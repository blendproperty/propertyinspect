import { cx } from "@/lib/format";
import { INSPECTION_STATUSES, STATUS_TONE, type InspectionStatus } from "@/lib/options";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

export const InspectionStatusBadge = ({ status }: { status: InspectionStatus }) => (
  <span className={cx(base, STATUS_TONE[status])}>{INSPECTION_STATUSES[status]}</span>
);
