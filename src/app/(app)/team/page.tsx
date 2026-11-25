import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { propertyOptions } from "@/lib/lookups";
import { ROLES } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import { StatefulForm } from "@/components/stateful-form";
import { inviteMember, resendInvite, updateMember } from "../admin-actions";

export const metadata = { title: "People" };

export default async function TeamPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  const [members, properties] = await Promise.all([
    db
      .select({ u: schema.users, m: schema.memberships })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.orgId, user.orgId))
      .orderBy(asc(schema.users.name)),
    propertyOptions(user.orgId),
  ]);
  const propName = new Map(properties.map((p) => [p.id, p.label]));

  const RoleSelect = ({ value }: { value?: string }) => (
    <select name="role" defaultValue={value ?? "inspector"} className="input">
      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
  const PropertySelect = ({ value }: { value?: string | null }) => (
    <select name="propertyId" defaultValue={value ?? ""} className="input">
      <option value="">All properties</option>
      {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader
        title="People and access"
        subtitle="Inspectors carry out inspections. Facility and portfolio managers can be limited to one property and its units; portfolio managers can only view."
      />
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-semibold">Invite someone</h2>
        <StatefulForm action={inviteMember} submitLabel="Add and create invite link" resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="name" placeholder="Name" className="input" required />
          <input name="email" type="email" placeholder="Email" className="input" required />
          <input name="phone" placeholder="Phone" className="input" />
          <RoleSelect />
          <PropertySelect />
        </StatefulForm>
      </section>

      <div className="space-y-3">
        {members.map(({ u, m }) => (
          <div key={u.id} className="card p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">{u.name} {u.id === user.id && <span className="text-xs text-stone-500">(you)</span>}</p>
                <p className="text-xs text-stone-500">
                  {u.email}{u.phone && ` · ${u.phone}`} · {ROLES[m.role]}{m.propertyId && ` · ${propName.get(m.propertyId) ?? "Archived property"}`}
                  {!u.passwordHash && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Invite not accepted</span>}
                  {!u.active && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5">Deactivated</span>}
                </p>
              </div>
              {u.id !== user.id && (
                <StatefulForm action={resendInvite} submitLabel={u.passwordHash ? "Reset password link" : "New invite link"} className="text-right">
                  <input type="hidden" name="userId" value={u.id} />
                </StatefulForm>
              )}
            </div>
            <StatefulForm action={updateMember} submitLabel="Save" className="grid items-center gap-3 sm:grid-cols-[1fr_1.5fr_auto_auto]">
              <input type="hidden" name="userId" value={u.id} />
              <RoleSelect value={m.role} />
              <PropertySelect value={m.propertyId} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === user.id} className="h-4 w-4 accent-brand-600" /> Active
              </label>
            </StatefulForm>
          </div>
        ))}
      </div>
    </>
  );
}
