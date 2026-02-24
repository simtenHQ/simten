/**
 * ROMNode Component
 *
 * Renders ROM components with drag-and-drop binary file loading.
 * Data is loaded at runtime, keeping DSL purely structural.
 */

'use client';

import React, { useCallback, useState, useRef } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useMemoryDataStore } from '../../stores/memory-data-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface ROMNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function ROMNode({ data, selected }: ROMNodeProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { loadedData, loadData, clearData } = useMemoryDataStore();

  // Find if there's loaded data for this ROM
  // Check by matching the pattern against the node ID
  const getLoadedInfo = () => {
    for (const [pattern, entry] of loadedData) {
      if (data.nodeId.toLowerCase().includes(pattern.toLowerCase())) {
        return entry;
      }
    }
    return null;
  };

  const loadedInfo = getLoadedInfo();

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setLabelPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setIsEditingLabel(true);
  }, []);

  const handleLabelSave = useCallback((newLabel: string) => {
    setIsEditingLabel(false);
  }, []);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const handleFileLoad = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const fileData = new Uint8Array(buffer);

    // Load data at internal address 0 - the ROM primitive's baseAddress parameter
    // handles address decoding (subtracting base from CPU address), just like
    // real hardware where ROM chips store data at internal addresses 0, 1, 2, ...
    loadData('rom', fileData, file.name, 0);
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
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFileLoad]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearData('rom');
  }, [clearData]);

  // Configure input ports
  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  // Configure output ports
  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
  }));

  return (
    <>
      {isEditingLabel && (
        <LabelEditor
          initialValue={data.label || ''}
          onSave={handleLabelSave}
          onCancel={handleLabelCancel}
          position={labelPosition}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin,.rom"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[120px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'ROM'}
          </div>

          {/* ROM Symbol */}
          <div className="h-auto w-auto px-3 py-2 text-xs font-semibold rounded-md bg-amber-100 text-amber-700">
            ROM
          </div>

          {/* Drop Zone / File Info */}
          <div
            className={`
              flex flex-col items-center gap-1 p-2 rounded border-2 border-dashed cursor-pointer transition-all
              ${isDragOver
                ? 'border-blue-500 bg-blue-50'
                : loadedInfo
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            title={loadedInfo ? 'Click to replace file' : 'Drop .bin file or click to browse'}
          >
            {loadedInfo ? (
              <>
                <div className="text-xs text-green-700 font-medium truncate max-w-[100px]">
                  {loadedInfo.filename}
                </div>
                <div className="text-xs text-green-600">
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
                <div className="text-xs text-gray-500">
                  Drop .bin
                </div>
                <div className="text-xs text-gray-400">
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
