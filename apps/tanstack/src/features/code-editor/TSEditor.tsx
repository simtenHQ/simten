/**
 * TSEditor Component
 *
 * Monaco-based TypeScript editor for writing circuit definitions using
 * the circuit() API. TypeScript circuit editor.
 *
 * Uses Monaco's built-in TypeScript language service for autocomplete,
 * type checking, and error display. Compilation uses executeCircuitCode()
 * which strips types via sucrase and executes the code.
 */

"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useTheme } from "@/components/ThemeProvider";
import Editor from "@monaco-editor/react";
import type { OnMount, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { Circuit } from "@simten/core";
import { useSandboxContext } from "@simten/ui/sandbox";
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

const DEFAULT_STORAGE_KEY = "simten-ts-code";

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
    library?: {
      resolveCircuit: (name: string) => Circuit | undefined;
      getAllPrimitiveNames: () => string[];
      getAllCircuitNames: () => string[];
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

export const TSEditor = forwardRef<TSEditorRef, TSEditorProps>(
  function TSEditor(
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
    const sandbox = useSandboxContext();
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

    const handleCodeChange = useCallback(
      (value: string | undefined) => {
        const newCode = value ?? "";
        setCode(newCode);
        if (storageKey) localStorage.setItem(storageKey, newCode);
        onCodeChange?.(newCode);
      },
      [storageKey, onCodeChange],
    );

    // ── Compilation ──

    const handleCompile = useCallback(
      async (options?: { silent?: boolean; _retried?: boolean }) => {
        const silent = options?.silent ?? false;
        setIsCompiling(true);
        if (!silent) setErrors([]);
        setSuccessMessage(null);

        try {
          const result = await sandbox.compile(code);

          if ('error' in result) {
            // 'Worker restarted' means this compile was collateral damage — the
            // worker was killed because a *different* compile caused an infinite
            // loop. The current code is likely valid; retry once on the fresh
            // worker. Don't retry 'Execution timed out' — that means this
            // specific code caused the hang, so retrying the same code is pointless.
            if (result.error === 'Worker restarted' && silent && !options?._retried) {
              setTimeout(() => handleCompile({ silent: true, _retried: true }), 100);
              return;
            }
            // Try to extract line info from error message
            const lineMatch = result.error.match(/\((\d+):(\d+)\)/);
            if (!silent) {
              setErrors([
                {
                  message: result.error,
                  line: lineMatch ? parseInt(lineMatch[1]) : 0,
                  column: lineMatch ? parseInt(lineMatch[2]) : 0,
                },
              ]);
            }
            return;
          }

          if (result.circuits.length === 0) {
            if (!silent) {
              setErrors([
                {
                  message:
                    "No circuits found. Use circuit('Name', { ... }) to define a circuit.",
                  line: 0,
                  column: 0,
                },
              ]);
            }
            return;
          }

          // Build a library-like interface from the sandbox result so downstream
          // consumers (CircuitCanvas, Verilog export) can resolve components.
          const allCircuits = [...result.circuits, ...result.libraryCircuits];
          const circuitMap = new Map(allCircuits.map((c) => [c.name, c]));
          const library = {
            resolveCircuit: (name: string) => circuitMap.get(name),
            getAllPrimitiveNames: () =>
              allCircuits
                .filter((c) => c.implementation?.kind === 'primitive')
                .map((c) => c.name),
            getAllCircuitNames: () => Array.from(circuitMap.keys()),
          };

          // Success
          setErrors([]);
          if (!silent) {
            const names = result.circuits.map((c) => c.name).join(", ");
            setSuccessMessage(
              `Compiled ${result.circuits.length} circuit(s): ${names}`,
            );
          }

          onCompileSuccess?.(result.circuits, code, library);
        } catch (e) {
          if (!silent) {
            setErrors([
              {
                message: e instanceof Error ? e.message : String(e),
                line: 0,
                column: 0,
              },
            ]);
          }
        } finally {
          setIsCompiling(false);
        }
      },
      [code, onCompileSuccess, sandbox],
    );

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
        .filter((e) => e.line > 0)
        .map((e) => ({
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
            <span className="text-xs font-medium text-muted-foreground">
              TypeScript
            </span>
            <div className="flex items-center gap-2">
              {successMessage && (
                <span className="text-xs text-green-600">{successMessage}</span>
              )}
              <CompileButton
                onClick={() => handleCompile()}
                isCompiling={isCompiling}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <Editor
            language="typescript"
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
            path="circuit.ts"
            value={code}
            onChange={handleCodeChange}
            beforeMount={(monaco) => {
              monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
            }}
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

        {errors.length > 0 && <ErrorDisplay errors={errors} />}
      </div>
    );
  },
);
