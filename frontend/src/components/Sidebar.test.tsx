import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "../lib/api";
import Sidebar from "./Sidebar";

const now = new Date().toISOString();
const sessions: SessionSummary[] = [
  { id: "1", title: "Yaman overview", created_at: now, updated_at: now },
  { id: "2", title: "Taal Teentaal", created_at: now, updated_at: now },
];

function setup(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const props: React.ComponentProps<typeof Sidebar> = {
    sessions,
    status: "ready",
    onRetry: vi.fn(),
    activeId: "1",
    query: "",
    onQueryChange: vi.fn(),
    onSelect: vi.fn(),
    onNewChat: vi.fn(),
    onRenameSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onTogglePin: vi.fn(),
    onShareSession: vi.fn(),
    notice: null,
    onDismissNotice: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    userName: "Test User",
    userPhoto: null,
    settingsActive: false,
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe("Sidebar", () => {
  it("lists conversations and marks the active one", () => {
    setup();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yaman overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "Taal Teentaal" })).not.toHaveAttribute("aria-current");
  });

  it("selects a conversation and starts a new chat", async () => {
    const { onSelect, onNewChat } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Taal Teentaal" }));
    expect(onSelect).toHaveBeenCalledWith("2");
    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalled();
  });

  it("reports search input", async () => {
    const { onQueryChange } = setup();
    await userEvent.type(screen.getByLabelText("Search conversations"), "t");
    expect(onQueryChange).toHaveBeenCalledWith("t");
  });

  it("shows an empty state when there are no conversations", () => {
    setup({ sessions: [], status: "ready" });
    expect(screen.getByText("Your conversations will appear here.")).toBeInTheDocument();
  });

  it("shows a no-results message while searching", () => {
    setup({ sessions: [], status: "ready", query: "zzz" });
    expect(screen.getByText("No matching conversations.")).toBeInTheDocument();
  });

  it("shows a loading placeholder before the first load", () => {
    setup({ sessions: [], status: "loading" });
    expect(screen.getByRole("status", { name: "Loading conversations" })).toBeInTheDocument();
  });

  it("shows an error with a retry action", async () => {
    const { onRetry } = setup({ sessions: [], status: "error" });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load conversations.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting, and cancels cleanly", async () => {
    const { onDeleteSession } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Options for Yaman overview" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Yaman overview");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDeleteSession).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    const { onDeleteSession } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Options for Taal Teentaal" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(onDeleteSession).toHaveBeenCalledWith("2");
  });

  it("closes the confirmation dialog with Escape", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Options for Yaman overview" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renames a conversation inline", async () => {
    const { onRenameSession } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Options for Yaman overview" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByLabelText("Rename conversation Yaman overview");
    await userEvent.clear(input);
    await userEvent.type(input, "Yaman notes{Enter}");
    expect(onRenameSession).toHaveBeenCalledWith("1", "Yaman notes");
  });

  it("cancels a rename with Escape", async () => {
    const { onRenameSession } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Options for Yaman overview" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    await userEvent.type(screen.getByLabelText("Rename conversation Yaman overview"), "x{Escape}");
    expect(onRenameSession).not.toHaveBeenCalled();
  });

  it("shows a dismissible notice about a failed action", async () => {
    const { onDismissNotice } = setup({
      notice: { text: "Couldn't delete the conversation.", kind: "error" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't delete the conversation.");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  it("announces an informational notice politely, not as an error", () => {
    setup({ notice: { text: "Conversation copied to the clipboard.", kind: "info" } });
    expect(screen.getByRole("status")).toHaveTextContent("Conversation copied to the clipboard.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Pinned group first", () => {
    setup({ sessions: [{ ...sessions[1], pinned: true }, sessions[0]] });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Pinned", "Today"]);
  });
});

describe("Sidebar conversation menu", () => {
  async function openMenu(title = "Yaman overview") {
    await userEvent.click(screen.getByRole("button", { name: `Options for ${title}` }));
    return screen.getByRole("menu");
  }

  it("offers Rename, Pin, Share and Delete, with Delete last", async () => {
    setup();
    const menu = await openMenu();
    const names = within(menu).getAllByRole("menuitem").map((i) => i.textContent);
    expect(names).toEqual(["Rename", "Pin", "Share", "Delete"]);
  });

  it("opens beside the sidebar, not inside it where it could be clipped", async () => {
    setup();
    const menu = await openMenu();
    expect(menu.closest("aside")).toBeNull();
    expect(menu).toHaveClass("fixed");
  });

  it("pins, and offers Unpin for a pinned conversation", async () => {
    const { onTogglePin } = setup({ sessions: [{ ...sessions[0], pinned: true }, sessions[1]] });
    const menu = await openMenu();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Unpin" }));
    expect(onTogglePin).toHaveBeenCalledWith(expect.objectContaining({ id: "1", pinned: true }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shares", async () => {
    const { onShareSession } = setup();
    const menu = await openMenu();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Share" }));
    expect(onShareSession).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("moves focus into the menu and supports arrow keys and Escape", async () => {
    setup();
    const menu = await openMenu();
    const [rename, pin] = within(menu).getAllByRole("menuitem");
    expect(rename).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(pin).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(rename).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options for Yaman overview" })).toHaveFocus();
  });

  it("closes when clicking elsewhere", async () => {
    setup();
    await openMenu();
    await userEvent.click(screen.getByLabelText("Search conversations"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
