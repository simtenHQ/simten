/**
 * BaseNode Component
 *
 * Base component for all node types with port rendering.
 * Provides common structure and port handles for connections.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface PortConfig {
  index: number;
  type: 'input' | 'output';
  connected?: boolean;
  value?: boolean;
}

export interface BaseNodeProps {
  children: React.ReactNode;
  inputPorts?: PortConfig[];
  outputPorts?: PortConfig[];
  selected?: boolean;
  className?: string;
}

export function BaseNode({ children, inputPorts = [], outputPorts = [], selected, className }: BaseNodeProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 bg-white shadow-md transition-all',
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-300',
        className
      )}
    >
      {/* Input Ports (Left Side) */}
      {inputPorts.map((port) => (
        <Handle
          key={`in-${port.index}`}
          type="target"
          position={Position.Left}
          id={`in-${port.index}`}
          className={cn(
            'h-3 w-3 rounded-full border-2 transition-colors',
            port.connected ? 'bg-blue-500 border-blue-600' : 'bg-white border-gray-400',
            'hover:bg-blue-300 hover:border-blue-500'
          )}
          style={{
            top: `${((port.index + 1) * 100) / (inputPorts.length + 1)}%`,
            left: '-6px',
          }}
        />
      ))}

      {/* Node Content */}
      <div className="relative px-4 py-3">{children}</div>

      {/* Output Ports (Right Side) */}
      {outputPorts.map((port) => (
        <Handle
          key={`out-${port.index}`}
          type="source"
          position={Position.Right}
          id={`out-${port.index}`}
          className={cn(
            'h-3 w-3 rounded-full border-2 transition-colors',
            port.connected ? 'bg-green-500 border-green-600' : 'bg-white border-gray-400',
            port.value === true && 'bg-green-500 border-green-600',
            port.value === false && 'bg-gray-300 border-gray-400',
            'hover:bg-green-300 hover:border-green-500'
          )}
          style={{
            top: `${((port.index + 1) * 100) / (outputPorts.length + 1)}%`,
            right: '-6px',
          }}
        />
      ))}
    </div>
  );
}
