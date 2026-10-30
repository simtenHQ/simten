// @vitest-environment jsdom
/**
 * Every new source compiles once: typed, pasted, an example, an import or a
 * push. Each compile is a round trip to the sandbox, and a second one for the
 * same source repeats it and can show the circuit twice.
 */

import { EXAMPLES } from '@simten/core/examples';
import { SandboxProvider, type SandboxProviderProps } from '@simten/react';
import { act, type ReactNode, type Ref, useImperativeHandle, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MCPRunStart } from '@/hooks/useMCPConnection';
import { EditorWorkspace } from './EditorWorkspace';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type OnSource = (source: string, requestId: string | undefined, run: MCPRunStart) => void;
const mcp = vi.hoisted(() => ({ onSource: null as OnSource | null }));

interface FakeEditorProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  ref?: Ref<{ getValue: () => string; setValue: (value: string) => void }>;
}

/** A textarea in Monaco's place. Like Monaco, `setValue` runs `onChange` and `value` doesn't. */
function FakeEditor({ value, onChange, ref }: FakeEditorProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    getValue: () => area.current?.value ?? '',
    setValue: (next: string) => onChange?.(next),
  }));
  return (
    <textarea
      aria-label="Source"
      ref={area}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

function Passthrough({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

vi.mock('@simten/react/code-editor', () => ({
  CodeEditor: FakeEditor,
  registerSimtenThemes: () => {},
  SIMTEN_DARK: 'dark',
  SIMTEN_LIGHT: 'light',
}));
vi.mock('@simten/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@simten/react')>()),
  CircuitCanvas: () => null,
  ClockControls: () => null,
}));
vi.mock('@simten/shared/primitives/resizable', () => ({
  ResizablePanelGroup: Passthrough,
  ResizablePanel: Passthrough,
  ResizableHandle: () => null,
}));
vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: ({ right }: { right?: ReactNode }) => <header>{right}</header>,
}));
vi.mock('@/components/ThemeProvider', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/features/share/ShareDialog', () => ({ ShareDialog: () => null }));
vi.mock('@/hooks/useMCPConnection', () => ({
  useMCPConnection: (callbacks: { onSource?: OnSource }) => {
    mcp.onSource = callbacks.onSource ?? null;
    return { status: 'disconnected', sendRenderResult: () => {} };
  },
}));
vi.mock('./VerilogImportSheet', () => ({
  VerilogImportSheet: ({ onImport }: { onImport: (source: string) => void }) => (
    <button type="button" onClick={() => onImport(IMPORTED)}>
      Import
    </button>
  ),
}));

const IMPORTED = 'export const imported = 1;';

/** A sandbox whose compiles never finish: only how many start matters here. */
const compile = vi.fn((_source: string) => new Promise<never>(() => {}));
const client = {
  compile,
  release: () => {},
  status: 'ready',
  onStatusChange: () => () => {},
} as unknown as NonNullable<SandboxProviderProps['client']>;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Write into the textarea as the browser does, so React sees an input event. */
function type(text: string) {
  const area = document.querySelector<HTMLTextAreaElement>('[aria-label="Source"]');
  if (!area) throw new Error('no editor');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function click(text: string) {
  const button = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.startsWith(text),
  );
  if (!button) throw new Error(`no button "${text}"`);
  act(() => button.click());
}

describe('EditorWorkspace compiles each source once', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mount = (initialSource?: string) => {
    act(() => {
      root.render(
        <SandboxProvider client={client}>
          <EditorWorkspace initialSource={initialSource} />
        </SandboxProvider>,
      );
    });
    // The first compile, and the picker's boot delay.
    advance(500);
    compile.mockClear();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    compile.mockClear();
    mcp.onSource = null;
  });

  it('compiles typing once it stops', () => {
    mount('a');
    type('ab');
    advance(20);
    type('abc');
    advance(20);
    type('abcd');
    advance(49);
    expect(compile).not.toHaveBeenCalled();
    advance(500);
    expect(compile.mock.calls).toEqual([['abcd']]);
  });

  it('compiles a paste once', () => {
    mount('a');
    type(IMPORTED);
    advance(500);
    expect(compile.mock.calls).toEqual([[IMPORTED]]);
  });

  it('compiles an example once, straight away from the empty editor', () => {
    mount();
    const example = EXAMPLES[0];
    click(example.title);
    advance(0);
    expect(compile.mock.calls).toEqual([[example.code]]);
    advance(500);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(document.querySelector('textarea')?.value).toBe(example.code);
  });

  it('compiles a Verilog import once', () => {
    mount('a');
    click('Import');
    advance(500);
    expect(compile.mock.calls).toEqual([[IMPORTED]]);
    expect(document.querySelector('textarea')?.value).toBe(IMPORTED);
  });

  it('compiles a pushed source once, and the same source pushed again once', () => {
    mount('a');
    act(() => mcp.onSource?.(IMPORTED, 'r1', {}));
    advance(500);
    expect(compile.mock.calls).toEqual([[IMPORTED]]);
    compile.mockClear();
    act(() => mcp.onSource?.(IMPORTED, 'r2', {}));
    advance(500);
    expect(compile.mock.calls).toEqual([[IMPORTED]]);
  });
});
