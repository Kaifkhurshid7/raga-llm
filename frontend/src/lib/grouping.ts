import type { SessionSummary } from "./api";

export interface SessionGroup {
  label: string;
  sessions: SessionSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LABELS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucket(updatedAt: string, now: Date): number {
  const daysAgo = Math.floor((startOfDay(now) - startOfDay(new Date(updatedAt))) / DAY_MS);
  if (daysAgo <= 0) return 0;
  if (daysAgo === 1) return 1;
  if (daysAgo <= 7) return 2;
  return 3;
}

/** Pinned conversations first, then the rest grouped by how recently they were active. */
export function groupByDate(sessions: SessionSummary[], now = new Date()): SessionGroup[] {
  const pinned = sessions.filter((s) => s.pinned);
  const groups: SessionGroup[] = LABELS.map((label) => ({ label, sessions: [] }));
  for (const s of sessions) {
    if (!s.pinned) groups[bucket(s.updated_at, now)].sessions.push(s);
  }
  const dated = groups.filter((g) => g.sessions.length > 0);
  return pinned.length > 0 ? [{ label: "Pinned", sessions: pinned }, ...dated] : dated;
}
