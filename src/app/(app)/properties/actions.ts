"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { bool, int, str } from "@/lib/format";

export type PropertyFormState = { error?: string } | undefined;

async function values(fd: FormData, orgId: string) {
  const addressLine1 = str(fd, "addressLine1");
  const city = str(fd, "city");
  if (!addressLine1 || !city) return { error: "Address line 1 and city are required." } as const;

  // Only accept related records that belong to this organisation.
  const clientId = str(fd, "clientId");
  if (clientId && !(await db.query.clients.findFirst({ where: and(eq(schema.clients.id, clientId), eq(schema.clients.orgId, orgId)) })))
    return { error: "Choose a valid client." } as const;
  const parentId = str(fd, "parentId");
  if (parentId && !(await db.query.properties.findFirst({ where: and(eq(schema.properties.id, parentId), eq(schema.properties.orgId, orgId)) })))
    return { error: "Choose a valid parent property." } as const;
  const defaultInspectorId = str(fd, "defaultInspectorId");
  if (
    defaultInspectorId &&
    !(await db.query.memberships.findFirst({
      where: and(eq(schema.memberships.userId, defaultInspectorId), eq(schema.memberships.orgId, orgId)),
    }))
  )
    return { error: "Choose a valid inspector." } as const;

  return {
    data: {
      addressLine1,
      addressLine2: str(fd, "addressLine2"),
      suburb: str(fd, "suburb"),
      city,
      province: str(fd, "province"),
      postalCode: str(fd, "postalCode"),
      country: str(fd, "country") ?? "South Africa",
      reference: str(fd, "reference"),
      externalId: str(fd, "externalId"),
      clientId,
      parentId,
      defaultInspectorId,
      propertyType: str(fd, "propertyType"),
      style: str(fd, "style"),
      furnishing: str(fd, "furnishing"),
      bedrooms: int(fd, "bedrooms"),
      bathrooms: int(fd, "bathrooms"),
      floors: int(fd, "floors"),
      units: int(fd, "units"),
      internalArea: str(fd, "internalArea"),
      externalArea: str(fd, "externalArea"),
      hasElevator: bool(fd, "hasElevator"),
      hasGarage: bool(fd, "hasGarage"),
      hasParking: bool(fd, "hasParking"),
      hasGarden: bool(fd, "hasGarden"),
      hasPool: bool(fd, "hasPool"),
      notes: str(fd, "notes"),
    },
  } as const;
}

export async function saveProperty(_: PropertyFormState, fd: FormData): Promise<PropertyFormState> {
  const user = await requireUser();
  if (!canEditProperties(user)) return { error: "You don't have permission to edit properties." };
  const v = await values(fd, user.orgId);
  if ("error" in v) return { error: v.error };
  const id = str(fd, "id");
  if (id) {
    if (v.data.parentId === id) return { error: "A property can't be its own parent." };
    const res = await db
      .update(schema.properties)
      .set(v.data)
      .where(and(eq(schema.properties.id, id), eq(schema.properties.orgId, user.orgId)))
      .returning({ id: schema.properties.id });
    if (!res.length) return { error: "Property not found." };
    revalidatePath("/properties");
    redirect(`/properties/${id}`);
  }
  const [row] = await db
    .insert(schema.properties)
    .values({ ...v.data, orgId: user.orgId })
    .returning({ id: schema.properties.id });
  revalidatePath("/properties");
  redirect(`/properties/${row.id}`);
}

export async function archiveProperty(fd: FormData) {
  const user = await requireUser();
  if (!canEditProperties(user)) throw new Error("Not allowed");
  const id = String(fd.get("id"));
  const archived = fd.get("archived") === "true";
  await db
    .update(schema.properties)
    .set({ archived })
    .where(and(eq(schema.properties.id, id), eq(schema.properties.orgId, user.orgId)));
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
}

export async function addContact(fd: FormData) {
  const user = await requireUser();
  if (!canEditProperties(user)) throw new Error("Not allowed");
  const propertyId = String(fd.get("propertyId"));
  const name = str(fd, "name");
  const role = (str(fd, "role") ?? "tenant") as (typeof schema.contactRoleEnum.enumValues)[number];
  if (!name || !schema.contactRoleEnum.enumValues.includes(role)) return;
  const prop = await db.query.properties.findFirst({
    where: and(eq(schema.properties.id, propertyId), eq(schema.properties.orgId, user.orgId)),
  });
  if (!prop) return;
  await db.insert(schema.contacts).values({
    orgId: user.orgId,
    propertyId,
    name,
    role,
    email: str(fd, "email"),
    phone: str(fd, "phone"),
  });
  revalidatePath(`/properties/${propertyId}`);
}

export async function removeContact(fd: FormData) {
  const user = await requireUser();
  if (!canEditProperties(user)) throw new Error("Not allowed");
  const id = String(fd.get("id"));
  const [row] = await db
    .delete(schema.contacts)
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.orgId, user.orgId)))
    .returning();
  if (row?.propertyId) revalidatePath(`/properties/${row.propertyId}`);
}
