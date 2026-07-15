/**
 * SimtenCodeEditor — Monaco, pre-wired for Simten circuit source.
 *
 * Sugar over `setupSimtenIntellisense` + `useTypeAcquisition`. Use it when you
 * want an editor; use the two primitives directly when you already own a Monaco
 * instance and just want it configured.
 */

import Editor, { type EditorProps, type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCallback, useEffect, useState } from 'react';
import { type IntellisenseOptions, setupSimtenIntellisense } from './setup';
import { type TypeAcquisitionOptions, useTypeAcquisition } from './useTypeAcquisition';

/**
 * A real file URI, not Monaco's default `inmemory://` scheme. TypeScript module
 * resolution walks up from the containing file looking for node_modules — from
 * `file:///circuit.ts` it finds the virtual `file:///node_modules` tree that
 * setup and type acquisition populate. From `inmemory://` it finds nothing, and
 * every import silently resolves to `any`.
 */
const DEFAULT_PATH = 'file:///circuit.ts';

const DEFAULT_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  automaticLayout: true,
  scrollBeyondLastLine: false,
};

export interface SimtenCodeEditorProps
  extends Omit<EditorProps, 'beforeMount' | 'language' | 'defaultLanguage'> {
  /** Tune or disable Simten's IntelliSense. `false` leaves Monaco untouched. */
  intellisense?: IntellisenseOptions | false;
  /** Tune or disable network type acquisition for third-party imports. */
  typeAcquisition?: TypeAcquisitionOptions;
  /** Runs after Simten's own setup, so you can layer on your own Monaco config. */
  beforeMount?: (monaco: Monaco) => void;
}

export function SimtenCodeEditor({
  intellisense,
  typeAcquisition,
  beforeMount,
  onMount,
  path = DEFAULT_PATH,
  theme = 'vs-dark',
  options,
  ...editorProps
}: SimtenCodeEditorProps) {
  const [ed, setEd] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<Monaco | null>(null);
  const [source, setSource] = useState('');

  // Type acquisition needs the source to find its imports, and we read it from
  // the *model* rather than the `value` prop on purpose. The model is the one
  // place every writer converges: a controlled `value`, an uncontrolled
  // `defaultValue`, and a collaborative binding (y-monaco writing remote edits
  // straight into the model) all land here. Watching `value` would miss the
  // latter two entirely.
  useEffect(() => {
    if (!ed) return;
    const sync = () => setSource(ed.getValue());
    sync();
    const sub = ed.onDidChangeModelContent(sync);
    return () => sub.dispose();
  }, [ed]);

  useTypeAcquisition(source, monaco, typeAcquisition);

  const handleBeforeMount = useCallback(
    (m: Monaco) => {
      if (intellisense !== false) setupSimtenIntellisense(m, intellisense ?? {});
      setMonaco(m);
      beforeMount?.(m);
    },
    [intellisense, beforeMount],
  );

  const handleMount = useCallback<OnMount>(
    (e, m) => {
      setEd(e);
      onMount?.(e, m);
    },
    [onMount],
  );

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      path={path}
      theme={theme}
      options={{ ...DEFAULT_OPTIONS, ...options }}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      {...editorProps}
    />
  );
}
