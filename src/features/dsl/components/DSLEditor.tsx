/**
 * DSLEditor Component
 *
 * Monaco-based text editor for writing circuit definitions in DSL.
 * Includes compilation, error display, and integration with component library.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  parseDSL,
  compileCircuitToIR,
  type ValidationError,
  CompilerError,
  ParseError,
} from "../index";
import { useComponentLibraryStore } from "@/features/visual-editor/stores/component-library-store";
import { CompileButton } from "./CompileButton";
import { ErrorDisplay, CompilationError } from "./ErrorDisplay";
import type { Circuit } from "@/features/visual-editor/types/ir-v0.1";

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
  showHeader?: boolean;
}

const STORAGE_KEY = "turing-incomplete-dsl-code";

export function DSLEditor({
  onCompileSuccess,
  autoCompileEnabled = false,
  showHeader = true,
}: DSLEditorProps) {
  // Load code from localStorage on mount, fallback to default
  const [code, setCode] = useState(() => {
    if (typeof window !== "undefined") {
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

  const { registerUser, resolveComponent, getAllComponentNames } =
    useComponentLibraryStore();

  // Save code to localStorage whenever it changes
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newCode);
    }
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

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

    // Set theme
    monaco.editor.defineTheme("dsl-theme", {
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

    monaco.editor.setTheme("dsl-theme");

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
  };

  const handleCompile = useCallback(() => {
    setIsCompiling(true);
    setErrors([]);
    setSuccessMessage(null);

    // Use setTimeout to ensure UI updates before heavy computation
    setTimeout(() => {
      try {
        // Parse the DSL to get all circuit definitions
        const { ast, errors: parseErrors } = parseDSL(code, "editor.dsl");

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

        // Success!
        const componentNames = compiledCircuits.map((c) => c.name).join(", ");
        setSuccessMessage(
          `Successfully compiled ${compiledCircuits.length} component(s): ${componentNames}`,
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
  }, [
    code,
    registerUser,
    resolveComponent,
    getAllComponentNames,
    onCompileSuccess,
  ]);

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
      {/* Header (optional) */}
      {showHeader && (
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
      )}

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
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            acceptSuggestionOnCommitCharacter: false,
          }}
        />
      </div>

      {/* Error Display */}
      <ErrorDisplay errors={errors} onClose={handleClearErrors} />
    </div>
  );
}
