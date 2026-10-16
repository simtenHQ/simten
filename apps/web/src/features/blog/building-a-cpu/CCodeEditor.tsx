/**
 * An editable C code box with the same syntax colours as the code on the
 * landing page.
 *
 * A transparent <textarea> sits exactly on top of a highlighted <pre>: you
 * type into the textarea and see the colours underneath. Both use the same
 * font, size, padding and wrapping, so the caret lines up with the text.
 *
 * Highlighting is sugar-high (a JavaScript tokenizer) with a pass that fixes
 * up the parts of C it doesn't know: type keywords such as `int` and
 * `unsigned`, preprocessor lines, and function names.
 */

import { type KeyboardEvent, useMemo } from 'react';
import { tokenize } from 'sugar-high';
import { SH_THEME_CLASSES } from '@/components/HighlightedCode';

// sugar-high 1.1 token type ids (see CodeWithHovers.tsx).
const IDENTIFIER = 0;
const KEYWORD = 1;
const STRING = 2;
const ENTITY = 5;
const SIGN = 7;
const BREAK = 9;
const SPACE = 10;
const COLORS = [
  'identifier',
  'keyword',
  'string',
  'class',
  'property',
  'entity',
  'jsxliterals',
  'sign',
  'comment',
  'break',
  'space',
];

const C_KEYWORDS = new Set([
  'auto',
  'char',
  'const',
  'double',
  'enum',
  'extern',
  'float',
  'int',
  'long',
  'register',
  'short',
  'signed',
  'sizeof',
  'static',
  'struct',
  'typedef',
  'union',
  'unsigned',
  'volatile',
  'goto',
]);

type Token = [type: number, text: string];

/** sugar-high's tokens, adjusted for C. */
function highlightC(code: string): Token[] {
  const tokens = tokenize(code).map(([t, s]) => [t, s] as Token);
  const out: Token[] = [];
  let lineStart = true;
  let inInclude = false;
  for (let i = 0; i < tokens.length; i++) {
    const [type, text] = tokens[i];
    if (type === BREAK || text.endsWith('\n')) {
      out.push([type, text]);
      lineStart = true;
      inInclude = false;
      continue;
    }
    if (inInclude) {
      // `#include <stdio.h>`: the file name reads as a string.
      out.push([type === SPACE ? SPACE : STRING, text]);
      continue;
    }
    if (lineStart && type === SIGN && text === '#') {
      // A preprocessor directive: `#` plus its name, coloured as one keyword.
      const next = tokens[i + 1];
      const name = next && next[0] === IDENTIFIER ? next[1] : '';
      out.push([KEYWORD, `#${name}`]);
      if (name) i++;
      inInclude = name === 'include';
      lineStart = false;
      continue;
    }
    if (type !== SPACE) lineStart = false;
    if (type === IDENTIFIER && C_KEYWORDS.has(text)) {
      out.push([KEYWORD, text]);
      continue;
    }
    if (type === IDENTIFIER) {
      // A name followed by `(` is a function: main, printf.
      let j = i + 1;
      while (tokens[j] && tokens[j][0] === SPACE) j++;
      if (tokens[j] && tokens[j][1] === '(') {
        out.push([ENTITY, text]);
        continue;
      }
    }
    out.push([type, text]);
  }
  return out;
}

const TEXT_CLASSES = 'm-0 p-3 font-mono text-xs leading-relaxed whitespace-pre [tab-size:4]';

export interface CCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CCodeEditor({ value, onChange, className }: CCodeEditorProps) {
  // Each token keyed by where it starts in the source.
  const tokens = useMemo(() => {
    let offset = 0;
    return highlightC(value).map(([type, text]) => {
      const start = offset;
      offset += text.length;
      return { type, text, start };
    });
  }, [value]);

  // Tab indents instead of moving focus out of the editor.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    onChange(`${value.slice(0, start)}    ${value.slice(end)}`);
    requestAnimationFrame(() => el.setSelectionRange(start + 4, start + 4));
  };

  return (
    <div
      className={`overflow-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 focus-within:border-blue-600 ${SH_THEME_CLASSES} ${className ?? ''}`}
    >
      <div className="relative min-w-full w-max">
        <pre aria-hidden="true" className={TEXT_CLASSES}>
          {tokens.map(({ type, text, start }) => (
            <span key={start} style={{ color: `var(--sh-${COLORS[type]})` }}>
              {text}
            </span>
          ))}
          {/* Keeps a trailing empty line as tall as the textarea's. */}
          {'\n'}
        </pre>
        <textarea
          aria-label="C source code"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className={`${TEXT_CLASSES} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-gray-900 dark:caret-gray-100 outline-none selection:bg-blue-500/30`}
        />
      </div>
    </div>
  );
}
