import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ClipboardPlus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect, propertyScope } from "@/lib/permissions";
import { addressOneLine, fmtDateTime } from "@/lib/format";
import { INSPECTION_TYPES, ROLES } from "@/lib/options";
import { InspectionStatusBadge } from "@/components/badges";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const user = await requireUser();
  const i = schema.inspections;
  const mine = user.role === "inspector" ? eq(i.inspectorId, user.id) : undefined;
  const base = and(eq(i.orgId, user.orgId), propertyScope(user), mine);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const startOfToday = new Date(`${today}T00:00:00+02:00`);
  const startOfMonth = new Date(`${today.slice(0, 7)}-01T00:00:00+02:00`);

  const [counts, upcoming, recent] = await Promise.all([
    db
      .select({
        today: sql<number>`count(*) filter (where ${i.scheduledAt} >= ${startOfToday} and ${i.scheduledAt} < ${new Date(startOfToday.getTime() + 864e5)} and ${i.status} <> 'cancelled')::int`,
        inProgress: sql<number>`count(*) filter (where ${i.status} = 'in_progress')::int`,
        inReview: sql<number>`count(*) filter (where ${i.status} = 'in_review')::int`,
        doneThisMonth: sql<number>`count(*) filter (where ${i.status} in ('completed','closed') and ${i.completedAt} >= ${startOfMonth})::int`,
      })
      .from(i)
      .innerJoin(schema.properties, eq(schema.properties.id, i.propertyId))
      .where(base),
    db
      .select({ i, property: schema.properties })
      .from(i)
      .innerJoin(schema.properties, eq(schema.properties.id, i.propertyId))
      .where(and(base, inArray(i.status, ["scheduled", "in_progress", "in_review"]), gte(i.scheduledAt, new Date(startOfToday.getTime() - 30 * 864e5))))
      .orderBy(asc(i.scheduledAt))
      .limit(8),
    db
      .select({ i, property: schema.properties })
      .from(i)
      .innerJoin(schema.properties, eq(schema.properties.id, i.propertyId))
      .where(and(base, inArray(i.status, ["completed", "closed"])))
      .orderBy(desc(i.completedAt))
      .limit(8),
  ]);
  const c = counts[0];
  const stats = [
    { label: "Scheduled today", n: c.today, href: "/inspections" },
    { label: "In progress", n: c.inProgress, href: "/inspections?status=in_progress" },
    { label: "Waiting for review", n: c.inReview, href: "/inspections?status=in_review" },
    { label: "Completed this month", n: c.doneThisMonth, href: "/inspections?status=completed" },
  ];

  const List = ({ title, rows, empty }: { title: string; rows: typeof upcoming; empty: string }) => (
    <section className="card">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <Link href="/inspections" className="text-sm text-brand-700 hover:underline">All</Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map(({ i, property }) => (
            <li key={i.id}>
              <Link href={`/inspections/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className="truncate font-medium">{addressOneLine(property)}</p>
                  <p className="text-xs text-stone-500">{INSPECTION_TYPES[i.type]} · {fmtDateTime(i.completedAt ?? i.scheduledAt)}</p>
                </div>
                <InspectionStatusBadge status={i.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.13em] text-brand-600 uppercase">{user.orgName}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-stone-500">{ROLES[user.role]} · your inspections at a glance.</p>
        </div>
        {canInspect(user) && <Link href="/inspections/new" className="btn-primary"><ClipboardPlus className="h-4 w-4" /> New inspection</Link>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-brand-500">
            <p className="text-sm text-stone-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold">{s.n}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <List title="Upcoming and open" rows={upcoming} empty="Nothing scheduled." />
        <List title="Recently completed" rows={recent} empty="No completed inspections yet." />
      </div>
    </>
  );
}
