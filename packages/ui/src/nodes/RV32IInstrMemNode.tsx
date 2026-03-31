"use client";

import React from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import type { NodeData } from './NodeData';

interface RV32IInstrMemNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RV32IInstrMemNode({ data, selected }: RV32IInstrMemNodeProps) {
  const initData = data.arguments?.init;
  const entryCount = Array.isArray(initData) ? initData.length : 0;

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name, index, type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name, index, type: 'output',
  }));

  return (
    <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[120px]" showPortLabels={data.showPortLabels} onPortClick={data.onPortClick} glowUnconnected={data.glowUnconnected}>
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'InstrMem'}
        </div>
        <div className="px-3 py-2 text-xs font-semibold rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)]">
          IMEM
        </div>
        <div className="text-xs text-[var(--embed-text-secondary)]">
          {entryCount > 0 ? `${entryCount} words` : 'empty'}
        </div>
      </div>
    </BaseNode>
  );
}
