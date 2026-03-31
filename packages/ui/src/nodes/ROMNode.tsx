"use client";

import React from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

interface ROMNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function ROMNode({ data, selected }: ROMNodeProps) {
  const initData = data.arguments?.init;

  const getInitDisplay = () => {
    if (!initData) return 'empty';
    if (Array.isArray(initData)) return `[${initData.length} values]`;
    if (typeof initData === 'object') return `{${Object.keys(initData).length} entries}`;
    return 'empty';
  };

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
          {data.label || 'ROM'}
        </div>
        <div className="px-3 py-2 text-xs font-semibold rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)]">
          ROM
        </div>
        <div className="text-xs text-[var(--embed-text-secondary)]">
          {getInitDisplay()}
        </div>
      </div>
    </BaseNode>
  );
}
