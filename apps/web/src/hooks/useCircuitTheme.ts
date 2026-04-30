import { useTheme } from "@/components/ThemeProvider";

export function useCircuitTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
