import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ClipboardPlus, Pencil } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties, canViewProperties, canInspect, canSeeProperty, canViewInspections } from "@/lib/permissions";
import { addressOneLine, fmtDate, isUuid } from "@/lib/format";
import { CONTACT_ROLES, INSPECTION_TYPES } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import { InspectionStatusBadge } from "@/components/badges";
import { addContact, archiveProperty, removeContact } from "../actions";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, id) });
  if (!property || !canViewProperties(user) || !canSeeProperty(user, property)) notFound();

  const [client, parent, units, contacts, inspections, inspector] = await Promise.all([
    property.clientId ? db.query.clients.findFirst({ where: eq(schema.clients.id, property.clientId) }) : null,
    property.parentId ? db.query.properties.findFirst({ where: eq(schema.properties.id, property.parentId) }) : null,
    db.query.properties.findMany({ where: and(eq(schema.properties.parentId, id), eq(schema.properties.archived, false)), orderBy: asc(schema.properties.addressLine1) }),
    db.query.contacts.findMany({ where: eq(schema.contacts.propertyId, id), orderBy: asc(schema.contacts.name) }),
    canViewInspections(user)
      ? db
          .select({ i: schema.inspections, inspector: schema.users.name })
          .from(schema.inspections)
          .leftJoin(schema.users, eq(schema.users.id, schema.inspections.inspectorId))
          .where(eq(schema.inspections.propertyId, id))
          .orderBy(desc(schema.inspections.scheduledAt))
      : [],
    property.defaultInspectorId ? db.query.users.findFirst({ where: eq(schema.users.id, property.defaultInspectorId) }) : null,
  ]);
  const canEdit = canEditProperties(user);

  const facts: [string, React.ReactNode][] = [
    ["Reference", property.reference],
    ["External ID", property.externalId],
    ["Client", client?.name],
    ["Default inspector", inspector?.name],
    ["Type", property.propertyType],
    ["Style", property.style],
    ["Furnishing", property.furnishing],
    ["Bedrooms", property.bedrooms],
    ["Bathrooms", property.bathrooms],
    ["Floors", property.floors],
    ["Units", property.units],
    ["Internal size", property.internalArea && `${property.internalArea} m²`],
    ["External size", property.externalArea && `${property.externalArea} m²`],
    [
      "Features",
      [property.hasGarage && "Garage", property.hasParking && "Parking", property.hasGarden && "Garden", property.hasPool && "Pool", property.hasElevator && "Lift"]
        .filter(Boolean)
        .join(", "),
    ],
  ];

  return (
    <>
      <PageHeader
        title={property.addressLine1}
        subtitle={
          <>
            {[property.addressLine2, property.suburb, property.city, property.province, property.postalCode].filter(Boolean).join(", ")}
            {parent && (
              <> · part of <Link className="text-brand-700 hover:underline" href={`/properties/${parent.id}`}>{parent.addressLine1}</Link></>
            )}
            {property.archived && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs">Archived</span>}
          </>
        }
        back={{ href: "/properties", label: "Properties" }}
        actions={
          <>
            {canInspect(user) && (
              <Link href={`/inspections/new?property=${id}`} className="btn-primary"><ClipboardPlus className="h-4 w-4" /> New inspection</Link>
            )}
            {canEdit && <Link href={`/properties/${id}/edit`} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</Link>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canViewInspections(user) && (
            <section className="card">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
                <h2 className="font-semibold">Inspections</h2>
              </div>
              {inspections.length === 0 ? (
                <p className="px-5 py-6 text-sm text-stone-500">No inspections yet.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {inspections.map(({ i, inspector }) => (
                    <li key={i.id}>
                      <Link href={`/inspections/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                        <div>
                          <p className="font-medium">{INSPECTION_TYPES[i.type]} inspection</p>
                          <p className="text-xs text-stone-500">{fmtDate(i.scheduledAt)} · {inspector ?? "Unassigned"}</p>
                        </div>
                        <InspectionStatusBadge status={i.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {units.length > 0 && (
            <section className="card">
              <h2 className="border-b border-stone-100 px-5 py-3 font-semibold">Units ({units.length})</h2>
              <ul className="divide-y divide-stone-100">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link href={`/properties/${u.id}`} className="block px-5 py-3 hover:bg-stone-50">
                      <span className="font-medium">{addressOneLine(u)}</span>
                      {u.reference && <span className="ml-2 text-xs text-stone-500">{u.reference}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {facts.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-stone-500">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {property.notes && <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm whitespace-pre-wrap text-stone-700">{property.notes}</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Contacts</h2>
            {contacts.length === 0 && <p className="text-sm text-stone-500">No contacts yet.</p>}
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{c.name} <span className="text-xs font-normal text-stone-500">· {CONTACT_ROLES[c.role]}</span></p>
                    <p className="text-xs text-stone-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                  {canEdit && (
                    <form action={removeContact}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-stone-400 hover:text-rose-600">Remove</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <form action={addContact} className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                <input type="hidden" name="propertyId" value={id} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="name" placeholder="Name" className="input" required />
                  <select name="role" className="input" defaultValue="tenant">
                    {Object.entries(CONTACT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="email" type="email" placeholder="Email" className="input" />
                  <input name="phone" placeholder="Phone" className="input" />
                </div>
                <button className="btn-secondary w-full">Add contact</button>
              </form>
            )}
          </section>

          {canEdit && (
            <form action={archiveProperty}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archived" value={property.archived ? "false" : "true"} />
              <button className="text-sm text-stone-500 hover:text-ink">{property.archived ? "Restore property" : "Archive property"}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
