/**
 * How a run starts, shared by simulate_circuit and show_circuit so the two
 * tools take the same keys and mean the same thing by them. Both follow
 * decision 0010: `inputs` is `simulate(top).set({...})`, and `memoryData` is
 * `simulate(top, { memory })`.
 */

import { z } from 'zod';

export const inputsSchema = z
  // Numbers only, including for bit inputs: a bit is 0 or 1.
  .record(z.string(), z.number())
  .optional()
  .describe(
    'Where the inputs sit at the start, as { key: value }, e.g. { "a": 1, "b": 0 }. A key is an input port name or the path of a Switch or Input node inside the circuit ("d", "cpu.kbd"). Keys resolve exactly, as simulate(top).set() does: anything else, or a name that is both a port and a Switch, is an error. Bits are 0 or 1.',
  );

export const memoryDataSchema = z
  .record(z.string(), z.record(z.string(), z.number()))
  .optional()
  .describe(
    'Memory contents to load before cycle 0, as { nodePath: { address: value } }, e.g. { "rom": { "0": 62, "1": 7 } }. A node is named by its exact path inside the circuit ("rom", "cpu.imem"); a path that names no node is an error. Addresses are decimal integers, values are numbers; addresses left out read 0. Works with any ROM or RAM primitive.',
  );
