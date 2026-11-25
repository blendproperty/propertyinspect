"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashToken, requireAdmin, requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { isUuid, str } from "@/lib/format";
import { SCOPED_ROLES, type RoleKey } from "@/lib/options";
import { checkImage, saveFile } from "@/lib/storage";

export type FormState = { error?: string; ok?: string; inviteLink?: string } | undefined;

/* ---------- Clients ---------- */

export async function saveClient(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditProperties(user)) return { error: "Not allowed." };
  const name = str(fd, "name");
  if (!name) return { error: "Enter a name." };
  const values = { name, company: str(fd, "company"), email: str(fd, "email"), phone: str(fd, "phone"), notes: str(fd, "notes") };
  const id = str(fd, "id");
  if (id && isUuid(id)) await db.update(schema.clients).set(values).where(and(eq(schema.clients.id, id), eq(schema.clients.orgId, user.orgId)));
  else await db.insert(schema.clients).values({ ...values, orgId: user.orgId });
  revalidatePath("/clients");
  return { ok: "Saved." };
}

export async function deleteClient(fd: FormData) {
  const user = await requireUser();
  if (!canEditProperties(user)) return;
  const id = fd.get("id");
  if (!isUuid(id)) return;
  await db.delete(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.orgId, user.orgId)));
  revalidatePath("/clients");
}

/* ---------- People ---------- */

const memberSchema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().optional(),
  role: z.enum(schema.roleEnum.enumValues),
  propertyId: z.string().optional(),
});

async function inviteLinkFor(userId: string) {
  const token = randomBytes(24).toString("base64url");
  await db
    .update(schema.users)
    .set({ inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + 7 * 864e5) })
    .where(eq(schema.users.id, userId));
  return `/invite/${token}`;
}

async function validProperty(orgId: string, role: RoleKey, propertyId?: string) {
  // Only managers can be limited to a property; empty means all properties.
  if (!SCOPED_ROLES.includes(role) || !propertyId) return { ok: true as const, propertyId: null };
  if (!isUuid(propertyId)) return { ok: false as const, error: "Choose a valid property." };
  const p = await db.query.properties.findFirst({ where: and(eq(schema.properties.id, propertyId), eq(schema.properties.orgId, orgId)) });
  return p ? { ok: true as const, propertyId: p.id } : { ok: false as const, error: "Choose a valid property." };
}

export async function inviteMember(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = memberSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, role, propertyId } = parsed.data;
  const prop = await validProperty(admin.orgId, role, propertyId);
  if (!prop.ok) return { error: prop.error };

  let user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (user) {
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, admin.orgId)) });
    if (m) return { error: "That person is already in your team. Edit them in the list below." };
    return { error: "That email belongs to another workspace." };
  }
  [user] = await db.insert(schema.users).values({ name, email, phone: phone || null }).returning();
  await db.insert(schema.memberships).values({ orgId: admin.orgId, userId: user.id, role, propertyId: prop.propertyId });
  const link = await inviteLinkFor(user.id);
  revalidatePath("/team");
  return { ok: `${name} added. Send them this link to set their password (valid 7 days):`, inviteLink: link };
}

export async function updateMember(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = fd.get("userId");
  if (!isUuid(userId)) return { error: "Not found." };
  const role = String(fd.get("role")) as RoleKey;
  if (!schema.roleEnum.enumValues.includes(role)) return { error: "Choose a role." };
  if (userId === admin.id && role !== "admin") return { error: "You can't remove your own administrator role." };
  const prop = await validProperty(admin.orgId, role, String(fd.get("propertyId") ?? ""));
  if (!prop.ok) return { error: prop.error };
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, userId), eq(schema.memberships.orgId, admin.orgId)) });
  if (!m) return { error: "Not found." };
  await db.update(schema.memberships).set({ role, propertyId: prop.propertyId }).where(eq(schema.memberships.id, m.id));
  const active = fd.get("active") === "on";
  if (userId !== admin.id) {
    await db.update(schema.users).set({ active }).where(eq(schema.users.id, userId));
    if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }
  revalidatePath("/team");
  return { ok: "Saved." };
}

export async function resendInvite(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = fd.get("userId");
  if (!isUuid(userId)) return { error: "Not found." };
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, userId), eq(schema.memberships.orgId, admin.orgId)) });
  if (!m) return { error: "Not found." };
  return { ok: "New link (valid 7 days). It also works as a password reset:", inviteLink: await inviteLinkFor(userId) };
}

/* ---------- Settings ---------- */

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "Enter the company name." };
  const colour = str(fd, "brandColour") ?? "#176f62";
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return { error: "Choose a valid colour." };
  const set: Partial<typeof schema.organisations.$inferInsert> = {
    name,
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    website: str(fd, "website"),
    reportFooter: str(fd, "reportFooter"),
    brandColour: colour,
  };
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const bad = checkImage(logo);
    if (bad) return { error: bad };
    set.logoPath = await saveFile(`${admin.orgId}/branding`, Buffer.from(await logo.arrayBuffer()), logo.type);
  }
  if (fd.get("removeLogo") === "on") set.logoPath = null;
  await db.update(schema.organisations).set(set).where(eq(schema.organisations.id, admin.orgId));
  revalidatePath("/settings");
  return { ok: "Settings saved." };
}
