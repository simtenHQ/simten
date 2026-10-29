import { Handle, Position } from '@xyflow/react';
import React from 'react';
import { cn } from '../lib/utils';

export interface PortConfig {
  name: string;
  index: number;
  type: 'input' | 'output';
  connected?: boolean;
  /** Numeric port value: 0/1 for bits, full value for buses. Undefined = not driven. */
  value?: number;
}

/** Vertical room per pin, so a block with many pins grows instead of squeezing them together. */
export const PIN_PITCH = 18;
/** Roughly one character of an 11px monospace pin label. */
const LABEL_CHAR_WIDTH = 7;

/** Height a node needs for the busier of its two pin columns. */
export function pinColumnHeight(pinCount: number): number {
  return (pinCount + 1) * PIN_PITCH;
}

/** Room a column of pin labels needs between the node's edge and its content. */
export function pinLabelGutter(names: string[]): number {
  const longest = names.reduce((max, name) => Math.max(max, name.length), 0);
  return Math.max(32, 18 + longest * LABEL_CHAR_WIDTH);
}

const PIN_LABEL_CLASS =
  'absolute text-[11px] font-mono text-[var(--embed-text-secondary)] pointer-events-none select-none';

/**
 * Pin labels hide when their canvas is zoomed out past the point of reading
 * them. `CircuitCanvas` sets this variable on its wrapper. A variable, not an
 * ancestor selector, because the drill-down canvas renders inside the main one
 * and must follow its own zoom, not the zoom of the canvas around it.
 */
const PIN_LABEL_DISPLAY = 'var(--simten-pin-labels, block)';

interface BaseNodeProps {
  children: React.ReactNode;
  inputPorts?: PortConfig[];
  outputPorts?: PortConfig[];
  selected?: boolean;
  className?: string;
  showPortLabels?: boolean;
  onPortClick?: (portName: string, portType: 'input' | 'output') => void;
  glowUnconnected?: boolean;
}

export function BaseNode({
  children,
  inputPorts = [],
  outputPorts = [],
  selected,
  className,
  showPortLabels,
  onPortClick,
  glowUnconnected,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col justify-center rounded-lg border-2 bg-[var(--embed-bg-secondary)] shadow-md transition-all',
        selected ? 'border-blue-500 shadow-lg' : 'border-[var(--embed-border-node)]',
        className,
      )}
      style={{ minHeight: pinColumnHeight(Math.max(inputPorts.length, outputPorts.length)) }}
    >
      {/* Input Ports (Left Side) */}
      {inputPorts.map((port) => {
        const topPct = `${((port.index + 1) * 100) / (inputPorts.length + 1)}%`;
        const unconnected = glowUnconnected && !port.connected;
        return (
          <React.Fragment key={`in-${port.name}`}>
            {unconnected && (
              <div
                className="absolute h-5 w-5 rounded-full animate-ping"
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
                // Transition colour and scale only. `transition-all` also animated
                // `top`, and handles are positioned as a percentage of node
                // height — so adding a port set every handle moving. React Flow
                // measures handle bounds once, right after the DOM updates, and
                // was catching them mid-flight: edges then routed to coordinates
                // the handles had already left, and nothing re-measured.
                'h-3 w-3 rounded-full border-2 transition-[background-color,border-color,transform] duration-200',
                port.connected
                  ? 'bg-blue-500 border-blue-600'
                  : 'bg-[var(--embed-bg-tertiary)] border-[var(--embed-border-node)]',
                unconnected && 'border-blue-400',
                onPortClick && 'cursor-pointer hover:scale-150',
                'hover:bg-blue-300 hover:border-blue-500',
              )}
              style={{ top: topPct, left: '-6px' }}
              onClick={
                onPortClick
                  ? (e) => {
                      e.stopPropagation();
                      onPortClick(port.name, 'input');
                    }
                  : undefined
              }
            />
            {showPortLabels && (
              <div
                className={PIN_LABEL_CLASS}
                style={{
                  top: topPct,
                  left: '10px',
                  transform: 'translateY(-50%)',
                  display: PIN_LABEL_DISPLAY,
                }}
              >
                {port.name}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Node Content */}
      {/* Port labels sit inside the node, so the content needs to give them
          room or they collide with it — on a two-input gate the box is ~88px
          wide, and a symbol plus `a`/`b`/`out` does not fit in that. Each side
          is as wide as its longest label, so `timing_ctrl` gets more than `a`. */}
      <div
        className="relative px-3 py-2"
        style={
          showPortLabels
            ? {
                paddingLeft: pinLabelGutter(inputPorts.map((p) => p.name)),
                paddingRight: pinLabelGutter(outputPorts.map((p) => p.name)),
              }
            : undefined
        }
      >
        {children}
      </div>

      {/* Output Ports (Right Side) */}
      {outputPorts.map((port) => {
        const topPct = `${((port.index + 1) * 100) / (outputPorts.length + 1)}%`;
        const unconnected = glowUnconnected && !port.connected;
        return (
          <React.Fragment key={`out-${port.name}`}>
            {unconnected && (
              <div
                className="absolute h-5 w-5 rounded-full animate-ping"
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
                // Transition colour and scale only. `transition-all` also animated
                // `top`, and handles are positioned as a percentage of node
                // height — so adding a port set every handle moving. React Flow
                // measures handle bounds once, right after the DOM updates, and
                // was catching them mid-flight: edges then routed to coordinates
                // the handles had already left, and nothing re-measured.
                'h-3 w-3 rounded-full border-2 transition-[background-color,border-color,transform] duration-200',
                port.connected
                  ? 'bg-green-500 border-green-600'
                  : 'bg-[var(--embed-bg-tertiary)] border-[var(--embed-border-node)]',
                // Values are numeric (0/1 for bits, full value for buses).
                // These were `=== true` / `=== false` against a `boolean`-typed
                // field that has always carried numbers at runtime.
                port.value !== undefined && port.value !== 0 && 'bg-green-500 border-green-600',
                port.value === 0 && 'bg-gray-300 border-gray-400',
                unconnected && 'border-green-400',
                onPortClick && 'cursor-pointer hover:scale-150',
                'hover:bg-green-300 hover:border-green-500',
              )}
              style={{ top: topPct, right: '-6px' }}
              onClick={
                onPortClick
                  ? (e) => {
                      e.stopPropagation();
                      onPortClick(port.name, 'output');
                    }
                  : undefined
              }
            />
            {showPortLabels && (
              <div
                className={PIN_LABEL_CLASS}
                style={{
                  top: topPct,
                  right: '10px',
                  transform: 'translateY(-50%)',
                  textAlign: 'right',
                  display: PIN_LABEL_DISPLAY,
                }}
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
