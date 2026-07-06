import type React from 'react';
import { useCallback, useState } from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import type { NodeData } from './NodeData';

interface NumericInputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function NumericInputNode({ data, selected }: NumericInputNodeProps) {
  const value = data.numericValue ?? 0;
  const width = data.width ?? 8;
  const maxValue = (1 << Math.min(width, 31)) - 1;

  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [displayMode, setDisplayMode] = useState<'dec' | 'hex'>('dec');

  const handleValueClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(value.toString());
      setIsEditingValue(true);
    },
    [value],
  );

  const handleValueKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const trimmed = editValue.trim();
        let parsed = trimmed.toLowerCase().startsWith('0x')
          ? parseInt(trimmed, 16)
          : parseInt(trimmed, 10);
        if (isNaN(parsed)) parsed = 0;
        parsed = Math.max(0, Math.min(maxValue, parsed));
        data.onValueChange?.(parsed);
        setIsEditingValue(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditingValue(false);
      }
    },
    [editValue, maxValue, data],
  );

  const toggleDisplayMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayMode((m) => (m === 'dec' ? 'hex' : 'dec'));
  }, []);

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value: true,
  }));

  const displayValue =
    displayMode === 'hex'
      ? `0x${value
          .toString(16)
          .toUpperCase()
          .padStart(Math.ceil(width / 4), '0')}`
      : value.toString();

  return (
    <BaseNode
      outputPorts={outputPorts}
      selected={selected}
      className="min-w-[100px]"
      showPortLabels={data.showPortLabels}
      onPortClick={data.onPortClick}
      glowUnconnected={data.glowUnconnected}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || data.componentRef}
        </div>
        <div className="flex flex-col items-center gap-1">
          {isEditingValue ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleValueKeyDown}
              onBlur={() => setIsEditingValue(false)}
              className="w-24 px-2 py-1 text-center font-mono text-sm border-2 border-blue-500 rounded focus:outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              onClick={handleValueClick}
              className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded cursor-pointer hover:shadow-md transition-all font-mono text-sm"
              title="Click to edit value"
            >
              {displayValue}
            </div>
          )}
          <button
            onClick={toggleDisplayMode}
            className="text-xs text-[var(--embed-text-secondary)] hover:text-[var(--embed-text-primary)] transition-colors"
          >
            {displayMode === 'dec' ? 'DEC' : 'HEX'}
          </button>
        </div>
        <div className="text-xs text-[var(--embed-text-muted)]">{width}-bit</div>
      </div>
    </BaseNode>
  );
}
