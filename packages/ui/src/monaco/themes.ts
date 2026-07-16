/**
 * Simten Monaco themes. Monaco's built-in `vs-dark`/`vs` leave most identifiers
 * uncolored; these give variables, types, and keywords distinct hues so circuit
 * definitions scan the way they do in VS Code.
 *
 * Register from `beforeMount` (pre-mount) so the named theme exists at first
 * paint — no flash/fallback. Kept separate from `setupSimtenIntellisense`
 * because themes are orthogonal: a headless consumer wiring its own Monaco with
 * its own theme shouldn't get Simten themes force-defined.
 */

import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export const SIMTEN_DARK = 'simten-dark';
export const SIMTEN_LIGHT = 'simten-light';

const DARK_RULES: editor.ITokenThemeRule[] = [
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
];

const LIGHT_RULES: editor.ITokenThemeRule[] = [
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
];

export interface RegisterThemesOptions {
  /**
   * Override the light theme's editor background; the gutter and line-number
   * column follow it so they don't seam. Omit to keep Monaco's `vs` white.
   * Pass a warm off-white (e.g. `'#faf9f4'`) to harmonise with a page whose
   * background isn't pure white.
   */
  lightBackground?: string;
}

/**
 * Define `simten-dark` / `simten-light` on a Monaco instance. Call from
 * `beforeMount`. Then select the active one via the editor's `theme` prop using
 * the exported `SIMTEN_DARK` / `SIMTEN_LIGHT` constants.
 */
export function registerSimtenThemes(monaco: Monaco, options: RegisterThemesOptions = {}): void {
  const { lightBackground } = options;

  monaco.editor.defineTheme(SIMTEN_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: DARK_RULES,
    colors: {},
  });

  monaco.editor.defineTheme(SIMTEN_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: LIGHT_RULES,
    colors: lightBackground
      ? {
          'editor.background': lightBackground,
          'editorGutter.background': lightBackground,
          'editorLineNumber.background': lightBackground,
        }
      : {},
  });
}
