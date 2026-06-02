"use client";

import { useEffect } from "react";
import { useOrkestra } from "@/lib/store";

/** Applique la classe `dark` sur <html> en fonction du store. */
export function ThemeSync() {
  const theme = useOrkestra((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);
  return null;
}
