/**
 * The campaign map, as an actual circuit.
 *
 * Not a drawing of one. `buildMapCircuit` returns a real `circuit()` — a
 * `Switch` per level carrying whether you solved it, `And` gates wherever a
 * row depends on more than one level below it, and an `Led` per level whose
 * value *is* that level's unlock state. `simulateMap` then runs it on the same
 * engine that runs the player's own circuits, and the page reads the answer
 * out of the port map.
 *
 * So unlock logic is not code that mimics a circuit; it is a circuit. The
 * consequence that matters: when the campaign grows branches, "level 7 needs
 * both 5 and 6" stops being a rule someone has to implement and becomes an
 * `And` — one representation, which cannot disagree with itself.
 *
 * This runs in the main frame, which is safe precisely because nothing here is
 * player source. The circuit is assembled through the typed API from `MAP_ROWS`;
 * there is no `eval`, so the sandbox is not involved and does not need to be.
 */

import type { Circuit } from '@simten/core';
import { And, Constant, circuit, createSimulatorFromCircuit, Led, Switch } from '@simten/core';
import { MAP_ROWS } from './map';

/** Node ids must be identifier-safe; level ids contain hyphens. */
function sane(levelId: string): string {
  return levelId.replace(/-/g, '_');
}

const switchId = (levelId: string) => `sw_${sane(levelId)}`;
const unlockId = (levelId: string) => `unlock_${sane(levelId)}`;
/** The always-high source feeding the first row, which has no prerequisite. */
const ALWAYS_ON = 'always_on';

/**
 * Assemble the map circuit.
 *
 * Row 0 is unlocked unconditionally, so it is driven by a `Constant`; every
 * later row is driven by the AND of the row beneath it, chained pairwise
 * because gates take two inputs. A row of one level needs no gate at all — the
 * switch below drives the lamp directly.
 */
export function buildMapCircuit() {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous node map, typed at the boundary.
  const nodes: Record<string, any> = { [ALWAYS_ON]: Constant({ value: 1 }) };

  for (const row of MAP_ROWS) {
    for (const levelId of row) {
      nodes[switchId(levelId)] = Switch;
      nodes[unlockId(levelId)] = Led;
    }
  }

  // One AND per extra prerequisite: a row of k levels needs k-1 gates to
  // reduce to a single "all of these are done" signal.
  MAP_ROWS.forEach((row, rowIndex) => {
    if (rowIndex === MAP_ROWS.length - 1) return;
    for (let i = 0; i < row.length - 1; i++) nodes[`gate_${rowIndex}_${i}`] = And;
  });

  return circuit('CampaignMap', {
    nodes,
    // biome-ignore lint/suspicious/noExplicitAny: same boundary as above.
    connect: ({ nodes: n }: { nodes: Record<string, any> }) => {
      // biome-ignore lint/suspicious/noExplicitAny: connection defs.
      const wires: any[] = [];

      for (const levelId of MAP_ROWS[0] ?? []) {
        wires.push(n[ALWAYS_ON].out.to(n[unlockId(levelId)].in));
      }

      MAP_ROWS.forEach((row, rowIndex) => {
        const above = MAP_ROWS[rowIndex + 1];
        if (!above) return;

        // Reduce this row to one signal, then fan it out to every level above.
        let signal = n[switchId(row[0])].out;
        for (let i = 1; i < row.length; i++) {
          const gate = n[`gate_${rowIndex}_${i - 1}`];
          wires.push(signal.to(gate.a), n[switchId(row[i])].out.to(gate.b));
          signal = gate.out;
        }

        wires.push(signal.to(...above.map((levelId) => n[unlockId(levelId)].in)));
      });

      return wires;
    },
  });
}

export interface MapState {
  /** Levels whose unlock lamp is lit. */
  unlocked: Set<string>;
  /** Levels whose switch is on — the signal leaving them is live. */
  live: Set<string>;
}

/**
 * Run the map.
 *
 * Switches are driven from `solved`, the circuit settles, and unlock state is
 * read back out of the port map rather than computed alongside it. `led.in` is
 * the lamp's value; reading it is reading the simulator's answer.
 */
export function simulateMap(solved: ReadonlySet<string> = new Set()): MapState {
  const built = buildMapCircuit();

  const byName = new Map<string, Circuit>([[built.circuit.name, built.circuit]]);
  for (const [, dep] of built._dependencies) byName.set(dep.circuit.name, dep.circuit);

  const engine = createSimulatorFromCircuit(built.circuit, {
    resolveCircuit: (name: string) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation?.kind === 'primitive').map((c) => c.name),
  });

  const levelIds = MAP_ROWS.flat();
  for (const levelId of levelIds) engine.setNode(switchId(levelId), solved.has(levelId));
  engine.runCombinational();

  const values = new Map<string, number | boolean>();
  for (const [k, v] of engine.getPortValues()) values.set(k, v);

  const unlocked = new Set<string>();
  const live = new Set<string>();
  for (const levelId of levelIds) {
    if (values.get(`${unlockId(levelId)}.in`)) unlocked.add(levelId);
    if (values.get(`${switchId(levelId)}.out`)) live.add(levelId);
  }

  return { unlocked, live };
}
