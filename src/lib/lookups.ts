import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { addressOneLine } from "./format";

export async function clientOptions(orgId: string) {
  const rows = await db.query.clients.findMany({ where: eq(schema.clients.orgId, orgId), orderBy: asc(schema.clients.name) });
  return rows.map((c) => ({ id: c.id, label: c.company ? `${c.name} (${c.company})` : c.name }));
}

export async function memberOptions(orgId: string, roles: (typeof schema.roleEnum.enumValues)[number][]) {
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.memberships.role, propertyId: schema.memberships.propertyId })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.role, roles), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));
  return rows;
}

export async function inspectorOptions(orgId: string) {
  return (await memberOptions(orgId, ["admin", "manager", "inspector"])).map((m) => ({ id: m.id, label: m.name }));
}

export async function propertyOptions(orgId: string) {
  const rows = await db.query.properties.findMany({
    where: and(eq(schema.properties.orgId, orgId), eq(schema.properties.archived, false)),
    orderBy: asc(schema.properties.addressLine1),
  });
  return rows.map((p) => ({ id: p.id, label: (p.reference ? `${p.reference} · ` : "") + addressOneLine(p) }));
}
