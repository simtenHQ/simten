import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@simten/shared/primitives/tooltip';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageStatus } from '@/lib/cc65-compiler';
import { CCodeEditor } from './CCodeEditor';
import { useCC65Compiler } from './useCC65Compiler';
import { useSimulator6502 } from './useSimulator6502';

const hex = (v: number, digits: number) => `$${v.toString(16).toUpperCase().padStart(digits, '0')}`;

/** The status flags worth showing, with their bit in P. B and bit 5 aren't stored. */
const FLAGS = [
  {
    name: 'N',
    bit: 7,
    help: 'Negative: the last result had its top bit set, so read as a signed number it is negative.',
  },
  {
    name: 'V',
    bit: 6,
    help: 'Overflow: the last signed add or subtract went outside -128 to 127.',
  },
  {
    name: 'D',
    bit: 3,
    help: 'Decimal: ADC and SBC count in decimal (BCD) instead of binary.',
  },
  {
    name: 'I',
    bit: 2,
    help: 'Interrupt disable: the CPU ignores interrupt requests. It is on after reset.',
  },
  {
    name: 'Z',
    bit: 1,
    help: 'Zero: the last result was 0. A comparison sets it when the two values are equal.',
  },
  {
    name: 'C',
    bit: 0,
    help: 'Carry: the last add carried out of the top bit, or a shift pushed a 1 out.',
  },
];

function StageIndicator({ label, status }: { label: string; status: StageStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono ${
        status === 'done'
          ? 'text-green-400'
          : status === 'error'
            ? 'text-red-400'
            : status === 'running'
              ? 'text-blue-400'
              : 'text-gray-500'
      }`}
    >
      {status === 'running' && (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
      )}
      {status === 'done' && '✓'}
      {status === 'error' && '✗'}
      {status === 'pending' && '○'}
      {label}
    </span>
  );
}

export function CPU6502Demo() {
  const {
    loading,
    loadError,
    sim,
    consoleText,
    registers,
    halted,
    currentProgram,
    sourceCode,
    programs,
    selectProgram,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    cyclesPerStep,
    handleReset,
    loadCustomBinary,
  } = useSimulator6502();

  const compiler = useCC65Compiler();
  const consoleRef = useRef<HTMLPreElement>(null);
  // The editor shows the loaded program's source until you change it.
  const [editorSource, setEditorSource] = useState(sourceCode);
  const [customRun, setCustomRun] = useState(false);
  const dirty = editorSource !== sourceCode;
  const autoRunRef = useRef(false);

  useEffect(() => {
    setEditorSource(sourceCode);
  }, [sourceCode]);

  // Start fetching the compiler on the first edit, so Compile is quick.
  const { loadWasm } = compiler;
  useEffect(() => {
    if (dirty) void loadWasm();
  }, [dirty, loadWasm]);

  // Auto-scroll the console as text arrives.
  useEffect(() => {
    if (consoleRef.current && consoleText) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleText]);

  // Auto-start running after compile → load → simulator rebuild
  useEffect(() => {
    if (autoRunRef.current && sim.state.ready) {
      autoRunRef.current = false;
      setIsRunning(true);
    }
  }, [sim.state.ready, setIsRunning]);

  const handleSelectProgram = useCallback(
    (id: string) => {
      setCustomRun(false);
      selectProgram(id);
    },
    [selectProgram],
  );

  const handleCompileAndRun = useCallback(async () => {
    setIsRunning(false);
    const result = await compiler.compile(editorSource);
    if (result.success && result.binary) {
      autoRunRef.current = true; // auto-start when simulator rebuilds
      setCustomRun(true);
      loadCustomBinary(result.binary, editorSource);
    }
  }, [compiler, editorSource, loadCustomBinary, setIsRunning]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6">
        <div className="text-red-400 text-sm font-mono">{loadError}</div>
      </div>
    );
  }

  if (loading || !sim.state.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <div>
            <span className="text-sm">
              {loading ? 'Loading program...' : 'Starting the 6502...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
      {/* Program picker */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Program
        </span>
        <div className="flex flex-wrap gap-2">
          {programs.map((prog) => (
            <button
              type="button"
              key={prog.id}
              onClick={() => handleSelectProgram(prog.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                !customRun && currentProgram.id === prog.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-700'
              }`}
            >
              {prog.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: console + source/editor side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700/50">
        {/* Console output */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Console Output
          </div>
          <pre
            ref={consoleRef}
            className="h-48 overflow-auto rounded-lg border border-gray-700 bg-black text-green-400 font-mono text-sm p-3 whitespace-pre-wrap"
          >
            {consoleText || (
              <span className="text-gray-600">{'// Click Run to start the program'}</span>
            )}
          </pre>
        </div>

        {/* C source: edit it and compile your own */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            C source ({customRun ? 'your code' : currentProgram.name}
            {dirty ? ', edited' : ''})
          </div>
          <CCodeEditor value={editorSource} onChange={setEditorSource} className="h-48" />
          {dirty && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCompileAndRun}
                disabled={compiler.compiling}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
              >
                {compiler.compiling ? 'Compiling...' : 'Compile & Run'}
              </button>
              {compiler.compiling ? (
                <div className="flex items-center gap-2">
                  <StageIndicator label="cc65" status={compiler.stages.cc65} />
                  <span className="text-gray-600">→</span>
                  <StageIndicator label="ca65" status={compiler.stages.ca65} />
                  <span className="text-gray-600">→</span>
                  <StageIndicator label="ld65" status={compiler.stages.ld65} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditorSource(sourceCode)}
                  className="text-xs text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Revert
                </button>
              )}
            </div>
          )}
          {dirty && compiler.errors.length > 0 && (
            <pre className="mt-2 max-h-24 overflow-auto rounded-lg border border-red-800/50 bg-red-950/30 text-red-400 font-mono text-xs p-3">
              {compiler.errors.join('\n')}
            </pre>
          )}
          <p className="mt-2 text-[11px] text-gray-500 leading-snug">
            Change the code to compile and run your own. It compiles and runs on the simulated 6502
            in your browser, and nothing is sent to a server. <code>printf</code> works.
            There&apos;s no floating point, and an <code>int</code> is 16&nbsp;bits, so it tops out
            at 32,767.
          </p>
        </div>
      </div>

      {/* Registers: hover a name for what it holds */}
      <TooltipProvider delayDuration={300}>
        <div className="px-4 py-2 border-t border-gray-700/50 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {[
            {
              name: 'PC',
              value: hex(registers.pc, 4),
              help: 'Program counter: the address of the next instruction',
            },
            {
              name: 'A',
              value: hex(registers.a, 2),
              help: 'Accumulator: where arithmetic and logic results go',
            },
            {
              name: 'X',
              value: hex(registers.x, 2),
              help: 'X index register: a counter or an offset into memory',
            },
            {
              name: 'Y',
              value: hex(registers.y, 2),
              help: 'Y index register: a counter or an offset into memory',
            },
            {
              name: 'S',
              value: hex(registers.s, 2),
              help: 'Stack pointer: the next free byte of the stack at $0100-$01FF',
            },
          ].map((r) => (
            <Tooltip key={r.name}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="underline decoration-dotted underline-offset-2">{r.name}</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">{r.value}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 font-sans">
                {r.help}
              </TooltipContent>
            </Tooltip>
          ))}
          {/* P: one box per flag, lit when it is set */}
          <span className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 underline decoration-dotted underline-offset-2"
                >
                  P
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 font-sans">
                Status flags. Each one lights up while it is set, and branch instructions check them
                to decide whether to jump.
              </TooltipContent>
            </Tooltip>
            {FLAGS.map((f) => {
              const on = (registers.p >> f.bit) & 1;
              return (
                <Tooltip key={f.name}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${f.name} flag ${on ? 'set' : 'clear'}`}
                      className={`w-5 h-5 rounded text-[11px] font-semibold cursor-help outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${
                        on
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                      }`}
                    >
                      {f.name}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64 font-sans">
                    {f.help}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </span>
          {halted && <span className="text-green-500">Program finished</span>}
        </div>
      </TooltipProvider>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-gray-900/90">
        {/* Run/Pause */}
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 text-gray-900 dark:text-white'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>

        {/* Step */}
        <button
          type="button"
          onClick={() => void sim.actions.tick()}
          disabled={isRunning}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
        >
          Step
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Reset
        </button>

        {/* Speed slider: cycles run per screen update */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="cpu6502-speed" className="text-xs text-gray-500 dark:text-gray-400">
            Speed
          </label>
          <input
            id="cpu6502-speed"
            type="range"
            min={1}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
          <span className="w-24 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {cyclesPerStep.toLocaleString()} cyc/step
          </span>
        </div>

        {/* Cycle counter */}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
          Cycle {sim.state.cycle.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
