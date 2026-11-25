"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { isUuid, str } from "@/lib/format";

async function editor() {
  const user = await requireUser();
  if (!canEditProperties(user)) throw new Error("Only managers and administrators can edit templates.");
  return user;
}
async function ownTemplate(orgId: string, id: unknown) {
  if (!isUuid(id)) throw new Error("Not found");
  const t = await db.query.templates.findFirst({ where: and(eq(schema.templates.id, id), eq(schema.templates.orgId, orgId)) });
  if (!t) throw new Error("Not found");
  return t;
}
async function ownSection(orgId: string, id: unknown) {
  if (!isUuid(id)) throw new Error("Not found");
  const s = await db.query.templateSections.findFirst({ where: eq(schema.templateSections.id, id) });
  if (!s) throw new Error("Not found");
  await ownTemplate(orgId, s.templateId);
  return s;
}

export async function createTemplate(fd: FormData) {
  const user = await editor();
  const name = str(fd, "name") ?? "New template";
  const [t] = await db.insert(schema.templates).values({ orgId: user.orgId, name }).returning();
  redirect(`/templates/${t.id}`);
}

export async function duplicateTemplate(fd: FormData) {
  const user = await editor();
  const src = await ownTemplate(user.orgId, fd.get("id"));
  const id = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.templates)
      .values({ orgId: user.orgId, name: `${src.name} (copy)`, description: src.description, checks: src.checks })
      .returning();
    const secs = await tx.query.templateSections.findMany({ where: eq(schema.templateSections.templateId, src.id), orderBy: asc(schema.templateSections.position) });
    const items = secs.length ? await tx.query.templateItems.findMany({ where: inArray(schema.templateItems.sectionId, secs.map((s) => s.id)) }) : [];
    for (const s of secs) {
      const [ns] = await tx.insert(schema.templateSections).values({ templateId: t.id, name: s.name, kind: s.kind, position: s.position }).returning();
      const its = items.filter((i) => i.sectionId === s.id);
      if (its.length) await tx.insert(schema.templateItems).values(its.map((i) => ({ sectionId: ns.id, name: i.name, position: i.position })));
    }
    return t.id;
  });
  redirect(`/templates/${id}`);
}

export async function deleteTemplate(fd: FormData) {
  const user = await editor();
  const t = await ownTemplate(user.orgId, fd.get("id"));
  await db.delete(schema.templates).where(eq(schema.templates.id, t.id));
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(fd: FormData) {
  const user = await editor();
  const t = await ownTemplate(user.orgId, fd.get("id"));
  const checks = String(fd.get("checks") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 5);
  await db
    .update(schema.templates)
    .set({ name: str(fd, "name") ?? t.name, description: str(fd, "description"), checks: checks.length ? checks : t.checks })
    .where(eq(schema.templates.id, t.id));
  revalidatePath(`/templates/${t.id}`);
}

export async function addTemplateSection(fd: FormData) {
  const user = await editor();
  const t = await ownTemplate(user.orgId, fd.get("templateId"));
  const name = str(fd, "name");
  const kind = (str(fd, "kind") ?? "room") as (typeof schema.sectionKindEnum.enumValues)[number];
  if (!name || !schema.sectionKindEnum.enumValues.includes(kind)) return;
  const [{ pos }] = await db.select({ pos: max(schema.templateSections.position) }).from(schema.templateSections).where(eq(schema.templateSections.templateId, t.id));
  await db.insert(schema.templateSections).values({ templateId: t.id, name, kind, position: (pos ?? -1) + 1 });
  revalidatePath(`/templates/${t.id}`);
}

export async function renameTemplateSection(fd: FormData) {
  const user = await editor();
  const s = await ownSection(user.orgId, fd.get("sectionId"));
  const name = str(fd, "name");
  if (name) await db.update(schema.templateSections).set({ name }).where(eq(schema.templateSections.id, s.id));
  revalidatePath(`/templates/${s.templateId}`);
}

export async function removeTemplateSection(fd: FormData) {
  const user = await editor();
  const s = await ownSection(user.orgId, fd.get("sectionId"));
  await db.delete(schema.templateSections).where(eq(schema.templateSections.id, s.id));
  revalidatePath(`/templates/${s.templateId}`);
}

export async function moveTemplateSection(fd: FormData) {
  const user = await editor();
  const s = await ownSection(user.orgId, fd.get("sectionId"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const all = await db.query.templateSections.findMany({ where: eq(schema.templateSections.templateId, s.templateId), orderBy: asc(schema.templateSections.position) });
  const idx = all.findIndex((x) => x.id === s.id);
  const other = all[idx + dir];
  if (!other) return;
  // Re-number everything so positions stay unique.
  const order = [...all];
  [order[idx], order[idx + dir]] = [order[idx + dir], order[idx]];
  await db.transaction(async (tx) => {
    for (const [i, x] of order.entries()) await tx.update(schema.templateSections).set({ position: i }).where(eq(schema.templateSections.id, x.id));
  });
  revalidatePath(`/templates/${s.templateId}`);
}

export async function addTemplateItem(fd: FormData) {
  const user = await editor();
  const s = await ownSection(user.orgId, fd.get("sectionId"));
  // Allow pasting several items at once, one per line or comma-separated.
  const names = String(fd.get("name") ?? "")
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!names.length) return;
  const [{ pos }] = await db.select({ pos: max(schema.templateItems.position) }).from(schema.templateItems).where(eq(schema.templateItems.sectionId, s.id));
  await db.insert(schema.templateItems).values(names.map((name, i) => ({ sectionId: s.id, name, position: (pos ?? -1) + 1 + i })));
  revalidatePath(`/templates/${s.templateId}`);
}

export async function removeTemplateItem(fd: FormData) {
  const user = await editor();
  const id = fd.get("itemId");
  if (!isUuid(id)) return;
  const item = await db.query.templateItems.findFirst({ where: eq(schema.templateItems.id, id) });
  if (!item) return;
  const s = await ownSection(user.orgId, item.sectionId);
  await db.delete(schema.templateItems).where(eq(schema.templateItems.id, id));
  revalidatePath(`/templates/${s.templateId}`);
}
