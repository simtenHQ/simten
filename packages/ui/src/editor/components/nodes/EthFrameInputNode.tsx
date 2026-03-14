/**
 * EthFrameInputNode Component
 *
 * Renders Eth_FrameInput components with drag-and-drop binary frame loading.
 * Accepts raw binary frame data (starting at dst MAC, no preamble/SFD).
 */

'use client';

import React, { useCallback, useState, useRef } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useMemoryDataStore } from '../../stores/memory-data-store';
import type { NodeData } from '../../utils/projection';

interface EthFrameInputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function EthFrameInputNode({ data, selected }: EthFrameInputNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { loadedData, loadData, clearData } = useMemoryDataStore();

  const getLoadedInfo = () => {
    for (const [pattern, entry] of loadedData) {
      if (data.nodeId.toLowerCase().includes(pattern.toLowerCase())) {
        return entry;
      }
      if ('eth_frameinput'.includes(pattern.toLowerCase())) {
        return entry;
      }
    }
    return null;
  };

  const loadedInfo = getLoadedInfo();

  const handleFileLoad = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const fileData = new Uint8Array(buffer);
    loadData('eth_frameinput', fileData, file.name, 0);
  }, [loadData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileLoad(file);
    }
  }, [handleFileLoad]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
    e.target.value = '';
  }, [handleFileLoad]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearData('eth_frameinput');
  }, [clearData]);

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
  }));

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin,.raw,.pcap"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[120px]">
        <div className="flex flex-col items-center gap-2">
          <div className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300">
            {data.label || 'Eth_FrameInput'}
          </div>

          <div className="h-auto w-auto px-3 py-2 text-xs font-semibold rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
            MAC RX
          </div>

          <div
            className={`
              flex flex-col items-center gap-1 p-2 rounded border-2 border-dashed cursor-pointer transition-all
              ${isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : loadedInfo
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            title={loadedInfo ? 'Click to replace frame' : 'Drop raw frame .bin or click to browse'}
          >
            {loadedInfo ? (
              <>
                <div className="text-xs text-green-700 dark:text-green-400 font-medium truncate max-w-[100px]">
                  {loadedInfo.filename}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">
                  {loadedInfo.data.size} bytes
                </div>
                <button
                  onClick={handleClear}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Drop frame .bin
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  or click
                </div>
              </>
            )}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
