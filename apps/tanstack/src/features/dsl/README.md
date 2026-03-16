# DSL Module

Complete DSL parser and compiler pipeline for the Turing Incomplete component simulator.

## Overview

This module provides a complete implementation of the Turing Incomplete Domain-Specific Language (DSL) v0.1, enabling human-friendly and LLM-friendly component descriptions that compile to executable IR.

**Pipeline:** `DSL Text → Tokens → AST → Validated AST → IR → Simulation`

### IDE-Grade Diagnostics

The parser implements an IDE-grade diagnostics pipeline that reports **all errors at once**:

- **Syntax errors** from Chevrotain parser (missing tokens, unexpected tokens)
- **Semantic errors** from validator (duplicate names, undefined references, unknown components)

The parser produces a best-effort AST even when syntax errors exist, marking incomplete nodes with `isIncomplete: true`. The validator defensively skips broken nodes, preventing error storms.

## Quick Start

```typescript
import { compileDSL, ComponentLibrary } from '@/features/dsl';

const source = `
  circuit HalfAdder {
    input a: Bit
    input b: Bit
    output sum: Bit
    output carry: Bit

    impl {
      node xor1: Xor
      node and1: And

      connect a -> xor1.a
      connect b -> xor1.b
      connect xor1.out -> sum

      connect a -> and1.a
      connect b -> and1.b
      connect and1.out -> carry
    }
  }
`;

const library: ComponentLibrary = /* your component library */;
const { circuits, errors } = compileDSL(source, library);

if (errors.length === 0) {
  // Success! circuits[0] is ready to simulate
  console.log(`Compiled ${circuits[0].name}`);
} else {
  console.error('Compilation errors:', errors);
}
```

## Module Structure

```
src/features/dsl/
├── types/
│   ├── ast.ts              # AST type definitions
│   └── index.ts
├── parser/
│   ├── chevrotain/         # Chevrotain-based parser
│   │   ├── tokens.ts       # Lexer token definitions
│   │   ├── parser.ts       # CstParser implementation
│   │   ├── visitor.ts      # CST → AST conversion
│   │   └── index.ts
│   ├── validator.ts        # Semantic analyzer
│   └── index.ts
├── compiler/
│   ├── ir-generator.ts     # AST → IR compiler
│   └── index.ts
├── (grammar.ebnf moved to packages/core/src/dsl/grammar.ebnf)
└── index.ts                # Main entry point
```

## Components

### Parser (Chevrotain)

Uses the Chevrotain parser library for robust parsing with multi-error recovery.

```typescript
import { parseDSL, parseDSLOrThrow } from '@/features/dsl';

// Parse with error collection (IDE mode)
const { ast, errors } = parseDSL(source);

// Parse with component library for unknown component errors
const { ast, errors } = parseDSL(source, {
  sourceName: 'editor.dsl',
  componentLibrary: {
    resolveComponent: (name) => library.get(name),
    getAllPrimitiveNames: () => ['And', 'Or', 'Xor', 'Not', ...],
  }
});

// Or parse and throw on errors
const ast = parseDSLOrThrow(source);
```

**Features:**
- Multi-error recovery: reports multiple syntax errors in a single pass
- IDE-grade diagnostics: returns ALL errors (syntax + semantic) at once
- Best-effort AST: produces AST even with syntax errors (incomplete nodes marked)
- Optional component library integration for "unknown component" errors
- Supports all DSL constructs (circuits, ports, nodes, connections, testbenches)
- Handles parameterized circuits
- Clear error messages with source locations
- Canonical grammar defined in `grammar.ebnf`

### Validator

Performs semantic analysis on the AST. Designed to work with incomplete ASTs from error recovery.

```typescript
import { validate } from '@/features/dsl';

// Basic validation
const errors = validate(ast);

// With component library for unknown component checks
const errors = validate(ast, {
  componentLibrary: {
    resolveComponent: (name) => library.get(name),
    getAllPrimitiveNames: () => [...primitiveNames],
  }
});
```

**Error Categories:**
- `'syntax'` - Parse errors (from Chevrotain)
- `'structure'` - AST building issues
- `'semantic'` - Validation errors

**Checks:**
- Duplicate names (circuits, ports, nodes, parameters)
- Undefined references (ports, nodes, parameters)
- Multiple drivers on single input
- Invalid parameter references
- Unknown components (when componentLibrary provided)

### IR Compiler

Compiles validated AST to executable IR.

```typescript
import { compileToIR, ComponentLibrary } from '@/features/dsl';

const circuits = compileToIR(ast, library);
// Returns: Circuit[] (IR v0.1 format)
```

**Features:**
- Resolves component references from library
- Evaluates parameters and substitutes values
- Creates runtime port and node instances
- Generates unique IDs for all elements
- Validates type compatibility

## API Reference

### Main Functions

#### `compileDSL(source, library, sourceName?)`

Complete pipeline: source text → IR circuits.

**Parameters:**
- `source: string` - DSL source code
- `library: ComponentLibrary` - Component library for resolution
- `sourceName?: string` - Optional source file name (for errors)

**Returns:**
```typescript
{
  circuits: Circuit[],
  errors: Array<{ message: string, line: number, column: number }>
}
```

#### `parseDSL(source, sourceName?)`

Parse source to validated AST.

**Parameters:**
- `source: string` - DSL source code
- `sourceName?: string` - Optional source file name

**Returns:**
```typescript
{
  ast: Program,
  errors: ValidationError[]
}
```

#### `parseDSLOrThrow(source, sourceName?)`

Parse and throw on errors (convenience function).

**Returns:** `Program` (AST)
**Throws:** Error if parsing or validation fails

### Component Library Interface

To compile DSL to IR, you must provide a component library:

```typescript
interface ComponentLibrary {
  getCircuit(name: string): Circuit | undefined;
  hasCircuit(name: string): boolean;
}
```

Example implementation:

```typescript
class MyLibrary implements ComponentLibrary {
  private circuits = new Map<string, Circuit>();

  constructor() {
    // Add primitives
    this.addPrimitive('And', ['a', 'b'], ['out']);
    this.addPrimitive('Or', ['a', 'b'], ['out']);
    // ...
  }

  getCircuit(name: string): Circuit | undefined {
    return this.circuits.get(name);
  }

  hasCircuit(name: string): boolean {
    return this.circuits.has(name);
  }

  addCircuit(circuit: Circuit): void {
    this.circuits.set(circuit.name, circuit);
  }
}
```

## DSL Syntax

### Circuit Definition

```
circuit <name> [(<parameters>)] {
  input <name>: <type>
  output <name>: <type>
  clock <name>
  state <name>: <type> [= <initial_value>]

  impl {
    node <instance>: <ComponentType>[(<arguments>)]
    connect <source> -> <target>
  }
}
```

### Types

- `Bit` - Single binary value
- `Bus[N]` - N-bit wide bus (e.g., `Bus[8]`)
- `Bus[param]` - Parameterized width

### Parameters

```
circuit Adder(width: int = 8) {
  input a: Bus[width]
  input b: Bus[width]
  output sum: Bus[width]
}
```

### Connections

```
connect a -> node1.input_port
connect node1.output_port -> node2.input_port
connect node2.output_port -> result
```

## Examples

See `examples.test.ts` for complete working examples:
- Simple circuits (Buffer, NOT gate)
- Composite circuits (HalfAdder, FullAdder)
- Hierarchical circuits (multi-level composition)
- Error handling
- Multi-component programs

## Testing

```bash
pnpm test src/features/dsl/
```

**Test Files:**
- `chevrotain.test.ts` - Chevrotain parser tests (lexer, parser, multi-error recovery)
- `examples.test.ts` - Real-world usage examples

## Error Handling

The DSL provides detailed error messages with source locations:

```
Error: Undefined component: 'Xorr'
  at component HalfAdder, line 8, column 18

  Suggestions:
  - Did you mean 'Xor'?
  - Check spelling and case sensitivity
```

**Error Types:**
- Lexer errors: Invalid characters, unterminated strings/comments
- Parse errors: Syntax violations, missing elements
- Validation errors: Duplicate names, undefined references
- Compiler errors: Unresolved components, type mismatches

## Integration

This module integrates with:

- **Phase 1 IR:** Generates IR v0.1 compatible with simulator-v0.1
- **Component Library:** Uses existing component-library-store
- **Visual Editor:** (Phase 3) Will sync with visual component editor

## Documentation

For complete DSL specification and design rationale:
- `/docs/SPECIFICATIONS/DSL-and-IR-specification.md` - DSL syntax and semantics
- `/docs/dsl-examples.md` - Example circuits
- `/docs/GUIDES/dsl-editor-guide.md` - Editor usage guide
