import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";

const COOKIE = "wr_session";
const SESSION_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, orgId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(schema.sessions).values({ id: hash(token), userId, orgId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hash(token)));
  jar.delete(COOKIE);
}

export type Role = (typeof schema.roleEnum.enumValues)[number];
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  orgId: string;
  orgName: string;
  role: Role;
  /** The property ("facility") a scoped role is limited to. */
  propertyId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      orgId: schema.sessions.orgId,
      orgName: schema.organisations.name,
      role: schema.memberships.role,
      propertyId: schema.memberships.propertyId,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.organisations, eq(schema.organisations.id, schema.sessions.orgId))
    .innerJoin(
      schema.memberships,
      and(eq(schema.memberships.userId, schema.users.id), eq(schema.memberships.orgId, schema.sessions.orgId)),
    )
    .where(
      and(
        eq(schema.sessions.id, hash(token)),
        gt(schema.sessions.expiresAt, new Date()),
        eq(schema.users.active, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Use in pages and server actions that need a signed-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Only an administrator can do this.");
  return user;
}

export { hash as hashToken };
