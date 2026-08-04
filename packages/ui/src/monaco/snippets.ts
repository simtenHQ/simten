/**
 * Snippet completions for Simten circuit source.
 *
 * The TypeScript service already handles the parts that need type knowledge:
 * `nodes.xor1.` lists that component's ports (ConnectArg is a mapped type over
 * each node's shape), and `.to()` is only offered on source refs (SourcePortRef
 * carries a brand the sink type lacks). What it cannot do is produce the
 * scaffold — the six-key object literal every circuit opens with, where the
 * circuit's name appears twice and every node name is written once in `nodes`
 * and again in the `connect` destructure.
 *
 * These snippets are that scaffold. Repeated tabstops (`${1:...}` used more than
 * once) are linked edits in Monaco, so typing the circuit name once fills both
 * places, and a node name typed in `nodes` appears in the destructure as you go.
 *
 * Kept as plain data so the bodies can be validated without a DOM or a Monaco
 * instance — see `snippets.test.ts`.
 */

import type { Monaco } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';

export interface SimtenSnippet {
  /** Typed to trigger the completion. */
  label: string;
  /** One-line grey text beside the label in the suggest widget. */
  detail: string;
  /** Markdown shown in the expanded documentation pane. */
  documentation: string;
  /**
   * Snippet body, newline-joined on registration. `${1:default}` is a tabstop
   * pre-filled with `default`; repeating an index makes those positions a
   * linked edit; `$0` is where the cursor lands last.
   */
  body: string[];
}

export const SIMTEN_SNIPPETS: readonly SimtenSnippet[] = [
  {
    label: 'circuit',
    detail: 'Composite circuit (nodes + connect)',
    documentation:
      'A circuit built by wiring components together. The name is a linked edit — ' +
      'type it once and both occurrences update. Node names likewise appear in both ' +
      '`nodes` and the `connect` destructure.',
    body: [
      "export const ${1:MyCircuit} = circuit('${1:MyCircuit}', {",
      '  inputs: { ${2:a}: ${3:bit}, ${4:b}: ${3:bit} },',
      '  outputs: { ${5:out}: ${3:bit} },',
      '  nodes: { ${6:g1}: ${7:And} },',
      '  connect: ({ inputs, outputs, nodes: { ${6:g1} } }) => [',
      '    inputs.${2:a}.to(${6:g1}.a),',
      '    inputs.${4:b}.to(${6:g1}.b),',
      '    ${6:g1}.out.to(outputs.${5:out}),$0',
      '  ],',
      '});',
    ],
  },
  {
    label: 'circuit-primitive',
    detail: 'Primitive circuit (eval, no nodes)',
    documentation:
      'A leaf component whose behaviour is a function rather than a wiring diagram. ' +
      '`eval` receives inputs by port name and returns outputs by port name. ' +
      'Only primitives carry executable behaviour; composites expand into them at elaboration.',
    body: [
      "export const ${1:MyGate} = circuit('${1:MyGate}', {",
      '  inputs: { ${2:a}: bit, ${3:b}: bit },',
      '  outputs: { ${4:out}: bit },',
      '  eval: ({ ${2:a}, ${3:b} }) => ({ ${4:out}: ${0:${2:a} & ${3:b}} }),',
      "  meta: { category: '${5:logic}', description: '${6:What it does}' },",
      '});',
    ],
  },
  {
    label: 'circuit-sequential',
    detail: 'Sequential primitive (state + onTick)',
    documentation:
      'A primitive that holds state. Declaring `state` is what makes a circuit sequential — ' +
      'there is no flag and no clock port. Every stateful element shares the one implicit ' +
      'clock, so `onTick` runs on each `tick()` and returns the next state.',
    body: [
      "export const ${1:MyRegister} = circuit('${1:MyRegister}', {",
      '  inputs: { ${2:d}: bus(${3:8}), we: bit },',
      '  outputs: { ${4:q}: bus(${3:8}) },',
      '  state: { ${5:value}: reg(${3:8}) },',
      '  eval: ({ ${5:value} }) => ({ ${4:q}: ${5:value} }),',
      '  onTick: ({ ${2:d}, we, ${5:value} }) => ({ ${5:value}: we ? ${2:d} : ${5:value} }),$0',
      '});',
    ],
  },
];

/** Languages the provider registers against. */
const LANGUAGES = ['typescript', 'javascript'] as const;

const REGISTERED = new WeakSet<object>();

export interface SnippetOptions {
  /**
   * Register even if this Monaco instance already has the provider. Off by
   * default: `beforeMount` can fire more than once for the same instance, and
   * unlike `addExtraLib` (which overwrites by path) each registration adds
   * another provider, so every snippet would appear twice in the suggest list.
   */
  force?: boolean;
}

/**
 * Register Simten's scaffold snippets on a Monaco instance.
 *
 * Idempotent per instance unless `force` is set. Returns a disposable for
 * callers that own the editor lifecycle; ignoring it is fine for the common
 * case where Monaco outlives the component.
 */
export function registerSimtenSnippets(
  monaco: Monaco,
  options: SnippetOptions = {},
): { dispose(): void } {
  if (!options.force && REGISTERED.has(monaco)) return { dispose() {} };
  REGISTERED.add(monaco);

  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;

  const disposables = LANGUAGES.map((language) =>
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model: editor.ITextModel, position: Position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: SIMTEN_SNIPPETS.map((s) => ({
            label: s.label,
            kind: CompletionItemKind.Snippet,
            detail: s.detail,
            documentation: { value: s.documentation },
            insertText: s.body.join('\n'),
            insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          })),
        };
      },
    }),
  );

  return {
    dispose() {
      REGISTERED.delete(monaco);
      for (const d of disposables) d.dispose();
    },
  };
}
