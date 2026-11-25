"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, hashToken } from "@/lib/auth";
import { seedStarterTemplates } from "@/lib/starter-templates";

export type FormState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  company: z.string().trim().min(1, "Enter your company name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, company, email, password } = parsed.data;

  // Open sign-up only creates the first administrator. Everyone else is invited.
  const anyUser = await db.query.users.findFirst();
  if (anyUser) return { error: "This workspace is already set up. Ask an administrator to invite you." };

  const passwordHash = await bcrypt.hash(password, 12);
  const { userId, orgId } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organisations).values({ name: company, email }).returning();
    const [user] = await tx.insert(schema.users).values({ name, email, passwordHash }).returning();
    await tx.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "admin" });
    await seedStarterTemplates(tx, org.id);
    return { userId: user.id, orgId: org.id };
  });
  await createSession(userId, orgId);
  redirect("/");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !user.active || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }
  const membership = await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, user.id) });
  if (!membership) return { error: "This account isn't linked to a company yet." };
  await createSession(user.id, membership.orgId);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const acceptSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function acceptInvite(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.query.users.findFirst({
    where: eq(schema.users.inviteTokenHash, hashToken(parsed.data.token)),
  });
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    return { error: "This invite link has expired. Ask for a new one." };
  }
  const membership = await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, user.id) });
  if (!membership) return { error: "This invite is no longer valid." };
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.password, 12), inviteTokenHash: null, inviteExpiresAt: null })
    .where(eq(schema.users.id, user.id));
  await createSession(user.id, membership.orgId);
  redirect("/");
}
