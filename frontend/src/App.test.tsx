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
    created_at: string;
    updated_at: string;
  }[];
  turns: Record<string, unknown[]>;
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
      if (url === "/api/sessions" && method === "GET") return json(state.sessions);
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
      if (url === "/api/chat" && method === "POST") return state.chat(body as never);
      return json({ detail: "not mocked" }, 500);
    })
  );
}

const reply = (text: string) =>
  json({
    session_id: "s1",
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
    turns: {
      s0: [
        {
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

  it("shares a conversation by copying its text when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText }, share: undefined });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Options for Earlier chat" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));

    expect(await screen.findByText("Conversation copied to the clipboard.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      "Earlier chat\n\nYou: What is a raga?\n\nRAGA: A melodic framework."
    );
  });

  it("uses the system share sheet when the browser has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText }, share });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Options for Earlier chat" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Earlier chat" })));
    expect(writeText).not.toHaveBeenCalled();
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
