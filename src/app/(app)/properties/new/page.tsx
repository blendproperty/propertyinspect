import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { clientOptions, inspectorOptions, propertyOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { PropertyForm } from "../property-form";

export const metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const user = await requireUser();
  if (!canEditProperties(user)) redirect("/properties");
  const [clients, inspectors, parents] = await Promise.all([
    clientOptions(user.orgId),
    inspectorOptions(user.orgId),
    propertyOptions(user.orgId),
  ]);
  return (
    <>
      <PageHeader title="Add property" back={{ href: "/properties", label: "Properties" }} />
      <PropertyForm clients={clients} inspectors={inspectors} parents={parents} />
    </>
  );
}
