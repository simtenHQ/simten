/**
 * SimtenCodeEditor — Monaco, pre-wired for Simten circuit source.
 *
 * Sugar over `setupSimtenIntellisense` + `useTypeAcquisition`. Use it when you
 * want an editor; use the two primitives directly when you already own a Monaco
 * instance and just want it configured.
 */

import Editor, { type EditorProps, type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { type Ref, useCallback, useEffect, useImperativeHandle, useState } from 'react';
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

/** Owner string for our markers — stable so passing `[]` clears exactly this set. */
const MARKERS_OWNER = 'simten';

const DEFAULT_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  automaticLayout: true,
  scrollBeyondLastLine: false,
};

/**
 * A diagnostic to render as a squiggle — a monaco-free shape so callers never
 * import `monaco-editor` just to show errors. Converted to `IMarkerData`
 * internally using the runtime Monaco instance.
 */
export interface SimtenDiagnostic {
  message: string;
  /** 1-based line. */
  line: number;
  /** 1-based column; defaults to the start of the line. */
  column?: number;
  /** 1-based end column; defaults to a short run past `column`. */
  endColumn?: number;
  /** @default 'error' */
  severity?: 'error' | 'warning' | 'info';
}

/** Imperative handle exposed via `ref`. Getters return null/`''` before mount. */
export interface SimtenCodeEditorHandle {
  getEditor: () => editor.IStandaloneCodeEditor | null;
  getMonaco: () => Monaco | null;
  getValue: () => string;
  setValue: (value: string) => void;
}

export interface SimtenCodeEditorProps
  extends Omit<EditorProps, 'beforeMount' | 'language' | 'defaultLanguage'> {
  /** Tune or disable Simten's IntelliSense. `false` leaves Monaco untouched. */
  intellisense?: IntellisenseOptions | false;
  /** Tune or disable network type acquisition for third-party imports. */
  typeAcquisition?: TypeAcquisitionOptions;
  /** Runs after Simten's own setup, so you can layer on your own Monaco config. */
  beforeMount?: (monaco: Monaco) => void;
  /** Diagnostics to render as squiggles. Pass `[]` (or omit) to clear. */
  diagnostics?: SimtenDiagnostic[];
  /** React 19 imperative handle. */
  ref?: Ref<SimtenCodeEditorHandle>;
}

function severityOf(monaco: Monaco, s: SimtenDiagnostic['severity']): number {
  const { MarkerSeverity } = monaco;
  if (s === 'warning') return MarkerSeverity.Warning;
  if (s === 'info') return MarkerSeverity.Info;
  return MarkerSeverity.Error;
}

export function SimtenCodeEditor({
  intellisense,
  typeAcquisition,
  beforeMount,
  onMount,
  diagnostics,
  ref,
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

  // Render diagnostics as markers. Waits for ed+monaco+model; `[]` clears them.
  useEffect(() => {
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    // A squiggle needs a real line; whole-file diagnostics (line < 1) still
    // carry a message for a caller's error panel but can't be placed here.
    const markers: editor.IMarkerData[] = (diagnostics ?? [])
      .filter((d) => d.line >= 1)
      .map((d) => ({
        severity: severityOf(monaco, d.severity),
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.column ?? 1,
        endLineNumber: d.line,
        endColumn: d.endColumn ?? (d.column ? d.column + 10 : 1000),
      }));
    monaco.editor.setModelMarkers(model, MARKERS_OWNER, markers);
  }, [ed, monaco, diagnostics]);

  useImperativeHandle(
    ref,
    () => ({
      getEditor: () => ed,
      getMonaco: () => monaco,
      getValue: () => ed?.getValue() ?? '',
      setValue: (value: string) => ed?.setValue(value),
    }),
    [ed, monaco],
  );

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
