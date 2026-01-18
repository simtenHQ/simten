'use client';

/**
 * ComponentTooltip Component
 *
 * Displays detailed information about a component on hover,
 * similar to Turing Complete game tooltips.
 * Shows component name, description, and input/output states.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface PortInfo {
  index: number;
  label: string;
  value?: boolean; // true = ON, false = OFF, undefined = not connected
}

interface ComponentTooltipProps {
  children: React.ReactNode;
  title: string;
  description: string;
  inputs?: PortInfo[];
  outputs?: PortInfo[];
  enabled?: boolean;
  delayMs?: number;
}

export function ComponentTooltip({
  children,
  title,
  description,
  inputs = [],
  outputs = [],
  enabled = true,
  delayMs = 500,
}: ComponentTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const rect = targetRef.current?.getBoundingClientRect();
      if (rect) {
        // Position tooltip to the right of the component with some offset
        setPosition({
          x: rect.right + 12,
          y: rect.top + rect.height / 2,
        });
        setIsVisible(true);
      }
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleDragStart = () => {
    // Immediately hide tooltip and clear any pending timeout when drag starts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={targetRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragStart={handleDragStart}
        className="h-full w-full"
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <TooltipContent
            title={title}
            description={description}
            inputs={inputs}
            outputs={outputs}
            position={position}
          />,
          document.body
        )}
    </>
  );
}

interface TooltipContentProps {
  title: string;
  description: string;
  inputs: PortInfo[];
  outputs: PortInfo[];
  position: { x: number; y: number };
}

function TooltipContent({ title, description, inputs, outputs, position }: TooltipContentProps) {
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateY(-50%)',
      }}
    >
      <div className="min-w-[240px] rounded-lg border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-white px-5 py-4 shadow-2xl shadow-black/20">
        {/* Title */}
        <div className="mb-2 border-b border-gray-300 pb-2 text-base font-bold uppercase tracking-wide text-gray-800">
          {title}
        </div>

        {/* Description */}
        <div className="mb-4 text-sm leading-relaxed text-gray-700">{description}</div>

        {/* Inputs Section */}
        {inputs.length > 0 && (
          <div className="mb-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">Inputs:</div>
            <div className="space-y-2 rounded-md bg-gray-100/50 px-3 py-2">
              {inputs.map((input) => (
                <PortRow key={`input-${input.index}`} port={input} />
              ))}
            </div>
          </div>
        )}

        {/* Outputs Section */}
        {outputs.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">Outputs:</div>
            <div className="space-y-2 rounded-md bg-gray-100/50 px-3 py-2">
              {outputs.map((output) => (
                <PortRow key={`output-${output.index}`} port={output} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PortRowProps {
  port: PortInfo;
}

function PortRow({ port }: PortRowProps) {
  const getStateColor = (value: boolean | undefined) => {
    if (value === undefined) {
      return 'bg-gray-300 border-gray-400';
    }
    return value ? 'bg-green-500 border-green-600' : 'bg-gray-400 border-gray-500';
  };

  const getStateText = (value: boolean | undefined) => {
    if (value === undefined) {
      return null; // Don't show status for unconnected/template ports
    }
    return value ? 'ON' : 'OFF';
  };

  const stateText = getStateText(port.value);

  return (
    <div className="flex items-center gap-2">
      {/* State indicator dot */}
      <div
        className={cn(
          'h-2.5 w-2.5 rounded-full border transition-colors',
          getStateColor(port.value)
        )}
      />

      {/* Port label and state */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-gray-700">{port.label}</span>
        {stateText && (
          <>
            <span className="text-gray-500">-</span>
            <span
              className={cn(
                'font-medium',
                port.value === true && 'text-green-600',
                port.value === false && 'text-gray-600'
              )}
            >
              {stateText}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
