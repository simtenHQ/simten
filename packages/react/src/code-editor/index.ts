/**
 * @simten/react/code-editor: Monaco with Simten's autocomplete and error
 * markers. It knows nothing about simulations; wire it to one with
 * `useSimulation({ source })` and `diagnostics` from `state.compileError`.
 *
 *   - `CodeEditor`: an editor, pre-wired. Reach for this first.
 *   - `registerSimtenThemes`, `SIMTEN_DARK` and `SIMTEN_LIGHT`: Simten's Monaco themes.
 *   - `setupSimtenIntellisense` + `useTypeAcquisition`: the same setup without
 *     the editor, for when you already own a Monaco instance (a collaborative
 *     editor with a Yjs binding, a custom editor shell).
 *
 * `@monaco-editor/react` and `monaco-editor` are *optional* peers, so importing
 * this entry is the only thing that requires them; `@simten/react` itself
 * stays Monaco-free on disk and in the bundle. Install with:
 *
 *   pnpm add @simten/react @monaco-editor/react
 *
 * (`monaco-editor` follows automatically as a peer of `@monaco-editor/react`.)
 */

export {
  CodeEditor,
  type CodeEditorDiagnostic,
  type CodeEditorHandle,
  type CodeEditorProps,
  preloadMonaco,
} from './CodeEditor';
export { buildGlobalsFor } from './globals-subset';
export { type IntellisenseOptions, setupSimtenIntellisense } from './setup';
export {
  type RegisterThemesOptions,
  registerSimtenThemes,
  SIMTEN_DARK,
  SIMTEN_LIGHT,
} from './themes';
export { type TypeAcquisitionOptions, useTypeAcquisition } from './useTypeAcquisition';
