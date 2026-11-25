import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canEditProperties } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { StatefulForm } from "@/components/stateful-form";
import { deleteClient, saveClient } from "../admin-actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireUser();
  if (!canEditProperties(user)) redirect("/");
  const c = schema.clients;
  const rows = await db
    .select({ c, properties: sql<number>`(select count(*)::int from properties p where p.client_id = ${c.id})` })
    .from(c)
    .where(eq(c.orgId, user.orgId))
    .orderBy(asc(c.name));
  return (
    <>
      <PageHeader title="Clients" subtitle="Landlords and owners you manage properties for." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="card p-6 text-sm text-stone-500">No clients yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Contact</th><th className="text-right">Properties</th><th /></tr></thead>
                <tbody>
                  {rows.map(({ c, properties }) => (
                    <tr key={c.id}>
                      <td><p className="font-medium">{c.name}</p>{c.company && <p className="text-xs text-stone-500">{c.company}</p>}</td>
                      <td className="text-stone-600">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="text-right">{properties}</td>
                      <td className="text-right">
                        <form action={deleteClient}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-stone-400 hover:text-rose-600">Delete</button></form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <section className="card self-start p-5">
          <h2 className="mb-3 font-semibold">Add a client</h2>
          <StatefulForm action={saveClient} submitLabel="Add client" resetOnSuccess className="space-y-3">
            <input name="name" placeholder="Name *" className="input" required />
            <input name="company" placeholder="Company" className="input" />
            <input name="email" type="email" placeholder="Email" className="input" />
            <input name="phone" placeholder="Phone" className="input" />
            <textarea name="notes" placeholder="Notes" rows={2} className="input" />
          </StatefulForm>
        </section>
      </div>
    </>
  );
}
