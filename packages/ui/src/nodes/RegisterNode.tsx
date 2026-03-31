"use client";

import React from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

interface RegisterNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RegisterNode({ data, selected }: RegisterNodeProps) {
  const initialValue = typeof data.arguments?.initial === 'number' ? data.arguments.initial : 0;

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name, index, type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name, index, type: 'output',
  }));

  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[100px]" showPortLabels={data.showPortLabels} onPortClick={data.onPortClick} glowUnconnected={data.glowUnconnected}>
      <div className="relative flex flex-col items-center gap-2">
        {data.isComposite && <CompositeBadge />}
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'Register'}
        </div>
        <div className="px-3 py-2 text-xs font-semibold rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)]">
          REG
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs text-[var(--embed-text-secondary)]">Initial:</div>
          <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded font-mono text-xs">
            {initialValue}
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
