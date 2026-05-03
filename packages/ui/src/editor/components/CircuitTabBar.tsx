/**
 * CircuitTabBar Component
 *
 * Browser-style tabs for switching between compiled circuits.
 * Replaces the old dropdown selector with a more discoverable tab interface.
 */

'use client';

import { useCircuitPreviewStore } from '../stores/circuit-preview-store';
import { cn } from '../../lib/utils';

export function CircuitTabBar() {
  const compiledCircuits = useCircuitPreviewStore((state) => state.compiledCircuits);
  const selectedCircuitIndex = useCircuitPreviewStore((state) => state.selectedCircuitIndex);
  const selectCircuit = useCircuitPreviewStore((state) => state.selectCircuit);

  const hasCircuits = compiledCircuits.length > 0;

  if (!hasCircuits) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 dark:bg-gray-900">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          No circuits compiled. Write circuit code to see circuits here.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-2 border-b bg-gray-100 dark:bg-gray-900 overflow-x-auto">
      {compiledCircuits.map((circuit, index) => (
        <button
          key={index}
          onClick={() => selectCircuit(index)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-md transition-all whitespace-nowrap',
            'hover:bg-gray-200 dark:hover:bg-gray-700',
            selectedCircuitIndex === index
              ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-400'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent'
          )}
          title={`Switch to ${circuit.name} circuit`}
        >
          {circuit.name}
        </button>
      ))}
    </div>
  );
}
