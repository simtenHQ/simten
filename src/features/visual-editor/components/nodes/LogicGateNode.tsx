/**
 * LogicGateNode Component
 *
 * Renders logic gate components (AND, OR, NOT, etc.).
 * Processes input signals and produces output signals.
 */

import React from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import type { NodeData } from '../../utils/projection';

interface LogicGateNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function LogicGateNode({ data, selected }: LogicGateNodeProps) {
  const value = data.value ?? false;

  // Configure input ports
  const inputPorts: PortConfig[] = [];
  for (let i = 0; i < data.inputCount; i++) {
    inputPorts.push({
      index: i,
      type: 'input',
    });
  }

  // Configure output ports
  const outputPorts: PortConfig[] = [];
  for (let i = 0; i < data.outputCount; i++) {
    outputPorts.push({
      index: i,
      type: 'output',
      value,
    });
  }

  // Render gate-specific symbol
  const renderGateSymbol = () => {
    const getSymbol = () => {
      switch (data.componentType) {
        case 'AND_GATE':
          return '&';
        case 'OR_GATE':
          return '≥1';
        case 'NOT_GATE':
          return '¬';
        case 'NAND_GATE':
          return '⊼';
        case 'NOR_GATE':
          return '⊽';
        case 'XOR_GATE':
          return '⊕';
        case 'XNOR_GATE':
          return '⊙';
        case 'BUFFER':
          return '▷';
        default:
          return '?';
      }
    };

    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-2xl font-bold text-gray-700">
        {getSymbol()}
      </div>
    );
  };

  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[100px]">
      <div className="flex flex-col items-center gap-2">
        {/* Component Label */}
        <div className="text-xs font-medium text-gray-600">
          {data.label || data.componentType.replace('_', ' ')}
        </div>

        {/* Gate Symbol */}
        <div className="flex items-center justify-center">{renderGateSymbol()}</div>
      </div>
    </BaseNode>
  );
}
