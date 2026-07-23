/**
 * Component homes — the single source of truth for classifying every primitive
 * the Verilog importer can emit.
 *
 * Two orthogonal axes on the *same* set of components (do not maintain two
 * drifting lists):
 *
 *   - `kind`: 'reconstruction' (pure bit-wiring that multiplies at scale —
 *     Slice/Concat/SignExtend/ZeroExtend and their internal Rtl* precursors)
 *     vs 'semantic' (everything that does logic/arithmetic/storage).
 *     → the cleanliness metric reads `kind` (reconstruction ÷ semantic ratio).
 *
 *   - `home`: 'stdlib' (corresponds to a construct an HDL author writes directly
 *     — arithmetic, compares, slices, extensions) vs 'import' (exists only as a
 *     product of yosys elaboration; no author writes it — `$pmux`, inferred
 *     `$dlatch`, exotic FF variants, packed memory).
 *     → the serializer/palette read `home`: 'import' primitives are injected +
 *     serializable but kept out of the authoring palette.
 *
 * The internal `Rtl*` primitives are transitional: Workstream A replaces the
 * semantic ones (RtlAdd → Adder, RtlAnd → BusAnd, …) with their stdlib homes so
 * generated source contains no `Rtl*`. They are classified here so the metric
 * and serializer stay total while that migration is in flight.
 */

export type ComponentKind = 'reconstruction' | 'semantic';
export type ComponentHome = 'stdlib' | 'import';

export interface Classification {
  kind: ComponentKind;
  home: ComponentHome;
}

const R: Classification = { kind: 'reconstruction', home: 'stdlib' };
const S_STD: Classification = { kind: 'semantic', home: 'stdlib' };
const S_IMP: Classification = { kind: 'semantic', home: 'import' };

/**
 * Exact-name classification. Shape-named primitives (RtlPmux_32w_10s, …) are
 * matched by prefix in {@link classify}, not listed here.
 */
const EXACT: Record<string, Classification> = {
  // ── reconstruction (bit-wiring) — authoring stdlib ────────────────────────
  Slice: R,
  Concat: R,
  SignExtend: R,
  ZeroExtend: R,
  // internal precursors (removed as Workstream B lands the clean nodes above)
  RtlSlice: { kind: 'reconstruction', home: 'import' },
  RtlConcat2: { kind: 'reconstruction', home: 'import' },

  // ── semantic — authoring stdlib ───────────────────────────────────────────
  Constant: S_STD,
  Adder: S_STD,
  Subtractor: S_STD,
  Comparator: S_STD,
  SignedComparator: S_STD,
  Multiplier: S_STD,
  SignedMultiplier: S_STD,
  WrappingMultiplier: S_STD,
  DynamicSlice: S_STD,
  Mux: S_STD,
  Register: S_STD,
  BusAnd: S_STD,
  BusOr: S_STD,
  BusXor: S_STD,
  BusXnor: S_STD,
  BusNot: S_STD,
  LeftShifter: S_STD,
  RightShifter: S_STD,
  SignedRightShifter: S_STD,
  LogicAnd: S_STD,
  LogicOr: S_STD,
  LogicNot: S_STD,
  ReduceOr: S_STD,
  ReduceAnd: S_STD,
  ReduceXor: S_STD,

  // ── semantic — internal Rtl* (transitional; → stdlib via Workstream A) ─────
  RtlAdd: S_IMP,
  RtlSub: S_IMP,
  RtlAnd: S_IMP,
  RtlOr: S_IMP,
  RtlXor: S_IMP,
  RtlNot: S_IMP,
  RtlReduceOr: S_IMP,
  RtlReduceBool: S_IMP,
  RtlReduceAnd: S_IMP,
  RtlReduceXor: S_IMP,
  RtlLogicAnd: S_IMP,
  RtlLogicOr: S_IMP,
  RtlLogicNot: S_IMP,
  RtlLt: S_IMP,
  RtlLe: S_IMP,
  RtlGt: S_IMP,
  RtlGe: S_IMP,
  RtlNe: S_IMP,
  RtlShl: S_IMP,
  RtlShr: S_IMP,
  RtlSshr: S_IMP,
};

/**
 * Shape-named import-namespace primitives — pure elaboration artifacts whose
 * port *set* varies per instance, so the shape is baked into the name
 * (RtlPmux_32w_10s, RtlMem_2r1w_8a_8w_256d, RtlDlatch_8w_ep1). Matched by prefix.
 */
const IMPORT_PREFIXES = ['Pmux', 'Mem', 'Dlatch'] as const;

/**
 * Classify a component by name. Returns `undefined` for names that are not
 * importer-emitted primitives (e.g. an instantiated submodule / user circuit) —
 * callers treat those as semantic module instances, never as reconstruction.
 */
export function classify(name: string): Classification | undefined {
  const exact = EXACT[name];
  if (exact) return exact;
  for (const p of IMPORT_PREFIXES) if (name.startsWith(p)) return S_IMP;
  return undefined;
}

/** A reconstruction (bit-wiring) node, per the cleanliness metric. */
export function isReconstruction(name: string): boolean {
  return classify(name)?.kind === 'reconstruction';
}

/**
 * Is this a known importer primitive the serializer may emit *by name* without
 * recursing into it (because the editor sandbox pre-injects it)? True for every
 * classified primitive — stdlib and import namespace alike. Submodule/user
 * circuits (undefined classification) return false and are emitted recursively.
 */
export function isKnownSerializablePrimitive(name: string): boolean {
  return classify(name) !== undefined;
}

/**
 * For a shape-named import-namespace primitive (`Pmux_32w_10s`), the factory
 * name to emit in generated source (`Pmux`) — the serializer emits a factory
 * call `Pmux({ width, sWidth })` that reconstructs the exact shape. Returns
 * undefined for everything else (emitted by their own name).
 */
export function importFactoryName(name: string): string | undefined {
  return IMPORT_PREFIXES.find((p) => name.startsWith(`${p}_`));
}
