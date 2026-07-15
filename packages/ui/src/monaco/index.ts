/**
 * @simten/ui/monaco — Monaco IntelliSense for Simten circuit source.
 *
 * Two layers:
 *   - `SimtenCodeEditor` — an editor, pre-wired. Reach for this first.
 *   - `setupSimtenIntellisense` + `useTypeAcquisition` — headless primitives,
 *     for when you already own a Monaco instance (a collaborative editor with a
 *     Yjs binding, a custom editor shell) and only want it configured.
 *
 * `@monaco-editor/react` and `monaco-editor` are *optional* peers, so importing
 * this subpath is the only thing that requires them — every other @simten/ui
 * subpath stays Monaco-free on disk and in the bundle. Consumers of this one
 * install with:
 *
 *   pnpm add @simten/ui @monaco-editor/react
 *
 * (`monaco-editor` follows automatically as a peer of `@monaco-editor/react`.)
 */

export { SimtenCodeEditor, type SimtenCodeEditorProps } from './SimtenCodeEditor';
export { type IntellisenseOptions, setupSimtenIntellisense } from './setup';
export { type TypeAcquisitionOptions, useTypeAcquisition } from './useTypeAcquisition';
