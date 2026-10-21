import type { SourceRef } from "../../lib/types";

interface Props {
  sources: SourceRef[];
}

function safeHref(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Source references exactly as supplied by the backend. Nothing is generated here. */
export default function SourceList({ sources }: Props) {
  if (sources.length === 0) return null;
  return (
    <section aria-label="Sources" className="mt-3">
      <h3 className="text-xs uppercase tracking-[0.12em] text-faint">Sources</h3>
      <ol className="mt-1.5 space-y-1 text-sm text-muted">
        {sources.map((source, i) => {
          const href = safeHref(source.url);
          return (
            <li key={`${source.title}-${i}`}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                  {source.title}
                </a>
              ) : (
                <span>{source.title}</span>
              )}
              {source.detail && <span className="text-faint"> — {source.detail}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
