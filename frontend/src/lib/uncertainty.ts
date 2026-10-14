const MARKERS = [
  "don't have a verified record",
  "do not have a verified record",
  "can't confirm",
  "cannot confirm",
  "not confident",
  "not certain",
];

/** True when a reply is a calibrated refusal or hedge rather than a firm answer. */
export function isUncertain(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[’‘]/g, "'");
  return MARKERS.some((m) => normalized.includes(m));
}
