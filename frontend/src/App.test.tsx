import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type Json = Record<string, unknown> | unknown[];

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface ApiState {
  sessions: {
    id: string;
    title: string;
    pinned?: boolean;
    archived?: boolean;
    shared?: boolean;
    created_at: string;
    updated_at: string;
  }[];
  turns: Record<string, Record<string, unknown>[]>;
  /** Public share token per session id, when sharing is on. */
  shares: Record<string, string>;
  chat: (body: { message: string; session_id: string | null; replace_from_turn?: number }) => Response;
}

let state: ApiState;
let calls: { method: string; url: string; body?: Record<string, unknown> }[];

const chatCalls = () => calls.filter((c) => c.url === "/api/chat");

function stubFetch() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });

      if (url === "/health") {
        return json({ status: "ok", mock_inference: true, serving_condition: "baseline" });
      }
      if (url.split("?")[0] === "/api/sessions" && method === "GET") {
        const params = new URL(url, "http://x").searchParams;
        const archived = params.get("archived") === "true";
        const q = params.get("q")?.toLowerCase();
        const limit = Number(params.get("limit") ?? 30);
        const offset = Number(params.get("offset") ?? 0);
        const rows = state.sessions
          .filter((s) => Boolean(s.archived) === archived)
          .flatMap((s) => {
            if (!q) return [s];
            if (s.title.toLowerCase().includes(q)) return [s];
            const hit = (state.turns[s.id] ?? []).find((t) =>
              String(t.model_response).toLowerCase().includes(q)
            );
            return hit ? [{ ...s, snippet: String(hit.model_response) }] : [];
          });
        return json(rows.slice(offset, offset + limit));
      }
      const feedback = url.match(/^\/api\/sessions\/([^/]+)\/turns\/([^/]+)\/feedback$/);
      if (feedback && method === "PUT") {
        const turn = state.turns[feedback[1]]?.find((t) => t.id === feedback[2]);
        if (!turn) return json({ detail: "Message not found." }, 404);
        turn.feedback = (body as { rating: string | null }).rating;
        return json({ turn_id: feedback[2], rating: turn.feedback as string | null });
      }
      const share = url.match(/^\/api\/sessions\/([^/]+)\/share$/);
      if (share) {
        const id = share[1];
        const view = () => ({ enabled: Boolean(state.shares[id]), token: state.shares[id] ?? null, shared_at: null });
        if (method === "POST") {
          const rotate = Boolean((body as { rotate?: boolean } | undefined)?.rotate);
          if (rotate || !state.shares[id]) state.shares[id] = `tok-${Math.random().toString(36).slice(2)}`;
          return json(view());
        }
        if (method === "DELETE") {
          delete state.shares[id];
          return new Response(null, { status: 204 });
        }
        return json(view());
      }
      if (url.startsWith("/api/sessions/") && method === "GET") {
        const id = url.split("/").pop()!;
        const s = state.sessions.find((x) => x.id === id);
        return s ? json({ ...s, turns: state.turns[id] ?? [] }) : json({ detail: "Session not found." }, 404);
      }
      if (url.startsWith("/api/sessions/") && method === "PATCH") {
        const id = url.split("/").pop()!;
        const s = state.sessions.find((x) => x.id === id);
        if (!s) return json({ detail: "Session not found." }, 404);
        Object.assign(s, body);
        return json(s);
      }
      if (url.startsWith("/api/sessions/") && method === "DELETE") {
        const id = url.split("/").pop()!;
        state.sessions = state.sessions.filter((s) => s.id !== id);
        return new Response(null, { status: 204 });
      }
      if (url === "/api/sessions" && method === "POST") {
        const now = new Date().toISOString();
        const created = { id: "new-1", title: "Untitled chat", created_at: now, updated_at: now };
        state.sessions.push(created);
        state.turns["new-1"] = [];
        return json(created, 201);
      }
      if (url === "/api/chat" && method === "POST") return state.chat(body as never);
      return json({ detail: "not mocked" }, 500);
    })
  );
}

const reply = (text: string) =>
  json({
    session_id: "s1",
    turn_id: "t-new",
    response: text,
    serving_condition: "baseline",
    model_version: "test-model",
    decoding_config: {},
  });

/** Answers "First answer", "Second answer", ... in order. */
function numberedAnswers() {
  const ordinals = ["First", "Second", "Third", "Fourth"];
  let n = 0;
  return () => reply(`${ordinals[n++]} answer`);
}

beforeEach(() => {
  const now = new Date().toISOString();
  state = {
    sessions: [{ id: "s0", title: "Earlier chat", created_at: now, updated_at: now }],
    shares: {},
    turns: {
      s0: [
        {
          id: "t0",
          created_at: "2026-10-01T10:00:00Z",
          user_message: "What is a raga?",
          model_response: "A melodic framework.",
          model_version: "test-model",
          serving_condition: "baseline",
        },
      ],
    },
    chat: () => reply("Ga is the vadi."),
  };
  stubFetch();
});

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText("Message"), `${text}{Enter}`);
}

describe("App: loading and sending", () => {
  it("shows the home screen and the conversations returned by the backend", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Explore Hindustani classical music."
    );
    expect(await screen.findByRole("button", { name: "Earlier chat" })).toBeInTheDocument();
  });

  it("sends a message and shows the reply", async () => {
    render(<App />);
    await ask("What is the vadi of Yaman?");

    expect(await screen.findByText("Ga is the vadi.")).toBeInTheDocument();
    expect(chatCalls()[0].body).toEqual({ message: "What is the vadi of Yaman?", session_id: null });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("sends a suggestion exactly as written", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "What are vadi and samvadi?" }));
    await screen.findByText("Ga is the vadi.");
    expect(chatCalls()[0].body?.message).toBe("What are vadi and samvadi?");
  });
});

describe("App: failures", () => {
  it("keeps the typed text and offers a retry when the request fails", async () => {
    state.chat = () => json({ detail: "Inference service unavailable." }, 502);
    render(<App />);
    await ask("Tell me about Bhupali");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Inference service unavailable.");
    expect(screen.getByLabelText("Message")).toHaveValue("Tell me about Bhupali");
    expect(screen.queryByText("Tell me about Bhupali", { selector: "p" })).not.toBeInTheDocument();

    state.chat = () => reply("Bhupali is a pentatonic raga.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Bhupali is a pentatonic raga.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("lets the user dismiss an error, which also removes Retry", async () => {
    state.chat = () => json({ detail: "Inference service unavailable." }, 502);
    render(<App />);
    await ask("hello");
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss error" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("hello");
  });

  it("reports an unreachable backend plainly instead of a status code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    render(<App />);
    expect(await screen.findByText("Couldn't load conversations.")).toBeInTheDocument();
    await ask("hello");
    expect(await screen.findByText("Can't reach the server. Check that the backend is running.")).toBeInTheDocument();
  });

  it("shows an error state when the conversation list cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "down" }, 500)));
    render(<App />);
    expect(await screen.findByText("Couldn't load conversations.")).toBeInTheDocument();
  });
});

describe("App: regenerate and edit", () => {
  it("regenerates the latest answer by replacing that turn", async () => {
    state.chat = numberedAnswers();
    render(<App />);
    await ask("What is a raga?");
    await screen.findByText("First answer");

    await userEvent.click(screen.getByRole("button", { name: "Regenerate response" }));

    expect(await screen.findByText("Second answer")).toBeInTheDocument();
    expect(screen.queryByText("First answer")).not.toBeInTheDocument();
    expect(chatCalls()[1].body).toEqual({
      message: "What is a raga?",
      session_id: "s1",
      replace_from_turn: 0,
    });
  });

  it("edits an earlier question and replaces it and everything after it", async () => {
    state.chat = numberedAnswers();
    render(<App />);
    await ask("original question");
    await screen.findByText("First answer");

    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const field = screen.getByLabelText("Edit your message");
    await userEvent.clear(field);
    await userEvent.type(field, "edited question{Enter}");

    expect(await screen.findByText("Second answer")).toBeInTheDocument();
    expect(screen.getByText("edited question")).toBeInTheDocument();
    expect(screen.queryByText("original question")).not.toBeInTheDocument();
    expect(chatCalls()[1].body).toMatchObject({ message: "edited question", replace_from_turn: 0 });
  });

  it("leaves the conversation as it was when a regenerate fails, and can retry it", async () => {
    let attempt = 0;
    state.chat = () => {
      attempt += 1;
      if (attempt === 2) return json({ detail: "Inference service unavailable." }, 502);
      return reply(attempt === 1 ? "First answer" : "Second answer");
    };
    render(<App />);
    await ask("What is a raga?");
    await screen.findByText("First answer");

    await userEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
    const alert = await screen.findByRole("alert");
    expect(screen.getByText("First answer")).toBeInTheDocument();
    expect(screen.getByText("What is a raga?")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Second answer")).toBeInTheDocument();
    expect(chatCalls()[2].body).toMatchObject({ message: "What is a raga?", replace_from_turn: 0 });
  });
});

describe("App: conversations and settings", () => {
  it("deletes a conversation after confirmation", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Options for Earlier chat" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/sessions/s0")).toBe(true)
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Earlier chat" })).not.toBeInTheDocument()
    );
  });

  it("pins a conversation and moves it into the Pinned group", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Options for Earlier chat" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pin" }));

    expect(await screen.findByRole("heading", { name: "Pinned" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ pinned: true });
  });

  it("opens settings from the sidebar, shows server status, and returns to the chat", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByText("Mock (no model connected)")).toBeInTheDocument();
    expect(screen.getByText("baseline")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

async function openMenuFor(title: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Options for ${title}` }));
}

describe("App: search", () => {
  it("searches the backend (not just the visible list) after a debounce and shows snippets", async () => {
    state.sessions.push({
      id: "s9",
      title: "Unrelated title",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    state.turns.s9 = [
      {
        id: "t9",
        user_message: "hi",
        model_response: "Bhairav uses komal Re.",
        model_version: "m",
        serving_condition: "b",
      },
    ];
    render(<App />);
    await screen.findByRole("button", { name: "Unrelated title" });

    await userEvent.type(screen.getByLabelText("Search conversations"), "KOMAL");
    const searchCalls = () => calls.filter((c) => c.url.startsWith("/api/sessions?") && c.url.includes("q="));
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0));
    // Debounced: typing five characters must not send five requests.
    expect(searchCalls().length).toBe(1);

    // The matched text is emphasised inside the snippet.
    expect(await screen.findByText("komal", { selector: "mark" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Earlier chat" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("button", { name: "Earlier chat" })).toBeInTheDocument();
  });

  it("shows the empty-result state", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.type(screen.getByLabelText("Search conversations"), "zzzz");
    expect(await screen.findByText("No matching conversations.")).toBeInTheDocument();
  });
});

describe("App: archive, export, rename", () => {
  it("archives a conversation, offers Undo, and restores it from the toast", async () => {
    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(await screen.findByText("Conversation archived")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ archived: true });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Earlier chat" })).not.toBeInTheDocument());
    // Archived, not deleted.
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Conversation restored")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Earlier chat" })).toBeInTheDocument();
  });

  it("lists archived conversations in Settings and restores one", async () => {
    state.sessions[0].archived = true;
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Restore Earlier chat" }));

    expect(await screen.findByText("Conversation restored")).toBeInTheDocument();
    expect(state.sessions[0].archived).toBe(false);
    expect(await screen.findByText(/No archived conversations/)).toBeInTheDocument();
  });

  it("does not show a success toast when archiving fails", async () => {
    render(<App />);
    await openMenuFor("Earlier chat");
    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PATCH" ? json({ detail: "boom" }, 500) : original(input, init)
      )
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("Conversation archived")).not.toBeInTheDocument();
    // The conversation is still in the history.
    expect(screen.getByRole("button", { name: "Earlier chat" })).toBeInTheDocument();
  });

  it("exports a conversation as Markdown through a download", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => (created.push(b), "blob:x"));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Export as Markdown" }));

    expect(await screen.findByText(/Exported raga-earlier-chat-.*\.md/)).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0]);
    });
    expect(text).toContain("# Earlier chat");
    expect(text).toContain("A melodic framework.");
    click.mockRestore();
  });

  it("exports a PDF by opening the print dialog with the rendered conversation", async () => {
    const print = vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get");
    const fakeWin = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    };
    print.mockReturnValue(fakeWin as unknown as Window);

    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Export as PDF" }));

    expect(await screen.findByText(/Save as PDF/)).toBeInTheDocument();
    await waitFor(() => expect(fakeWin.print).toHaveBeenCalled());
    const html = fakeWin.document.write.mock.calls[0][0] as string;
    expect(html).toContain("<h1>Earlier chat</h1>");
    expect(html).toContain("A melodic framework.");
    print.mockRestore();
  });

  it("reports an export of an empty conversation instead of downloading nothing", async () => {
    state.turns.s0 = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Export as Markdown" }));

    expect(await screen.findByText("There is nothing in this conversation to export yet.")).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("confirms a rename with a toast only after the server accepts it", async () => {
    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByLabelText("Rename conversation Earlier chat");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed{Enter}");

    expect(await screen.findByText("Conversation renamed")).toBeInTheDocument();
    expect(state.sessions[0].title).toBe("Renamed");
  });
});

describe("App: sharing", () => {
  it("is off by default, creates a link on request, copies it, and revokes it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));

    const dialog = await screen.findByRole("dialog", { name: "Share conversation" });
    expect(within(dialog).getByText("Earlier chat")).toBeInTheDocument();
    expect(await within(dialog).findByRole("radio", { name: /Private/ })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).queryByLabelText("Public link")).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/share"))).toBe(false);
    expect(within(dialog).getByText(/Anyone who has the link can read/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("radio", { name: /Anyone with the link/ }));
    const link = (await within(dialog).findByLabelText("Public link")) as HTMLInputElement;
    expect(link.value).toMatch(/\/s\/tok-/);
    expect(link.value).not.toContain("s0"); // not derived from the conversation id

    await userEvent.click(within(dialog).getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(link.value);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();

    const first = link.value;
    await userEvent.click(within(dialog).getByRole("button", { name: /Create a new link/ }));
    await waitFor(() => expect((screen.getByLabelText("Public link") as HTMLInputElement).value).not.toBe(first));

    await userEvent.click(within(dialog).getByRole("radio", { name: /Private/ }));
    await waitFor(() => expect(within(dialog).queryByLabelText("Public link")).not.toBeInTheDocument());
    expect(state.shares.s0).toBeUndefined();
  });

  it("closes with Escape", async () => {
    render(<App />);
    await openMenuFor("Earlier chat");
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    await screen.findByRole("dialog", { name: "Share conversation" });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("App: message actions", () => {
  async function openEarlier() {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Earlier chat" }));
    await screen.findByText("A melodic framework.");
  }

  it("rates an answer, toggles it off, and rolls back when the request fails", async () => {
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Good response" }));
    expect(await screen.findByText("Thanks, feedback submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "true");
    expect(calls.find((c) => c.method === "PUT")?.url).toBe("/api/sessions/s0/turns/t0/feedback");
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ rating: "up" });

    await userEvent.click(screen.getByRole("button", { name: "Good response" }));
    expect(await screen.findByText("Feedback removed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "false");

    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT" ? json({ detail: "nope" }, 500) : original(input, init)
      )
    );
    await userEvent.click(screen.getByRole("button", { name: "Bad response" }));
    expect(await screen.findByText("nope")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bad response" })).toHaveAttribute("aria-pressed", "false");
  });

  it("can rate a freshly generated answer using the turn id from the chat response", async () => {
    render(<App />);
    await ask("Tell me about Yaman");
    await screen.findByText("Ga is the vadi.");
    await userEvent.click(screen.getByRole("button", { name: "Bad response" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PUT")?.url).toBe("/api/sessions/s1/turns/t-new/feedback")
    );
  });

  it("copies an answer and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(writeText).toHaveBeenCalledWith("A melodic framework.");
    expect(await screen.findByText("Answer copied")).toBeInTheDocument();
  });

  it("tells the user when copying fails", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(await screen.findByText("Couldn't copy to the clipboard.")).toBeInTheDocument();
    expect(screen.queryByText("Answer copied")).not.toBeInTheDocument();
  });

  it("asks before an edit discards later messages, and does nothing on cancel", async () => {
    state.turns.s0.push({
      id: "t1",
      user_message: "And Yaman?",
      model_response: "An evening raga.",
      model_version: "test-model",
      serving_condition: "baseline",
    });
    await openEarlier();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit message" })[0]);
    const field = screen.getByLabelText("Edit your message");
    await userEvent.clear(field);
    await userEvent.type(field, "What is a thaat?");
    await userEvent.click(screen.getByRole("button", { name: "Save and resend" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/replaces this message and the 3 messages after it/i);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(chatCalls()).toHaveLength(0);
    expect(screen.getByText("An evening raga.")).toBeInTheDocument();
  });

  it("does not ask when editing the last question", async () => {
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const field = screen.getByLabelText("Edit your message");
    await userEvent.clear(field);
    await userEvent.type(field, "What is a thaat?");
    await userEvent.click(screen.getByRole("button", { name: "Save and resend" }));
    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    expect(chatCalls()[0].body).toMatchObject({ replace_from_turn: 0, session_id: "s0" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("App: keyboard shortcuts", () => {
  it("Ctrl+Shift+O starts a new chat", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Earlier chat" }));
    await screen.findByText("A melodic framework.");
    await userEvent.keyboard("{Control>}{Shift>}o{/Shift}{/Control}");
    await waitFor(() => expect(screen.queryByText("A melodic framework.")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("Ctrl+K focuses the search field", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(screen.getByLabelText("Search conversations")).toHaveFocus());
  });

  it("? opens the shortcut dialog, but not while typing in a field", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.type(screen.getByLabelText("Message"), "why?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("why?");

    await userEvent.click(document.body);
    await userEvent.keyboard("?");
    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Search conversations")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("App: pagination", () => {
  it("loads older conversations with Show more", async () => {
    const now = new Date().toISOString();
    state.sessions = Array.from({ length: 45 }, (_, i) => ({
      id: `p${i}`,
      title: `Chat ${i}`,
      created_at: now,
      updated_at: now,
    }));
    render(<App />);
    await screen.findByRole("button", { name: "Chat 0" });
    expect(screen.queryByRole("button", { name: "Chat 44" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("button", { name: "Chat 44" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("offset=30"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });
});

describe("App: settings", () => {
  it("shows version, shortcuts, privacy and research-system information, and no sign-out", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByText("About RAGA")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText(/research system/)).toBeInTheDocument();
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
    expect(screen.getByText("Privacy and data")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});

describe("App: header actions", () => {
  async function openEarlier() {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Earlier chat" }));
    await screen.findByText("A melodic framework.");
  }

  it("offers only Rename and Share in a new chat, and the full menu once there are messages", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    expect(screen.getByRole("button", { name: "Share conversation" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Earlier chat" }));
    await screen.findByText("A melodic framework.");
    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    expect(screen.getAllByRole("menuitem").length).toBe(6);
  });

  it("creates the conversation on the server when sharing from a new chat", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.click(screen.getByRole("button", { name: "Share conversation" }));

    expect(await screen.findByRole("dialog", { name: "Share conversation" })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST" && c.url === "/api/sessions")).toHaveLength(1);
    // Creating it does not turn sharing on.
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/share"))).toBe(false);
  });

  it("sends the first message into the conversation created for sharing", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.click(screen.getByRole("button", { name: "Share conversation" }));
    await screen.findByRole("dialog", { name: "Share conversation" });
    await userEvent.keyboard("{Escape}");
    await ask("Tell me about Yaman");
    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    expect(chatCalls()[0].body).toMatchObject({ session_id: "new-1" });
  });

  it("renames a new chat before its first message", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Earlier chat" });
    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByLabelText("Conversation title");
    await userEvent.clear(input);
    await userEvent.type(input, "My study{Enter}");
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ title: "My study" }));
    expect(calls.find((c) => c.method === "PATCH")?.url).toBe("/api/sessions/new-1");
  });

  it("opens the share dialog from the header", async () => {
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Share conversation" }));
    expect(await screen.findByRole("dialog", { name: "Share conversation" })).toBeInTheDocument();
  });

  it("pins, archives and deletes the open conversation from the three-dot menu", async () => {
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    const menu = screen.getByRole("menu", { name: "Conversation options" });
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Rename",
      "Pin",
      "Export as Markdown",
      "Export as PDF",
      "Archive",
      "Delete",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Pin" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ pinned: true }));

    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false); // confirmation first
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/sessions/s0")).toBe(true));
    // The deleted conversation is closed, leaving a new chat with the reduced menu.
    await userEvent.click(await screen.findByRole("button", { name: "Conversation options" }));
    await waitFor(() => expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename"]));
  });

  it("renames from the menu and closes the menu with Escape", async () => {
    await openEarlier();
    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByLabelText("Conversation title")).toBeInTheDocument();
  });
});
