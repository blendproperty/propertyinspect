import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";
import { canInspect, canSeeProperty, canViewInspections } from "./permissions";
import { isUuid } from "./format";

/** Loads an inspection the user may view (or edit, with write=true). Returns null otherwise. */
export async function loadInspection(user: CurrentUser, id: string, write = false) {
  if (!isUuid(id)) return null;
  if (!(write ? canInspect(user) : canViewInspections(user))) return null;
  const inspection = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, id) });
  if (!inspection || inspection.orgId !== user.orgId) return null;
  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, inspection.propertyId) });
  if (!property || !canSeeProperty(user, property)) return null;
  return { inspection, property };
}

export const isLocked = (status: string) => status === "closed" || status === "cancelled";
