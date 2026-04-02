import React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      className="w-9 h-9 p-0"
    >
      <svg className="w-5 h-4" viewBox="0 0 20 14" fill="none" strokeLinecap="square" strokeLinejoin="miter">
        {resolvedTheme === "dark" ? (
          /* Low: ____|____ */
          <polyline points="1,12 19,12" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          /* High: ‾‾‾‾|‾‾‾‾ with walls */
          <polyline points="1,12 4,12 4,2 16,2 16,12 19,12" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
    </Button>
  );
}
