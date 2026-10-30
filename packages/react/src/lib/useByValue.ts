import { useRef } from 'react';

/**
 * `value`, or the one returned before if it's equal by value, so a caller
 * passing an inline object (options, a layout) doesn't look like a change on
 * every render.
 */
export function useByValue<T>(value: T): T {
  const last = useRef<{ seen: T; stable: T; key: string } | null>(null);
  if (last.current && last.current.seen === value) return last.current.stable;
  const key = JSON.stringify(value ?? null);
  if (last.current && last.current.key === key) {
    last.current.seen = value;
    return last.current.stable;
  }
  last.current = { seen: value, stable: value, key };
  return value;
}
