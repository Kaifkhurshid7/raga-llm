import { describe, expect, it } from "vitest";
import { formatTranscript } from "./transcript";

describe("formatTranscript", () => {
  it("lists the title, then each question and answer in order", () => {
    const text = formatTranscript("Yaman notes", [
      { user_message: "What is the vadi?", model_response: "Ga." },
      { user_message: "And the samvadi?", model_response: "Ni." },
    ]);
    expect(text).toBe(
      "Yaman notes\n\nYou: What is the vadi?\n\nRAGA: Ga.\n\n---\n\nYou: And the samvadi?\n\nRAGA: Ni."
    );
  });
});
