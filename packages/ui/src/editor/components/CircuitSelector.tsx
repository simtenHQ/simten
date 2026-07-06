/**
 * CircuitSelector Component
 *
 * Dropdown selector for choosing which compiled TypeScript circuit to visualize.
 * Displays circuit count and allows switching between multiple circuits
 * when a circuit code file defines multiple circuits.
 */

'use client';

import { cn } from '../../lib/utils';
import { useCircuitPreviewStore } from '../stores/circuit-preview-store';

export function CircuitSelector() {
  const compiledCircuits = useCircuitPreviewStore((state) => state.compiledCircuits);
  const selectedCircuitIndex = useCircuitPreviewStore((state) => state.selectedCircuitIndex);
  const selectCircuit = useCircuitPreviewStore((state) => state.selectCircuit);

  const hasCircuits = compiledCircuits.length > 0;
  const circuitCount = compiledCircuits.length;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50 dark:bg-gray-900">
      <label
        htmlFor="circuit-select"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Circuit:
      </label>
      <select
        id="circuit-select"
        value={selectedCircuitIndex}
        onChange={(e) => selectCircuit(Number(e.target.value))}
        disabled={!hasCircuits}
        className={cn(
          'px-3 py-1 rounded border text-sm',
          'bg-white dark:bg-gray-800',
          'border-gray-300 dark:border-gray-600',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {!hasCircuits && <option value={-1}>No circuits compiled</option>}
        {compiledCircuits.map((circuit, index) => (
          <option key={index} value={index}>
            {circuit.name}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {circuitCount === 0 && 'No circuits compiled'}
        {circuitCount === 1 && '1 circuit compiled'}
        {circuitCount > 1 && `${circuitCount} circuits compiled`}
      </span>
    </div>
  );
}
