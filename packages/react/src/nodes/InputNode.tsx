import type React from 'react';
import { useCallback } from 'react';
import { useCanvasActions, useNodeValue } from '../canvas/values';
import { cn } from '../lib/utils';
import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

interface InputNodeProps {
  data: NodeData;
  selected?: boolean;
}

/** A Switch with nothing to write to (the inspector's boundary ports): a lamp, not a switch. */
function SwitchLamp({ data, value }: { data: NodeData; value: boolean }) {
  return (
    <div
      role="img"
      aria-label={`${data.label || data.componentRef}: ${value ? 'on' : 'off'}`}
      className={cn(
        'h-5 w-5 rounded-full shadow-sm',
        value
          ? 'bg-gradient-to-br from-emerald-400 to-green-500'
          : 'bg-gradient-to-br from-gray-300 to-gray-400',
      )}
    />
  );
}

function SwitchToggle({
  data,
  value,
  toggle,
}: {
  data: NodeData;
  value: boolean;
  toggle: (path: string) => void;
}) {
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle(data.path);
    },
    [toggle, data.path],
  );

  return (
    <>
      <button
        onClick={handleToggle}
        role="switch"
        aria-checked={value}
        aria-label={data.label || data.componentRef}
        className={cn(
          'group relative h-9 w-16 rounded-full transition-all duration-300 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 hover:shadow-md active:scale-95',
          value
            ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-sm'
            : 'bg-gradient-to-r from-gray-300 to-gray-400 shadow-sm',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 flex items-center justify-center',
            'h-8 w-8 rounded-full bg-white',
            'shadow-lg transition-all duration-300 ease-out',
            value ? 'translate-x-[1.875rem]' : 'translate-x-0.5',
          )}
        >
          <span className="absolute inset-1 rounded-full bg-gradient-to-br from-white to-gray-50" />
          <span
            className={cn(
              'relative z-10 h-2 w-2 rounded-full transition-all duration-300',
              value
                ? 'bg-gradient-to-br from-emerald-400 to-green-500'
                : 'bg-gradient-to-br from-gray-300 to-gray-400',
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          'text-xs font-semibold tracking-wide transition-colors duration-300',
          value ? 'text-emerald-400' : 'text-[var(--embed-text-secondary)]',
        )}
      >
        {value ? 'ON' : 'OFF'}
      </div>
    </>
  );
}

/** A Switch, or a primitive that only drives outputs. */
export function InputNode({ data, selected }: InputNodeProps) {
  const reading = useNodeValue(data);
  const value = reading !== undefined && reading !== 0;
  const { toggle } = useCanvasActions();

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output' as const,
    value: value ? 1 : 0,
  }));

  return (
    <BaseNode
      outputPorts={outputPorts}
      selected={selected}
      className="min-w-[80px]"
      showPortLabels={data.showPortLabels}
    >
      <div className="relative flex flex-col items-center gap-2">
        {(data.isComposite || data.hasReference) && <CompositeBadge />}
        <div className="px-2 py-1 rounded text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || data.componentRef}
        </div>

        {toggle && data.componentRef === 'Switch' ? (
          <SwitchToggle data={data} value={value} toggle={toggle} />
        ) : (
          <SwitchLamp data={data} value={value} />
        )}
      </div>
    </BaseNode>
  );
}
