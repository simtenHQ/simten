# Validation & Analysis Pipeline

An LLM-native hardware design environment with two sibling capabilities for circuit validation and analysis.

## Overview

The pipeline provides:

1. **Validation Pipeline** - Static correctness checking (syntax → semantic → type → structural)
2. **Analysis Pipeline** - Hardware metrics, simulation traces, design deltas

This transforms the system from "DSL with error correction" to an "LLM-native hardware design environment".

## Architecture

```
DSL Source
    ↓
┌─────────────────────────────────────────┐
│     validateCircuit(source, context)    │  ← VALIDATION PIPELINE
│                                         │
│  Phase 1: Syntax    (Chevrotain)       │
│  Phase 2: Semantic  (Validator)        │
│  Phase 3: Type      (IR Compilation)   │
│  Phase 4: Structural (Elaboration)     │
│         → ValidationResult              │
└─────────────────────────────────────────┘
    ↓ (if canSimulate)
┌─────────────────────────────────────────┐
│     analyzeCircuit(context)             │  ← ANALYSIS PIPELINE
│                                         │
│  Metrics: depth, fan-out, registers    │
│         → CircuitMetrics                │
└─────────────────────────────────────────┘
```

## Validation Pipeline

### Usage

```typescript
import { validateCircuit, formatForLLM, formatForMonaco } from '@/features/dsl';

// Validate DSL source code
const result = validateCircuit(source, {
  componentLibrary: library,
});

// Check results
result.valid           // true if no errors
result.canSimulate     // true if no blocking errors
result.diagnostics     // array of typed diagnostics

// Format for different consumers
const monacoMarkers = formatForMonaco(result);  // IDE squiggly lines
const cliOutput = formatForCLI(result);         // Terminal output
const llmContext = formatForLLM(result);        // AI consumption
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;              // No errors at all
  canSimulate: boolean;        // No blocking errors
  diagnostics: Diagnostic[];   // All issues found
  ast?: Program;               // Parsed AST (if syntax passed)
  circuits?: Circuit[];        // Compiled circuits (if type passed)
  availableComponents: ComponentInterface[];
  summary: ValidationSummary;
  analysis: {
    circuitsDefined: string[];
    componentsUsed: string[];
    unresolvedReferences: string[];
  };
}
```

### Diagnostic Codes

| Code | Phase | Severity | Description |
|------|-------|----------|-------------|
| `SYNTAX_ERROR` | syntax | error | Parser-level syntax error |
| `UNKNOWN_COMPONENT` | semantic | error | Referenced component not found |
| `DUPLICATE_NAME` | semantic | error | Name already defined |
| `UNDEFINED_REFERENCE` | semantic | error | Reference to undefined item |
| `WIDTH_MISMATCH` | type | error | Bus width incompatibility |
| `COMBINATIONAL_CYCLE` | structural | error | Illegal feedback loop |
| `FLOATING_INPUT` | structural | error | Input port not connected |
| `FLOATING_OUTPUT` | structural | warning | Output port not driven |

### Phase Guarding

The pipeline uses phase guarding - later phases only run if earlier phases pass:

```
Syntax → Semantic → Type → Structural
                      ↓
              (guards structural)
```

Structural checks will not run if type checking fails, preventing invalid graphs.

## Analysis Pipeline

### Circuit Metrics

```typescript
import { analyzeCircuit } from '@/features/dsl';
import { elaborate } from '@/core/simulator/elaboration';

// Create analysis context
const flat = elaborate(circuit, library);
const ctx = { circuit, flat, library };

// Extract metrics
const metrics = analyzeCircuit(ctx);
```

#### CircuitMetrics

```typescript
interface CircuitMetrics {
  nodeCount: number;           // Total component instances
  registerCount: number;       // Sequential elements
  combinationalDepth: number;  // Critical path length
  maxFanOut: number;           // Highest output connections
  maxFanIn: number;            // Highest input connections
  isPurelyCombinational: boolean;
}
```

### Simulation Traces

```typescript
import { simulateCircuit, extractBehavioralDiagnostics } from '@/features/dsl';

// Run simulation
const trace = simulateCircuit(ctx, stimuli, { cycles: 100 });

// Extract behavioral insights
const behavioral = extractBehavioralDiagnostics(trace);
```

#### Behavioral Diagnostic Codes

| Code | Description |
|------|-------------|
| `REGISTER_NEVER_UPDATES` | Register value never changes |
| `OUTPUT_CONSTANT` | Signal is always the same value |
| `UNUSED_SIGNAL` | Signal is never read |
| `HIGH_TOGGLE_RATE` | Signal changes very frequently |
| `LONG_COMBINATIONAL_PATH` | Critical path exceeds threshold |

### Design Delta Analysis

```typescript
import { compareCircuits } from '@/features/dsl';

// Compare two circuit versions
const delta = compareCircuits(originalCtx, modifiedCtx);
```

#### CircuitDelta

```typescript
interface CircuitDelta {
  combinationalDepthChange: number;
  registerCountChange: number;
  cycleResolved: boolean;
  latencyChange: number;
  nodesAdded: string[];
  nodesRemoved: string[];
}
```

## LLM Integration

### Hardware LLM Envelope

The canonical response contract for all LLM interactions:

```typescript
import { buildEnvelope, serializeEnvelope } from '@/features/dsl';

const envelope = buildEnvelope({
  validation: result,
  metrics: metrics,
  simulation: trace,
  library: library,
});

const json = serializeEnvelope(envelope);
```

#### Envelope Structure

```typescript
interface HardwareLLMEnvelope {
  version: '1.0';
  validation: ValidationResult;
  metrics: CircuitMetrics | null;
  behavioralDiagnostics: BehavioralDiagnostic[];
  simulation: SimulationTrace | null;
  delta: CircuitDelta | null;
  components: ComponentInterface[];
  grammarSummary: string;
}
```

**Critical**: All fields are always present (use `null` or `[]` for absent data). LLMs treat missing keys as semantic signals.

### Example LLM Output

```json
{
  "version": "1.0",
  "validation": {
    "valid": true,
    "canSimulate": true,
    "diagnostics": []
  },
  "metrics": {
    "nodeCount": 12,
    "registerCount": 2,
    "combinationalDepth": 5,
    "maxFanOut": 4,
    "maxFanIn": 2,
    "isPurelyCombinational": false
  },
  "behavioralDiagnostics": [
    {
      "code": "LONG_COMBINATIONAL_PATH",
      "severity": "suggestion",
      "message": "Combinational depth is 5 - consider pipelining"
    }
  ],
  "simulation": null,
  "delta": null,
  "components": [...],
  "grammarSummary": "circuit <Name> { input <name>: Bit | Bus[N] ... }"
}
```

## UI Integration

### Diagnostics Panel

The right sidebar includes a **Diagnostics** tab showing:

1. **Status Banner** - Valid (green) or errors (red)
2. **Circuit Metrics** - Node count, registers, critical path, fan-out
3. **Analysis Summary** - Circuits defined, components used
4. **Diagnostics List** - All errors/warnings with suggestions

The panel updates automatically when you compile DSL code.

## Structural Checks

### Cycle Detection

Uses Tarjan's strongly connected components (SCC) algorithm:

1. **Quick detection**: Kahn's algorithm for topological sort
2. **Precise reporting**: Tarjan's SCC identifies exact nodes in cycles

Sequential elements (Register, DFlipFlop) break cycles - they are legal feedback paths.

```typescript
import { checkCycles, hasCycle } from '@/features/dsl';

const result = checkCycles(flatCircuit, library);
// { hasCycle: boolean, cycles: string[][], diagnostics: Diagnostic[] }
```

### Floating Port Detection

```typescript
import { checkFloatingInputs, checkFloatingOutputs } from '@/features/dsl';

const inputDiagnostics = checkFloatingInputs(flat, library);
const outputDiagnostics = checkFloatingOutputs(flat);
```

## Design Principles

1. **Validation = Authoritative** - Determines if circuit is legal
2. **Analysis = Advisory** - Provides insights for optimization
3. **Deterministic Output** - Same input always produces same output order
4. **All Fields Present** - Never omit fields in LLM output
5. **Phase Guarding** - Don't run later phases if earlier phases fail
6. **Parser Agnostic** - Swapping Chevrotain for Tree-sitter only affects Phase 1

## File Structure

```
src/features/dsl/
├── validation/
│   ├── types.ts          # Diagnostic, ValidationResult types
│   ├── structural.ts     # Cycle detection, floating ports
│   ├── validate.ts       # Main orchestration
│   ├── catalog.ts        # Component catalog
│   ├── formatters.ts     # Monaco, CLI, LLM formatters
│   └── index.ts
├── analysis/
│   ├── types.ts          # CircuitMetrics, SimulationTrace
│   ├── metrics.ts        # Structural metrics extraction
│   ├── simulate.ts       # Simulation traces
│   ├── delta.ts          # Design comparison
│   ├── envelope.ts       # HardwareLLMEnvelope
│   └── index.ts
└── index.ts              # Public exports
```

## Related Documentation

- [DSL Editor Guide](../GUIDES/dsl-editor-guide.md) - Using the Diagnostics panel
- [DSL and IR Specification](../SPECIFICATIONS/DSL-and-IR-specification.md) - Language syntax
- [Component Model](../SPECIFICATIONS/component-model.md) - Primitives vs composites
