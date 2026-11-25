/**
 * Adds made-up demo data (clients, properties and an inspector)
 * to the first workspace. Run after creating your admin account at /signup:
 *   npm run seed:demo
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { asc, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

async function main() {
  const org = await db.query.organisations.findFirst({ orderBy: asc(schema.organisations.createdAt) });
  if (!org) throw new Error("Create the admin account at /signup first.");
  const admin = await db.query.memberships.findFirst({ where: eq(schema.memberships.orgId, org.id) });
  if (!admin) throw new Error("No admin found.");

  const [c1, c2] = await db
    .insert(schema.clients)
    .values([
      { orgId: org.id, name: "Thandi Mokoena", company: "Mokoena Family Trust", email: "thandi@example.com", phone: "082 000 0001" },
      { orgId: org.id, name: "Pieter van Wyk", email: "pieter@example.com", phone: "083 000 0002" },
    ])
    .returning();

  const [building] = await db
    .insert(schema.properties)
    .values({
      orgId: org.id, reference: "BLD-001", addressLine1: "Harbour View Apartments", addressLine2: "18 Marine Drive", suburb: "Sea Point",
      city: "Cape Town", province: "Western Cape", postalCode: "8005", propertyType: "Building", units: 3, floors: 4, hasElevator: true, hasParking: true, clientId: c1.id,
    })
    .returning();
  await db.insert(schema.properties).values([
    { orgId: org.id, parentId: building.id, reference: "BLD-001-2A", addressLine1: "Unit 2A, Harbour View", suburb: "Sea Point", city: "Cape Town", province: "Western Cape", postalCode: "8005", propertyType: "Apartment", bedrooms: 2, bathrooms: 1, furnishing: "Furnished", clientId: c1.id },
    { orgId: org.id, parentId: building.id, reference: "BLD-001-3B", addressLine1: "Unit 3B, Harbour View", suburb: "Sea Point", city: "Cape Town", province: "Western Cape", postalCode: "8005", propertyType: "Apartment", bedrooms: 1, bathrooms: 1, furnishing: "Unfurnished", clientId: c1.id },
    { orgId: org.id, reference: "HSE-014", addressLine1: "14 Jacaranda Street", suburb: "Parkhurst", city: "Johannesburg", province: "Gauteng", postalCode: "2193", propertyType: "House", style: "Freestanding", bedrooms: 3, bathrooms: 2, furnishing: "Unfurnished", hasGarage: true, hasGarden: true, hasPool: true, clientId: c2.id },
    { orgId: org.id, reference: "TWN-007", addressLine1: "7 Protea Close", suburb: "Umhlanga", city: "Durban", province: "KwaZulu-Natal", postalCode: "4319", propertyType: "Townhouse", style: "Duplex", bedrooms: 2, bathrooms: 2, furnishing: "Semi-furnished", hasParking: true },
  ]);

  const [inspector] = await db.insert(schema.users).values({ name: "Naledi Inspector (demo)", email: `inspector+${Date.now()}@example.com` }).returning();
  await db.insert(schema.memberships).values({ orgId: org.id, userId: inspector.id, role: "inspector" });

  console.log("Demo data added: 2 clients, 5 properties (one building with 2 units), 1 inspector (invite them from People).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
