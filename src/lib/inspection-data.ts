import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Sections, items, photos, linked jobs and signatures for one inspection. */
export async function inspectionContent(inspectionId: string) {
  const sections = await db.query.inspectionSections.findMany({
    where: eq(schema.inspectionSections.inspectionId, inspectionId),
    orderBy: asc(schema.inspectionSections.position),
  });
  const sectionIds = sections.map((s) => s.id);
  const items = sectionIds.length
    ? await db.query.inspectionItems.findMany({
        where: inArray(schema.inspectionItems.sectionId, sectionIds),
        orderBy: asc(schema.inspectionItems.position),
      })
    : [];
  const [photos, signatures] = await Promise.all([
    db.query.photos.findMany({ where: eq(schema.photos.inspectionId, inspectionId), orderBy: asc(schema.photos.createdAt) }),
    db.query.signatures.findMany({ where: eq(schema.signatures.inspectionId, inspectionId), orderBy: asc(schema.signatures.signedAt) }),
  ]);
  return {
    sections: sections.map((s) => ({
      ...s,
      items: items
        .filter((i) => i.sectionId === s.id)
        .map((i) => ({
          ...i,
          photos: photos.filter((p) => p.itemId === i.id).map((p) => ({ id: p.id })),
        })),
    })),
    signatures,
  };
}
