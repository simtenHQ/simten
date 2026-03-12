/**
 * DSLEditor Component
 *
 * Monaco-based text editor for writing circuit definitions in DSL.
 * Includes compilation, error display, and integration with component library.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useTheme } from "next-themes";
import Editor, { OnMount, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  parseDSL,
  compileCircuitToIR,
  type ValidationError,
  CompilerError,
  validateCircuit,
  analyzeCircuit,
} from "../index";
import { elaborate } from "@turing-incomplete/core/simulator";
import { useComponentLibraryStore, useAnalysisStore } from "@turing-incomplete/ui/editor/stores";
import type { Circuit } from "@turing-incomplete/ui/editor/types";
import { CompileButton } from "./CompileButton";
import { ErrorDisplay, CompilationError } from "./ErrorDisplay";

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

export interface DSLEditorRef {
  /** Get the current code in the editor */
  getCode: () => string;
  /** Set the code in the editor */
  setCode: (code: string) => void;
  /** Trigger a compile */
  compile: () => void;
}

interface DSLEditorProps {
  onCompileSuccess?: (circuits: Circuit[], dslCode: string) => void;
  autoCompileEnabled?: boolean;
  showHeader?: boolean;
  /** Override localStorage key (default: "turing-incomplete-dsl-code"). Set to null to disable persistence. */
  storageKey?: string | null;
  /** Initial code to load (used instead of default example when provided). */
  initialCode?: string;
  /** Called whenever the editor content changes. */
  onCodeChange?: (code: string) => void;
  /** Monaco editor options overrides. */
  editorOptions?: Record<string, unknown>;
}

const DEFAULT_storageKey = "turing-incomplete-dsl-code";

export const DSLEditor = forwardRef<DSLEditorRef, DSLEditorProps>(function DSLEditor({
  onCompileSuccess,
  autoCompileEnabled = false,
  showHeader = true,
  storageKey = DEFAULT_storageKey,
  initialCode,
  onCodeChange,
  editorOptions,
}, ref) {
  // Load code from localStorage on mount, fallback to initialCode or default
  const [code, setCode] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return initialCode ?? DEFAULT_CODE;
  });
  const [errors, setErrors] = useState<CompilationError[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // When true, errors show as Monaco squiggles only (no banner)
  const [silentErrors, setSilentErrors] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const autoCompileTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch Monaco theme reactively when system theme changes
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.setTheme(resolvedTheme === "dark" ? "dsl-dark" : "dsl-light");
  }, [resolvedTheme]);

  // Update Monaco markers when errors change
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();

    if (!monaco || !model) return;

    const markers = errors
      .filter(e => e.line > 0)
      .map(error => {
        // Try to find a reasonable end column
        const lineContent = model.getLineContent(error.line);
        const startCol = Math.min(error.column, lineContent.length);
        // Find the end of the word/token at the error position
        let endCol = startCol;
        while (endCol < lineContent.length && /\w/.test(lineContent[endCol])) {
          endCol++;
        }
        // If we didn't find a word, highlight at least a few characters
        if (endCol === startCol) {
          endCol = Math.min(startCol + 8, lineContent.length + 1);
        }

        return {
          severity: monaco.MarkerSeverity.Error,
          message: error.message,
          startLineNumber: error.line,
          startColumn: startCol,
          endLineNumber: error.line,
          endColumn: endCol + 1,
        };
      });

    monaco.editor.setModelMarkers(model, 'dsl', markers);
  }, [errors]);

  const { registerUser, resolveComponent, getAllComponentNames, getAllPrimitiveNames } =
    useComponentLibraryStore();
  const { setValidationResult, setMetrics } =
    useAnalysisStore();

  // Save code to localStorage whenever it changes
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    onCodeChange?.(newCode);
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, newCode);
    }
  }, [storageKey, onCodeChange]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Auto-insert " -> " when pressing space after "connect <source>"
    editor.onKeyDown((e) => {
      if (e.code === "Space") {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model) return;

        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);

        // Only trigger on connect lines: "connect source" or "connect node.port"
        // Must not already have an arrow
        if (
          textBeforeCursor.match(/^\s*connect\s+[\w.]+$/) &&
          !textBeforeCursor.includes("->")
        ) {
          e.preventDefault();
          e.stopPropagation();

          // Insert " -> " instead of just space
          editor.executeEdits("auto-arrow", [
            {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              text: " -> ",
            },
          ]);

          // Move cursor to end of inserted text
          editor.setPosition({
            lineNumber: position.lineNumber,
            column: position.column + 4,
          });
        }
      }
    });

    // Configure Monaco for DSL
    monaco.languages.register({ id: "dsl" });

    // Set syntax highlighting
    monaco.languages.setMonarchTokensProvider("dsl", {
      keywords: [
        "circuit",
        "input",
        "output",
        "clock",
        "state",
        "impl",
        "node",
        "connect",
        "on",
        "rising",
        "falling",
      ],

      tokenizer: {
        root: [
          [/\/\/.*/, "comment"],
          [/\b(circuit|input|output|clock|state|impl)\b/, "keyword"],
          [/\b(Bit|Bus|Word|Array)\b/, "type"],
          [/\b(node|connect|on)\b/, "keyword"],
          [/\b(rising|falling)\b/, "constant"],
          [/[a-zA-Z_]\w*/, "identifier"],
          [/\d+/, "number"],
          [/<|>|:|\(|\)|\{|\}|,|->/, "delimiter"],
        ],
      },
    });

    // Define light and dark themes
    monaco.editor.defineTheme("dsl-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a9955", fontStyle: "italic" },
        { token: "keyword", foreground: "0000ff", fontStyle: "bold" },
        { token: "type", foreground: "267f99" },
        { token: "constant", foreground: "a31515" },
        { token: "identifier", foreground: "001080" },
        { token: "number", foreground: "098658" },
      ],
      colors: {},
    });

    monaco.editor.defineTheme("dsl-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569cd6", fontStyle: "bold" },
        { token: "type", foreground: "4ec9b0" },
        { token: "constant", foreground: "ce9178" },
        { token: "identifier", foreground: "9cdcfe" },
        { token: "number", foreground: "b5cea8" },
      ],
      colors: {
        "editor.background": "#1e1e1e",
      },
    });

    // Set initial theme based on current system preference
    const isDark = document.documentElement.classList.contains("dark");
    monaco.editor.setTheme(isDark ? "dsl-dark" : "dsl-light");

    // Register autocomplete provider
    monaco.languages.registerCompletionItemProvider("dsl", {
      triggerCharacters: [".", ":"],
      provideCompletionItems: (
        model: editor.ITextModel,
        position: { lineNumber: number; column: number },
      ) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const fullText = model.getValue();

        // Get all available components (primitives + user-defined)
        const allComponents = getAllComponentNames();

        // After "node name: " -> suggest component types
        if (textUntilPosition.match(/node\s+\w+:\s*\w*$/)) {
          return {
            suggestions: allComponents.map((name) => {
              const circuit = resolveComponent(name);
              return {
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: name,
                documentation:
                  circuit?.metadata?.description || `Component: ${name}`,
                detail: circuit
                  ? `inputs: ${circuit.inputs.map((i) => i.name).join(", ")}`
                  : undefined,
              };
            }),
          };
        }

        // After "connect nodeName." -> suggest output ports
        const connectMatch = textUntilPosition.match(/connect\s+(\w+)\.(\w*)$/);
        if (connectMatch) {
          const nodeName = connectMatch[1];
          const nodeType = findNodeTypeInText(fullText, nodeName);
          if (nodeType) {
            const circuit = resolveComponent(nodeType);
            if (circuit) {
              return {
                suggestions: circuit.outputs.map((output) => ({
                  label: output.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: output.name,
                  detail: `output: ${output.portType.kind}`,
                })),
              };
            }
          }
        }

        // After "-> nodeName." -> suggest input ports
        const arrowMatch = textUntilPosition.match(/->\s*(\w+)\.(\w*)$/);
        if (arrowMatch) {
          const nodeName = arrowMatch[1];
          const nodeType = findNodeTypeInText(fullText, nodeName);
          if (nodeType) {
            const circuit = resolveComponent(nodeType);
            if (circuit) {
              // Include both inputs and clocks
              const inputSuggestions = circuit.inputs.map((input) => ({
                label: input.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: input.name,
                detail: `input: ${input.portType.kind}`,
              }));
              const clockSuggestions = (circuit.clocks || []).map((clock) => ({
                label: clock.name,
                kind: monaco.languages.CompletionItemKind.Event,
                insertText: clock.name,
                detail: "clock",
              }));
              return {
                suggestions: [...inputSuggestions, ...clockSuggestions],
              };
            }
          }
        }

        // DSL keywords
        const keywords = [
          "circuit",
          "input",
          "output",
          "clock",
          "impl",
          "node",
          "connect",
        ];
        if (
          textUntilPosition.match(/^\s*\w*$/) ||
          textUntilPosition.match(/\{\s*\w*$/)
        ) {
          return {
            suggestions: keywords.map((kw) => ({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
            })),
          };
        }

        return { suggestions: [] };
      },
    });

    // Helper: find what type a node is by parsing the text
    function findNodeTypeInText(text: string, nodeName: string): string | null {
      // Match "node nodeName: TypeName" or "node nodeName: TypeName(...)"
      const regex = new RegExp(`node\\s+${nodeName}:\\s*(\\w+)`, "m");
      const match = text.match(regex);
      return match ? match[1] : null;
    }

    // Register hover provider for documentation
    monaco.languages.registerHoverProvider("dsl", {
      provideHover: (
        model: editor.ITextModel,
        position: { lineNumber: number; column: number },
      ) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const circuit = resolveComponent(word.word);
        if (circuit) {
          const inputs = circuit.inputs
            .map((i) => `  ${i.name}: ${i.portType.kind}`)
            .join("\n");
          const outputs = circuit.outputs
            .map((o) => `  ${o.name}: ${o.portType.kind}`)
            .join("\n");
          const clocks = (circuit.clocks || [])
            .map((c) => `  ${c.name}`)
            .join("\n");

          let content = `**${circuit.name}**\n\n`;
          if (circuit.metadata?.description) {
            content += `${circuit.metadata.description}\n\n`;
          }
          content += `**Inputs:**\n\`\`\`\n${inputs || "  (none)"}\n\`\`\`\n`;
          content += `**Outputs:**\n\`\`\`\n${outputs || "  (none)"}\n\`\`\``;
          if (clocks) {
            content += `\n**Clocks:**\n\`\`\`\n${clocks}\n\`\`\``;
          }

          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
            contents: [{ value: content }],
          };
        }
        return null;
      },
    });

    // Ghost hint — faded text on a specific line, removed on first edit
  };


  const handleCompile = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    setSilentErrors(silent);
    setIsCompiling(true);
    if (!silent) setErrors([]);
    setSuccessMessage(null);

    // Use setTimeout to ensure UI updates before heavy computation
    setTimeout(() => {
      try {
        // Create a ComponentLibrary adapter for IDE-grade diagnostics
        // This enables "unknown component" errors at parse time
        const componentLibrary = {
          resolveComponent,
          getAllPrimitiveNames: getAllComponentNames,
        };

        // Parse the DSL to get all circuit definitions
        // Pass componentLibrary for IDE-grade component validation
        const { ast, errors: parseErrors } = parseDSL(code, {
          sourceName: "editor.dsl",
          componentLibrary,
        });

        if (parseErrors.length > 0) {
          setErrors(
            parseErrors.map((e: ValidationError) => ({
              message: e.message,
              line: e.location.start.line,
              column: e.location.start.column,
              suggestions: e.suggestions,
            })),
          );
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
              const compiled = compiledCircuits.find((c) => c.name === name);
              if (compiled) return compiled;

              // Then check existing library
              return resolveComponent(name);
            },
            hasCircuit: (name: string): boolean => {
              return (
                compiledCircuits.some((c) => c.name === name) ||
                resolveComponent(name) !== undefined
              );
            },
            getAllComponentNames: (): string[] => {
              // Include both existing library components and just-compiled circuits
              const existing = getAllComponentNames();
              const justCompiled = compiledCircuits.map((c) => c.name);
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
            const compilationError: CompilationError =
              error instanceof CompilerError && error.location
                ? {
                    message: error.message,
                    line: error.location.line,
                    column: error.location.column,
                  }
                : {
                    message:
                      error instanceof Error ? error.message : String(error),
                    line: 0,
                    column: 0,
                  };

            setErrors([compilationError]);
            setIsCompiling(false);
            return;
          }
        }

        // Success — always clear errors (clears Monaco squiggles)
        setErrors([]);
        if (!silent) {
          const componentNames = compiledCircuits.map((c) => c.name).join(", ");
          setSuccessMessage(
            `Successfully compiled ${compiledCircuits.length} component(s): ${componentNames}`,
          );
        }

        // Notify parent (pass DSL code for version tracking)
        onCompileSuccess?.(compiledCircuits, code);

        // Run validation and analysis pipeline
        try {
          // Create a ComponentLibrary adapter for the simulator
          const library = {
            resolveComponent,
            getAllPrimitiveNames,
          };

          const validationResult = validateCircuit(code, {
            componentLibrary: library,
          });
          setValidationResult(validationResult);

          // If validation passed, try to compute metrics for the last circuit
          if (validationResult.canSimulate && compiledCircuits.length > 0) {
            const lastCircuit = compiledCircuits[compiledCircuits.length - 1];
            try {
              const flat = elaborate(lastCircuit, library);
              const metrics = analyzeCircuit({ circuit: lastCircuit, flat, library });
              setMetrics(metrics);
            } catch (metricsError) {
              // Metrics are optional - don't fail if they can't be computed
              console.warn('Could not compute metrics:', metricsError);
              setMetrics(null);
            }
          }
        } catch (analysisError) {
          console.warn('Analysis failed:', analysisError);
        }

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        // Extract location info from CompilerError if available
        const compilationError: CompilationError =
          error instanceof CompilerError && error.location
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
      } finally {
        setIsCompiling(false);
      }
    }, 0);
  }, [
    code,
    registerUser,
    resolveComponent,
    getAllComponentNames,
    onCompileSuccess,
  ]);

  // Expose ref methods for external access (e.g., from ChatPanel)
  useImperativeHandle(ref, () => ({
    getCode: () => code,
    setCode: (newCode: string) => {
      setCode(newCode);
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(storageKey, newCode);
      }
    },
    compile: () => {
      handleCompile();
    },
  }), [code, handleCompile]);

  // Auto-compile effect (debounced)
  // Triggers on mount and whenever code changes
  useEffect(() => {
    if (!autoCompileEnabled) return;

    // Clear any existing timer
    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current);
    }

    // Set new timer for auto-compile (immediate on mount, debounced on changes)
    const delay = 500; // Debounce to avoid compiling mid-keystroke
    autoCompileTimerRef.current = setTimeout(() => {
      handleCompile({ silent: true });
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
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
      {/* Header (optional) */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-[#1a1a1e] dark:border-[#2a2a2e]">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">DSL Editor</h2>
          <div className="flex items-center gap-2">
            <CompileButton
              onClick={handleCompile}
              isCompiling={isCompiling}
              disabled={!code.trim()}
            />
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-300 dark:border-green-800">
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
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            acceptSuggestionOnCommitCharacter: false,
            fixedOverflowWidgets: true,  // Render hovers outside clipped container
            ...editorOptions,
          }}
        />
      </div>

      {/* Error Display — hidden during auto-compile (squiggles only) */}
      {!silentErrors && <ErrorDisplay errors={errors} />}
    </div>
  );
});
