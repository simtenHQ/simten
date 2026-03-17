/**
 * RV32IInstrMemNode Component
 *
 * Renders RV32I instruction memory with:
 * - Drag-and-drop binary file loading (like ROM)
 * - Inline code editor with compile button (calls /api/compile)
 */

'use client';

import React, { useCallback, useState, useRef } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useMemoryDataStore } from '../../stores/memory-data-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

const DEFAULT_MEMORY_PATTERN = 'instrmem';

const LANGUAGES = [
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'rust', label: 'Rust' },
  { value: 'asm', label: 'Assembly' },
] as const;

const PLACEHOLDER_CODE: Record<string, string> = {
  c: `void _start() {
    // Write your C code here
    volatile int *result = (volatile int *)0x100;
    *result = 42;
    while (1);
}`,
  cpp: `extern "C" void _start() {
    volatile int *result = (volatile int *)0x100;
    *result = 42;
    while (1) {}
}`,
  rust: `#![no_std]
#![no_main]

#[no_mangle]
pub extern "C" fn _start() -> ! {
    unsafe {
        let result = 0x100 as *mut i32;
        core::ptr::write_volatile(result, 42);
    }
    loop {}
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }`,
  asm: `.global _start
.text
_start:
    li   a0, 42
    li   t0, 0x100
    sw   a0, 0(t0)
1:  j    1b`,
};

interface RV32IInstrMemNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RV32IInstrMemNode({ data, selected }: RV32IInstrMemNodeProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [language, setLanguage] = useState<string>('c');
  const [code, setCode] = useState('');
  const [compileStatus, setCompileStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');
  const [compileError, setCompileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { loadedData, loadData, clearData } = useMemoryDataStore();

  // Use the full nodeId as the memory pattern so each InstrMem gets its own data
  // (important for dual-CPU circuits where multiple InstrMem nodes exist)
  const memoryPattern = data.nodeId || DEFAULT_MEMORY_PATTERN;

  const getLoadedInfo = () => {
    for (const [pattern, entry] of loadedData) {
      if (data.nodeId.toLowerCase().includes(pattern.toLowerCase()) ||
          pattern.toLowerCase().includes(data.nodeId.toLowerCase())) {
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
    setLabelPosition({ x: rect.left + rect.width / 2, y: rect.top });
    setIsEditingLabel(true);
  }, []);

  const handleLabelSave = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const loadBinary = useCallback((binary: Uint8Array, filename: string) => {
    loadData(memoryPattern, binary, filename, 0);
  }, [loadData]);

  const handleFileLoad = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    loadBinary(new Uint8Array(buffer), file.name);
  }, [loadBinary]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
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
    if (file) handleFileLoad(file);
    e.target.value = '';
  }, [handleFileLoad]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearData(memoryPattern);
  }, [clearData]);

  const handleCompile = useCallback(async () => {
    const sourceCode = code || PLACEHOLDER_CODE[language] || '';
    if (!sourceCode.trim()) return;

    setCompileStatus('compiling');
    setCompileError('');

    try {
      const resp = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceCode, language }),
      });

      const result = await resp.json() as {
        success: boolean;
        binary?: string; // base64-encoded (Go encodes []byte as base64 in JSON)
        stderr?: string;
        error?: string;
      };

      if (!result.success) {
        setCompileStatus('error');
        setCompileError(result.stderr || result.error || 'Compilation failed');
        return;
      }

      // Decode base64 binary (Go's encoding/json marshals []byte as base64)
      const b64 = result.binary ?? '';
      const raw = atob(b64);
      const binary = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) binary[i] = raw.charCodeAt(i);
      loadBinary(binary, `program.${language}`);
      setCompileStatus('success');
      setTimeout(() => setCompileStatus('idle'), 2000);
    } catch (e) {
      setCompileStatus('error');
      setCompileError(e instanceof Error ? e.message : 'Network error');
    }
  }, [code, language, loadBinary]);

  const handleToggleCodeEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCodeEditor(prev => !prev);
  }, []);

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name, index, type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name, index, type: 'output',
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
        accept=".bin"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[140px]">
        <div className="flex flex-col items-center gap-2">
          {/* Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'InstrMem'}
          </div>

          {/* Type badge */}
          <div className="h-auto w-auto px-3 py-2 text-xs font-semibold rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
            RV32I_InstrMem
          </div>

          {/* Drop Zone / File Info */}
          <div
            className={`
              flex flex-col items-center gap-1 p-2 rounded border-2 border-dashed cursor-pointer transition-all w-full
              ${isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : loadedInfo
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
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
                <div className="text-xs text-green-700 dark:text-green-400 font-medium truncate max-w-[120px]">
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
                <div className="text-xs text-gray-500 dark:text-gray-400">Drop .bin</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">or click</div>
              </>
            )}
          </div>

          {/* Code Editor Toggle */}
          <button
            onClick={handleToggleCodeEditor}
            className={`
              w-full px-2 py-1 text-xs rounded transition-colors
              ${showCodeEditor
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
              }
            `}
          >
            {showCodeEditor ? 'Hide Code' : 'Code'}
          </button>

          {/* Code Editor Panel */}
          {showCodeEditor && (
            <div
              className="flex flex-col gap-2 w-full min-w-[280px] nodrag"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Language Selector */}
              <div className="flex gap-1">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.value}
                    onClick={() => setLanguage(lang.value)}
                    className={`
                      px-2 py-0.5 text-xs rounded transition-colors
                      ${language === lang.value
                        ? 'bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Code Input */}
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={PLACEHOLDER_CODE[language]}
                className="w-full h-32 p-2 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y"
                spellCheck={false}
              />

              {/* Compile Button */}
              <button
                onClick={handleCompile}
                disabled={compileStatus === 'compiling'}
                className={`
                  w-full px-3 py-1.5 text-xs font-medium rounded transition-colors
                  ${compileStatus === 'compiling'
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-wait'
                    : compileStatus === 'success'
                      ? 'bg-green-500 text-white'
                      : 'bg-violet-600 hover:bg-violet-700 text-white'
                  }
                `}
              >
                {compileStatus === 'compiling' ? 'Compiling...'
                  : compileStatus === 'success' ? 'Loaded!'
                  : 'Compile & Load'}
              </button>

              {/* Error Display */}
              {compileStatus === 'error' && compileError && (
                <div className="p-2 text-xs font-mono rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {compileError}
                </div>
              )}
            </div>
          )}
        </div>
      </BaseNode>
    </>
  );
}
