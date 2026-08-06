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

import type { BuiltCircuit } from '@simten/core/circuit';
import { buildFromIR } from '@simten/core/circuit';
import { SandboxProvider, useSandboxContext } from '@simten/ui/sandbox';
import { useEffect, useId, useState } from 'react';
import { CircuitEmbed, type CircuitEmbedProps } from '../CircuitEmbed';
import { ErrorDisplay } from '../components/ErrorDisplay';

export interface WebComponentEmbedProps {
  code?: string;
  height?: number;
  showControls?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  href?: string;
  autoRunSpeed?: number;
  theme?: 'light' | 'dark';
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
  // One compile slot per element. `sandbox.compile` with no slot writes to the
  // shared default, so several <circuit-embed> tags on one page — a blog post
  // with three diagrams — trampled each other and all rendered whichever
  // circuit compiled last. `useCircuitSimulator` already does this for the
  // simulation slot; compilation was the half that was missed.
  const slotId = `wc-${useId()}`;
  const [builtCircuit, setBuiltCircuit] = useState<BuiltCircuit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setBuiltCircuit(null);
      setError(null);
      return;
    }

    let cancelled = false;

    sandbox.compile(code, slotId).then((result) => {
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

    return () => {
      cancelled = true;
    };
  }, [code, sandbox, slotId]);

  if (!code) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        No circuit code provided
      </div>
    );
  }

  if (error) {
    // The package's own ErrorDisplay rather than a bespoke div: it carries
    // role="alert" and aria-live, so a compile failure is announced instead of
    // silently replacing the diagram for anyone using a screen reader.
    return (
      <div style={{ height }} className="flex items-center justify-center p-4">
        <ErrorDisplay error={error} />
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
    <div data-embed-theme={theme ?? 'dark'}>
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
