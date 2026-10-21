import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EmptyConversationError, exportFilename } from "./export";
import type { Turn } from "./api";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE = `
  @page { margin: 18mm; }
  body { font: 11pt/1.55 Georgia, "Times New Roman", serif; color: #1a1a19; }
  h1 { font: 600 18pt/1.25 system-ui, sans-serif; margin: 0 0 4pt; }
  .meta { font: 9pt system-ui, sans-serif; color: #6b6b66; margin-bottom: 18pt; }
  .label { font: 600 8.5pt system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #6b6b66; margin: 16pt 0 4pt; }
  .user { white-space: pre-wrap; border-left: 3pt solid #c9c6bd; padding-left: 10pt; }
  h2, h3 { font-family: system-ui, sans-serif; margin: 12pt 0 4pt; break-after: avoid; }
  p, ul, ol { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font: 10pt system-ui, sans-serif; break-inside: avoid; }
  th, td { border: .5pt solid #b5b2a8; padding: 4pt 7pt; text-align: left; vertical-align: top; }
  th { background: #efede7; }
  pre { background: #f4f2ec; padding: 8pt; font: 9.5pt/1.45 ui-monospace, Consolas, monospace; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 9.5pt; }
  a { color: #1a1a19; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 8.5pt; color: #6b6b66; word-break: break-all; }
`;

/** Self-contained printable HTML for a conversation. Markdown in replies is rendered, never trusted as HTML. */
export function conversationToHtml(
  title: string,
  turns: Pick<Turn, "user_message" | "model_response">[],
  docTitle = title
): string {
  if (turns.length === 0) throw new EmptyConversationError();
  const body = turns
    .map((t) => {
      const reply = renderToStaticMarkup(
        createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, t.model_response)
      );
      return `<div class="label">You</div><div class="user">${escapeHtml(t.user_message)}</div>
<div class="label">RAGA</div><div>${reply}</div>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title>
<style>${STYLE}</style></head><body><h1>${escapeHtml(title)}</h1>
<div class="meta">Exported from RAGA on ${new Date().toLocaleDateString()}</div>${body}</body></html>`;
}

/**
 * Opens the browser's print dialog for the conversation; choosing "Save as PDF" there produces the
 * file. The hidden frame's title becomes the suggested file name.
 */
export function printConversation(
  title: string,
  turns: Pick<Turn, "user_message" | "model_response">[]
): void {
  const docTitle = exportFilename(title, "markdown").replace(/\.md$/, "");
  const html = conversationToHtml(title, turns, docTitle);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1000);

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error("Couldn't open the print preview.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener("afterprint", cleanup);
  // Give the frame a moment to lay out before printing.
  setTimeout(() => {
    win.focus();
    win.print();
    // Some browsers never fire afterprint; don't leak the frame.
    setTimeout(cleanup, 60_000);
  }, 100);
}
