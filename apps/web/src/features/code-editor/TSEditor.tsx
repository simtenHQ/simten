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

'use client';

import type { Monaco, OnMount } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';
import type { Circuit } from '@simten/core';
import { useSandboxContext } from '@simten/ui/sandbox';
import type { editor } from 'monaco-editor';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { CompileButton } from './CompileButton';
import type { CompilationError } from './ErrorDisplay';
import { ErrorDisplay } from './ErrorDisplay';
import { useCorePreload } from './useCorePreload';
import { useTypeAcquisition } from './useTypeAcquisition';

// ============================================================================
// Default code
// ============================================================================

const DEFAULT_STORAGE_KEY = 'simten-ts-code';

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
    sandboxResult?: {
      circuits: Circuit[];
      libraryCircuits: Circuit[];
      portValues: Record<string, number | boolean>;
    },
  ) => void;
  /** Called when a (manual) compile fails — used for the show_circuit render ack. */
  onCompileError?: (message: string) => void;
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
    onCompileError,
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
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);

  // Code state. No default circuit: a first visit (nothing in localStorage)
  // starts empty so the workspace shows the example picker instead.
  const [code, setCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return '';
  });

  // Report the resolved initial code once, so the workspace's empty-state
  // (example picker) logic sees the truth on mount — onCodeChange otherwise
  // only fires on user edits.
  const reportedInitial = useRef(false);
  useEffect(() => {
    if (reportedInitial.current) return;
    reportedInitial.current = true;
    onCodeChange?.(code);
  }, [code, onCodeChange]);

  // Fetch + inject TypeScript declarations for npm imports
  useTypeAcquisition(code, monacoInstance);

  // Preload bundled @simten/core types + ambient globals shim
  useCorePreload(monacoInstance);

  // Compilation state
  const [errors, setErrors] = useState<CompilationError[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Code changes ──

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? '';
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
        const result = await sandbox.compile(code, 'editor-main');

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
          // Try to extract line info from error message. We surface errors
          // in both silent and manual compiles — silent auto-compiles were
          // swallowing failures entirely (e.g. `window is not defined`),
          // leaving the canvas stuck on the last good build with no user
          // feedback. `silent` now only suppresses the green success toast
          // and the pre-clear of errors, not the error display itself.
          const lineMatch = result.error.match(/\((\d+):(\d+)\)/);
          setErrors([
            {
              message: result.error,
              line: lineMatch ? parseInt(lineMatch[1]) : 0,
              column: lineMatch ? parseInt(lineMatch[2]) : 0,
            },
          ]);
          onCompileError?.(result.error);
          return;
        }

        if (result.circuits.length === 0) {
          const message = "No circuits found. Use circuit('Name', { ... }) to define a circuit.";
          setErrors([{ message, line: 0, column: 0 }]);
          onCompileError?.(message);
          return;
        }

        // Build a library-like interface from the sandbox result so downstream
        // consumers (CircuitCanvas, Verilog export) can resolve components.
        const allCircuits = [...result.circuits, ...result.libraryCircuits];
        const circuitMap = new Map(allCircuits.map((c) => [c.name, c]));
        const library = {
          resolveCircuit: (name: string) => circuitMap.get(name),
          getAllPrimitiveNames: () =>
            allCircuits.filter((c) => c.implementation?.kind === 'primitive').map((c) => c.name),
          getAllCircuitNames: () => Array.from(circuitMap.keys()),
        };

        // Success
        setErrors([]);
        if (!silent) {
          const names = result.circuits.map((c) => c.name).join(', ');
          setSuccessMessage(`Compiled ${result.circuits.length} circuit(s): ${names}`);
        }

        onCompileSuccess?.(result.circuits, code, library, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setErrors([{ message, line: 0, column: 0 }]);
        onCompileError?.(message);
      } finally {
        setIsCompiling(false);
      }
    },
    [code, onCompileSuccess, onCompileError, sandbox],
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
    setMonacoInstance(monaco);

    // Configure TypeScript compiler options for the editor
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      strict: false, // Don't require strict types — user code is casual
      noEmit: true,
      allowJs: true,
      esModuleInterop: true,
      // Tell TypeScript where to find injected @types/* declarations
      typeRoots: ['file:///node_modules/@types'],
    });

    // Suppress module-not-found errors for npm imports — packages are resolved
    // at runtime via esm.sh, not locally installed. Users can import anything.
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      diagnosticCodesToIgnore: [
        2307, // Cannot find module 'X' or its corresponding type declarations
        2792, // Cannot find module 'X'. Did you mean to set moduleResolution...
      ],
    });

    // Type declarations for circuit(), BuiltCircuit, stdlib, and the
    // ambient globals injected by executeCircuitCode are loaded by
    // useCorePreload above — sourced from `@simten/core/bundle?raw` and
    // `@simten/core/editor-globals?raw`, both produced by core's build.

    // Set editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
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

    monaco.editor.setModelMarkers(model, 'ts-editor', markers);
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
    <div className="flex flex-col h-full overflow-hidden">
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">TypeScript</span>
          <div className="flex items-center gap-2">
            {successMessage && <span className="text-xs text-green-600">{successMessage}</span>}
            <CompileButton onClick={() => handleCompile()} isCompiling={isCompiling} />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          language="typescript"
          theme={resolvedTheme === 'dark' ? 'simten-dark' : 'simten-light'}
          path="file:///circuit.ts"
          value={code}
          onChange={handleCodeChange}
          beforeMount={(monaco) => {
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            // Custom themes — Monaco's vs-dark / vs leave most identifiers
            // uncolored. These give variable names, types, and keywords
            // distinct hues so circuit definitions scan the way they do in
            // VS Code. Defined here (pre-mount) so the editor finds them on
            // first render.
            monaco.editor.defineTheme('simten-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'identifier', foreground: '9CDCFE' },
                { token: 'type.identifier', foreground: '4EC9B0' },
                { token: 'keyword', foreground: 'C586C0' },
                { token: 'keyword.flow', foreground: 'C586C0' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                { token: 'delimiter', foreground: 'D4D4D4' },
                { token: 'delimiter.bracket', foreground: 'D4D4D4' },
                { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
                { token: 'delimiter.square', foreground: 'D4D4D4' },
                { token: 'delimiter.curly', foreground: 'D4D4D4' },
                { token: 'operator', foreground: 'D4D4D4' },
              ],
              colors: {},
            });
            monaco.editor.defineTheme('simten-light', {
              base: 'vs',
              inherit: true,
              rules: [
                { token: 'identifier', foreground: '001080' },
                { token: 'type.identifier', foreground: '267F99' },
                { token: 'keyword', foreground: 'AF00DB' },
                { token: 'keyword.flow', foreground: 'AF00DB' },
                { token: 'string', foreground: 'A31515' },
                { token: 'number', foreground: '098658' },
                { token: 'comment', foreground: '008000', fontStyle: 'italic' },
                { token: 'delimiter', foreground: '000000' },
                { token: 'delimiter.bracket', foreground: '000000' },
                { token: 'delimiter.parenthesis', foreground: '000000' },
                { token: 'delimiter.square', foreground: '000000' },
                { token: 'delimiter.curly', foreground: '000000' },
                { token: 'operator', foreground: '000000' },
              ],
              // Warm off-white to harmonise with the host's page background
              // (oklch(0.975 0.003 85), ≈ #faf9f4) — pure-white from `vs`
              // base reads as a cold panel inside the warmed-up page.
              // Gutter matches so the line-number column doesn't seam.
              colors: {
                'editor.background': '#faf9f4',
                'editorGutter.background': '#faf9f4',
                'editorLineNumber.background': '#faf9f4',
              },
            });
          }}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            'semanticHighlighting.enabled': true,
            fixedOverflowWidgets: true,
          }}
        />
      </div>

      {errors.length > 0 && <ErrorDisplay errors={errors} />}
    </div>
  );
});
