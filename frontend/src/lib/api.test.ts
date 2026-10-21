import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, isAbortError, listSessions, sendMessage } from "./api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function message(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the request to fail");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("API client errors", () => {
  it("explains a network failure", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await message(listSessions())).toBe("Can't reach the server. Check that the backend is running.");
  });

  it("uses the server's own message when it sends one", async () => {
    stubFetch(async () =>
      json({ detail: "The backend isn't reachable at http://localhost:8000. Start it, then try again." }, 503)
    );
    expect(await message(listSessions())).toContain("The backend isn't reachable");
  });

  it("describes a bare server error without exposing raw status text", async () => {
    stubFetch(async () => new Response("Internal Server Error", { status: 500 }));
    expect(await message(listSessions())).toBe("The server ran into a problem (error 500). Try again.");
  });

  it("joins FastAPI validation messages", async () => {
    stubFetch(async () => json({ detail: [{ msg: "message must not be blank" }, { msg: "too short" }] }, 422));
    expect(await message(sendMessage("x"))).toBe("message must not be blank too short");
  });

  it("rejects a response that is not valid JSON", async () => {
    stubFetch(async () => new Response("<html>oops</html>", { status: 200 }));
    expect(await message(listSessions())).toBe("The server sent an unexpected response.");
  });

  it("rejects a response with the wrong shape", async () => {
    stubFetch(async () => json({ not: "a list" }));
    expect(await message(listSessions())).toBe("The server sent an unexpected response.");
    stubFetch(async () => json({ nope: true }));
    expect(await message(sendMessage("hi"))).toBe("The server sent an unexpected response.");
  });

  it("times out requests that carry no cancel signal", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    const failure = message(listSessions());
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await failure).toBe("The request timed out. Try again.");
  });

  it("lets a user-initiated cancel through as an abort, not an error message", async () => {
    stubFetch(() => Promise.reject(new DOMException("Aborted", "AbortError")));
    const controller = new AbortController();
    const failure = sendMessage("hi", undefined, controller.signal).catch((e) => e);
    controller.abort();
    const error = await failure;
    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe("sendMessage", () => {
  it("includes replace_from_turn only when replacing a turn", async () => {
    const fetchMock = stubFetch(async () => json({ session_id: "s", response: "ok" }));

    await sendMessage("hello", "s1");
    await sendMessage("hello again", "s1", undefined, 2);

    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0]).toEqual({ message: "hello", session_id: "s1" });
    expect(bodies[1]).toEqual({ message: "hello again", session_id: "s1", replace_from_turn: 2 });
  });
});
