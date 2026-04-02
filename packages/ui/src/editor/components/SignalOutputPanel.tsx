/**
 * SignalOutputPanel
 *
 * Displays circuit output port values in real-time during simulation.
 * Pure presentational — receives portValues as a prop.
 */

'use client';

import { useCircuitStore } from '../stores';

function formatValue(value: number | boolean | undefined): string {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Math.abs(value) > 255) {
    return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  }
  return String(value);
}

export interface SignalOutputPanelProps {
  portValues?: ReadonlyMap<string, boolean | number>;
}

export function SignalOutputPanel({ portValues }: SignalOutputPanelProps) {
  const circuit = useCircuitStore((state) => state.circuit);

  if (!circuit || circuit.outputs.length === 0 || !portValues) return null;

  return (
    <div className="flex items-center gap-3">
      {circuit.outputs.map((output) => {
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
