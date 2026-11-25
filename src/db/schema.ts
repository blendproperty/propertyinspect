import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["admin", "manager", "portfolio", "inspector"]);
export const inspectionTypeEnum = pgEnum("inspection_type", [
  "move_in",
  "move_out",
  "interim",
  "routine",
  "standalone",
]);
export const inspectionStatusEnum = pgEnum("inspection_status", [
  "scheduled",
  "in_progress",
  "in_review",
  "completed",
  "closed",
  "cancelled",
]);
export const sectionKindEnum = pgEnum("section_kind", ["room", "checklist", "meters", "keys", "notes"]);
export const ratingEnum = pgEnum("rating", ["yes", "no", "na"]);
export const contactRoleEnum = pgEnum("contact_role", [
  "tenant",
  "landlord",
  "agent",
  "witness",
  "other",
]);

export const organisations = pgTable("organisations", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  logoPath: text("logo_path"),
  brandColour: text("brand_colour").notNull().default("#0f766e"),
  reportFooter: text("report_footer"),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    /** Null until the person accepts their invite and sets a password. */
    passwordHash: text("password_hash"),
    inviteTokenHash: text("invite_token_hash"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("inspector"),
    /** Facility and portfolio managers can be limited to one property (and its units). Null means all properties. */
    propertyId: uuid("property_id").references((): AnyPgColumn => properties.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_org_user_idx").on(t.orgId, t.userId)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const clients = pgTable(
  "clients",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("clients_org_idx").on(t.orgId)],
);

export const properties = pgTable(
  "properties",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    reference: text("reference"),
    externalId: text("external_id"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    suburb: text("suburb"),
    city: text("city").notNull(),
    province: text("province"),
    postalCode: text("postal_code"),
    country: text("country").notNull().default("South Africa"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    defaultInspectorId: uuid("default_inspector_id").references(() => users.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => properties.id, { onDelete: "set null" }),
    propertyType: text("property_type"),
    style: text("style"),
    furnishing: text("furnishing"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    floors: integer("floors"),
    units: integer("units"),
    internalArea: numeric("internal_area"),
    externalArea: numeric("external_area"),
    hasElevator: boolean("has_elevator").notNull().default(false),
    hasGarage: boolean("has_garage").notNull().default(false),
    hasParking: boolean("has_parking").notNull().default(false),
    hasGarden: boolean("has_garden").notNull().default(false),
    hasPool: boolean("has_pool").notNull().default(false),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("properties_org_idx").on(t.orgId), index("properties_parent_idx").on(t.parentId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: contactRoleEnum("role").notNull().default("tenant"),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_property_idx").on(t.propertyId)],
);

/** Template definition. `checks` lists the rating columns used by room items. */
export const templates = pgTable("templates", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  checks: jsonb("checks").$type<string[]>().notNull().default(["Clean", "Undamaged", "Working"]),
  createdAt: createdAt(),
});

export const templateSections = pgTable("template_sections", {
  id: id(),
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: sectionKindEnum("kind").notNull().default("room"),
  position: integer("position").notNull().default(0),
});

export const templateItems = pgTable("template_items", {
  id: id(),
  sectionId: uuid("section_id").notNull().references(() => templateSections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});

export const inspections = pgTable(
  "inspections",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    inspectorId: uuid("inspector_id").references(() => users.id, { onDelete: "set null" }),
    reference: text("reference"),
    type: inspectionTypeEnum("type").notNull().default("routine"),
    status: inspectionStatusEnum("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    checks: jsonb("checks").$type<string[]>().notNull().default(["Clean", "Undamaged", "Working"]),
    summary: text("summary"),
    createdAt: createdAt(),
  },
  (t) => [index("inspections_org_idx").on(t.orgId), index("inspections_property_idx").on(t.propertyId)],
);

export const inspectionSections = pgTable(
  "inspection_sections",
  {
    id: id(),
    inspectionId: uuid("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: sectionKindEnum("kind").notNull().default("room"),
    position: integer("position").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [index("inspection_sections_inspection_idx").on(t.inspectionId)],
);

export const inspectionItems = pgTable(
  "inspection_items",
  {
    id: id(),
    sectionId: uuid("section_id").notNull().references(() => inspectionSections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    /** check name -> rating */
    ratings: jsonb("ratings").$type<Record<string, "yes" | "no" | "na">>().notNull().default({}),
    description: text("description"),
    comment: text("comment"),
    /** meter reading, key count etc. */
    value: text("value"),
  },
  (t) => [index("inspection_items_section_idx").on(t.sectionId)],
);

export const photos = pgTable(
  "photos",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    inspectionId: uuid("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => inspectionItems.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => inspectionSections.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    caption: text("caption"),
    createdAt: createdAt(),
  },
  (t) => [index("photos_inspection_idx").on(t.inspectionId)],
);

export const signatures = pgTable("signatures", {
  id: id(),
  inspectionId: uuid("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  signerName: text("signer_name").notNull(),
  signerRole: contactRoleEnum("signer_role").notNull().default("tenant"),
  /** PNG data URL */
  image: text("image").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Property = typeof properties.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
export type Client = typeof clients.$inferSelect;
