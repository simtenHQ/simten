"use client";

import { useTheme } from "next-themes";

export function useCircuitTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
