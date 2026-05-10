/**
 * WebComponentEmbed — bridge between code strings and CircuitEmbed.
 *
 * Internal to the web component registration. Not a public API.
 * Takes a `code` string (from the <circuit-embed> HTML attribute),
 * compiles it via the sandbox (isolated iframe, separate origin),
 * and passes the resulting BuiltCircuit to CircuitEmbed.
 *
 * Security: code executes only inside the sandbox iframe — never in
 * the main frame. Only plain Circuit IR (JSON) crosses the boundary.
 */

import { useState, useEffect } from "react";
import { SandboxProvider, useSandboxContext } from "@simten/ui/sandbox";
import { buildFromIR } from "@simten/core/circuit";
import type { BuiltCircuit } from "@simten/core/circuit";
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

function WebComponentEmbedInner({
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
  const sandbox = useSandboxContext();
  const [builtCircuit, setBuiltCircuit] = useState<BuiltCircuit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setBuiltCircuit(null);
      setError(null);
      return;
    }

    let cancelled = false;

    sandbox.compile(code).then((result) => {
      if (cancelled) return;

      if ('error' in result) {
        setError(result.error);
        setBuiltCircuit(null);
        return;
      }

      const circuit = result.circuits[result.circuits.length - 1];
      if (!circuit) {
        setError('No circuit found in code');
        setBuiltCircuit(null);
        return;
      }

      setError(null);
      setBuiltCircuit(buildFromIR(circuit, result.libraryCircuits));
    });

    return () => { cancelled = true; };
  }, [code, sandbox]);

  if (!code) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        No circuit code provided
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center p-4">
        <div className="text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">
          <div className="font-medium mb-1">Error</div>
          <div className="font-mono text-xs whitespace-pre-wrap">{error}</div>
        </div>
      </div>
    );
  }

  if (!builtCircuit) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        Compiling...
      </div>
    );
  }

  return (
    <div data-embed-theme={theme ?? "dark"}>
      <CircuitEmbed
        circuit={builtCircuit}
        height={height}
        showControls={showControls}
        title={title}
        subtitle={subtitle}
        description={description}
        href={href}
        forkSource={code}
        autoRunSpeed={autoRunSpeed}
        theme={theme}
      />
    </div>
  );
}

export function WebComponentEmbed(props: WebComponentEmbedProps) {
  return (
    <SandboxProvider>
      <WebComponentEmbedInner {...props} />
    </SandboxProvider>
  );
}
