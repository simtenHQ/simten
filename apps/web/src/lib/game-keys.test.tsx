// @vitest-environment jsdom
import { act, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameKeys } from './game-keys';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A demo that takes the arrow keys, as Snake does. */
function Demo({ name, onKey }: { name: string; onKey: (key: string) => void }) {
  const keys = useMemo(
    () => ({
      down: (key: string) => {
        if (!key.startsWith('Arrow')) return false;
        onKey(key);
        return true;
      },
    }),
    [onKey],
  );
  const keyboard = useGameKeys(keys);
  return (
    <section {...keyboard.props} aria-label={name}>
      <button type="button" onClick={keyboard.focus}>
        Run
      </button>
      <input type="range" aria-label="Speed" />
    </section>
  );
}

function press(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('useGameKeys', () => {
  let host: HTMLDivElement;
  let root: Root;
  const first = vi.fn();
  const second = vi.fn();

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <>
          <Demo name="first" onKey={first} />
          <Demo name="second" onKey={second} />
        </>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    first.mockClear();
    second.mockClear();
  });

  const demo = (name: string) => host.querySelector<HTMLElement>(`[aria-label="${name}"]`);

  it('leaves arrow keys to the page while no demo has focus', () => {
    const event = press(document.body, 'ArrowDown');
    expect(event.defaultPrevented).toBe(false);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('steers only the focused demo', () => {
    const target = demo('second');
    act(() => target?.focus());
    const event = press(document.activeElement ?? document.body, 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it('takes the keyboard when its Run button is clicked', () => {
    const run = demo('first')?.querySelector('button');
    act(() => run?.click());
    expect(document.activeElement).toBe(demo('first'));
    press(document.activeElement ?? document.body, 'ArrowLeft');
    expect(first).toHaveBeenCalledWith('ArrowLeft');
    expect(second).not.toHaveBeenCalled();
  });

  it('leaves keys the game does not use, and the speed slider, alone', () => {
    act(() => demo('first')?.focus());
    expect(press(document.activeElement ?? document.body, 'Tab').defaultPrevented).toBe(false);
    const slider = demo('first')?.querySelector('input');
    act(() => slider?.focus());
    expect(press(document.activeElement ?? document.body, 'ArrowRight').defaultPrevented).toBe(
      false,
    );
    expect(first).not.toHaveBeenCalled();
  });
});
