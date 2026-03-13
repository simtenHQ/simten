/**
 * SignalOutputPanel
 *
 * Displays circuit output port values in real-time during simulation.
 * Reads from the port-values store (set by the simulator each tick).
 */

'use client';

import { usePortValuesStore } from '../stores/port-values-store';
import { useCircuitStore } from '../stores';

function formatValue(value: number | boolean | undefined): string {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '1' : '0';
  // Show hex for values > 255, decimal otherwise
  if (Math.abs(value) > 255) {
    return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  }
  return String(value);
}

export function SignalOutputPanel() {
  const circuit = useCircuitStore((state) => state.circuit);
  const portValues = usePortValuesStore((state) => state.portValues);

  if (!circuit || circuit.outputs.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {circuit.outputs.map((output) => {
        // Port values store uses keys like "nodeId.portName"
        // For top-level outputs, try common key patterns
        let value: number | boolean | undefined;
        for (const [key, val] of portValues) {
          if (key.endsWith(`.${output.name}`)) {
            value = val;
          }
        }

        return (
          <div
            key={output.name}
            className="flex items-center gap-1.5 rounded bg-gray-100 dark:bg-[#2a2a2e] px-2 py-1"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {output.name}:
            </span>
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {formatValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
