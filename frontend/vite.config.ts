import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

/** Proxy to the backend; if it is down, answer with a clear 503 instead of an empty 500. */
const backendProxy = {
  target: apiTarget,
  configure: (proxy: {
    on: (event: "error", handler: (err: Error, req: unknown, res: unknown) => void) => void;
  }) => {
    proxy.on("error", (_err, _req, res) => {
      const out = res as { headersSent?: boolean; writeHead?: Function; end?: Function };
      if (out.writeHead && out.end && !out.headersSent) {
        out.writeHead(503, { "Content-Type": "application/json" });
        out.end(
          JSON.stringify({
            detail: `The backend isn't reachable at ${apiTarget}. Start it, then try again.`,
          })
        );
      }
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backendProxy,
      "/health": backendProxy,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
