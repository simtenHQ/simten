/**
 * DSLEditor Component
 *
 * Monaco-based text editor for writing circuit definitions in DSL.
 * Includes compilation, error display, and integration with component library.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { parseDSL, compileCircuitToIR, type ValidationError, CompilerError, ParseError } from '../index';
import { useComponentLibraryStore } from '@/features/visual-editor/stores/component-library-store';
import { CompileButton } from './CompileButton';
import { ErrorDisplay, CompilationError } from './ErrorDisplay';
import type { Circuit } from '@/features/visual-editor/types/ir-v0.1';

const DEFAULT_CODE = `// Example: NOT Gate (Inverter)
circuit Inverter {
  input a: Bit
  output out: Bit

  impl {
    node nand1: Nand
    connect a -> nand1.a
    connect a -> nand1.b
    connect nand1.out -> out
  }
}

// Example: Half Adder
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
`;

interface DSLEditorProps {
  onCompileSuccess?: (circuits: Circuit[], dslCode: string) => void;
  autoCompileEnabled?: boolean;
}

const STORAGE_KEY = 'turing-incomplete-dsl-code';

export function DSLEditor({ onCompileSuccess, autoCompileEnabled = false }: DSLEditorProps) {
  // Load code from localStorage on mount, fallback to default
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || DEFAULT_CODE;
    }
    return DEFAULT_CODE;
  });
  const [errors, setErrors] = useState<CompilationError[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const autoCompileTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { registerUser, resolveComponent, getAllComponentNames } = useComponentLibraryStore();

  // Save code to localStorage whenever it changes
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newCode);
    }
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure Monaco for DSL
    monaco.languages.register({ id: 'dsl' });

    // Set syntax highlighting
    monaco.languages.setMonarchTokensProvider('dsl', {
      keywords: [
        'circuit', 'input', 'output', 'clock', 'state', 'impl',
        'node', 'connect', 'on', 'rising', 'falling'
      ],

      tokenizer: {
        root: [
          [/\/\/.*/, 'comment'],
          [/\b(circuit|input|output|clock|state|impl)\b/, 'keyword'],
          [/\b(Bit|Bus|Word|Array)\b/, 'type'],
          [/\b(node|connect|on)\b/, 'keyword'],
          [/\b(rising|falling)\b/, 'constant'],
          [/[a-zA-Z_]\w*/, 'identifier'],
          [/\d+/, 'number'],
          [/<|>|:|\(|\)|\{|\}|,|->/, 'delimiter'],
        ],
      },
    });

    // Set theme
    monaco.editor.defineTheme('dsl-theme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'type', foreground: '267f99' },
        { token: 'constant', foreground: 'a31515' },
        { token: 'identifier', foreground: '001080' },
        { token: 'number', foreground: '098658' },
      ],
      colors: {},
    });

    monaco.editor.setTheme('dsl-theme');
  };

  const handleCompile = useCallback(() => {
    setIsCompiling(true);
    setErrors([]);
    setSuccessMessage(null);

    // Use setTimeout to ensure UI updates before heavy computation
    setTimeout(() => {
      try {
        // Parse the DSL to get all circuit definitions
        const { ast, errors: parseErrors } = parseDSL(code, 'editor.dsl');

        if (parseErrors.length > 0) {
          setErrors(parseErrors.map((e: ValidationError) => ({
            message: e.message,
            line: e.location.start.line,
            column: e.location.start.column,
            suggestions: e.suggestions,
          })));
          setIsCompiling(false);
          return;
        }

        // Compile circuits one by one, registering each before compiling the next
        // This allows later circuits to reference earlier ones
        const compiledCircuits: Circuit[] = [];

        for (const circuitDef of ast.circuits) {
          // Build library that includes previously compiled circuits
          const library = {
            getCircuit: (name: string): Circuit | undefined => {
              // Check already compiled circuits from this session first
              const compiled = compiledCircuits.find(c => c.name === name);
              if (compiled) return compiled;

              // Then check existing library
              return resolveComponent(name);
            },
            hasCircuit: (name: string): boolean => {
              return compiledCircuits.some(c => c.name === name) ||
                     resolveComponent(name) !== undefined;
            },
            getAllComponentNames: (): string[] => {
              // Include both existing library components and just-compiled circuits
              const existing = getAllComponentNames();
              const justCompiled = compiledCircuits.map(c => c.name);
              return [...existing, ...justCompiled];
            },
          };

          // Compile this single circuit
          try {
            const circuit = compileCircuitToIR(circuitDef, library);
            compiledCircuits.push(circuit);
            registerUser(circuit); // Register immediately so next circuit can use it
          } catch (error) {
            // Extract location info from CompilerError if available
            const compilationError: CompilationError = error instanceof CompilerError && error.location
              ? {
                  message: error.message,
                  line: error.location.line,
                  column: error.location.column,
                }
              : {
                  message: error instanceof Error ? error.message : String(error),
                  line: 0,
                  column: 0,
                };

            setErrors([compilationError]);
            setIsCompiling(false);
            return;
          }
        }

        // Success!
        const componentNames = compiledCircuits.map(c => c.name).join(', ');
        setSuccessMessage(
          `Successfully compiled ${compiledCircuits.length} component(s): ${componentNames}`
        );

        // Notify parent (pass DSL code for version tracking)
        onCompileSuccess?.(compiledCircuits, code);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        // Extract location info from ParseError or CompilerError if available
        let compilationError: CompilationError;

        if (error instanceof ParseError) {
          // ParseError has token.location structure
          compilationError = {
            message: error.message,
            line: error.token.location.start.line,
            column: error.token.location.start.column,
          };
        } else if (error instanceof CompilerError && error.location) {
          // CompilerError has direct location property
          compilationError = {
            message: error.message,
            line: error.location.line,
            column: error.location.column,
          };
        } else {
          // Fallback for unknown error types
          compilationError = {
            message: error instanceof Error ? error.message : String(error),
            line: 0,
            column: 0,
          };
        }

        setErrors([compilationError]);
      } finally {
        setIsCompiling(false);
      }
    }, 0);
  }, [code, registerUser, resolveComponent, getAllComponentNames, onCompileSuccess]);

  const handleClearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Auto-compile effect (debounced)
  // Triggers on mount and whenever code changes
  useEffect(() => {
    if (!autoCompileEnabled) return;

    // Clear any existing timer
    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current);
    }

    // Set new timer for auto-compile (immediate on mount, debounced on changes)
    const delay = 100; // Short delay to let component stabilize
    autoCompileTimerRef.current = setTimeout(() => {
      handleCompile();
    }, delay);

    // Cleanup
    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoCompileEnabled]); // Don't include handleCompile - causes infinite recompilation!

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">DSL Editor</h2>
        <div className="flex items-center gap-2">
          <CompileButton
            onClick={handleCompile}
            isCompiling={isCompiling}
            disabled={!code.trim()}
          />
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-300">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {successMessage}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="dsl"
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* Error Display */}
      <ErrorDisplay errors={errors} onClose={handleClearErrors} />
    </div>
  );
}
