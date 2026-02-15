/**
 * LogicGateNode Component
 *
 * Renders logic gate components (AND, OR, NOT, etc.).
 * Processes input signals and produces output signals.
 */

import React from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import type { NodeData } from '../../utils/projection';
import { getPrimitiveMetadata, PRIMITIVE_CATEGORIES } from '../../lib/simulation/primitive-metadata';

interface LogicGateNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function LogicGateNode({ data, selected }: LogicGateNodeProps) {
  const value = data.value ?? false;

  // Configure input ports using port names
  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  // Configure output ports using port names
  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value,
  }));

  // Render gate-specific symbol (now using componentRef from IR v0.1)
  const renderGateSymbol = () => {
    const getSymbol = () => {
      switch (data.componentRef) {
        case 'And':
          return '&';
        case 'Or':
          return '≥1';
        case 'Not':
          return '¬';
        case 'Nand':
          return '⊼';
        case 'Nor':
          return '⊽';
        case 'Xor':
          return '⊕';
        case 'Xnor':
          return '⊙';
        case 'Buffer':
          return '▷';
        case 'DFlipFlop':
          return 'D';
        case 'Register':
          return 'REG';
        case 'RAM':
          return 'RAM';
        default:
          // For user-defined components, show the component ref name
          return data.componentRef;
      }
    };

    const symbol = getSymbol();

    // Check if this is a simple logic gate (should render as small symbol)
    // Uses metadata as single source of truth instead of hardcoded list
    const metadata = getPrimitiveMetadata(data.componentRef);
    const isSimpleGate = metadata?.category === PRIMITIVE_CATEGORIES.LOGIC_GATES;

    return (
      <div className={`flex items-center justify-center rounded-md bg-gray-100 text-gray-700 ${
        isSimpleGate ? 'h-12 w-12 text-2xl font-bold' : 'h-auto w-auto px-3 py-2 text-xs font-semibold'
      }`}>
        {symbol}
      </div>
    );
  };

  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[100px]">
      <div className="flex flex-col items-center gap-2">
        {/* Component Label */}
        <div className="text-xs font-medium text-gray-600">
          {data.label || data.componentRef}
        </div>

        {/* Gate Symbol */}
        <div className="flex items-center justify-center">{renderGateSymbol()}</div>
      </div>
    </BaseNode>
  );
}
