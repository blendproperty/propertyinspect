"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect, canSeeProperty } from "@/lib/permissions";
import { isUuid, str } from "@/lib/format";
import { isLocked, loadInspection } from "@/lib/inspection-access";
import { checkImage, deleteStored, saveFile } from "@/lib/storage";
import type { InspectionStatus } from "@/lib/options";

export type FormState = { error?: string } | undefined;
type Rating = "yes" | "no" | "na";
/** Rating key used by checklist items. */
const ANSWER = "Answer";

export async function createInspection(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canInspect(user)) return { error: "You don't have permission to schedule inspections." };
  const propertyId = str(fd, "propertyId");
  const templateId = str(fd, "templateId");
  const inspectorId = str(fd, "inspectorId");
  const type = str(fd, "type") as (typeof schema.inspectionTypeEnum.enumValues)[number] | null;
  const when = str(fd, "scheduledAt");
  if (!isUuid(propertyId)) return { error: "Choose a property." };
  if (!type || !schema.inspectionTypeEnum.enumValues.includes(type)) return { error: "Choose an inspection type." };

  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, propertyId) });
  if (!property || !canSeeProperty(user, property)) return { error: "Choose a property." };
  const template = templateId
    ? await db.query.templates.findFirst({ where: and(eq(schema.templates.id, templateId), eq(schema.templates.orgId, user.orgId)) })
    : null;
  if (templateId && !template) return { error: "Choose a valid template." };
  if (
    inspectorId &&
    !(await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, inspectorId), eq(schema.memberships.orgId, user.orgId)) }))
  )
    return { error: "Choose a valid inspector." };

  // Africa/Johannesburg has no DST, so a fixed +02:00 offset is safe for datetime-local input.
  const scheduledAt = when ? new Date(`${when}:00+02:00`) : new Date();
  if (Number.isNaN(scheduledAt.getTime())) return { error: "Enter a valid date and time." };

  const id = await db.transaction(async (tx) => {
    const [insp] = await tx
      .insert(schema.inspections)
      .values({
        orgId: user.orgId,
        propertyId,
        templateId: template?.id ?? null,
        inspectorId: inspectorId ?? property.defaultInspectorId ?? null,
        type,
        reference: str(fd, "reference"),
        scheduledAt,
        checks: template?.checks ?? ["Clean", "Undamaged", "Working"],
      })
      .returning();
    if (template) {
      const sections = await tx.query.templateSections.findMany({
        where: eq(schema.templateSections.templateId, template.id),
        orderBy: asc(schema.templateSections.position),
      });
      const items = sections.length
        ? await tx.query.templateItems.findMany({
            where: inArray(schema.templateItems.sectionId, sections.map((s) => s.id)),
            orderBy: asc(schema.templateItems.position),
          })
        : [];
      for (const s of sections) {
        const [sec] = await tx
          .insert(schema.inspectionSections)
          .values({ inspectionId: insp.id, name: s.name, kind: s.kind, position: s.position })
          .returning();
        const its = items.filter((i) => i.sectionId === s.id);
        if (its.length)
          await tx.insert(schema.inspectionItems).values(its.map((i) => ({ sectionId: sec.id, name: i.name, position: i.position })));
      }
    }
    return insp.id;
  });
  revalidatePath("/inspections");
  redirect(`/inspections/${id}`);
}

const NEXT: Record<InspectionStatus, InspectionStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["in_review", "completed", "cancelled"],
  in_review: ["in_progress", "completed"],
  completed: ["in_progress", "closed"],
  closed: ["completed"],
  cancelled: ["scheduled"],
};

export async function setInspectionStatus(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const to = String(fd.get("status")) as InspectionStatus;
  const found = await loadInspection(user, id, true);
  if (!found) throw new Error("Inspection not found");
  if (!NEXT[found.inspection.status]?.includes(to)) throw new Error("That status change isn't allowed.");
  const managerOnly = to === "closed" || found.inspection.status === "closed" || found.inspection.status === "in_review";
  if (managerOnly && user.role === "inspector")
    throw new Error("Only a manager or administrator can approve, close or reopen an inspection.");
  await db
    .update(schema.inspections)
    .set({
      status: to,
      startedAt: to === "in_progress" && !found.inspection.startedAt ? new Date() : undefined,
      completedAt: to === "completed" ? new Date() : undefined,
    })
    .where(eq(schema.inspections.id, id));
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
}

async function itemContext(itemId: string) {
  const user = await requireUser();
  if (!isUuid(itemId)) throw new Error("Not found");
  const row = await db
    .select({ item: schema.inspectionItems, section: schema.inspectionSections })
    .from(schema.inspectionItems)
    .innerJoin(schema.inspectionSections, eq(schema.inspectionSections.id, schema.inspectionItems.sectionId))
    .where(eq(schema.inspectionItems.id, itemId))
    .limit(1);
  if (!row[0]) throw new Error("Not found");
  const found = await loadInspection(user, row[0].section.inspectionId, true);
  if (!found || isLocked(found.inspection.status)) throw new Error("This inspection can't be edited.");
  return { user, ...row[0], ...found };
}

export async function updateItem(
  itemId: string,
  patch: { ratings?: Record<string, Rating | null>; description?: string; comment?: string; value?: string },
) {
  const { inspection } = await itemContext(itemId);
  const set: Record<string, unknown> = {};
  if (patch.ratings) {
    const allowed = [...inspection.checks, ANSWER];
    const add: Record<string, Rating> = {};
    const remove: string[] = [];
    for (const [check, value] of Object.entries(patch.ratings)) {
      if (!allowed.includes(check)) throw new Error("Unknown check");
      if (value === null) remove.push(check);
      else if (value === "yes" || value === "no" || value === "na") add[check] = value;
      else throw new Error("Invalid rating");
    }
    // Merge in SQL so concurrent taps on different checks can't overwrite each other.
    set.ratings = sql`(${schema.inspectionItems.ratings} - array(select jsonb_array_elements_text(${JSON.stringify(remove)}::jsonb))) || ${JSON.stringify(add)}::jsonb`;
  }
  if (typeof patch.description === "string") set.description = patch.description.slice(0, 2000);
  if (typeof patch.comment === "string") set.comment = patch.comment.slice(0, 4000);
  if (typeof patch.value === "string") set.value = patch.value.slice(0, 200);
  if (Object.keys(set).length) await db.update(schema.inspectionItems).set(set).where(eq(schema.inspectionItems.id, itemId));
  if (inspection.status === "scheduled")
    await db.update(schema.inspections).set({ status: "in_progress", startedAt: new Date() }).where(eq(schema.inspections.id, inspection.id));
}

export async function updateSectionNotes(sectionId: string, notes: string) {
  const user = await requireUser();
  if (!isUuid(sectionId)) throw new Error("Not found");
  const sec = await db.query.inspectionSections.findFirst({ where: eq(schema.inspectionSections.id, sectionId) });
  const found = sec && (await loadInspection(user, sec.inspectionId, true));
  if (!sec || !found || isLocked(found.inspection.status)) throw new Error("Not found");
  await db.update(schema.inspectionSections).set({ notes: notes.slice(0, 8000) }).where(eq(schema.inspectionSections.id, sectionId));
}

export async function addSection(fd: FormData) {
  const user = await requireUser();
  const inspectionId = String(fd.get("inspectionId"));
  const name = str(fd, "name");
  const kind = (str(fd, "kind") ?? "room") as (typeof schema.sectionKindEnum.enumValues)[number];
  const found = await loadInspection(user, inspectionId, true);
  if (!found || isLocked(found.inspection.status) || !name || !schema.sectionKindEnum.enumValues.includes(kind)) return;
  const [{ pos }] = await db
    .select({ pos: max(schema.inspectionSections.position) })
    .from(schema.inspectionSections)
    .where(eq(schema.inspectionSections.inspectionId, inspectionId));
  await db.insert(schema.inspectionSections).values({ inspectionId, name, kind, position: (pos ?? -1) + 1 });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function addItem(fd: FormData) {
  const user = await requireUser();
  const sectionId = String(fd.get("sectionId"));
  const name = str(fd, "name");
  if (!isUuid(sectionId) || !name) return;
  const sec = await db.query.inspectionSections.findFirst({ where: eq(schema.inspectionSections.id, sectionId) });
  const found = sec && (await loadInspection(user, sec.inspectionId, true));
  if (!sec || !found || isLocked(found.inspection.status)) return;
  const [{ pos }] = await db
    .select({ pos: max(schema.inspectionItems.position) })
    .from(schema.inspectionItems)
    .where(eq(schema.inspectionItems.sectionId, sectionId));
  await db.insert(schema.inspectionItems).values({ sectionId, name, position: (pos ?? -1) + 1 });
  revalidatePath(`/inspections/${sec.inspectionId}`);
}

export async function removeItem(fd: FormData) {
  const itemId = String(fd.get("itemId"));
  const { inspection } = await itemContext(itemId);
  await db.delete(schema.inspectionItems).where(eq(schema.inspectionItems.id, itemId));
  revalidatePath(`/inspections/${inspection.id}`);
}

export async function uploadPhoto(fd: FormData): Promise<{ error?: string; id?: string }> {
  const itemId = String(fd.get("itemId"));
  const file = fd.get("file");
  const bad = checkImage(file);
  if (bad) return { error: bad };
  const { user, inspection } = await itemContext(itemId);
  const f = file as File;
  const path = await saveFile(`${user.orgId}/inspections/${inspection.id}`, Buffer.from(await f.arrayBuffer()), f.type);
  const [row] = await db
    .insert(schema.photos)
    .values({ orgId: user.orgId, inspectionId: inspection.id, itemId, path, mimeType: f.type })
    .returning({ id: schema.photos.id });
  revalidatePath(`/inspections/${inspection.id}`);
  return { id: row.id };
}

export async function deletePhoto(photoId: string) {
  const user = await requireUser();
  if (!isUuid(photoId)) return;
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
  if (!photo) return;
  const found = await loadInspection(user, photo.inspectionId, true);
  if (!found || isLocked(found.inspection.status)) return;
  await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
  await deleteStored(photo.path);
  revalidatePath(`/inspections/${photo.inspectionId}`);
}

export async function addSignature(fd: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const inspectionId = String(fd.get("inspectionId"));
  const signerName = str(fd, "signerName");
  const signerRole = (str(fd, "signerRole") ?? "tenant") as (typeof schema.contactRoleEnum.enumValues)[number];
  const image = String(fd.get("image") ?? "");
  const found = await loadInspection(user, inspectionId, true);
  if (!found || isLocked(found.inspection.status)) return { error: "This inspection can't be signed." };
  if (!signerName) return { error: "Enter the signer's name." };
  if (!schema.contactRoleEnum.enumValues.includes(signerRole)) return { error: "Choose a role." };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 400_000) return { error: "Draw a signature first." };
  await db.insert(schema.signatures).values({ inspectionId, signerName, signerRole, image });
  revalidatePath(`/inspections/${inspectionId}`);
  return {};
}

export async function removeSignature(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  if (!isUuid(id)) return;
  const sig = await db.query.signatures.findFirst({ where: eq(schema.signatures.id, id) });
  const found = sig && (await loadInspection(user, sig.inspectionId, true));
  if (!sig || !found || isLocked(found.inspection.status)) return;
  await db.delete(schema.signatures).where(eq(schema.signatures.id, id));
  revalidatePath(`/inspections/${sig.inspectionId}`);
}

export async function saveSummary(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const found = await loadInspection(user, id, true);
  if (!found || isLocked(found.inspection.status)) return;
  await db.update(schema.inspections).set({ summary: str(fd, "summary") }).where(eq(schema.inspections.id, id));
  revalidatePath(`/inspections/${id}`);
}
