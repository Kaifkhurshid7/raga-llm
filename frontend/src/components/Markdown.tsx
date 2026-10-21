import { useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyIcon } from "./icons";
import { useToast } from "./Toast";

interface Props {
  children: string;
}

/** A code block with its own copy button, so a snippet can be copied without the rest of the answer. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? "");
      toast("Code copied", { kind: "success" });
    } catch {
      toast("Couldn't copy to the clipboard.", { kind: "error" });
    }
  }

  return (
    <div className="group/code relative">
      <pre ref={ref}>{children}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        title="Copy code"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-raised text-muted opacity-0 transition-opacity duration-100 hover:text-ink focus-visible:opacity-100 group-hover/code:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <CopyIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Renders assistant replies: headings, lists, tables, links and code blocks. */
export default function Markdown({ children }: Props) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Wide tables scroll inside the message instead of overflowing the page.
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
