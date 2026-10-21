import type { Evidence } from "../../lib/types";
import AttributeTable from "./AttributeTable";
import EvidenceBadge from "./EvidenceBadge";
import SourceList from "./SourceList";

interface Props {
  evidence?: Evidence;
}

/**
 * Renders only what the backend supplied. With no evidence metadata it renders
 * nothing: the UI does not infer verification from the model's wording.
 */
export default function EvidencePanel({ evidence }: Props) {
  if (!evidence) return null;
  const { status, attributes = [], sources = [] } = evidence;
  if (!status && attributes.length === 0 && sources.length === 0) return null;

  return (
    <div className="mt-3" data-testid="evidence-panel">
      {status && <EvidenceBadge status={status} />}
      <AttributeTable caption="Key facts" rows={attributes} />
      <SourceList sources={sources} />
    </div>
  );
}
