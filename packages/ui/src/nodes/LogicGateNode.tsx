
import React from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import type { NodeData } from './NodeData';
import { CompositeBadge } from './CompositeBadge';

const SIMPLE_GATES = new Set([
  'And', 'Or', 'Not', 'Nand', 'Nor', 'Xor', 'Xnor', 'Buffer',
]);

function formatComponentLabel(componentRef: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return componentRef;
  const width = args.width ?? args.input_count;
  if (width !== undefined) return `${componentRef}(${width})`;
  return componentRef;
}

interface LogicGateNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function LogicGateNode({ data, selected }: LogicGateNodeProps) {
  const value = data.value ?? false;

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value,
  }));

  const renderGateSymbol = () => {
    const getSymbol = () => {
      switch (data.componentRef) {
        case 'And': return '&';
        case 'Or': return '≥1';
        case 'Not': return '¬';
        case 'Nand': return '⊼';
        case 'Nor': return '⊽';
        case 'Xor': return '⊕';
        case 'Xnor': return '⊙';
        case 'Buffer': return '▷';
        case 'DFlipFlop': return 'D';
        case 'Register': return 'REG';
        case 'RAM': return 'RAM';
        default: return formatComponentLabel(data.componentRef, data.arguments);
      }
    };

    const symbol = getSymbol();
    const isSimple = SIMPLE_GATES.has(data.componentRef);

    return (
      <div className={`flex items-center justify-center rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)] ${
        isSimple ? 'h-12 w-12 text-2xl font-bold' : 'h-auto w-auto px-3 py-2 text-xs font-semibold'
      }`}>
        {symbol}
      </div>
    );
  };

  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[60px]" showPortLabels={data.showPortLabels} onPortClick={data.onPortClick} glowUnconnected={data.glowUnconnected}>
      <div className="relative flex flex-col items-center gap-1">
        {data.isComposite && <CompositeBadge />}
        <div className="text-xs font-medium text-[var(--embed-text-secondary)]">
          {data.label || data.componentRef}
        </div>
        <div className="flex items-center justify-center">{renderGateSymbol()}</div>
        {data.isComposite && (
          <div className="text-[9px] text-[var(--embed-text-muted)] italic">double-click to inspect</div>
        )}
      </div>
    </BaseNode>
  );
}
