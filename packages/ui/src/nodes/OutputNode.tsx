import { cn } from '../lib/utils';
import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

interface OutputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function OutputNode({ data, selected }: OutputNodeProps) {
  const value = data.value ?? false;
  const numericValue = data.numericValue ?? 0;

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  const toHexString = (num: number): string => num.toString(16).toUpperCase().padStart(2, '0');

  const renderDisplay = () => {
    if (data.componentRef === 'HexDisplay') {
      const hexValue = toHexString(numericValue);
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="px-2 py-1 rounded text-xs font-medium text-[var(--embed-text-primary)]">
            {data.label || data.componentRef}
          </div>
          <div className="flex items-center justify-center px-4 py-2 bg-black rounded border-2 border-gray-600">
            <span className="text-2xl font-mono font-bold text-green-400">{hexValue}</span>
          </div>
          <div className="text-xs text-[var(--embed-text-secondary)]">Dec: {numericValue}</div>
        </div>
      );
    } else if (data.componentRef === 'SevenSegment') {
      const hexDigit = (numericValue & 0xf).toString(16).toUpperCase();
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="px-2 py-1 rounded text-xs font-medium text-[var(--embed-text-primary)]">
            {data.label || data.componentRef}
          </div>
          <div className="flex items-center justify-center px-3 py-2 bg-black rounded border-2 border-gray-600">
            <span className="text-xl font-mono font-bold text-red-500">{hexDigit}</span>
          </div>
          <div className="text-xs text-[var(--embed-text-secondary)]">
            Dec: {numericValue & 0xf}
          </div>
        </div>
      );
    } else {
      // LED display (default)
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="px-2 py-1 rounded text-xs font-medium text-[var(--embed-text-primary)]">
            {data.label || data.componentRef}
          </div>
          <div
            className={cn(
              'h-10 w-10 rounded-full border-2 transition-all',
              value
                ? 'border-green-600 bg-green-400 shadow-lg shadow-green-500/50'
                : 'border-gray-500 bg-[var(--embed-bg-tertiary)]',
            )}
          >
            {value && (
              <div className="h-full w-full rounded-full bg-gradient-to-br from-green-300 to-green-500" />
            )}
          </div>
          <div
            className={cn(
              'text-xs font-semibold',
              value ? 'text-green-400' : 'text-[var(--embed-text-secondary)]',
            )}
          >
            {value ? 'ON' : 'OFF'}
          </div>
        </div>
      );
    }
  };

  return (
    <BaseNode
      inputPorts={inputPorts}
      selected={selected}
      className="min-w-[80px]"
      showPortLabels={data.showPortLabels}
      onPortClick={data.onPortClick}
      glowUnconnected={data.glowUnconnected}
    >
      <div className="relative">
        {data.isComposite && <CompositeBadge />}
        {renderDisplay()}
      </div>
    </BaseNode>
  );
}
