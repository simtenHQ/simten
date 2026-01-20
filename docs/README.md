# Turing Incomplete DSL and IR Documentation

## Overview

This directory contains the complete v0.1 specification for the Turing Incomplete domain-specific language (DSL) and intermediate representation (IR). These specifications define how digital circuits are described, compiled, and simulated in the browser.

## Quick Start

**New to the project?** Start here:

1. Read [Implementation FAQ](./FAQ_IMPLEMENTATION.md) - **Quick answers to common questions**
2. Read [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - **Step-by-step implementation guide**
3. Read [v0.1 Specification Summary](./v0.1-specification-summary.md) - High-level overview
4. Browse [Workflow Examples](./WORKFLOW_EXAMPLES.md) - How users create composite components
5. Browse [DSL Examples](./dsl-examples.md) - Concrete circuit examples
6. Study [Reference Implementations](./reference-implementations.md) - Complete DSL/IR/execution traces

**Implementing the system?** Follow this order:

1. [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - **Essential reading** - Phased implementation plan
2. [Workflow Examples](./WORKFLOW_EXAMPLES.md) - User workflows and UI mockups
3. [DSL v0.1 Specification](./dsl-v0.1-spec.md) - Language syntax
4. [Linking and Resolution](./linking-and-resolution.md) - Name resolution pipeline
5. [IR v0.1 Specification](./ir-v0.1-spec.md) - Target representation

**Implementing the DSL compiler?** Read these in order:

1. [DSL v0.1 Specification](./dsl-v0.1-spec.md) - Language syntax
2. [Linking and Resolution](./linking-and-resolution.md) - Name resolution pipeline
3. [IR v0.1 Specification](./ir-v0.1-spec.md) - Target representation

**Implementing the simulator?** Read these in order:

1. [IR v0.1 Specification](./ir-v0.1-spec.md) - Data structures
2. [Component Library Model](./component-library-model.md) - Component types
3. [Execution Semantics](./execution-semantics.md) - How to simulate

## Document Index

### Core Specifications

| Document | Purpose | Audience |
|----------|---------|----------|
| [v0.1 Specification Summary](./v0.1-specification-summary.md) | High-level overview and design decisions | Everyone |
| [DSL v0.1 Specification](./dsl-v0.1-spec.md) | Complete language syntax and semantics | DSL users, compiler developers |
| [IR v0.1 Specification](./ir-v0.1-spec.md) | Formal IR type definitions (JSON schema) | Compiler and simulator developers |

### Implementation Guides

| Document | Purpose | Audience |
|----------|---------|----------|
| [Implementation FAQ](./FAQ_IMPLEMENTATION.md) | **Quick answers to common implementation questions** | **All developers - READ FIRST** |
| [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) | **Step-by-step implementation plan from current state to MVP** | **All developers - ESSENTIAL** |
| [Workflow Examples](./WORKFLOW_EXAMPLES.md) | User workflows, UI mockups, data flow diagrams | All developers, UX designers |
| [Component Library Model](./component-library-model.md) | How components are organized and resolved | All developers |
| [Linking and Resolution](./linking-and-resolution.md) | Name resolution and type checking pipeline | Compiler developers |
| [Execution Semantics](./execution-semantics.md) | Detailed simulation algorithms | Simulator developers |

### Examples and Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [DSL Examples](./dsl-examples.md) | Circuit examples from simple to complex | DSL users, LLM training |
| [Reference Implementations](./reference-implementations.md) | Complete DSL/IR/execution for key circuits | All developers |

## Key Design Principles

### 1. Clear Separation of Concerns

```
DSL (what to build) ≠ UI (how to render) ≠ IR (how to execute)
```

- **DSL** describes circuit structure and behavior
- **UI** adds visual metadata (positions, colors)
- **IR** is the executable representation

### 2. Components Are Not Keywords

```
DSL Text → AST (names) → Linker (resolve) → IR (definitions)
```

Components like `And`, `Xor`, `Register` are library definitions, not language keywords. This enables:
- User-defined components
- Standard library extensibility
- Future compatibility

### 3. Three Types of Components

| Type | Implementation | Purpose | Examples |
|------|---------------|---------|----------|
| **Primitive** | Simulator kernel | Fast core operations | And, Or, Register, RAM |
| **Composite** | Built from other components | User extensibility | HalfAdder, FullAdder, ALU |
| **Intrinsic** | Special simulator logic | UI/debugging | Display, Input, Probe |

### 4. Type Safety

All ports have explicit types:
- `Bit` - Single binary value
- `Bus[N]` - N-bit wide signal

All connections are type-checked at compile time.

### 5. Deterministic Execution

- Combinational circuits: Topological evaluation
- Sequential circuits: Clock-driven state updates
- No race conditions, no undefined behavior

### 6. LLM-Friendly Syntax

- Consistent structure (all circuits follow same pattern)
- Predictable naming (PascalCase types, snake_case ports)
- Self-documenting (explicit types, clear connections)
- Forgiving (whitespace-insensitive, helpful errors)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐    ┌──────────┐    ┌─────────────┐         │
│  │    DSL    │───▶│  Parser  │───▶│     AST     │         │
│  │  (Text)   │    └──────────┘    └─────────────┘         │
│  └───────────┘                            │                │
│       ▲                                   │                │
│       │                                   ▼                │
│   Human/LLM                      ┌─────────────────┐       │
│    writes                        │ Symbol Table    │       │
│                                  │    Builder      │       │
│                                  └────────┬────────┘       │
│                                           │                │
│                                           ▼                │
│                                  ┌─────────────────┐       │
│                                  │  Name Resolver  │       │
│                                  └────────┬────────┘       │
│                                           │                │
│                                           ▼                │
│                                  ┌─────────────────┐       │
│                                  │  Type Checker   │       │
│                                  └────────┬────────┘       │
│                                           │                │
│                                           ▼                │
│                                  ┌─────────────────┐       │
│                                  │  IR Generator   │       │
│                                  └────────┬────────┘       │
│                                           │                │
└───────────────────────────────────────────┼────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      IR (JSON)                              │
│  - Circuit structure (nodes, connections)                   │
│  - Port types and directions                                │
│  - State blocks and clocking                                │
│  - Metadata (tests, docs)                                   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                ┌───────────────┴────────────────┐
                │                                │
                ▼                                ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│      Simulator           │      │      UI Projection       │
├──────────────────────────┤      ├──────────────────────────┤
│                          │      │                          │
│  ┌────────────────────┐  │      │  ┌────────────────────┐  │
│  │ Component Library  │  │      │  │  Visual Editor     │  │
│  │ - Primitives       │  │      │  │  - ReactFlow       │  │
│  │ - Standard lib     │  │      │  │  - Node rendering  │  │
│  └────────────────────┘  │      │  │  - Connection UI   │  │
│                          │      │  └────────────────────┘  │
│  ┌────────────────────┐  │      │                          │
│  │ Evaluator          │  │      │  ┌────────────────────┐  │
│  │ - Topological sort │  │      │  │  UI Metadata       │  │
│  │ - Combinational    │  │      │  │  - Positions       │  │
│  │ - Sequential       │  │      │  │  - Colors          │  │
│  └────────────────────┘  │      │  │  - Labels          │  │
│                          │      │  └────────────────────┘  │
│  ┌────────────────────┐  │      │                          │
│  │ State Manager      │  │      └──────────────────────────┘
│  │ - Registers        │  │
│  │ - Memory           │  │
│  │ - Clock tracking   │  │
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
```

## Component Library Structure

```
Standard Library
├── primitives/ (Simulator Kernel)
│   ├── gates/
│   │   ├── And, Or, Xor, Not
│   │   └── Nand, Nor, Xnor, Buffer
│   ├── state/
│   │   ├── Register, RegisterN
│   │   └── DFF (D Flip-Flop)
│   ├── memory/
│   │   ├── RAM
│   │   └── ROM
│   └── arithmetic/
│       ├── Add, Subtract
│       └── Multiply
│
├── composite/ (Standard Library)
│   ├── arithmetic/
│   │   ├── HalfAdder
│   │   ├── FullAdder
│   │   ├── RippleCarryAdder(width)
│   │   └── ALU(width)
│   ├── memory/
│   │   ├── RegisterFile(size, width)
│   │   └── Stack(depth, width)
│   └── mux/
│       ├── Mux2to1, Mux4to1
│       └── Decoder2to4
│
└── intrinsic/ (Special Behavior)
    ├── Display (UI widget)
    ├── Input (UI widget)
    └── DebugProbe (debugger)
```

## Implementation Status

### Phase 1: IR v0.1 Core Infrastructure ✅ COMPLETE
- [x] IR v0.1 type definitions (`/src/features/visual-editor/types/ir-v0.1.ts`)
- [x] Component library store with three-tier resolution (primitives/standard/user)
- [x] Recursive composite simulator (`simulator-v0.1.ts`)
- [x] 31+ primitive components with evaluators
- [x] Comprehensive test coverage (73 tests passing)
- [x] Documentation complete

**Status**: All success criteria met. See [Phase 1 Completion Summary](./PHASE_1_COMPLETION_SUMMARY.md)

### Phase 2: DSL Parser Pipeline ✅ COMPLETE
- [x] Complete DSL lexer (tokenizer) with source location tracking
- [x] Recursive descent parser for full v0.1 DSL syntax
- [x] AST type definitions (`/src/features/dsl/types/ast.ts`)
- [x] Semantic validator (duplicate detection, name resolution)
- [x] IR compiler (AST → IR v0.1)
- [x] Comprehensive test coverage (59 tests passing)
- [x] HalfAdder, FullAdder, 4-bit Adder examples working

**Status**: All success criteria met. See [Phase 2 Completion Summary](./PHASE_2_COMPLETION_SUMMARY.md)

### Phase 3: DSL Editor Integration ✅ COMPLETE
- [x] Monaco-based DSL code editor with syntax highlighting
- [x] Real-time DSL compilation to IR v0.1
- [x] Component library UI (primitives/standard/user tabs)
- [x] Visual editor ↔ DSL bidirectional workflow
- [x] Error reporting with line/column information
- [x] Sequential circuit support (clocks, registers, RAM, D flip-flops)
- [x] Clock controls UI (Step/Run/Pause/Reset)
- [x] IR flattening for composite components

**Status**: All success criteria met. See [Phase 3 Architecture](./phase3-architecture.md)

### Phase 4: Canvas as DSL (Ready for MVP Work)
**Goal**: Make the visual canvas generate DSL, making DSL the single source of truth

Current capabilities:
- Users can write DSL → compile to IR → simulate
- Users can drag primitives onto canvas → simulate (legacy IR)
- **Gap**: Canvas doesn't generate DSL from visual layout

Next steps:
- Implement visual → DSL serialization
- Make canvas edit DSL under the hood
- Deprecate legacy IR, migrate fully to IR v0.1
- Enable visual creation of composite components

### Current Architecture (Phases 1-3 Complete)

**Single IR System**: The codebase uses IR v0.1 as the canonical format:
- `/src/features/visual-editor/types/ir-v0.1.ts` - **Canonical IR specification**
- `/src/features/visual-editor/types/ir.ts` - **Legacy compatibility shims only**
- DSL compiler outputs IR v0.1
- Simulator v0.1 consumes IR v0.1
- Component library uses IR v0.1 throughout
- Visual editor still uses legacy IR (to be migrated in Phase 4)

**There is NO "two IR problem"** - only one canonical IR with legacy compatibility layer.

## Getting Involved

### For DSL Users

1. Study the [DSL Examples](./dsl-examples.md)
2. Try writing simple circuits
3. Provide feedback on syntax clarity
4. Report confusing error messages

### For Compiler Developers

1. Read the [DSL Specification](./dsl-v0.1-spec.md)
2. Study the [Linking and Resolution](./linking-and-resolution.md) pipeline
3. Implement parser and linker
4. Generate IR following [IR Specification](./ir-v0.1-spec.md)

### For Simulator Developers

1. Read the [IR Specification](./ir-v0.1-spec.md)
2. Understand [Component Library Model](./component-library-model.md)
3. Implement [Execution Semantics](./execution-semantics.md)
4. Test with [Reference Implementations](./reference-implementations.md)

### For UI Developers

1. IR is read-only source of truth
2. UI adds visual metadata (positions, colors)
3. UI updates do not modify IR semantics
4. Synchronize with IR changes via projection

## Design Rationale

### Why DSL + IR?

**DSL** provides human/LLM-friendly syntax:
- Clear, readable
- Forgiving of variations
- Self-documenting

**IR** provides machine-executable representation:
- Unambiguous semantics
- Efficient evaluation
- Optimizable

Separation allows evolution of DSL syntax without breaking IR consumers.

### Why Three Component Types?

**Primitives** - Performance-critical operations
**Composites** - User extensibility and reusability
**Intrinsics** - UI/debugging without polluting core model

### Why Explicit Types?

Type safety catches errors early:
- Prevent connecting Bus[8] to Bit
- Detect multiple drivers
- Enable optimization

### Why Deterministic Execution?

Predictable behavior:
- Same inputs → same outputs
- Reproducible tests
- No race conditions

## Common Questions

**Q: Can I define custom primitives?**
A: No. Primitives are part of the simulator kernel. Use composite components instead.

**Q: Can I redefine standard library components?**
A: Yes, through shadowing. But you cannot shadow primitives.

**Q: How do I create reusable components?**
A: Define circuits with clear inputs/outputs. Use parameters for genericity.

**Q: Can circuits have side effects?**
A: Only intrinsic components (Display, Input) have side effects. Pure logic has no side effects.

**Q: How do I debug circuits?**
A: Use DebugProbe intrinsic, test cases in metadata, and step-by-step simulation.

**Q: Can I import components from other files?**
A: Not in v0.1. Planned for future version.

## Resources

- **TypeScript IR Types**: `/src/features/visual-editor/types/ir-v0.1.ts`
- **Examples**: All documents in this directory
- **Discussion**: GitHub Issues

## Version History

- **v0.1** (2026-01-19) - Initial specification incorporating senior engineering feedback

## License

See project root LICENSE file.

## Contributing

Contributions welcome! Please:

1. Read the specifications thoroughly
2. Discuss significant changes via GitHub Issues
3. Provide concrete examples and rationale
4. Maintain consistency with existing design principles
5. Update documentation with your changes

## Contact

Questions? Open a GitHub Issue with the `documentation` or `specification` label.
