/**
 * LogicGateNode Component
 *
 * Renders logic gate components (AND, OR, NOT, etc.).
 * Composite components show a badge; double-clicking opens the inspector dialog
 * (handled at the Canvas/ReactFlow level via onNodeDoubleClick).
 */

import React from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import type { NodeData } from '../../utils/projection';
import { getPrimitiveMetadata, PRIMITIVE_CATEGORIES } from '../../lib/simulation/primitive-metadata';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../primitives/tooltip';

/** Format component name with key parameters, e.g. "Adder(16)" */
function formatComponentLabel(componentRef: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return componentRef;
  // Show width param inline if present (most common case)
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
          // For user-defined components, show the component ref name with params
          return formatComponentLabel(data.componentRef, data.arguments);
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

  // Always render collapsed node (inspector dialog handles expansion)
  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[100px]">
      <div className="relative flex flex-col items-center gap-2">
        {/* Composite badge */}
        {data.isComposite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[8px] text-white">
                &#x229E;
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">Double-click to inspect internals</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Component Label */}
        <div className="text-xs font-medium text-gray-600">
          {data.label || data.componentRef}
        </div>

        {/* Gate Symbol */}
        <div className="flex items-center justify-center">{renderGateSymbol()}</div>

        {/* Inspect hint for composites */}
        {data.isComposite && (
          <div className="text-[9px] text-gray-400">double-click to inspect</div>
        )}
      </div>
    </BaseNode>
  );
}
