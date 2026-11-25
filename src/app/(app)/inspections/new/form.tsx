"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError } from "@/components/form-error";
import { INSPECTION_TYPES } from "@/lib/options";
import { createInspection } from "../actions";

type Opt = { id: string; label: string };

export function NewInspectionForm({
  properties,
  inspectors,
  templates,
  defaults,
}: {
  properties: Opt[];
  inspectors: Opt[];
  templates: Opt[];
  defaults: { propertyId?: string; inspectorId?: string };
}) {
  const [state, action, pending] = useActionState(createInspection, undefined);
  const now = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 13) + ":00";
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-5">
      <FormError error={state?.error} />
      <div>
        <label className="label">Property *</label>
        <select name="propertyId" defaultValue={defaults.propertyId ?? ""} className="input" required>
          <option value="" disabled>Choose a property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {properties.length === 0 && (
          <p className="mt-1 text-xs text-stone-500">No properties yet. <Link href="/properties/new" className="text-brand-700 underline">Add one first</Link>.</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Type *</label>
          <select name="type" defaultValue="routine" className="input">
            {Object.entries(INSPECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Template</label>
          <select name="templateId" defaultValue={templates[0]?.id ?? ""} className="input">
            <option value="">Blank (add rooms as you go)</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date and time</label>
          <input type="datetime-local" name="scheduledAt" defaultValue={now} className="input" />
        </div>
        <div>
          <label className="label">Inspector</label>
          <select name="inspectorId" defaultValue={defaults.inspectorId ?? ""} className="input">
            <option value="">Property&apos;s default inspector</option>
            {inspectors.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Reference</label>
          <input name="reference" className="input" placeholder="Optional, e.g. lease number" />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create inspection"}</button>
        <Link href="/inspections" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
