/**
 * What a level is.
 *
 * A level is data, not code. It names the signals the grader will drive and
 * read, the primitives you may build from, and the truth table that decides
 * whether you did. Nothing here executes, which is the point: levels can move
 * to R2 later and be fetched as plain JSON without shipping executable content
 * to the browser.
 *
 * Signals are named, not typed as ports. That is deliberate — early levels are
 * self-contained circuits wiring `Switch` nodes to `Led` nodes, and later ones
 * declare real top-level ports once abstraction has been taught. The grader
 * resolves a name against either shape (see `runtime.ts`), so one format spans
 * the whole campaign and no level has to declare which kind it is.
 *
 * The grader lives in `grade.ts` and is the only thing that interprets these.
 */

/**
 * One row of the truth table. `inputs` are driven onto the named signals;
 * every key in `expect` is compared against the signal of that name.
 *
 * Values are 0/1 numbers rather than booleans — the simulator reports bits as
 * numbers, and one representation avoids a coercion layer in the grader.
 */
export interface Vector {
  inputs: Record<string, number>;
  expect: Record<string, number>;
}

export interface Level {
  /** Stable URL segment. Public surface once shared — do not rename. */
  id: string;
  title: string;
  /**
   * The problem, in a sentence or two of plain prose. This is player-facing
   * copy on a public site, so it gets written like a human wrote it.
   */
  brief: string;
  /** The circuit name the player must define. Looked up by name, not position. */
  target: string;
  /**
   * Signals the grader drives. Each must exist as a `Switch` node (or, in a
   * port-based level, a top-level input) of that name.
   */
  inputs: string[];
  /**
   * Signals the grader reads. Each must exist as an `Led` node (or a top-level
   * output) of that name.
   */
  outputs: string[];
  /**
   * Primitives the solution may be built from. Checked after elaboration, so it
   * constrains what the answer is *made of*, not what the source mentions — a
   * helper circuit built from allowed primitives is fine.
   *
   * This list also defines the score: gates used is the count of nodes whose
   * type appears here. Structural nodes are simply absent from it, so they
   * never need excluding.
   */
  allowed: string[];
  /** Starting source in the editor. */
  stub: string;
  /**
   * The truth table. Exhaustive where the input space allows it — every level
   * shipped so far is small enough that it is.
   */
  vectors: Vector[];
  /**
   * Gate count worth beating. Shown as a target, never enforced. `undefined`
   * means the level has no interesting optimum.
   */
  par?: number;
}

/** Why a submission was rejected. Each case carries what the player needs to fix it. */
export type GradeFailure =
  /** No circuit of that name in the compiled source. */
  | { kind: 'missing-circuit'; expected: string; found: string[] }
  /** Circuit exists but does not expose the signals the level named. */
  | { kind: 'interface'; problems: string[] }
  /** Elaborated netlist contains primitives the level does not permit. */
  | { kind: 'forbidden'; used: string[]; allowed: string[] }
  /** A truth-table row came out wrong. The first failing row, not all of them. */
  | { kind: 'vector'; vector: Vector; actual: Record<string, number> };

export type GradeResult =
  | { status: 'pass'; gates: number }
  | { status: 'fail'; failure: GradeFailure }
  /** Compile error, sandbox error — anything that is not a verdict on the design. */
  | { status: 'error'; message: string };
