const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: token("page"),
        surface: token("surface"),
        raised: token("raised"),
        overlay: token("overlay"),
        bubble: token("overlay"),
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        accent: token("accent"),
        "accent-hover": token("accent-hover"),
        "accent-soft": token("accent-soft"),
        "accent-fg": token("accent-fg"),
        line: "var(--line)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["\"Source Serif 4\"", "ui-serif", "Georgia", "serif"],
      },
      keyframes: {
        "message-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "hero-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "dot-pulse": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        "stop-glow": {
          "0%, 100%": { boxShadow: "0 0 0 4px rgb(var(--accent) / 0.3)" },
          "50%": { boxShadow: "0 0 0 4px rgb(var(--accent) / 0.6)" },
        },
      },
      animation: {
        "message-in": "message-in 200ms ease-out both",
        "hero-in": "hero-in 300ms ease-out both",
        "dot-pulse": "dot-pulse 1.2s ease-in-out infinite",
        "stop-glow": "stop-glow 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
