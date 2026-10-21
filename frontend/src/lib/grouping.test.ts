import { describe, expect, it } from "vitest";
import type { SessionSummary } from "./api";
import { groupByDate } from "./grouping";

const NOW = new Date(2026, 9, 14, 15, 0, 0); // 14 Oct 2026, local time

function session(id: string, daysAgo: number): SessionSummary {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return { id, title: id, created_at: d.toISOString(), updated_at: d.toISOString() };
}

describe("groupByDate", () => {
  it("buckets sessions by how recently they were active", () => {
    const groups = groupByDate(
      [session("a", 0), session("b", 1), session("c", 4), session("d", 30)],
      NOW
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Previous 7 days", "Older"]);
    expect(groups.map((g) => g.sessions.map((s) => s.id))).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("omits empty groups and keeps the incoming order within a group", () => {
    const groups = groupByDate([session("x", 0), session("y", 0)], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["x", "y"]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByDate([], NOW)).toEqual([]);
  });

  it("puts pinned conversations in their own first group, whatever their age", () => {
    const old = { ...session("old", 90), pinned: true };
    const groups = groupByDate([session("a", 0), old], NOW);
    expect(groups.map((g) => g.label)).toEqual(["Pinned", "Today"]);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["old"]);
  });

  it("treats a missing pinned flag as not pinned", () => {
    expect(groupByDate([session("a", 0)], NOW).map((g) => g.label)).toEqual(["Today"]);
  });
});
