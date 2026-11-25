import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/format";
import { canSeeProperty, canViewInspections } from "@/lib/permissions";
import { readStored } from "@/lib/storage";

const notFound = () => new Response("Not found", { status: 404 });

/** Serves stored images after checking the viewer may see the record they belong to. */
export async function GET(_: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  if (!isUuid(id)) return notFound();

  let filePath: string | null = null;
  let mime = "application/octet-stream";

  if (kind === "photo") {
    const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, id) });
    if (!photo || photo.orgId !== user.orgId || !canViewInspections(user)) return notFound();
    const insp = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, photo.inspectionId) });
    const prop = insp && (await db.query.properties.findFirst({ where: eq(schema.properties.id, insp.propertyId) }));
    if (!prop || !canSeeProperty(user, prop)) return notFound();
    filePath = photo.path;
    mime = photo.mimeType;
  } else if (kind === "logo") {
    const org = await db.query.organisations.findFirst({ where: eq(schema.organisations.id, id) });
    if (!org || org.id !== user.orgId || !org.logoPath) return notFound();
    filePath = org.logoPath;
    mime = org.logoPath.endsWith(".png") ? "image/png" : org.logoPath.endsWith(".webp") ? "image/webp" : "image/jpeg";
  } else return notFound();

  try {
    const bytes = await readStored(filePath);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return notFound();
  }
}
