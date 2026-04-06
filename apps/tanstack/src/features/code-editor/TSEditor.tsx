/**
 * TSEditor Component
 *
 * Monaco-based TypeScript editor for writing circuit definitions using
 * the circuit() builder API. Drop-in replacement for DSLEditor.
 *
 * Uses Monaco's built-in TypeScript language service for autocomplete,
 * type checking, and error display. Compilation uses executeCircuitCode()
 * which strips types via sucrase and executes the code.
 */

"use client";

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import Editor from "@monaco-editor/react";
import type { OnMount, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { executeCircuitCode } from "@turing-incomplete/core/circuit";
import type { Circuit } from "@turing-incomplete/core";
import { CompileButton } from "./CompileButton";
import { ErrorDisplay } from "./ErrorDisplay";
import type { CompilationError } from "./ErrorDisplay";
import { EDITOR_TYPE_DECLARATIONS } from "./editor-types";

// ============================================================================
// Default code
// ============================================================================

const DEFAULT_CODE = `// Circuit Editor — TypeScript Mode
//
// Build circuits using the circuit() API.
// All standard components are available: And, Or, Xor, Not, Mux, Register, etc.
//
// Example: Half Adder

const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { x: Xor, a: And },
  connect: ({ in: inp, out, x, a }) => [
    inp.a.to(x.a, a.a),
    inp.b.to(x.b, a.b),
    x.out.to(out.sum),
    a.out.to(out.carry),
  ],
})
`;

const DEFAULT_STORAGE_KEY = "turing-incomplete-ts-code";

// ============================================================================
// Types
// ============================================================================

export interface TSEditorRef {
  getCode: () => string;
  setCode: (code: string) => void;
  compile: () => void;
}

interface TSEditorProps {
  onCompileSuccess?: (
    circuits: Circuit[],
    tsCode: string,
    componentLibrary?: {
      resolveCircuit: (name: string) => Circuit | undefined;
      getAllPrimitiveNames: () => string[];
    },
  ) => void;
  autoCompileEnabled?: boolean;
  showHeader?: boolean;
  storageKey?: string | null;
  initialCode?: string;
  onCodeChange?: (code: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const TSEditor = forwardRef<TSEditorRef, TSEditorProps>(function TSEditor(
  {
    onCompileSuccess,
    autoCompileEnabled = false,
    showHeader = true,
    storageKey = DEFAULT_STORAGE_KEY,
    initialCode,
    onCodeChange,
  },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Code state
  const [code, setCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return DEFAULT_CODE;
  });

  // Compilation state
  const [errors, setErrors] = useState<CompilationError[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Code changes ──

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value ?? "";
    setCode(newCode);
    if (storageKey) localStorage.setItem(storageKey, newCode);
    onCodeChange?.(newCode);
  }, [storageKey, onCodeChange]);

  // ── Compilation ──

  const handleCompile = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    setIsCompiling(true);
    if (!silent) setErrors([]);
    setSuccessMessage(null);

    setTimeout(() => {
      try {
        const result = executeCircuitCode(code);

        if (result.error) {
          // Try to extract line info from error message
          const lineMatch = result.error.match(/\((\d+):(\d+)\)/);
          setErrors([{
            message: result.error,
            line: lineMatch ? parseInt(lineMatch[1]) : 0,
            column: lineMatch ? parseInt(lineMatch[2]) : 0,
          }]);
          setIsCompiling(false);
          return;
        }

        if (result.circuits.length === 0) {
          if (!silent) {
            setErrors([{
              message: "No circuits found. Use circuit('Name', { ... }) to define a circuit.",
              line: 0,
              column: 0,
            }]);
          }
          setIsCompiling(false);
          return;
        }

        // Success
        setErrors([]);
        if (!silent) {
          const names = result.circuits.map(c => c.name).join(", ");
          setSuccessMessage(`Compiled ${result.circuits.length} circuit(s): ${names}`);
        }

        // Build library for simulation
        const library = {
          resolveCircuit: (name: string) => result.library.resolveCircuit(name),
          getAllPrimitiveNames: () => result.library.getAllPrimitiveNames(),
        };

        onCompileSuccess?.(result.circuits, code, library);
      } catch (e) {
        setErrors([{
          message: e instanceof Error ? e.message : String(e),
          line: 0,
          column: 0,
        }]);
      } finally {
        setIsCompiling(false);
      }
    }, 0);
  }, [code, onCompileSuccess]);

  // ── Auto-compile ──

  useEffect(() => {
    if (!autoCompileEnabled || !code) return;
    const timer = setTimeout(() => handleCompile({ silent: true }), 500);
    return () => clearTimeout(timer);
  }, [code, autoCompileEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monaco setup ──

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure TypeScript compiler options for the editor
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      strict: false, // Don't require strict types — user code is casual
      noEmit: true,
      allowJs: true,
      esModuleInterop: true,
    });

    // Add type declarations for the injected scope
    // Generic types enable autocomplete for port names in connect() callbacks
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      EDITOR_TYPE_DECLARATIONS,
      "gate-dev.d.ts",
    );

    // Set editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      wordWrap: "on",
      tabSize: 2,
    });
  };

  // ── Markers (error squiggles) ──

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const markers = errors
      .filter(e => e.line > 0)
      .map(e => ({
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: e.line,
        startColumn: e.column || 1,
        endLineNumber: e.line,
        endColumn: e.column ? e.column + 10 : 1000,
      }));

    monaco.editor.setModelMarkers(model, "ts-editor", markers);
  }, [errors]);

  // ── Ref ──

  useImperativeHandle(ref, () => ({
    getCode: () => code,
    setCode: (newCode: string) => {
      setCode(newCode);
      editorRef.current?.setValue(newCode);
      if (storageKey) localStorage.setItem(storageKey, newCode);
    },
    compile: () => handleCompile(),
  }));

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">TypeScript</span>
          <div className="flex items-center gap-2">
            {successMessage && (
              <span className="text-xs text-green-600">{successMessage}</span>
            )}
            <CompileButton onClick={() => handleCompile()} isCompiling={isCompiling} />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Editor
          language="typescript"
          theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
          }}
        />
      </div>

      {errors.length > 0 && (
        <ErrorDisplay errors={errors} />
      )}
    </div>
  );
});

// Type declarations moved to editor-types.ts
const _DEPRECATED = `
// Builder API
declare function circuit(name: string): CircuitBuilder;

declare const bit: PortType;
declare function bus(width: number): PortType;

interface PortType {
  readonly kind: 'bit' | 'bus';
}

interface PortRef {
  to(...targets: PortRef[]): ConnectionDef;
}

interface ConnectionDef {}

interface CircuitBuilder {
  in(name: string, type: PortType | number): CircuitBuilder;
  out(name: string, type: PortType | number): CircuitBuilder;
  node(name: string, component: any): CircuitBuilder;
  connect(fn: (arg: any) => ConnectionDef[]): CircuitBuilder;
  eval(fn: (inputs: any) => any): CircuitBuilder;
  state(initial: any): CircuitBuilder;
  onTick(fn: (inputsAndState: any) => any): CircuitBuilder;
  impl(fn: (c: CircuitBuilder) => CircuitBuilder): CircuitBuilder;
  meta(meta: { category?: string; description?: string; icon?: string }): CircuitBuilder;
  build(): BuiltCircuit;
}

interface BuiltCircuit {
  readonly name: string;
  readonly circuit: any;
}

// Standard Library — Logic Gates
declare const And: BuiltCircuit;
declare const Or: BuiltCircuit;
declare const Not: BuiltCircuit;
declare const Xor: BuiltCircuit;
declare const Nand: BuiltCircuit;
declare const Nor: BuiltCircuit;
declare const Xnor: BuiltCircuit;
declare const Buffer: BuiltCircuit;

// Standard Library — Arithmetic
declare const Adder: BuiltCircuit;
declare const Subtractor: BuiltCircuit;
declare const Multiplier: BuiltCircuit;
declare const Comparator: BuiltCircuit;
declare const Incrementer: BuiltCircuit;
declare const LeftShifter: BuiltCircuit;
declare const RightShifter: BuiltCircuit;
declare const SignedAdder: BuiltCircuit;
declare const SignedComparator: BuiltCircuit;
declare const SignedMultiplier: BuiltCircuit;
declare const BusAnd: BuiltCircuit;
declare const BusOr: BuiltCircuit;
declare const BusNot: BuiltCircuit;
declare const BusXor: BuiltCircuit;

// Standard Library — Routing
declare const Mux: BuiltCircuit;
declare const Decoder: BuiltCircuit;
declare const Splitter: BuiltCircuit;
declare const Splitter8to8: BuiltCircuit;
declare const Combiner8to8: BuiltCircuit;
declare const Concat: BuiltCircuit;
declare const BitSlice: BuiltCircuit;
declare const AddressCombiner: BuiltCircuit;
declare const Probe: BuiltCircuit;

// Standard Library — Sequential
declare const DFlipFlop: BuiltCircuit;
declare const Register: BuiltCircuit;

// Standard Library — Memory
declare const ROM: BuiltCircuit;
declare const RAM: BuiltCircuit;
declare const DualPortRAM: BuiltCircuit;

// Standard Library — I/O
declare const Switch: BuiltCircuit;
declare const Button: BuiltCircuit;
declare const Led: BuiltCircuit;
declare const Input: BuiltCircuit;
declare const Output: BuiltCircuit;
declare const Constant: BuiltCircuit;

// Standard Library — Display
declare const SevenSegment: BuiltCircuit;
declare const HexDisplay: BuiltCircuit;
declare const Screen: BuiltCircuit;
declare const RasterDisplay: BuiltCircuit;
declare const Console: BuiltCircuit;
`;
