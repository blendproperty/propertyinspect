"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Property } from "@/db/schema";
import { FormError } from "@/components/form-error";
import { FURNISHING, PROPERTY_STYLES, PROPERTY_TYPES, PROVINCES } from "@/lib/options";
import { saveProperty } from "./actions";

type Opt = { id: string; label: string };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Select({ name, value, options, placeholder = "—" }: { name: string; value?: string | null; options: (string | Opt)[]; placeholder?: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="input">
      <option value="">{placeholder}</option>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.id} value={o.id}>{o.label}</option>
        ),
      )}
    </select>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-brand-600" />
      {label}
    </label>
  );
}

export function PropertyForm({
  property,
  clients,
  inspectors,
  parents,
}: {
  property?: Property;
  clients: Opt[];
  inspectors: Opt[];
  parents: Opt[];
}) {
  const [state, action, pending] = useActionState(saveProperty, undefined);
  const p = property;
  return (
    <form action={action} className="space-y-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <FormError error={state?.error} />

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1 *" className="sm:col-span-2">
            <input name="addressLine1" defaultValue={p?.addressLine1} className="input" required placeholder="12 Oak Avenue" />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <input name="addressLine2" defaultValue={p?.addressLine2 ?? ""} className="input" placeholder="Unit, complex or building" />
          </Field>
          <Field label="Suburb"><input name="suburb" defaultValue={p?.suburb ?? ""} className="input" /></Field>
          <Field label="City *"><input name="city" defaultValue={p?.city} className="input" required /></Field>
          <Field label="Province"><Select name="province" value={p?.province} options={PROVINCES} /></Field>
          <Field label="Postal code"><input name="postalCode" defaultValue={p?.postalCode ?? ""} className="input" inputMode="numeric" /></Field>
          <Field label="Country"><input name="country" defaultValue={p?.country ?? "South Africa"} className="input" /></Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Management</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client"><Select name="clientId" value={p?.clientId} options={clients} placeholder="No client" /></Field>
          <Field label="Default inspector"><Select name="defaultInspectorId" value={p?.defaultInspectorId} options={inspectors} placeholder="Unassigned" /></Field>
          <Field label="Reference"><input name="reference" defaultValue={p?.reference ?? ""} className="input" placeholder="Your own code, e.g. BLD-014" /></Field>
          <Field label="External ID"><input name="externalId" defaultValue={p?.externalId ?? ""} className="input" placeholder="ID in another system" /></Field>
          <Field label="Part of (building or estate)" className="sm:col-span-2">
            <Select name="parentId" value={p?.parentId} options={parents} placeholder="Not part of another property" />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type"><Select name="propertyType" value={p?.propertyType} options={PROPERTY_TYPES} /></Field>
          <Field label="Style"><Select name="style" value={p?.style} options={PROPERTY_STYLES} /></Field>
          <Field label="Furnishing"><Select name="furnishing" value={p?.furnishing} options={FURNISHING} /></Field>
          <Field label="Bedrooms"><input type="number" min={0} name="bedrooms" defaultValue={p?.bedrooms ?? ""} className="input" /></Field>
          <Field label="Bathrooms"><input type="number" min={0} name="bathrooms" defaultValue={p?.bathrooms ?? ""} className="input" /></Field>
          <Field label="Floors"><input type="number" min={0} name="floors" defaultValue={p?.floors ?? ""} className="input" /></Field>
          <Field label="Units"><input type="number" min={0} name="units" defaultValue={p?.units ?? ""} className="input" /></Field>
          <Field label="Internal size (m²)"><input type="number" min={0} step="0.1" name="internalArea" defaultValue={p?.internalArea ?? ""} className="input" /></Field>
          <Field label="External size (m²)"><input type="number" min={0} step="0.1" name="externalArea" defaultValue={p?.externalArea ?? ""} className="input" /></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Toggle name="hasGarage" label="Garage" checked={p?.hasGarage} />
          <Toggle name="hasParking" label="Parking" checked={p?.hasParking} />
          <Toggle name="hasGarden" label="Garden" checked={p?.hasGarden} />
          <Toggle name="hasPool" label="Pool" checked={p?.hasPool} />
          <Toggle name="hasElevator" label="Lift" checked={p?.hasElevator} />
        </div>
        <Field label="Notes" className="mt-4">
          <textarea name="notes" defaultValue={p?.notes ?? ""} rows={3} className="input" placeholder="Access instructions, alarm codes kept elsewhere, etc." />
        </Field>
      </section>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : p ? "Save changes" : "Add property"}</button>
        <Link href={p ? `/properties/${p.id}` : "/properties"} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
