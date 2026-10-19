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
    if (match[1] !== level.target) parts.push(match[1]);
  }
  return parts;
}
