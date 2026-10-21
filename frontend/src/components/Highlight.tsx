interface Props {
  text: string;
  /** Case-insensitive match to emphasise; plain text when blank. */
  query: string;
}

/** Emphasises every case-insensitive occurrence of `query` without interpreting it as a pattern. */
export default function Highlight({ text, query }: Props) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;

  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-accent/20 px-0.5 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>
    );
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}
