import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, lte, notInArray, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect, canViewInspections, propertyScope } from "@/lib/permissions";
import { inspectorOptions } from "@/lib/lookups";
import { addressOneLine, fmtDateTime } from "@/lib/format";
import { INSPECTION_STATUSES, INSPECTION_TYPES, type InspectionStatus, type InspectionType } from "@/lib/options";
import { EmptyState, PageHeader } from "@/components/page-header";
import { InspectionStatusBadge } from "@/components/badges";

export const metadata = { title: "Inspections" };

type F = { status?: string; type?: string; inspector?: string; from?: string; to?: string; view?: string };

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<F> }) {
  const f = await searchParams;
  const user = await requireUser();
  if (!canViewInspections(user)) redirect("/");
  const i = schema.inspections;
  const where: SQL[] = [eq(i.orgId, user.orgId), propertyScope(user)];
  if (f.status && f.status in INSPECTION_STATUSES) where.push(eq(i.status, f.status as InspectionStatus));
  else if (!f.status) where.push(notInArray(i.status, ["closed", "cancelled"]));
  if (f.type && f.type in INSPECTION_TYPES) where.push(eq(i.type, f.type as InspectionType));
  if (f.inspector === "me") where.push(eq(i.inspectorId, user.id));
  else if (f.inspector) where.push(eq(i.inspectorId, f.inspector));
  if (f.from) where.push(gte(i.scheduledAt, new Date(`${f.from}T00:00:00+02:00`)));
  if (f.to) where.push(lte(i.scheduledAt, new Date(`${f.to}T23:59:59+02:00`)));

  const [rows, inspectors] = await Promise.all([
    db
      .select({ i, property: schema.properties, inspector: schema.users.name })
      .from(i)
      .innerJoin(schema.properties, eq(schema.properties.id, i.propertyId))
      .leftJoin(schema.users, eq(schema.users.id, i.inspectorId))
      .where(and(...where))
      .orderBy(f.status === "completed" || f.status === "closed" ? desc(i.scheduledAt) : asc(i.scheduledAt))
      .limit(300),
    inspectorOptions(user.orgId),
  ]);

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={f.status ? `${rows.length} ${INSPECTION_STATUSES[f.status as InspectionStatus]?.toLowerCase() ?? ""}` : `${rows.length} open`}
        actions={canInspect(user) && <Link href="/inspections/new" className="btn-primary"><Plus className="h-4 w-4" /> New inspection</Link>}
      />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6" method="get">
        <select name="status" defaultValue={f.status ?? ""} className="input">
          <option value="">All open</option>
          {Object.entries(INSPECTION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="type" defaultValue={f.type ?? ""} className="input">
          <option value="">All types</option>
          {Object.entries(INSPECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="inspector" defaultValue={f.inspector ?? ""} className="input">
          <option value="">Any inspector</option>
          <option value="me">Assigned to me</option>
          {inspectors.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input type="date" name="from" defaultValue={f.from} className="input" aria-label="From" />
        <input type="date" name="to" defaultValue={f.to} className="input" aria-label="To" />
        <div className="flex gap-2">
          <button className="btn-primary flex-1">Apply</button>
          <Link href="/inspections" className="btn-secondary">Reset</Link>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title="No inspections here"
          body="Schedule an inspection from a property or with the button above. It copies the rooms and items from the template you choose."
          action={canInspect(user) && <Link href="/inspections/new" className="btn-primary">New inspection</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>Property</th><th>Type</th><th>Inspector</th><th>Reference</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(({ i, property, inspector }) => (
                <tr key={i.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap"><Link href={`/inspections/${i.id}`} className="font-medium hover:text-brand-700 hover:underline">{fmtDateTime(i.scheduledAt)}</Link></td>
                  <td className="min-w-56"><Link href={`/inspections/${i.id}`} className="hover:underline">{addressOneLine(property)}</Link></td>
                  <td>{INSPECTION_TYPES[i.type]}</td>
                  <td className="text-stone-600">{inspector ?? "Unassigned"}</td>
                  <td className="text-stone-600">{i.reference ?? "—"}</td>
                  <td><InspectionStatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
