import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties, canInspect } from "@/lib/permissions";
import { isUuid } from "@/lib/format";
import { SECTION_KINDS } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import {
  addTemplateItem,
  addTemplateSection,
  deleteTemplate,
  duplicateTemplate,
  moveTemplateSection,
  removeTemplateItem,
  removeTemplateSection,
  renameTemplateSection,
  updateTemplate,
} from "../actions";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  if (!canInspect(user)) notFound();
  const t = await db.query.templates.findFirst({ where: and(eq(schema.templates.id, id), eq(schema.templates.orgId, user.orgId)) });
  if (!t) notFound();
  const sections = await db.query.templateSections.findMany({ where: eq(schema.templateSections.templateId, id), orderBy: asc(schema.templateSections.position) });
  const items = sections.length
    ? await db.query.templateItems.findMany({ where: inArray(schema.templateItems.sectionId, sections.map((s) => s.id)), orderBy: asc(schema.templateItems.position) })
    : [];
  const edit = canEditProperties(user);

  return (
    <>
      <PageHeader
        title={t.name}
        back={{ href: "/templates", label: "Templates" }}
        actions={
          edit && (
            <>
              <form action={duplicateTemplate}><input type="hidden" name="id" value={t.id} /><button className="btn-secondary">Duplicate</button></form>
              <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><button className="btn-danger">Delete</button></form>
            </>
          )
        }
      />
      {edit && (
        <form action={updateTemplate} className="card mb-6 grid gap-4 p-5 sm:grid-cols-3">
          <input type="hidden" name="id" value={t.id} />
          <div><label className="label">Name</label><input name="name" defaultValue={t.name} className="input" required /></div>
          <div><label className="label">Description</label><input name="description" defaultValue={t.description ?? ""} className="input" /></div>
          <div>
            <label className="label">Room checks (comma-separated, up to 5)</label>
            <input name="checks" defaultValue={t.checks.join(", ")} className="input" />
          </div>
          <div className="sm:col-span-3"><button className="btn-secondary">Save details</button></div>
        </form>
      )}

      <div className="space-y-4">
        {sections.map((s, idx) => (
          <section key={s.id} className="card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-3">
              {edit ? (
                <form action={renameTemplateSection} className="flex items-center gap-2">
                  <input type="hidden" name="sectionId" value={s.id} />
                  <input name="name" defaultValue={s.name} className="input w-56 font-semibold" />
                  <button className="text-xs text-brand-700 hover:underline">Rename</button>
                </form>
              ) : (
                <h2 className="font-semibold">{s.name}</h2>
              )}
              <div className="flex items-center gap-2 text-xs text-stone-500">
                {SECTION_KINDS[s.kind]}
                {edit && (
                  <>
                    <form action={moveTemplateSection}><input type="hidden" name="sectionId" value={s.id} /><input type="hidden" name="dir" value="up" /><button disabled={idx === 0} className="rounded p-1 hover:bg-stone-100 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button></form>
                    <form action={moveTemplateSection}><input type="hidden" name="sectionId" value={s.id} /><input type="hidden" name="dir" value="down" /><button disabled={idx === sections.length - 1} className="rounded p-1 hover:bg-stone-100 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button></form>
                    <form action={removeTemplateSection}><input type="hidden" name="sectionId" value={s.id} /><button className="text-rose-600 hover:underline">Remove</button></form>
                  </>
                )}
              </div>
            </header>
            {s.kind !== "notes" && (
              <div className="px-5 py-3">
                <ul className="flex flex-wrap gap-2">
                  {items.filter((i) => i.sectionId === s.id).map((i) => (
                    <li key={i.id} className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pr-1.5 pl-3 text-sm">
                      {i.name}
                      {edit && (
                        <form action={removeTemplateItem}><input type="hidden" name="itemId" value={i.id} /><button className="rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-rose-600" aria-label={`Remove ${i.name}`}><X className="h-3.5 w-3.5" /></button></form>
                      )}
                    </li>
                  ))}
                </ul>
                {edit && (
                  <form action={addTemplateItem} className="mt-3 flex gap-2">
                    <input type="hidden" name="sectionId" value={s.id} />
                    <input name="name" placeholder="Add items (separate several with commas)" className="input" required />
                    <button className="btn-secondary shrink-0">Add</button>
                  </form>
                )}
              </div>
            )}
          </section>
        ))}
        {edit && (
          <form action={addTemplateSection} className="card flex flex-wrap gap-2 p-4">
            <input type="hidden" name="templateId" value={t.id} />
            <input name="name" placeholder="New section name" className="input min-w-48 flex-1" required />
            <select name="kind" className="input w-auto" defaultValue="room">
              {Object.entries(SECTION_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-secondary">Add section</button>
          </form>
        )}
      </div>
    </>
  );
}
