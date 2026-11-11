import { FlaskConical } from "lucide-react";

/** Always-visible label so demo numbers are never mistaken for real company data. */
export function FictionalDataBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
      title="Fjordhus Retail A/S is a fictional company. All figures are generated demo data."
    >
      <FlaskConical className="size-3" aria-hidden />
      Fictional data
    </span>
  );
}
