/**
 * BaseNode Component
 *
 * Base component for all node types with port rendering.
 * Provides common structure and port handles for connections.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../../lib/utils';

export interface PortConfig {
  name: string; // Port name (e.g., "a", "b", "out", "clk")
  index: number; // Port position for layout (0, 1, 2, ...)
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
  /** Show port name labels next to handles */
  showPortLabels?: boolean;
  /** Called when a port handle is clicked */
  onPortClick?: (portName: string, portType: 'input' | 'output') => void;
  /** Highlight unconnected ports with a pulsing glow */
  glowUnconnected?: boolean;
}

export function BaseNode({ children, inputPorts = [], outputPorts = [], selected, className, showPortLabels, onPortClick, glowUnconnected }: BaseNodeProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 bg-white dark:bg-[#1a1a1e] shadow-md transition-all',
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-300 dark:border-[#3a3a3e]',
        className
      )}
    >
      {/* Input Ports (Left Side) */}
      {inputPorts.map((port) => {
        const topPct = `${((port.index + 1) * 100) / (inputPorts.length + 1)}%`;
        const unconnected = glowUnconnected && !port.connected;
        return (
          <React.Fragment key={`in-${port.name}`}>
            {/* Glow ring behind the handle */}
            {unconnected && (
              <div
                className="absolute h-5 w-5 rounded-full animate-ping-slow"
                style={{
                  top: topPct,
                  left: '-7px',
                  transform: 'translateY(-50%)',
                  background: 'radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 70%)',
                }}
              />
            )}
            <Handle
              type="target"
              position={Position.Left}
              id={`in-${port.name}`}
              className={cn(
                'h-3 w-3 rounded-full border-2 transition-all duration-200',
                port.connected ? 'bg-blue-500 border-blue-600' : 'bg-white dark:bg-[#2a2a2e] border-gray-400 dark:border-gray-500',
                unconnected && 'border-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]',
                onPortClick && 'cursor-pointer hover:scale-150',
                'hover:bg-blue-300 hover:border-blue-500'
              )}
              style={{ top: topPct, left: '-6px' }}
              onClick={onPortClick ? (e) => { e.stopPropagation(); onPortClick(port.name, 'input'); } : undefined}
            />
            {showPortLabels && (
              <div
                className="absolute text-[9px] font-mono text-gray-400 pointer-events-none select-none"
                style={{ top: topPct, left: '10px', transform: 'translateY(-50%)' }}
              >
                {port.name}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Node Content */}
      <div className="relative px-4 py-3">{children}</div>

      {/* Output Ports (Right Side) */}
      {outputPorts.map((port) => {
        const topPct = `${((port.index + 1) * 100) / (outputPorts.length + 1)}%`;
        const unconnected = glowUnconnected && !port.connected;
        return (
          <React.Fragment key={`out-${port.name}`}>
            {/* Glow ring behind the handle */}
            {unconnected && (
              <div
                className="absolute h-5 w-5 rounded-full animate-ping-slow"
                style={{
                  top: topPct,
                  right: '-7px',
                  transform: 'translateY(-50%)',
                  background: 'radial-gradient(circle, rgba(74,222,128,0.5) 0%, transparent 70%)',
                }}
              />
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={`out-${port.name}`}
              className={cn(
                'h-3 w-3 rounded-full border-2 transition-all duration-200',
                port.connected ? 'bg-green-500 border-green-600' : 'bg-white dark:bg-[#2a2a2e] border-gray-400 dark:border-gray-500',
                port.value === true && 'bg-green-500 border-green-600',
                port.value === false && 'bg-gray-300 border-gray-400',
                unconnected && 'border-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]',
                onPortClick && 'cursor-pointer hover:scale-150',
                'hover:bg-green-300 hover:border-green-500'
              )}
              style={{ top: topPct, right: '-6px' }}
              onClick={onPortClick ? (e) => { e.stopPropagation(); onPortClick(port.name, 'output'); } : undefined}
            />
            {showPortLabels && (
              <div
                className="absolute text-[9px] font-mono text-gray-400 pointer-events-none select-none"
                style={{ top: topPct, right: '10px', transform: 'translateY(-50%)', textAlign: 'right' }}
              >
                {port.name}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
