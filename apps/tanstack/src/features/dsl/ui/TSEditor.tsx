/**
 * TSEditor Component
 *
 * Monaco-based TypeScript editor for writing circuit definitions using
 * the component() builder API. Drop-in replacement for DSLEditor.
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
import { executeCircuitCode } from "@turing-incomplete/core/builder";
import type { Circuit, ComponentLibrary } from "@turing-incomplete/core/dsl";
import { CompileButton } from "./CompileButton";
import { ErrorDisplay } from "./ErrorDisplay";
import type { CompilationError } from "./ErrorDisplay";
import { EDITOR_TYPE_DECLARATIONS } from "./editor-types";

// ============================================================================
// Default code
// ============================================================================

const DEFAULT_CODE = `// Circuit Editor — TypeScript Mode
//
// Build circuits using the component() API.
// All standard components are available: And, Or, Xor, Not, Mux, Register, etc.
//
// Example: Half Adder

const HalfAdder = component('HalfAdder', {
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
      resolveComponent: (name: string) => Circuit | undefined;
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
              message: "No circuits found. Use component('Name', { ... }) to define a circuit.",
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
          setSuccessMessage(`Compiled ${result.circuits.length} component(s): ${names}`);
        }

        // Build library for simulation
        const library = {
          resolveComponent: (name: string) => result.library.resolveComponent(name),
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
            <CompileButton onCompile={() => handleCompile()} isCompiling={isCompiling} />
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
declare function component(name: string): ComponentBuilder;

declare const bit: PortType;
declare function bus(width: number): PortType;

interface PortType {
  readonly kind: 'bit' | 'bus';
}

interface PortRef {
  to(...targets: PortRef[]): ConnectionDef;
}

interface ConnectionDef {}

interface ComponentBuilder {
  in(name: string, type: PortType | number): ComponentBuilder;
  out(name: string, type: PortType | number): ComponentBuilder;
  node(name: string, component: any): ComponentBuilder;
  connect(fn: (arg: any) => ConnectionDef[]): ComponentBuilder;
  eval(fn: (inputs: any) => any): ComponentBuilder;
  state(initial: any): ComponentBuilder;
  onTick(fn: (inputsAndState: any) => any): ComponentBuilder;
  impl(fn: (c: ComponentBuilder) => ComponentBuilder): ComponentBuilder;
  meta(meta: { category?: string; description?: string; icon?: string }): ComponentBuilder;
  build(): BuiltComponent;
}

interface BuiltComponent {
  readonly name: string;
  readonly circuit: any;
}

// Standard Library — Logic Gates
declare const And: BuiltComponent;
declare const Or: BuiltComponent;
declare const Not: BuiltComponent;
declare const Xor: BuiltComponent;
declare const Nand: BuiltComponent;
declare const Nor: BuiltComponent;
declare const Xnor: BuiltComponent;
declare const Buffer: BuiltComponent;

// Standard Library — Arithmetic
declare const Adder: BuiltComponent;
declare const Subtractor: BuiltComponent;
declare const Multiplier: BuiltComponent;
declare const Comparator: BuiltComponent;
declare const Incrementer: BuiltComponent;
declare const LeftShifter: BuiltComponent;
declare const RightShifter: BuiltComponent;
declare const SignedAdder: BuiltComponent;
declare const SignedComparator: BuiltComponent;
declare const SignedMultiplier: BuiltComponent;
declare const BusAnd: BuiltComponent;
declare const BusOr: BuiltComponent;
declare const BusNot: BuiltComponent;
declare const BusXor: BuiltComponent;

// Standard Library — Routing
declare const Mux: BuiltComponent;
declare const Decoder: BuiltComponent;
declare const Splitter: BuiltComponent;
declare const Splitter8to8: BuiltComponent;
declare const Combiner8to8: BuiltComponent;
declare const Concat: BuiltComponent;
declare const BitSlice: BuiltComponent;
declare const AddressCombiner: BuiltComponent;
declare const Probe: BuiltComponent;

// Standard Library — Sequential
declare const DFlipFlop: BuiltComponent;
declare const Register: BuiltComponent;

// Standard Library — Memory
declare const ROM: BuiltComponent;
declare const RAM: BuiltComponent;
declare const DualPortRAM: BuiltComponent;

// Standard Library — I/O
declare const Switch: BuiltComponent;
declare const Button: BuiltComponent;
declare const Led: BuiltComponent;
declare const Input: BuiltComponent;
declare const Output: BuiltComponent;
declare const Constant: BuiltComponent;

// Standard Library — Display
declare const SevenSegment: BuiltComponent;
declare const HexDisplay: BuiltComponent;
declare const Screen: BuiltComponent;
declare const RasterDisplay: BuiltComponent;
declare const Console: BuiltComponent;
`;
