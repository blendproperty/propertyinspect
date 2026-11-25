import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatefulForm } from "@/components/stateful-form";
import { saveSettings } from "../admin-actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  const org = (await db.query.organisations.findFirst({ where: eq(schema.organisations.id, user.orgId) }))!;
  return (
    <>
      <PageHeader title="Company settings" subtitle="Shown on every inspection report." />
      <section className="card max-w-3xl p-5">
        <StatefulForm action={saveSettings} submitLabel="Save settings" className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Company name *</label><input name="name" defaultValue={org.name} className="input" required /></div>
          <div><label className="label">Website</label><input name="website" defaultValue={org.website ?? ""} className="input" /></div>
          <div><label className="label">Email</label><input name="email" type="email" defaultValue={org.email ?? ""} className="input" /></div>
          <div><label className="label">Phone</label><input name="phone" defaultValue={org.phone ?? ""} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input name="address" defaultValue={org.address ?? ""} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Report footer</label><input name="reportFooter" defaultValue={org.reportFooter ?? ""} className="input" placeholder="e.g. Blend Property Management · Reg 2020/123456/07" /></div>
          <div>
            <label className="label">Report colour</label>
            <input type="color" name="brandColour" defaultValue={org.brandColour} className="h-10 w-20 cursor-pointer rounded-lg border border-stone-300" />
          </div>
          <div>
            <label className="label">Logo</label>
            {org.logoPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/logo/${org.id}`} alt="Current logo" className="mb-2 max-h-14" />
            )}
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" />
            {org.logoPath && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="removeLogo" /> Remove logo</label>}
          </div>
        </StatefulForm>
      </section>
    </>
  );
}
