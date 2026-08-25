/**
 * What a level is.
 *
 * A level is data, not code. It names the signals the grader will drive and
 * read, the primitives you may build from, and the truth table that decides
 * whether you did. Nothing here executes, which is the point: levels can move
 * to R2 later and be fetched as plain JSON without shipping executable content
 * to the browser.
 *
 * Signals are named, not typed as ports. That is deliberate: early levels are
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
 * Values are 0/1 numbers rather than booleans, since the simulator reports bits as
 * numbers, and one representation avoids a coercion layer in the grader.
 */
export interface Vector {
  inputs: Record<string, number>;
  expect: Record<string, number>;
}

export interface Level {
  /** Stable URL segment. Public surface once shared; do not rename. */
  id: string;
  title: string;
  /**
   * One line, in the header beside the title: what this level is about.
   *
   * Separate from `brief` because the two are read at different moments. The
   * header is a glance while you work, and it truncates, so putting the problem
   * statement there meant the first thing on screen was a half-sentence of
   * instructions. This says what you are making; `brief` says what counts as
   * done.
   */
  tagline: string;
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
   * constrains what the answer is *made of*, not what the source mentions; a
   * helper circuit built from allowed primitives is fine.
   *
   * This list also defines the score: gates used is the count of nodes whose
   * type appears here. Structural nodes are simply absent from it, so they
   * never need excluding.
   */
  allowed: string[];
  /**
   * A one-time explainer, shown on first arrival at this level.
   *
   * For a band that introduces something the player has never met and cannot
   * discover from the brief; the clock arrives this way, with no wire to
   * connect and no gate to place, so nothing on screen would otherwise account
   * for it. Shown once, then never again.
   */
  intro?: {
    headline: string;
    body: string;
    /**
     * Somewhere to read more. Kept as data rather than markup so a level stays
     * plain JSON; see the note at the top of this file.
     */
    link?: { label: string; href: string };
  };
  /** Starting source in the editor. */
  stub: string;
  /**
   * The truth table. Exhaustive where the input space allows it: every
   * combinational level shipped so far is small enough that it is.
   *
   * On a `sequential` level these are ordered steps, not independent cases, and
   * reordering or deduplicating them destroys what they assert.
   */
  vectors: Vector[];
  /**
   * Does this level's answer have memory?
   *
   * The grader needs no help; it drives one vector per clock tick and does not
   * reset between them, so state already carries. This exists for the spec
   * panel, which otherwise presents ordered steps as an unordered truth table
   * and tells the player the opposite of the lesson: on a latch the same inputs
   * appear twice with different outputs, which is a contradiction in a truth
   * table and the definition of memory in a sequence.
   */
  sequential?: boolean;
  /**
   * Gate count worth beating. Used for scoring; not shown on the completion
   * dialog, where a par figure reads as a mark out of ten rather than an
   * invitation. `undefined` means the level has no interesting optimum.
   */
  par?: number;
  /**
   * What the completion dialog says. Written per level so finishing one names
   * what you just built and points at what is coming, instead of repeating a
   * generic "solved" every time.
   */
  outro: {
    /** The reaction, not the fact. Short. */
    headline: string;
    /** A sentence or two: what you made, and the hook into the next level. */
    body: string;
  };
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
  /** Compile error, sandbox error: anything that is not a verdict on the design. */
  | { status: 'error'; message: string };
