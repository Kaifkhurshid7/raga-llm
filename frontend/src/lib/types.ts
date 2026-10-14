export interface Message {
  role: "user" | "assistant";
  content: string;
  modelVersion?: string;
  servingCondition?: string;
}
