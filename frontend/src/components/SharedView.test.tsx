import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Markdown from "./Markdown";
import SharedView from "./SharedView";
import { ToastProvider } from "./Toast";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("SharedView", () => {
  it("renders the shared conversation read-only and asks for the token only", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        title: "Yaman basics",
        shared_at: "2026-10-01T10:00:00Z",
        turns: [{ user_message: "What is Yaman?", model_response: "An **evening** raga.", created_at: "2026-10-01T10:00:00Z" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedView token="abc123" />);

    expect(await screen.findByRole("heading", { name: "Yaman basics" })).toBeInTheDocument();
    expect(screen.getByText("What is Yaman?")).toBeInTheDocument();
    expect(screen.getByText("evening")).toBeInTheDocument();
    expect(screen.getByText(/read-only/)).toBeInTheDocument();
    // Nothing an owner could do: no composer, no menus, no sidebar.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("/api/shared/abc123");
    // Keeps the link out of search engines.
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  it("explains an unavailable link without distinguishing revoked from unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "This link is not available." }, 404)));
    render(<SharedView token="gone" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This link isn't available");
  });

  it("offers a retry on a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json({ title: "Back online", shared_at: null, turns: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedView token="t" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Back online" })).toBeInTheDocument();
  });
});

describe("Markdown code blocks", () => {
  it("copies just the code block and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <ToastProvider>
        <Markdown>{"Intro text\n\n```\nSa Re Ga\n```\n"}</Markdown>
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("Sa Re Ga\n");
    expect(await screen.findByText("Code copied")).toBeInTheDocument();
  });
});
