/**
 * WebComponentEmbed — bridge between code strings and CircuitEmbed.
 *
 * Internal to the web component registration. Not a public API.
 * Takes a `code` string (from the <circuit-embed> HTML attribute),
 * executes it via executeCircuitCode(), and passes the resulting
 * BuiltCircuit to CircuitEmbed.
 */

import { useMemo } from "react";
import { executeCircuitCode } from "@turing-incomplete/core/circuit";
import { CircuitEmbed, type CircuitEmbedProps } from "../CircuitEmbed";

export interface WebComponentEmbedProps {
  code?: string;
  height?: number;
  showControls?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  href?: string;
  autoRunSpeed?: number;
  theme?: "light" | "dark";
}

export function WebComponentEmbed({
  code,
  height,
  showControls,
  title,
  subtitle,
  description,
  href,
  autoRunSpeed,
  theme,
}: WebComponentEmbedProps) {
  const result = useMemo(() => {
    if (!code) return null;
    return executeCircuitCode(code);
  }, [code]);

  if (!code) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        No circuit code provided
      </div>
    );
  }

  if (result?.error) {
    return (
      <div style={{ height }} className="flex items-center justify-center p-4">
        <div className="text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">
          <div className="font-medium mb-1">Error</div>
          <div className="font-mono text-xs whitespace-pre-wrap">{result.error}</div>
        </div>
      </div>
    );
  }

  const builtCircuit = result?.builtCircuits[result.builtCircuits.length - 1];
  if (!builtCircuit) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        No circuit found in code
      </div>
    );
  }

  return (
    <CircuitEmbed
      circuit={builtCircuit}
      height={height}
      showControls={showControls}
      title={title}
      subtitle={subtitle}
      description={description}
      href={href}
      autoRunSpeed={autoRunSpeed}
      theme={theme}
    />
  );
}
