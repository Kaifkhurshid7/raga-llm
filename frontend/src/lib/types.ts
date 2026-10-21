/**
 * Evidence metadata. The backend does not return any of this yet; every field is
 * optional and the UI renders nothing for evidence until the API supplies it.
 * See docs/FRONTEND_EVIDENCE_API.md for the fields the frontend expects.
 */
export type EvidenceStatus = "supported" | "partial" | "uncertain";

export interface SourceRef {
  title: string;
  /** Only http(s) links are rendered as links. */
  url?: string;
  detail?: string;
}

export interface AttributeRow {
  label: string;
  value: string;
}

export interface Evidence {
  status?: EvidenceStatus;
  attributes?: AttributeRow[];
  sources?: SourceRef[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  modelVersion?: string;
  servingCondition?: string;
  evidence?: Evidence;
}
