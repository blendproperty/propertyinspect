import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { clientOptions, inspectorOptions, propertyOptions } from "@/lib/lookups";
import { addressOneLine, isUuid } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { PropertyForm } from "../../property-form";

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  if (!canEditProperties(user)) redirect(`/properties/${id}`);
  const property = await db.query.properties.findFirst({
    where: and(eq(schema.properties.id, id), eq(schema.properties.orgId, user.orgId)),
  });
  if (!property) notFound();
  const [clients, inspectors, parents] = await Promise.all([
    clientOptions(user.orgId),
    inspectorOptions(user.orgId),
    propertyOptions(user.orgId),
  ]);
  return (
    <>
      <PageHeader title="Edit property" subtitle={addressOneLine(property)} back={{ href: `/properties/${id}`, label: "Back to property" }} />
      <PropertyForm property={property} clients={clients} inspectors={inspectors} parents={parents.filter((p) => p.id !== id)} />
    </>
  );
}
