export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

export const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Cluster", "Duplex", "Cottage", "Office", "Retail", "Industrial", "Building", "Estate", "Other"];
export const PROPERTY_STYLES = ["Freestanding", "Semi-detached", "Simplex", "Duplex", "Penthouse", "Ground floor", "Upper floor"];
export const FURNISHING = ["Unfurnished", "Semi-furnished", "Furnished"];

export const INSPECTION_TYPES = {
  move_in: "Move-in",
  move_out: "Move-out",
  interim: "Interim",
  routine: "Routine",
  standalone: "Standalone",
} as const;
export type InspectionType = keyof typeof INSPECTION_TYPES;

export const INSPECTION_STATUSES = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  in_review: "In review",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
} as const;
export type InspectionStatus = keyof typeof INSPECTION_STATUSES;

export const STATUS_TONE: Record<InspectionStatus, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  in_review: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-200 text-stone-700",
  cancelled: "bg-rose-100 text-rose-800",
};

export const SECTION_KINDS = {
  room: "Room",
  checklist: "Checklist",
  meters: "Meter readings",
  keys: "Keys",
  notes: "Notes",
} as const;
export type SectionKind = keyof typeof SECTION_KINDS;

export const CONTACT_ROLES = {
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
  witness: "Witness",
  other: "Other",
} as const;
export type ContactRole = keyof typeof CONTACT_ROLES;

export const ROLES = {
  admin: "Administrator",
  manager: "Facility manager",
  portfolio: "Portfolio manager",
  inspector: "Inspector",
} as const;
export type RoleKey = keyof typeof ROLES;
/** Roles that can be limited to one property. */
export const SCOPED_ROLES: RoleKey[] = ["manager", "portfolio"];
