import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { loadInspection } from "@/lib/inspection-access";
import { inspectionContent } from "@/lib/inspection-data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CONTACT_ROLES, INSPECTION_STATUSES, INSPECTION_TYPES } from "@/lib/options";
import { APP_NAME } from "@/lib/brand";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Inspection report" };

const R: Record<string, { t: string; c: string }> = {
  yes: { t: "Yes", c: "text-emerald-700" },
  no: { t: "No", c: "font-semibold text-rose-700" },
  na: { t: "N/A", c: "text-stone-400" },
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const found = await loadInspection(user, id);
  if (!found) notFound();
  const { inspection: i, property } = found;
  const [content, org, inspector, client, contacts] = await Promise.all([
    inspectionContent(id),
    db.query.organisations.findFirst({ where: eq(schema.organisations.id, i.orgId) }),
    i.inspectorId ? db.query.users.findFirst({ where: eq(schema.users.id, i.inspectorId) }) : null,
    property.clientId ? db.query.clients.findFirst({ where: eq(schema.clients.id, property.clientId) }) : null,
    db.query.contacts.findMany({ where: eq(schema.contacts.propertyId, property.id) }),
  ]);
  const brand = org?.brandColour ?? "#176f62";
  const issues = content.sections.flatMap((s) =>
    s.items.filter((it) => Object.values(it.ratings).includes("no")).map((it) => ({ section: s.name, item: it })),
  );

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between px-4">
        <Link href={`/inspections/${i.id}`} className="text-sm text-stone-600 hover:text-ink">← Back to inspection</Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none sm:p-12">
        <header className="flex items-start justify-between gap-6 border-b-4 pb-6" style={{ borderColor: brand }}>
          <div>
            <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: brand }}>{INSPECTION_TYPES[i.type]} inspection report</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{property.addressLine1}</h1>
            <p className="text-stone-600">{[property.addressLine2, property.suburb, property.city, property.province, property.postalCode].filter(Boolean).join(", ")}</p>
          </div>
          <div className="text-right text-sm">
            {org?.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/logo/${org.id}`} alt={org.name} className="ml-auto max-h-16 max-w-40 object-contain" />
            ) : (
              <p className="text-lg font-bold">{org?.name}</p>
            )}
            <p className="mt-2 text-stone-600">{org?.phone}</p>
            <p className="text-stone-600">{org?.email}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-4 py-6 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-stone-500">Carried out</dt><dd className="font-medium">{fmtDateTime(i.completedAt ?? i.startedAt ?? i.scheduledAt)}</dd></div>
          <div><dt className="text-xs text-stone-500">Inspector</dt><dd className="font-medium">{inspector?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-stone-500">Client</dt><dd className="font-medium">{client?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-stone-500">Status</dt><dd className="font-medium">{INSPECTION_STATUSES[i.status]}</dd></div>
          {i.reference && <div><dt className="text-xs text-stone-500">Reference</dt><dd className="font-medium">{i.reference}</dd></div>}
          {contacts.map((c) => (
            <div key={c.id}><dt className="text-xs text-stone-500">{CONTACT_ROLES[c.role]}</dt><dd className="font-medium">{c.name}</dd></div>
          ))}
        </dl>

        {(i.summary || issues.length > 0) && (
          <section className="mb-8 rounded-lg p-5" style={{ background: `${brand}10` }}>
            <h2 className="mb-2 font-bold">Summary</h2>
            {i.summary && <p className="text-sm whitespace-pre-wrap">{i.summary}</p>}
            {issues.length > 0 && (
              <>
                <p className="mt-3 text-sm font-semibold">{issues.length} item{issues.length > 1 ? "s" : ""} need attention</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {issues.map(({ section, item }) => (
                    <li key={item.id}>{section} › {item.name}{item.comment && `: ${item.comment}`}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {content.sections.map((s, si) => (
          <section key={s.id} className="mb-8 break-inside-avoid-page">
            <h2 className="mb-2 px-3 py-1.5 text-sm font-bold tracking-wide text-white uppercase" style={{ background: brand }}>
              {si + 1}. {s.name}
            </h2>
            {s.kind === "notes" ? (
              <p className="px-3 text-sm whitespace-pre-wrap">{s.notes || "No notes."}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-300 text-left text-xs text-stone-500">
                    <th className="w-10 py-1.5 pl-3">Ref</th>
                    <th className="py-1.5">Item</th>
                    {s.kind === "room" && i.checks.map((c) => <th key={c} className="w-20 py-1.5 text-center">{c}</th>)}
                    {s.kind === "checklist" && <th className="w-20 py-1.5 text-center">Answer</th>}
                    {(s.kind === "meters" || s.kind === "keys") && <th className="w-28 py-1.5">{s.kind === "meters" ? "Reading" : "Quantity"}</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((it, ii) => (
                    <tr key={it.id} className="break-inside-avoid border-b border-stone-100 align-top">
                      <td className="py-2 pl-3 text-stone-500">{si + 1}.{ii + 1}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{it.name}</p>
                        {it.description && <p className="text-stone-600">{it.description}</p>}
                        {it.comment && <p className="text-stone-700 italic">{it.comment}</p>}
                        {it.photos.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {it.photos.map((p) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={p.id} src={`/api/files/photo/${p.id}`} alt={it.name} className="h-28 w-36 rounded object-cover" />
                            ))}
                          </div>
                        )}
                      </td>
                      {s.kind === "room" &&
                        i.checks.map((c) => (
                          <td key={c} className={`py-2 text-center ${R[it.ratings[c]]?.c ?? "text-stone-300"}`}>{R[it.ratings[c]]?.t ?? "–"}</td>
                        ))}
                      {s.kind === "checklist" && <td className={`py-2 text-center ${R[it.ratings.Answer]?.c ?? "text-stone-300"}`}>{R[it.ratings.Answer]?.t ?? "–"}</td>}
                      {(s.kind === "meters" || s.kind === "keys") && <td className="py-2">{it.value || "–"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.kind !== "notes" && s.notes && <p className="mt-2 px-3 text-sm whitespace-pre-wrap">{s.notes}</p>}
          </section>
        ))}

        <section className="break-inside-avoid-page">
          <h2 className="mb-2 px-3 py-1.5 text-sm font-bold tracking-wide text-white uppercase" style={{ background: brand }}>Declaration</h2>
          <p className="px-3 text-sm text-stone-600">
            The people below confirm this report is a fair record of the property&apos;s condition on the date shown.
          </p>
          <div className="mt-4 grid gap-6 px-3 sm:grid-cols-2">
            {content.signatures.length === 0 && <p className="text-sm text-stone-400">Not signed yet.</p>}
            {content.signatures.map((s) => (
              <div key={s.id} className="border-t border-stone-300 pt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={`Signature of ${s.signerName}`} className="h-20 object-contain" />
                <p className="text-sm font-medium">{s.signerName} · {CONTACT_ROLES[s.signerRole]}</p>
                <p className="text-xs text-stone-500">Signed {fmtDateTime(s.signedAt)}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-stone-200 pt-3 text-xs text-stone-400">
          {org?.reportFooter ?? org?.name} · Generated {fmtDate(new Date())} with {APP_NAME}
        </footer>
      </article>
    </div>
  );
}
