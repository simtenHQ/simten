/**
 * RV32IInstrMemNode Component
 *
 * Renders RV32I instruction memory with:
 * - Drag-and-drop binary file loading
 * - Inline code editor with compile button (calls /api/compile)
 * - Uses onLoadMemory callback to write data via engine.setNode()
 */

'use client';

import React, { useCallback, useState, useRef } from 'react';
import { BaseNode, type PortConfig } from './BaseNode';
import type { NodeData } from './NodeData';

const LANGUAGES = [
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'rust', label: 'Rust' },
  { value: 'asm', label: 'ASM' },
] as const;

// The compiler links a crt0 that provides `_start` (stack setup) and calls
// `main` — templates define `main`, not `_start` (which collides at link).
const PLACEHOLDER_CODE: Record<string, string> = {
  c: `void main() {
    volatile int *uart = (volatile int *)0x80000000;
    const char *msg = "Hello from C!\\n";
    while (*msg) *uart = *msg++;
    while (1);
}`,
  cpp: `extern "C" void main() {
    volatile int *uart = (volatile int *)0x80000000;
    const char *msg = "Hello from C++!\\n";
    while (*msg) *uart = *msg++;
    while (1) {}
}`,
  rust: `#![no_std]
#![no_main]

#[no_mangle]
pub extern "C" fn main() -> ! {
    let uart = 0x80000000 as *mut u32;
    for &b in b"Hello from Rust!\\n" {
        unsafe { core::ptr::write_volatile(uart, b as u32); }
    }
    loop {}
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }`,
  asm: `.global main
.text
main:
    # Write 'H' to UART
    li   t0, 0x80000000
    li   a0, 72
    sw   a0, 0(t0)
1:  j    1b`,
};

interface RV32IInstrMemNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RV32IInstrMemNode({ data, selected }: RV32IInstrMemNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [language, setLanguage] = useState<string>('c');
  const [code, setCode] = useState('');
  const [compileStatus, setCompileStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>(
    'idle',
  );
  const [compileError, setCompileError] = useState('');
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null);
  const [loadedSize, setLoadedSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadBinary = useCallback(
    (binary: Uint8Array, filename: string) => {
      const memoryMap = new Map<number, number>();
      for (let i = 0; i < binary.length; i++) {
        if (binary[i] !== 0) memoryMap.set(i, binary[i]);
      }
      setLoadedFilename(filename);
      setLoadedSize(binary.length);
      data.onLoadMemory?.(memoryMap);
    },
    [data.onLoadMemory],
  );

  const handleFileLoad = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      loadBinary(new Uint8Array(buffer), file.name);
    },
    [loadBinary],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileLoad(file);
    },
    [handleFileLoad],
  );

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

  const handleClickDropZone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileLoad(file);
      e.target.value = '';
    },
    [handleFileLoad],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLoadedFilename(null);
      setLoadedSize(0);
      data.onLoadMemory?.(new Map());
    },
    [data.onLoadMemory],
  );

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

      const result = (await resp.json()) as {
        success: boolean;
        binary?: string;
        stderr?: string;
        error?: string;
      };

      if (!result.success) {
        setCompileStatus('error');
        setCompileError(result.stderr || result.error || 'Compilation failed');
        return;
      }

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
    setShowCodeEditor((prev) => !prev);
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin,.elf"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <BaseNode
        inputPorts={inputPorts}
        outputPorts={outputPorts}
        selected={selected}
        className="min-w-[140px]"
        showPortLabels={data.showPortLabels}
        onPortClick={data.onPortClick}
        glowUnconnected={data.glowUnconnected}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Label */}
          <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
            {data.label || 'InstrMem'}
          </div>

          {/* Type badge */}
          <div className="px-3 py-2 text-xs font-semibold rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)]">
            IMEM
          </div>

          {/* Drop Zone */}
          <div
            className={`
              flex flex-col items-center gap-1 p-2 rounded border-2 border-dashed cursor-pointer transition-all w-full
              ${
                isDragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : loadedFilename
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-[var(--embed-border)] hover:border-blue-400 hover:bg-blue-500/5'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClickDropZone}
            title={loadedFilename ? 'Click to replace' : 'Drop .bin or click'}
          >
            {loadedFilename ? (
              <>
                <div className="text-xs text-green-400 font-medium truncate max-w-[120px]">
                  {loadedFilename}
                </div>
                <div className="text-xs text-[var(--embed-text-muted)]">{loadedSize} bytes</div>
                <button
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <div className="text-xs text-[var(--embed-text-muted)]">Drop .bin</div>
                <div className="text-xs text-[var(--embed-text-muted)]">or click</div>
              </>
            )}
          </div>

          {/* Code Editor Toggle */}
          <button
            onClick={handleToggleCodeEditor}
            className={`
              w-full px-2 py-1 text-xs rounded transition-colors
              ${
                showCodeEditor
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-muted)] hover:bg-violet-500/10 hover:text-violet-400'
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
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => setLanguage(lang.value)}
                    className={`
                      px-2 py-0.5 text-xs rounded transition-colors
                      ${
                        language === lang.value
                          ? 'bg-violet-500/30 text-violet-300'
                          : 'bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-muted)] hover:bg-[var(--embed-bg-tertiary)]/80'
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
                className="w-full h-32 p-2 text-xs font-mono rounded border border-[var(--embed-border)] bg-[var(--embed-bg-code)] text-[var(--embed-text-primary)] resize-y"
                spellCheck={false}
              />

              {/* Compile Button */}
              <button
                onClick={handleCompile}
                disabled={compileStatus === 'compiling'}
                className={`
                  w-full px-3 py-1.5 text-xs font-medium rounded transition-colors
                  ${
                    compileStatus === 'compiling'
                      ? 'bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-muted)] cursor-wait'
                      : compileStatus === 'success'
                        ? 'bg-green-600 text-white'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }
                `}
              >
                {compileStatus === 'compiling'
                  ? 'Compiling...'
                  : compileStatus === 'success'
                    ? 'Loaded!'
                    : 'Compile & Load'}
              </button>

              {/* Error Display */}
              {compileStatus === 'error' && compileError && (
                <div className="p-2 text-xs font-mono rounded bg-red-500/10 text-red-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
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
