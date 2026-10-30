/**
 * Keyboard for a game demo, only while it has focus.
 *
 * A page can hold several demos (the landing page has Pong and Snake, the Snake
 * post has two Snakes), so a demo listens on its own container, not the window.
 * The container takes focus when clicked or tabbed to; while nothing in it has
 * focus, the arrow keys scroll the page as usual.
 */

import { type FocusEvent, type KeyboardEvent, useCallback, useMemo, useRef } from 'react';

/** A game's keys. Each returns true when the game uses that key. */
interface GameKeys {
  down(key: string): boolean;
  up?(key: string): boolean;
}

/** The ring on a demo whose keys are live: on whenever focus is inside it. */
export const GAME_FOCUS_RING = 'outline-none focus-within:ring-2 focus-within:ring-blue-500';

/** The slider and other fields keep their own arrow keys. */
function isField(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.matches('input, textarea, select');
}

/** Props for the demo's container, and `focus` to hand it the keyboard (on Run). */
export function useGameKeys(keys: GameKeys) {
  const ref = useRef<HTMLElement>(null);
  // Keys the game took and has not seen released, let go of when focus leaves.
  const held = useRef(new Set<string>());

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (isField(e.target) || !keys.down(e.key)) return;
      e.preventDefault();
      held.current.add(e.key);
    },
    [keys],
  );

  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      held.current.delete(e.key);
      if (isField(e.target) || !keys.up?.(e.key)) return;
      e.preventDefault();
    },
    [keys],
  );

  const onBlur = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      for (const key of held.current) keys.up?.(key);
      held.current.clear();
    },
    [keys],
  );

  const focus = useCallback(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, []);

  const props = useMemo(
    () => ({ ref, tabIndex: 0, onKeyDown, onKeyUp, onBlur }),
    [onKeyDown, onKeyUp, onBlur],
  );
  return { props, focus };
}
