import { describe, expect, it } from "vitest";
import { EmptyConversationError } from "./export";
import { conversationToHtml } from "./pdf";

const turns = [
  {
    user_message: "Compare <b>Yaman</b> & Bhairav",
    model_response:
      "## Yaman\n\n- Evening raga\n\n| Raga | Time |\n|---|---|\n| Yaman | Night |\n\nSee [source](https://example.org).\n\n<script>alert(1)</script>",
  },
];

describe("conversationToHtml", () => {
  it("renders headings, lists, tables and links from the reply", () => {
    const html = conversationToHtml("Raga notes", turns);
    expect(html).toContain("<h1>Raga notes</h1>");
    expect(html).toContain("<h2>Yaman</h2>");
    expect(html).toContain("<li>Evening raga</li>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>Night</td>");
    expect(html).toContain('<a href="https://example.org">source</a>');
  });

  it("escapes the user's text and never emits raw HTML from a reply", () => {
    const html = conversationToHtml("<img src=x onerror=alert(1)>", turns);
    expect(html).toContain("Compare &lt;b&gt;Yaman&lt;/b&gt; &amp; Bhairav");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("refuses an empty conversation", () => {
    expect(() => conversationToHtml("t", [])).toThrow(EmptyConversationError);
  });
});
