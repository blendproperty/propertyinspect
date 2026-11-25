import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canEditProperties, canViewProperties } from "@/lib/permissions";
import { clientOptions } from "@/lib/lookups";
import { listProperties, type PropertyFilters } from "@/lib/property-query";
import { addressOneLine, fmtDate } from "@/lib/format";
import { FURNISHING, PROPERTY_TYPES } from "@/lib/options";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<PropertyFilters> }) {
  const f = await searchParams;
  const user = await requireUser();
  if (!canViewProperties(user)) redirect("/");
  const [rows, clients] = await Promise.all([listProperties(user, f), clientOptions(user.orgId)]);
  const canEdit = canEditProperties(user);
  const filtered = Boolean(f.q || f.client || f.type || f.furnishing || f.bedrooms || f.archived === "1");
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={`${rows.length} ${rows.length === 1 ? "property" : "properties"}${filtered ? " match your filters" : ""}`}
        actions={
          <>
            <a href={`/properties/export${qs ? `?${qs}` : ""}`} className="btn-secondary">
              <Download className="h-4 w-4" /> CSV
            </a>
            {canEdit && (
              <Link href="/properties/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Add property
              </Link>
            )}
          </>
        }
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <input name="q" defaultValue={f.q} placeholder="Search address, reference, postcode…" className="input lg:col-span-2" />
        <select name="client" defaultValue={f.client ?? ""} className="input">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select name="type" defaultValue={f.type ?? ""} className="input">
          <option value="">All types</option>
          {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select name="furnishing" defaultValue={f.furnishing ?? ""} className="input">
          <option value="">Any furnishing</option>
          {FURNISHING.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select name="bedrooms" defaultValue={f.bedrooms ?? ""} className="input">
          <option value="">Any bedrooms</option>
          {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? "Studio" : `${n} bed`}</option>)}
          <option value="5">5+ bed</option>
        </select>
        <div className="flex flex-wrap items-center gap-4 text-sm lg:col-span-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="units" value="1" defaultChecked={f.units === "1"} className="h-4 w-4 accent-brand-600" />
            Include units inside buildings
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="archived" value="1" defaultChecked={f.archived === "1"} className="h-4 w-4 accent-brand-600" />
            Show archived
          </label>
          <select name="sort" defaultValue={f.sort ?? ""} className="input w-auto">
            <option value="">Sort by address</option>
            <option value="reference">Sort by reference</option>
            <option value="last_inspected">Longest since inspected</option>
            <option value="newest">Recently added</option>
          </select>
        </div>
        <div className="flex gap-2 lg:col-span-2 lg:justify-end">
          <button className="btn-primary">Apply</button>
          {(filtered || f.units || f.sort) && <Link href="/properties" className="btn-secondary">Reset</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState title="No matching properties" body="Try a different search or clear the filters." action={<Link href="/properties" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <EmptyState
            title="No properties yet"
            body="Add your first property to start scheduling inspections. Buildings and estates can hold units."
            action={canEdit && <Link href="/properties/new" className="btn-primary"><Plus className="h-4 w-4" /> Add property</Link>}
          />
        )
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Reference</th>
                <th>Client</th>
                <th>Type</th>
                <th className="text-right">Beds</th>
                <th>Furnishing</th>
                <th>Last inspected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ property: p, clientName, parentAddress, lastInspection, unitCount }) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="min-w-64">
                    <Link href={`/properties/${p.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                      {addressOneLine(p)}
                    </Link>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {[p.province, p.postalCode].filter(Boolean).join(" · ")}
                      {parentAddress && <> · in {parentAddress}</>}
                      {unitCount > 0 && <> · {unitCount} units</>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-stone-600">{p.reference ?? "—"}</td>
                  <td className="text-stone-600">{clientName ?? "—"}</td>
                  <td className="text-stone-600">{p.propertyType ?? "—"}</td>
                  <td className="text-right text-stone-600">{p.bedrooms ?? "—"}</td>
                  <td className="text-stone-600">{p.furnishing ?? "—"}</td>
                  <td className="whitespace-nowrap text-stone-600">{lastInspection ? fmtDate(lastInspection) : <span className="text-stone-400">Never</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
