import type { Turn } from "./api";

/** Formats offered for a single conversation. "pdf" goes through the print dialog (see pdf.ts). */
export type ExportFormat = "markdown" | "json" | "pdf";

interface Exportable {
  title: string;
  created_at?: string;
  updated_at?: string;
  turns: Pick<Turn, "user_message" | "model_response" | "created_at">[];
}

export class EmptyConversationError extends Error {
  constructor() {
    super("There is nothing in this conversation to export yet.");
  }
}

/**
 * Markdown transcript. Assistant replies are already Markdown, so headings, lists, tables and links
 * pass through untouched; the user's text is quoted so it can't be mistaken for structure.
 */
export function toMarkdown(c: Exportable): string {
  if (c.turns.length === 0) throw new EmptyConversationError();
  const lines = [`# ${c.title.replace(/\s+/g, " ").trim()}`, ""];
  if (c.created_at) lines.push(`_Started ${c.created_at}_`, "");
  c.turns.forEach((t, i) => {
    lines.push(`## You (${i + 1})`, "");
    lines.push(...t.user_message.split("\n").map((l) => `> ${l}`), "");
    lines.push("## RAGA", "", t.model_response.trim(), "");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** Structured export. Only user-visible fields: no prompts, decoding settings, token counts or ids. */
export function toJson(c: Exportable): string {
  if (c.turns.length === 0) throw new EmptyConversationError();
  return JSON.stringify(
    {
      title: c.title,
      created_at: c.created_at ?? null,
      updated_at: c.updated_at ?? null,
      exported_at: new Date().toISOString(),
      messages: c.turns.flatMap((t) => [
        { role: "user", content: t.user_message, created_at: t.created_at ?? null },
        { role: "assistant", content: t.model_response, created_at: t.created_at ?? null },
      ]),
    },
    null,
    2
  );
}

/** `raga-<title-slug>-<yyyy-mm-dd>.<ext>`, safe on every filesystem. */
export function exportFilename(title: string, format: ExportFormat, now = new Date()): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 50)
      .replace(/^-+|-+$/g, "") || "conversation";
  const date = now.toISOString().slice(0, 10);
  return `raga-${slug}-${date}.${format === "json" ? "json" : format === "pdf" ? "pdf" : "md"}`;
}

export function buildExport(c: Exportable, format: Exclude<ExportFormat, "pdf">) {
  const body = format === "markdown" ? toMarkdown(c) : toJson(c);
  return {
    filename: exportFilename(c.title, format),
    blob: new Blob([body], {
      type: format === "markdown" ? "text/markdown;charset=utf-8" : "application/json",
    }),
  };
}

/** Hands a blob to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One file holding several conversations, for "export everything". Empty ones are skipped. */
export function buildBundle(conversations: Exportable[]) {
  const exportedAt = new Date().toISOString();
  const body = JSON.stringify(
    {
      exported_at: exportedAt,
      conversations: conversations
        .filter((c) => c.turns.length > 0)
        .map((c) => {
          const { exported_at: _same, ...rest } = JSON.parse(toJson(c));
          return rest;
        }),
    },
    null,
    2
  );
  return {
    filename: `raga-all-conversations-${exportedAt.slice(0, 10)}.json`,
    blob: new Blob([body], { type: "application/json" }),
  };
}
