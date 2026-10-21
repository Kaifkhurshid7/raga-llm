import { describe, expect, it } from "vitest";
import { EmptyConversationError, exportFilename, toJson, toMarkdown } from "./export";

const convo = {
  title: "Yaman: vadi & samvadi?",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:05:00Z",
  turns: [
    {
      user_message: "What is Yaman?\n# not a heading",
      model_response:
        "## Yaman\n\n- Evening raga\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nSee [source](https://example.org).",
      created_at: "2026-10-01T10:00:05Z",
    },
  ],
};

describe("export", () => {
  it("keeps the assistant's Markdown intact and quotes the user's text", () => {
    const md = toMarkdown(convo);
    expect(md).toContain("# Yaman: vadi & samvadi?");
    expect(md).toContain("> What is Yaman?\n> # not a heading");
    expect(md).toContain("- Evening raga");
    expect(md).toContain("| a | b |");
    expect(md).toContain("[source](https://example.org)");
  });

  it("exports structured JSON with timestamps and nothing internal", () => {
    const withInternals = {
      ...convo,
      turns: [{ ...convo.turns[0], model_version: "x", decoding_config: {}, prompt_tokens: 3 }],
    };
    const parsed = JSON.parse(toJson(withInternals));
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]).toEqual({
      role: "user",
      content: convo.turns[0].user_message,
      created_at: "2026-10-01T10:00:05Z",
    });
    expect(parsed.messages[1].role).toBe("assistant");
    expect(parsed.created_at).toBe("2026-10-01T10:00:00Z");
    expect(JSON.stringify(parsed)).not.toMatch(/model_version|decoding|token/);
  });

  it("refuses an empty conversation", () => {
    expect(() => toMarkdown({ title: "t", turns: [] })).toThrow(EmptyConversationError);
    expect(() => toJson({ title: "t", turns: [] })).toThrow(EmptyConversationError);
  });

  it("builds safe filenames", () => {
    const d = new Date("2026-10-22T12:00:00Z");
    expect(exportFilename("Yaman: vadi & samvadi?", "markdown", d)).toBe(
      "raga-yaman-vadi-samvadi-2026-10-22.md"
    );
    expect(exportFilename("../../etc/passwd", "json", d)).toBe("raga-etcpasswd-2026-10-22.json");
    expect(exportFilename("???", "json", d)).toBe("raga-conversation-2026-10-22.json");
  });
});
