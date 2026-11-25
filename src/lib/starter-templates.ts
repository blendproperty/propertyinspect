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

export async function seedStarterTemplates(tx: Tx, orgId: string) {
  for (const def of [RESIDENTIAL, QUICK]) {
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
}
