"use client";

import { forwardRef } from "react";
import { CircuitEmbed, type CircuitEmbedProps, type CircuitEmbedHandle } from "@turing-incomplete/embed";
import { useTheme } from "@/components/ThemeProvider";

/**
 * CircuitEmbed wrapper that passes the current app theme automatically.
 * Use this in blog posts instead of importing CircuitEmbed directly.
 */
export const ThemedCircuitEmbed = forwardRef<CircuitEmbedHandle, CircuitEmbedProps>(
  function ThemedCircuitEmbed(props, ref) {
    const { resolvedTheme } = useTheme();
    return <CircuitEmbed ref={ref} {...props} theme={(resolvedTheme as "light" | "dark") ?? "dark"} />;
  }
);
