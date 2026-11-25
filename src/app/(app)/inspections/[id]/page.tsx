import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect } from "@/lib/permissions";
import { isLocked, loadInspection } from "@/lib/inspection-access";
import { inspectionContent } from "@/lib/inspection-data";
import { addressOneLine, fmtDateTime } from "@/lib/format";
import { INSPECTION_TYPES, type InspectionStatus } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import { InspectionStatusBadge } from "@/components/badges";
import { saveSummary, setInspectionStatus } from "../actions";
import { InspectionRunner } from "./runner";

const ACTIONS: Partial<Record<InspectionStatus, { to: InspectionStatus; label: string; primary?: boolean }[]>> = {
  scheduled: [{ to: "in_progress", label: "Start inspection", primary: true }, { to: "cancelled", label: "Cancel" }],
  in_progress: [{ to: "in_review", label: "Send for review", primary: true }, { to: "completed", label: "Mark complete" }, { to: "cancelled", label: "Cancel" }],
  in_review: [{ to: "completed", label: "Approve and complete", primary: true }, { to: "in_progress", label: "Back to in progress" }],
  completed: [{ to: "closed", label: "Close and lock", primary: true }, { to: "in_progress", label: "Reopen" }],
  closed: [{ to: "completed", label: "Unlock" }],
  cancelled: [{ to: "scheduled", label: "Restore" }],
};

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const found = await loadInspection(user, id);
  if (!found) notFound();
  const { inspection: i, property } = found;
  const [content, inspector] = await Promise.all([
    inspectionContent(id),
    i.inspectorId ? db.query.users.findFirst({ where: eq(schema.users.id, i.inspectorId) }) : null,
  ]);
  const editable = canInspect(user);
  const locked = !editable || isLocked(i.status);
  const actions = (ACTIONS[i.status] ?? []).filter(
    (a) => editable && !(user.role === "inspector" && (a.to === "closed" || i.status === "closed" || i.status === "in_review")),
  );

  return (
    <>
      <PageHeader
        title={`${INSPECTION_TYPES[i.type]} inspection`}
        subtitle={
          <>
            <Link href={`/properties/${property.id}`} className="text-brand-700 hover:underline">{addressOneLine(property)}</Link>
            {" · "}{fmtDateTime(i.scheduledAt)} · {inspector?.name ?? "Unassigned"}
            {i.reference && <> · Ref {i.reference}</>}
          </>
        }
        back={{ href: "/inspections", label: "Inspections" }}
        actions={
          <>
            <InspectionStatusBadge status={i.status} />
            <Link href={`/reports/${i.id}`} className="btn-secondary"><FileText className="h-4 w-4" /> Report</Link>
            {actions.map((a) => (
              <form key={a.to} action={setInspectionStatus}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="status" value={a.to} />
                <button className={a.primary ? "btn-primary" : "btn-secondary"}>{a.label}</button>
              </form>
            ))}
          </>
        }
      />

      {locked && editable && i.status === "closed" && (
        <p className="mb-4 rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-600">This inspection is closed, so it can&apos;t be changed. A manager can unlock it.</p>
      )}

      <form action={saveSummary} className="card mb-5 p-4 sm:p-5">
        <input type="hidden" name="id" value={i.id} />
        <label className="label" htmlFor="summary">Summary for the report</label>
        <textarea id="summary" name="summary" defaultValue={i.summary ?? ""} rows={2} disabled={locked} className="input" placeholder="Overall condition, anything the landlord should know first" />
        {!locked && <button className="btn-secondary mt-2">Save summary</button>}
      </form>

      <InspectionRunner
        inspectionId={i.id}
        checks={i.checks}
        locked={locked}
        sections={content.sections.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          notes: s.notes,
          items: s.items.map((it) => ({
            id: it.id,
            name: it.name,
            ratings: it.ratings,
            description: it.description,
            comment: it.comment,
            value: it.value,
            photos: it.photos,
          })),
        }))}
        signatures={content.signatures.map((s) => ({ ...s, signedAt: s.signedAt.toISOString() }))}
      />
    </>
  );
}
