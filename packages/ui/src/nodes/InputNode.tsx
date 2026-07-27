import type React from 'react';
import { useCallback, useState } from 'react';
import { cn } from '../lib/utils';
import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

interface InputNodeProps {
  data: NodeData;
  selected?: boolean;
}

function NumericInputControl({ data }: { data: NodeData }) {
  const width = data.width ?? 8;
  // Use 2**width, not (1 << width): JS `<<` is signed 32-bit, so `1 << 31` is
  // negative and `1 << 32` wraps to 1 — either way maxValue went bad and clamped
  // every wide input to 0. Cap at 32 (simten's max bus width) → up to 2^32-1.
  const maxValue = 2 ** Math.min(width, 32) - 1;
  const currentValue = data.numericValue ?? 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const setValue = useCallback(
    (newValue: number) => {
      const clamped = Math.max(0, Math.min(maxValue, newValue));
      data.onValueChange?.(clamped);
    },
    [data, maxValue],
  );

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditText(currentValue.toString());
      setIsEditing(true);
    },
    [currentValue],
  );

  const handleFinishEdit = useCallback(() => {
    const parsed = parseInt(editText, 10);
    if (!isNaN(parsed)) setValue(parsed);
    setIsEditing(false);
  }, [editText, setValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') handleFinishEdit();
      else if (e.key === 'Escape') setIsEditing(false);
    },
    [handleFinishEdit],
  );

  const hexDigits = Math.ceil(width / 4);
  const hexValue = currentValue.toString(16).toUpperCase().padStart(hexDigits, '0');

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setValue(currentValue - 1);
          }}
          aria-label="Decrease value"
          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-secondary)] text-sm font-bold active:scale-90 transition-all"
        >
          -
        </button>
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-14 h-7 text-center text-xs font-mono bg-white border border-blue-400 rounded outline-none text-gray-800"
          />
        ) : (
          <button
            onClick={handleStartEdit}
            aria-label={`Current value: ${currentValue}. Click to edit`}
            className="w-14 h-7 flex items-center justify-center rounded bg-[var(--embed-bg-tertiary)] text-emerald-400 font-mono text-sm font-bold hover:opacity-80 transition-colors cursor-text"
          >
            0x{hexValue}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setValue(currentValue + 1);
          }}
          aria-label="Increase value"
          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-secondary)] text-sm font-bold active:scale-90 transition-all"
        >
          +
        </button>
      </div>
      <div className="text-[10px] text-[var(--embed-text-secondary)] font-mono">
        = {currentValue}
      </div>
    </div>
  );
}

export function InputNode({ data, selected }: InputNodeProps) {
  const value = data.value ?? false;
  const isNumericInput = data.componentRef === 'Input';

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onToggle?.();
    },
    [data],
  );

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output' as const,
    value: isNumericInput ? (data.numericValue ?? 0) !== 0 : value,
  }));

  return (
    <BaseNode
      outputPorts={outputPorts}
      selected={selected}
      className="min-w-[80px]"
      showPortLabels={data.showPortLabels}
      onPortClick={data.onPortClick}
      glowUnconnected={data.glowUnconnected}
    >
      <div className="relative flex flex-col items-center gap-2">
        {data.isComposite && <CompositeBadge />}
        <div className="px-2 py-1 rounded text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || data.componentRef}
        </div>

        {isNumericInput ? (
          <NumericInputControl data={data} />
        ) : (
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
        )}
      </div>
    </BaseNode>
  );
}
