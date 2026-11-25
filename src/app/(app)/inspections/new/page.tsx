import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect } from "@/lib/permissions";
import { inspectorOptions, propertyOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { NewInspectionForm } from "./form";

export const metadata = { title: "New inspection" };

export default async function NewInspectionPage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const { property } = await searchParams;
  const user = await requireUser();
  if (!canInspect(user)) redirect("/inspections");
  const [properties, inspectors, templates] = await Promise.all([
    propertyOptions(user.orgId),
    inspectorOptions(user.orgId),
    db.query.templates.findMany({ where: eq(schema.templates.orgId, user.orgId), orderBy: asc(schema.templates.name) }),
  ]);
  return (
    <>
      <PageHeader title="New inspection" back={{ href: "/inspections", label: "Inspections" }} />
      <NewInspectionForm
        properties={properties}
        inspectors={inspectors}
        templates={templates.map((t) => ({ id: t.id, label: t.name }))}
        defaults={{ propertyId: property, inspectorId: user.role === "inspector" ? user.id : undefined }}
      />
    </>
  );
}
