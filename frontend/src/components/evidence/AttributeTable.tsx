import type { AttributeRow } from "../../lib/types";

interface Props {
  caption: string;
  rows: AttributeRow[];
}

/** Key facts for a raga, rendered as a semantic table. */
export default function AttributeTable({ caption, rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-3 w-full max-w-md border-collapse text-sm">
      <caption className="pb-1.5 text-left text-xs uppercase tracking-[0.12em] text-faint">
        {caption}
      </caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-line">
            <th scope="row" className="w-2/5 py-1.5 pr-3 text-left font-normal text-muted">
              {row.label}
            </th>
            <td className="py-1.5">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
