import { getCurrentUser } from "@/lib/auth";
import { listProperties, type PropertyFilters } from "@/lib/property-query";
import { fmtDate } from "@/lib/format";
import { canViewProperties } from "@/lib/permissions";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything and neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  if (!canViewProperties(user)) return new Response("Forbidden", { status: 403 });
  const f = Object.fromEntries(new URL(req.url).searchParams) as PropertyFilters;
  const rows = await listProperties(user, f);
  const header = ["Reference", "External ID", "Address line 1", "Address line 2", "Suburb", "City", "Province", "Postal code", "Client", "Type", "Style", "Furnishing", "Bedrooms", "Bathrooms", "Last inspected"];
  const lines = rows.map(({ property: p, clientName, lastInspection }) =>
    [p.reference, p.externalId, p.addressLine1, p.addressLine2, p.suburb, p.city, p.province, p.postalCode, clientName, p.propertyType, p.style, p.furnishing, p.bedrooms, p.bathrooms, lastInspection ? fmtDate(lastInspection) : ""]
      .map(esc)
      .join(","),
  );
  return new Response([header.map(esc).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="properties-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
