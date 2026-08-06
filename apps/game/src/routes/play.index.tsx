/**
 * The campaign list.
 *
 * Deliberately plain. The interesting page is the level; this one only has to
 * get out of the way.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { LEVELS } from '../game/levels';

export const Route = createFileRoute('/play/')({
  component: LevelList,
});

function LevelList() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-semibold">Build a computer</h1>
      <p className="mt-2 text-muted-foreground">
        You get one gate to start with, and everything else gets built out of it. Write the circuit
        in TypeScript; the diagram draws itself.
      </p>

      <ol className="mt-8 space-y-2">
        {LEVELS.map((level, i) => (
          <li key={level.id}>
            <Link
              to="/play/$levelId"
              params={{ levelId: level.id }}
              className="flex items-baseline gap-4 rounded-lg border border-border p-4 hover:border-foreground/40"
            >
              <span className="font-mono text-sm text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1">
                <span className="font-medium">{level.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{level.brief}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
