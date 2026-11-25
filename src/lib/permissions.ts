import { and, eq, or, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import type { CurrentUser } from "./auth";

export const isAdmin = (u: CurrentUser) => u.role === "admin";
/** Can add and edit properties, clients and templates. */
export const canEditProperties = (u: CurrentUser) => u.role === "admin" || u.role === "manager";
/** Can schedule and carry out inspections. */
export const canInspect = (u: CurrentUser) => u.role === "admin" || u.role === "manager" || u.role === "inspector";
/** Can see inspections and reports. Every role can; portfolio managers are read-only. */
export const canViewInspections = (u: CurrentUser) => Boolean(u);
/** Can open the properties area. */
export const canViewProperties = (u: CurrentUser) => Boolean(u);

/** Managers and portfolio managers with a property set only see that property and its units. */
const unscoped = (u: CurrentUser) => u.role === "admin" || u.role === "inspector" || !u.propertyId;

/** WHERE clause limiting properties to those the user may see. */
export function propertyScope(u: CurrentUser): SQL {
  const org = eq(schema.properties.orgId, u.orgId);
  if (unscoped(u)) return org;
  return and(org, or(eq(schema.properties.id, u.propertyId!), eq(schema.properties.parentId, u.propertyId!)))!;
}

export function canSeeProperty(u: CurrentUser, p: { id: string; orgId: string; parentId: string | null }) {
  if (p.orgId !== u.orgId) return false;
  if (unscoped(u)) return true;
  return p.id === u.propertyId || p.parentId === u.propertyId;
}
