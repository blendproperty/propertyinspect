import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties, canInspect } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { createTemplate } from "./actions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  if (!canInspect(user)) redirect("/");
  const t = schema.templates;
  const rows = await db
    .select({
      t,
      sections: sql<number>`(select count(*)::int from template_sections s where s.template_id = templates.id)`,
      items: sql<number>`(select count(*)::int from template_items i join template_sections s on s.id = i.section_id where s.template_id = templates.id)`,
    })
    .from(t)
    .where(eq(t.orgId, user.orgId))
    .orderBy(asc(t.name));
  return (
    <>
      <PageHeader title="Templates" subtitle="Rooms and items copied into each new inspection. Changing a template doesn't change past inspections." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ t, sections, items }) => (
          <Link key={t.id} href={`/templates/${t.id}`} className="card block p-5 hover:border-brand-500">
            <p className="font-semibold">{t.name}</p>
            {t.description && <p className="mt-1 text-sm text-stone-500">{t.description}</p>}
            <p className="mt-3 text-xs text-stone-500">{sections} sections · {items} items · checks: {t.checks.join(", ")}</p>
          </Link>
        ))}
        {canEditProperties(user) && (
          <form action={createTemplate} className="card flex flex-col justify-center gap-2 border-dashed p-5">
            <input name="name" placeholder="New template name" className="input" required />
            <button className="btn-secondary">Create template</button>
          </form>
        )}
      </div>
    </>
  );
}
