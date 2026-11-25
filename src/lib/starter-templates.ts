import { eq } from "drizzle-orm";
import { schema } from "@/db";
import type { db as Db } from "@/db";

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0] | typeof Db;
type Kind = "room" | "checklist" | "meters" | "keys" | "notes";
type Def = { name: string; description: string; sections: { name: string; kind: Kind; items: string[] }[] };

const roomBasics = ["Door & frame", "Walls", "Ceiling", "Floor", "Windows & sills", "Light fittings", "Plug points & switches"];

const RESIDENTIAL: Def = {
  name: "Residential – standard",
  description: "Room-by-room condition report for a typical house or flat.",
  sections: [
    { name: "Before you start", kind: "checklist", items: ["Tenant present", "All keys received", "Utilities on", "Smoke detectors tested"] },
    { name: "Entrance", kind: "room", items: [...roomBasics, "Front door lock", "Intercom / doorbell"] },
    { name: "Lounge", kind: "room", items: [...roomBasics, "Curtain rails & blinds"] },
    { name: "Kitchen", kind: "room", items: [...roomBasics, "Cupboards & drawers", "Counter tops", "Sink & taps", "Stove & oven", "Extractor fan", "Tiling"] },
    { name: "Bedroom 1", kind: "room", items: [...roomBasics, "Built-in cupboards", "Curtain rails & blinds"] },
    { name: "Bedroom 2", kind: "room", items: [...roomBasics, "Built-in cupboards", "Curtain rails & blinds"] },
    { name: "Bathroom", kind: "room", items: [...roomBasics, "Basin & taps", "Toilet", "Bath / shower", "Mirror & cabinet", "Towel rails", "Tiling & grout"] },
    { name: "Outside", kind: "room", items: ["Garden", "Boundary walls & fencing", "Gate & motor", "Driveway / parking", "Washing line", "Outside lights"] },
    { name: "Meter readings", kind: "meters", items: ["Electricity", "Water", "Gas"] },
    { name: "Keys & remotes", kind: "keys", items: ["Front door keys", "Gate remotes", "Security tags", "Postbox key"] },
    { name: "General notes", kind: "notes", items: [] },
  ],
};

const QUICK: Def = {
  name: "Routine check – quick",
  description: "Short walk-through for mid-lease visits.",
  sections: [
    { name: "Overall", kind: "checklist", items: ["Property kept clean", "No visible damage", "No unauthorised occupants", "No pets (unless agreed)", "Garden maintained"] },
    { name: "Living areas", kind: "room", items: ["Walls", "Floors", "Windows"] },
    { name: "Kitchen", kind: "room", items: ["Appliances", "Sink & taps", "Cupboards"] },
    { name: "Bathrooms", kind: "room", items: ["Toilet", "Bath / shower", "Leaks or damp"] },
    { name: "Maintenance needed", kind: "notes", items: [] },
  ],
};

// Commercial and industrial. Use the same template for ingoing and outgoing
// inspections (pick the inspection type when you book it) so the two reports
// line up item by item.
const unitBasics = ["Walls", "Ceiling & ceiling boards", "Floor finish", "Windows & glazing", "Doors & frames", "Lighting", "Plug points & switches"];

const ablutions = (name: string) => ({
  name,
  kind: "room" as const,
  items: ["Door & frame", "Walls & tiling", "Floor", "Toilets / urinals", "Basins & taps", "Hand dryers / towel dispensers", "Mirrors", "Extractor fan", "Geyser", "Leaks or damp"],
});

const fireEquipment = {
  name: "Fire equipment",
  kind: "checklist" as const,
  items: ["Extinguishers in place & in service date", "Hose reels", "Fire hydrants", "Smoke / heat detectors", "Fire alarm panel", "Sprinklers", "Emergency lighting", "Exit signage", "Escape routes clear", "Fire certificate on site"],
};

const electrical = {
  name: "Electrical & DBs",
  kind: "room" as const,
  items: ["Main distribution board", "Sub DBs labelled", "Earth leakage tested", "Cable trays & trunking", "Exposed wiring", "Electrical certificate of compliance"],
};

const hvac = {
  name: "HVAC",
  kind: "room" as const,
  items: ["Air-conditioning units", "Remotes / controllers", "Filters", "Condensate drains", "Outdoor units & brackets", "Extraction / ventilation"],
};

const roof = {
  name: "Roof & gutters",
  kind: "room" as const,
  items: ["Roof sheeting / tiles", "Flashings", "Skylights / translucent sheets", "Gutters", "Downpipes", "Signs of leaks inside"],
};

const signage = {
  name: "Signage",
  kind: "room" as const,
  items: ["Building / tenant signage", "Illuminated signs", "Unit number", "Brackets & fixings", "Holes or marks from removed signs"],
};

const COMMERCIAL_OFFICE: Def = {
  name: "Commercial office – ingoing / outgoing",
  description: "Full condition report for office space at lease start and lease end.",
  sections: [
    { name: "Before you start", kind: "checklist", items: ["Tenant / representative present", "Lease and floor plan on hand", "All keys and access cards received", "Power and water on", "Alarm code handed over"] },
    { name: "Reception & entrance", kind: "room", items: [...unitBasics, "Entrance door & lock", "Access control", "Reception counter"] },
    { name: "Open-plan office", kind: "room", items: [...unitBasics, "Carpet tiles", "Partitions", "Floor boxes & data points", "Blinds"] },
    { name: "Private offices", kind: "room", items: [...unitBasics, "Partitions & glazing", "Data points", "Blinds"] },
    { name: "Boardroom", kind: "room", items: [...unitBasics, "Data & AV points", "Blinds"] },
    { name: "Kitchenette", kind: "room", items: [...unitBasics, "Cupboards", "Counter tops", "Sink & taps", "Zip / urn", "Geyser"] },
    ablutions("Ablutions"),
    { name: "Server / store room", kind: "room", items: [...unitBasics, "Dedicated aircon", "Shelving"] },
    electrical,
    hvac,
    fireEquipment,
    signage,
    { name: "Parking & common areas", kind: "room", items: ["Allocated bays & markings", "Boom / gate access", "Lifts", "Stairwells", "Common passages", "External lighting"] },
    { name: "Meter readings", kind: "meters", items: ["Electricity", "Water", "Generator hours"] },
    { name: "Keys, cards & remotes", kind: "keys", items: ["Door keys", "Access cards / tags", "Gate & boom remotes", "Alarm remotes", "DB / riser keys"] },
    { name: "Reinstatement & general notes", kind: "notes", items: [] },
  ],
};

const RETAIL: Def = {
  name: "Retail shop – ingoing / outgoing",
  description: "Full condition report for a shop or showroom at lease start and lease end.",
  sections: [
    { name: "Before you start", kind: "checklist", items: ["Tenant / representative present", "Lease and floor plan on hand", "All keys received", "Power and water on", "Alarm code handed over"] },
    { name: "Shopfront", kind: "room", items: ["Shopfront glazing", "Entrance doors", "Roller shutter / trellis", "Locks", "Bulkhead", "Display windows"] },
    { name: "Trading floor", kind: "room", items: [...unitBasics, "Shopfittings & shelving", "Bulkheads", "Change rooms", "Data points"] },
    { name: "Back-of-house / storeroom", kind: "room", items: [...unitBasics, "Shelving", "Rear / service door"] },
    { name: "Staff kitchen", kind: "room", items: [...unitBasics, "Sink & taps", "Cupboards", "Geyser"] },
    ablutions("Ablutions"),
    electrical,
    hvac,
    fireEquipment,
    signage,
    { name: "Service & delivery area", kind: "room", items: ["Service passage", "Refuse area", "Delivery door"] },
    { name: "Meter readings", kind: "meters", items: ["Electricity", "Water", "Gas"] },
    { name: "Keys & remotes", kind: "keys", items: ["Shopfront keys", "Shutter keys / remotes", "Back door keys", "Alarm remotes"] },
    { name: "Reinstatement & general notes", kind: "notes", items: [] },
  ],
};

const COMMERCIAL_ROUTINE: Def = {
  name: "Commercial – routine",
  description: "Mid-lease walk-through for offices and shops.",
  sections: [
    { name: "Overall", kind: "checklist", items: ["Premises clean and tidy", "No visible damage", "Used as per lease", "No unapproved alterations", "Escape routes clear"] },
    { name: "Trading / office areas", kind: "room", items: ["Walls", "Ceilings", "Floors", "Lighting", "Doors & locks"] },
    { name: "Kitchen & ablutions", kind: "room", items: ["Toilets & basins", "Taps & leaks", "Geyser"] },
    { name: "Services", kind: "room", items: ["Distribution board", "Air-conditioning", "Fire extinguishers in service date", "Emergency lighting"] },
    { name: "Exterior", kind: "room", items: ["Signage", "Shopfront / entrance", "Parking", "Roof & gutters (visible)"] },
    { name: "Maintenance needed", kind: "notes", items: [] },
  ],
};

const INDUSTRIAL: Def = {
  name: "Industrial – warehouse / factory ingoing / outgoing",
  description: "Full condition report for warehouses, factories and workshops at lease start and lease end.",
  sections: [
    { name: "Before you start", kind: "checklist", items: ["Tenant / representative present", "Lease and site plan on hand", "All keys and remotes received", "Power and water on", "Alarm code handed over", "Premises empty of tenant stock (outgoing)"] },
    { name: "Warehouse floor", kind: "room", items: ["Floor slab", "Cracks & joints", "Floor markings", "Columns & column guards", "Walls / cladding", "High-bay lighting", "Skylights", "Drains"] },
    { name: "Racking & mezzanine", kind: "room", items: ["Racking uprights & beams", "Rack protection", "Load signs", "Mezzanine floor", "Mezzanine stairs & balustrades"] },
    { name: "Roller doors & loading bays", kind: "room", items: ["Roller doors", "Door motors & chains", "Dock levellers", "Dock shelters / seals", "Dock bumpers", "Loading platform edge", "Bay lighting"] },
    { name: "Workshop / production area", kind: "room", items: ["Floor", "Walls", "Three-phase points", "Compressed air lines", "Extraction", "Wash bay"] },
    { name: "Offices", kind: "room", items: [...unitBasics, "Air-conditioning"] },
    ablutions("Ablutions & change rooms"),
    { name: "Canteen", kind: "room", items: [...unitBasics, "Sink & taps", "Geyser"] },
    electrical,
    fireEquipment,
    roof,
    { name: "Yard & parking", kind: "room", items: ["Yard surface", "Truck turning area", "Parking bays & markings", "Stormwater drains", "Boundary walls & fencing", "Palisade / gates", "Gate motors", "Guard house", "Yard lighting", "Refuse area"] },
    signage,
    { name: "Meter readings", kind: "meters", items: ["Electricity", "Water", "Generator hours"] },
    { name: "Keys & remotes", kind: "keys", items: ["Gate keys / remotes", "Roller door keys / remotes", "Office keys", "Alarm remotes", "DB keys"] },
    { name: "Reinstatement & general notes", kind: "notes", items: [] },
  ],
};

const STORAGE: Def = {
  name: "Storage unit – ingoing / outgoing",
  description: "Short condition report for mini-storage and small industrial units.",
  sections: [
    { name: "Unit", kind: "room", items: ["Roller door / door", "Lock & latch", "Floor slab", "Walls", "Roof / ceiling", "Lighting", "Plug point", "Signs of leaks or damp", "Unit number"] },
    { name: "Access", kind: "checklist", items: ["Gate access working", "Access code / tag issued", "Unit left empty and swept (outgoing)"] },
    { name: "Meter readings", kind: "meters", items: ["Electricity"] },
    { name: "Keys & access", kind: "keys", items: ["Unit keys", "Gate tags / remotes"] },
    { name: "Notes", kind: "notes", items: [] },
  ],
};

const INDUSTRIAL_ROUTINE: Def = {
  name: "Industrial – routine",
  description: "Mid-lease walk-through for warehouses, factories and storage units.",
  sections: [
    { name: "Overall", kind: "checklist", items: ["Premises clean and tidy", "Used as per lease", "No unapproved alterations", "No hazardous storage without approval", "Escape routes clear", "Racking not overloaded"] },
    { name: "Warehouse & workshop", kind: "room", items: ["Floor slab", "Walls / cladding", "Columns & guards", "Lighting", "Racking"] },
    { name: "Roller doors & loading bays", kind: "room", items: ["Roller doors", "Door motors", "Dock levellers", "Dock bumpers"] },
    { name: "Services", kind: "room", items: ["Distribution boards", "Fire extinguishers in service date", "Hose reels", "Ablutions"] },
    { name: "Exterior", kind: "room", items: ["Roof & gutters (visible)", "Yard surface", "Stormwater drains", "Fencing & gates", "Signage"] },
    { name: "Maintenance needed", kind: "notes", items: [] },
  ],
};

export const STARTER_TEMPLATES: Def[] = [
  RESIDENTIAL,
  QUICK,
  COMMERCIAL_OFFICE,
  RETAIL,
  COMMERCIAL_ROUTINE,
  INDUSTRIAL,
  STORAGE,
  INDUSTRIAL_ROUTINE,
];

/** Adds the starter templates. Skips any the organisation already has (matched by name). Returns how many were added. */
export async function seedStarterTemplates(tx: Tx, orgId: string) {
  const existing = new Set(
    (await tx.select({ name: schema.templates.name }).from(schema.templates).where(eq(schema.templates.orgId, orgId))).map((r) => r.name),
  );
  let added = 0;
  for (const def of STARTER_TEMPLATES) {
    if (existing.has(def.name)) continue;
    added++;
    const [tpl] = await tx
      .insert(schema.templates)
      .values({ orgId, name: def.name, description: def.description })
      .returning();
    for (const [si, s] of def.sections.entries()) {
      const [sec] = await tx
        .insert(schema.templateSections)
        .values({ templateId: tpl.id, name: s.name, kind: s.kind, position: si })
        .returning();
      if (s.items.length)
        await tx
          .insert(schema.templateItems)
          .values(s.items.map((name, position) => ({ sectionId: sec.id, name, position })));
    }
  }
  return added;
}
