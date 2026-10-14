import { useCallback, useEffect, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";

export type Theme = "light" | "dark";

const KEY = "raga.theme";

function initialTheme(): Theme {
  const saved = readStorage<Theme | null>(KEY, null);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeStorage(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}
