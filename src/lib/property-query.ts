import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";
import { propertyScope } from "./permissions";

export type PropertyFilters = {
  q?: string;
  client?: string;
  type?: string;
  furnishing?: string;
  bedrooms?: string;
  units?: string; // "1" includes units inside buildings
  archived?: string;
  sort?: string;
};

const p = schema.properties;

export async function listProperties(user: CurrentUser, f: PropertyFilters) {
  const where: SQL[] = [propertyScope(user), eq(p.archived, f.archived === "1")];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(p.addressLine1, like),
        ilike(p.addressLine2, like),
        ilike(p.suburb, like),
        ilike(p.city, like),
        ilike(p.reference, like),
        ilike(p.externalId, like),
        ilike(p.postalCode, like),
      )!,
    );
  }
  if (f.client) where.push(eq(p.clientId, f.client));
  if (f.type) where.push(eq(p.propertyType, f.type));
  if (f.furnishing) where.push(eq(p.furnishing, f.furnishing));
  if (f.bedrooms) {
    const n = Number.parseInt(f.bedrooms, 10);
    if (Number.isFinite(n)) where.push(n >= 5 ? sql`${p.bedrooms} >= 5` : eq(p.bedrooms, n));
  }
  if (f.units !== "1") where.push(isNull(p.parentId));

  const lastInspection = sql<Date | null>`(
    select max(coalesce(i.completed_at, i.scheduled_at)) from inspections i
    where i.property_id = ${p.id} and i.status in ('completed','closed')
  )`;
  const unitCount = sql<number>`(select count(*)::int from properties c where c.parent_id = ${p.id} and c.archived = false)`;

  const order =
    f.sort === "last_inspected"
      ? [sql`${lastInspection} asc nulls first`]
      : f.sort === "newest"
        ? [desc(p.createdAt)]
        : f.sort === "reference"
          ? [asc(p.reference), asc(p.addressLine1)]
          : [asc(p.addressLine1)];

  return db
    .select({
      property: p,
      clientName: schema.clients.name,
      parentAddress: sql<string | null>`(select pp.address_line1 from properties pp where pp.id = ${p.parentId})`,
      lastInspection,
      unitCount,
    })
    .from(p)
    .leftJoin(schema.clients, eq(schema.clients.id, p.clientId))
    .where(and(...where))
    .orderBy(...order)
    .limit(500);
}
