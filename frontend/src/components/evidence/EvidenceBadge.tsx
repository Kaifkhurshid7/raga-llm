import type { EvidenceStatus } from "../../lib/types";
import { CheckIcon, InfoIcon } from "../icons";

const LABELS: Record<EvidenceStatus, string> = {
  supported: "Supported by sources",
  partial: "Partially supported",
  uncertain: "Uncertain",
};

interface Props {
  status: EvidenceStatus;
}

/** Status is conveyed by the label text and icon, never by colour alone. */
export default function EvidenceBadge({ status }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
      {status === "supported" ? (
        <CheckIcon className="h-3.5 w-3.5 text-accent" />
      ) : (
        <InfoIcon className="h-3.5 w-3.5" />
      )}
      {LABELS[status]}
    </span>
  );
}
