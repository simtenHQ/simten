/**
 * The finished parts a level's starter code hands over.
 *
 * Read from the level's own stub, never from the editor, so nothing a player
 * types can change it. Every stub hands a part over the same way, as a
 * `const Name = circuit('Name', ...)` above the circuit the player writes, so
 * the list cannot drift from what the editor actually shows.
 *
 * Display only. Whether a submit is allowed is the grader's call, made on the
 * gates the whole circuit breaks down to.
 */

import type { Level } from './types';

export function givenParts(level: Level): string[] {
  const parts: string[] = [];
  for (const match of level.stub.matchAll(/^const (\w+) = circuit\('\1'/gm)) {
    const body = level.stub.slice(match.index, level.stub.indexOf('\n});', match.index));
    if (match[1] !== level.target && !isSkeleton(body)) parts.push(match[1]);
  }
  return parts;
}

/**
 * Is this circuit the player's to finish? A stub can declare a part with its
 * ports in place and nothing inside, for the player to fill (the CPU's
 * `Control`). Its wiring is only the `//` placeholder, which no finished part
 * ever has.
 */
export function isSkeleton(circuitSource: string): boolean {
  return /=> \[\s*\/\/\s*\],/.test(circuitSource);
}
