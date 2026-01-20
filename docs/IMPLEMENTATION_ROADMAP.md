# Implementation Roadmap: From Current State to Full DSL/IR System

**Last Updated**: January 20, 2026
**Status**: Phases 1-3 COMPLETE ✅ | Ready for Phase 4 (Canvas as DSL)

## Implementation Status

### ✅ Phase 1: COMPLETE (January 19, 2026)
- IR v0.1 core infrastructure
- Component library with three-tier resolution
- Recursive composite simulator
- 73 tests passing
- See: [Phase 1 Completion Summary](./PHASE_1_COMPLETION_SUMMARY.md)

### ✅ Phase 2: COMPLETE (January 19, 2026)
- Complete DSL parser pipeline (lexer, parser, validator)
- AST → IR v0.1 compiler
- 59 tests passing
- HalfAdder, FullAdder, 4-bit Adder working
- See: [Phase 2 Completion Summary](./PHASE_2_COMPLETION_SUMMARY.md)

### ✅ Phase 3: COMPLETE (January 19-20, 2026)
- DSL editor with Monaco-based syntax highlighting
- Real-time DSL compilation to IR v0.1
- Component library UI (primitives/standard/user tabs)
- Sequential circuit support (clocks, D flip-flops, registers, RAM)
- Clock controls UI (Step/Run/Pause/Reset)
- IR flattening for composite sequential circuits
- See: [Phase 3 Architecture](./phase3-architecture.md)

### 🚧 Phase 4: READY TO START (Canvas as DSL)
**Goal**: Make visual canvas generate DSL, establishing DSL as single source of truth
- Visual → DSL serialization
- Bidirectional sync (DSL ↔ Canvas)
- Deprecate legacy IR entirely
- Visual composite component creation
- See: [Current Architecture](./CURRENT_ARCHITECTURE.md) for detailed plan

---

## Executive Summary

This document provides a clear implementation path from the initial working visual editor to a complete DSL-driven system with composite components.

**THIS ROADMAP IS NOW HISTORICAL.** Phases 1-3 are complete. Refer to [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md) for current state and Phase 4 plans.

## Original Current State Assessment (Pre-Phase 1)

### What You Have Working ✅

1. **Visual Editor** - ReactFlow-based drag-drop interface
2. **IR Store** - Basic component and connection management (Zustand + Immer)
3. **Simulator** - Combinational circuit evaluation
4. **Component Types** - Primitives: SWITCH, LED, logic gates (AND, OR, NOT, etc.)
5. **Type Definitions** - v0.1 IR spec in TypeScript (`ir-v0.1.ts`)

### What's Missing ⬜

1. **DSL Parser** - No way to parse DSL text yet
2. **Composite Components** - No way to define/instantiate user components
3. **Component Library** - No library system for reusable components
4. **DSL-to-IR Compiler** - No linking/resolution pipeline
5. **Component Definition UI** - No way to create composites in the visual editor

## Answer to Your Questions

### 1. Can users create composite components that execute internal logic?

**YES, absolutely.** This is a core design goal. The v0.1 specification fully supports:

- **Composite components** built from other components (primitives or composites)
- **Internal logic** that executes exactly like primitives
- **Hierarchical composition** - composites can contain other composites
- **Parameterization** - width, array sizes, etc.

**Example: HalfAdder (from docs)**
```dsl
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
```

This HalfAdder becomes a reusable component that can be instantiated like:
```dsl
node my_adder: HalfAdder
```

### 2. How does this work in the UI?

**There are THREE pathways to create composite components:**

#### Path A: DSL-First (Recommended for v0.1)
1. User writes DSL text in a text editor panel
2. DSL parser compiles to IR
3. IR loads into the visual editor
4. User can edit visually OR in text
5. Changes in either sync to IR

**Why recommended?** DSL parsing is simpler than reverse-engineering from visual layouts. Get DSL→IR working first, then add visual→DSL later.

#### Path B: Visual-First (Future)
1. User creates circuit visually
2. User selects components and clicks "Create Component"
3. UI generates DSL from selection
4. DSL compiles to IR
5. New component appears in component palette

**Why later?** Requires robust visual→DSL serialization and UI for defining ports/parameters.

#### Path C: Hybrid (Long-term)
1. Import/export between text and visual
2. Edit in either mode
3. Round-trip preservation of structure
4. Version control friendly (DSL text)

### 3. Should you implement DSL/IR first, then UI? Or together?

**Recommended Order: DSL/IR First, UI Second**

**Rationale:**
- DSL→IR pipeline has NO dependencies on UI
- UI depends on IR being correct and complete
- Text-based DSL is easier to test (no browser, no ReactFlow)
- You can validate logic before dealing with visual complexity
- LLMs can generate DSL without knowing about your UI

## Minimum Viable Path (MVP)

### Phase 1: Extend IR to Support Composites (2-3 days)

**Goal:** Modify IR store to handle composite component definitions

**Tasks:**
1. Add component library store
2. Extend IR types to match v0.1 spec (`Circuit`, `Node`, `Implementation`)
3. Update simulator to evaluate composite components
4. Write tests for composite evaluation

**Files to modify:**
- `/src/features/visual-editor/types/ir.ts` - Use v0.1 types from `ir-v0.1.ts`
- `/src/features/visual-editor/stores/ir-store.ts` - Add circuit definitions
- `/src/features/visual-editor/utils/simulator.ts` - Add composite evaluation

**Deliverable:** You can programmatically create a HalfAdder IR object and simulate it

### Phase 2: Build DSL Parser (3-5 days)

**Goal:** Parse DSL text into IR

**Tasks:**
1. Choose parser (recommend: [nearley](https://nearley.js.org/) or hand-written recursive descent)
2. Write grammar for v0.1 DSL syntax
3. Build AST types
4. Implement parser
5. Write extensive tests (see `dsl-examples.md`)

**Files to create:**
- `/src/features/dsl/parser/grammar.ne` (if using nearley)
- `/src/features/dsl/parser/parser.ts`
- `/src/features/dsl/types/ast.ts`
- `/src/features/dsl/parser/parser.test.ts`

**Deliverable:** `parseCircuit(dslText)` returns AST

### Phase 3: Build Linker/Resolver (2-3 days)

**Goal:** Resolve component names and generate IR

**Tasks:**
1. Build symbol table (map names to definitions)
2. Implement name resolution (resolve component references)
3. Add type checking (port type compatibility)
4. Detect combinational loops
5. Generate IR from validated AST

**Files to create:**
- `/src/features/dsl/linker/symbol-table.ts`
- `/src/features/dsl/linker/resolver.ts`
- `/src/features/dsl/linker/type-checker.ts`
- `/src/features/dsl/linker/ir-generator.ts`

**Deliverable:** `compileCircuit(dslText)` returns IR

### Phase 4: Minimal UI Integration (1-2 days)

**Goal:** Let users write DSL and see it rendered

**Tasks:**
1. Add text editor panel to UI (e.g., Monaco Editor or CodeMirror)
2. Wire up compile button
3. Load compiled IR into visual editor
4. Display compilation errors

**Files to create:**
- `/src/features/visual-editor/components/DSLEditor.tsx`
- `/src/features/visual-editor/components/CompilerPanel.tsx`

**Deliverable:** User can type DSL, click "Compile", see circuit rendered

### Phase 5: Component Library UI (2-3 days)

**Goal:** Save and reuse composite components

**Tasks:**
1. Create library store (separate from circuit store)
2. Add "Save as Component" button
3. Generate DSL from current circuit (reverse compilation)
4. Add component to library
5. Update component palette to show user components

**Files to create:**
- `/src/features/visual-editor/stores/library-store.ts`
- `/src/features/visual-editor/components/SaveComponentDialog.tsx`
- `/src/features/visual-editor/components/ComponentLibraryPanel.tsx`

**Deliverable:** User can save circuits as components and reuse them

## Recommended Implementation Sequence

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: IR Extensions (No UI changes)                     │
│ - Extend IR types to support Circuit definitions           │
│ - Add component library store                              │
│ - Update simulator for composite evaluation                │
│ Result: Can programmatically create composites             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: DSL Parser (Standalone, no UI)                    │
│ - Write parser for DSL syntax                              │
│ - Generate AST from text                                   │
│ - Extensive testing with examples from docs                │
│ Result: parseCircuit(text) → AST                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Linker/Resolver (Standalone, no UI)               │
│ - Symbol table building                                    │
│ - Name resolution                                          │
│ - Type checking                                            │
│ - IR generation                                            │
│ Result: compileCircuit(text) → IR                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Minimal UI Integration                            │
│ - Add text editor to UI                                    │
│ - Wire up compiler                                         │
│ - Display results in visual editor                         │
│ Result: Users can write DSL and see circuits               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Component Library UI                              │
│ - Save circuits as components                              │
│ - Component palette shows user components                  │
│ - Reuse components in new circuits                         │
│ Result: Full composite component workflow                  │
└─────────────────────────────────────────────────────────────┘
```

## Why This Order?

### Bottom-Up Approach Benefits

1. **Testability** - Each phase can be thoroughly tested in isolation
2. **No UI blocking** - Backend work happens without fighting React
3. **Clear dependencies** - Each phase depends only on previous phases
4. **Early validation** - Prove the DSL/IR design works before UI investment
5. **LLM friendly** - LLMs can generate DSL without knowing your UI

### DSL-First Benefits

1. **Authoritative source** - DSL is the canonical representation
2. **Version control** - Text files are easy to diff/merge
3. **LLM generation** - Claude can write DSL, harder to generate UI interactions
4. **Validation** - Text syntax is easier to validate than visual layouts
5. **Documentation** - DSL examples are self-documenting

## Alternative: Visual-First (Not Recommended for v0.1)

**If you wanted to start with visual editing:**

1. Add "Collapse Selection" button to UI
2. User selects components
3. UI creates a new Circuit IR object with those components
4. Generate DSL from IR (reverse compilation)
5. Add circuit to library

**Problems with this approach:**
- Reverse compilation is complex (IR → DSL ambiguities)
- Hard to define ports/parameters visually
- No way to test without full UI working
- LLMs can't help generate visual layouts
- Version control is harder (JSON IR vs text DSL)

## Workflow After MVP

### Creating a Composite Component (DSL-First)

1. User opens "DSL Editor" tab
2. Types circuit definition:
   ```dsl
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
   ```
3. Clicks "Compile"
4. System:
   - Parses DSL → AST
   - Resolves names (Xor, And from primitive library)
   - Type checks connections
   - Generates IR
   - Adds HalfAdder to component library
5. HalfAdder now appears in component palette
6. User drags HalfAdder into canvas like any other component
7. User can switch to "Visual" tab to see HalfAdder rendered

### Using a Composite Component

1. User drags "HalfAdder" from palette to canvas
2. System creates a Node in IR:
   ```typescript
   {
     id: "ha1",
     componentRef: "HalfAdder",
     arguments: {},
     inputs: [{id: "ha1.a", name: "a", portType: {kind: "bit"}}],
     outputs: [{id: "ha1.sum", name: "sum", portType: {kind: "bit"}}]
   }
   ```
3. User wires HalfAdder ports like any other component
4. During simulation:
   - If inlined: Simulator evaluates internal nodes directly
   - If hierarchical: Simulator calls HalfAdder as a sub-circuit

## Key Design Decisions for Implementation

### 1. Two-Store Architecture

**Component Library Store** (Definitions)
- Stores Circuit definitions
- Primitives: And, Or, Xor, Register, etc.
- Standard library: HalfAdder, FullAdder, ALU
- User components: MyCustomComponent

**Circuit Store** (Instances)
- Current working circuit
- Nodes (instances of components)
- Connections between nodes
- State (register values, memory contents)

**Why separate?**
- Clear distinction between "what exists" (library) vs "what's in use" (circuit)
- Can have multiple circuits using same components
- Easy to share/export component libraries

### 2. IR as Single Source of Truth

```
DSL Text ──(parse)──→ IR ←──(read)── Visual Editor
                      │
                      └──(evaluate)── Simulator
```

- IR is the ONLY executable format
- DSL is a textual representation of IR
- Visual editor is a graphical representation of IR
- All three views show the same underlying IR

**Implications:**
- UI never directly modifies DSL
- DSL never directly modifies UI
- All changes go through IR
- IR changes trigger UI updates (via stores)

### 3. Component Resolution

When user types `node x1: Xor`, system resolves in this order:

1. **Primitive library** - Is "Xor" a primitive? (Yes → use kernel implementation)
2. **Standard library** - Is "Xor" in standard library? (Check composites)
3. **User library** - Is "Xor" user-defined? (Check user circuits)
4. **Current file** - Is "Xor" defined in this DSL file?
5. **Error** - "Cannot resolve component 'Xor'"

**Implementation:**
```typescript
interface ComponentLibrary {
  primitives: Map<string, PrimitiveDefinition>;
  standard: Map<string, Circuit>;
  user: Map<string, Circuit>;
}

function resolveComponent(name: string, library: ComponentLibrary): Circuit | PrimitiveDefinition {
  return (
    library.primitives.get(name) ||
    library.standard.get(name) ||
    library.user.get(name) ||
    throwError(`Cannot resolve component '${name}'`)
  );
}
```

### 4. Composite Evaluation Strategy

**Two approaches (implement both, let user choose):**

#### A. Inlining (Flattening)
- Copy all nodes from composite into parent circuit
- Rename IDs to avoid conflicts (`ha1.xor1` → `circuit_ha1_xor1`)
- Rewire connections
- Evaluate as flat circuit

**Pros:** Faster simulation (no function calls)
**Cons:** Harder to debug, loses structure

#### B. Hierarchical (Nested)
- Treat composite as a black box
- Evaluate internal circuit separately
- Return outputs

**Pros:** Preserves structure, easier to debug
**Cons:** Function call overhead

**Recommendation:** Start with inlining (simpler), add hierarchical later

## Testing Strategy

### Phase 1: Unit Tests (Backend)

Test each phase independently:

```typescript
// Parser tests
test('parses simple circuit', () => {
  const dsl = `
    circuit And {
      input a: Bit
      input b: Bit
      output out: Bit
      impl {
        node and1: And
        connect a -> and1.a
        connect b -> and1.b
        connect and1.out -> out
      }
    }
  `;
  const ast = parseCircuit(dsl);
  expect(ast.name).toBe('And');
  expect(ast.inputs.length).toBe(2);
});

// Linker tests
test('resolves primitive components', () => {
  const ast = /* ... */;
  const library = createPrimitiveLibrary();
  const ir = compileCircuit(ast, library);
  expect(ir.nodes[0].componentRef).toBe('And');
});

// Simulator tests
test('evaluates composite circuit', () => {
  const ir = /* HalfAdder IR */;
  const result = simulate(ir, { a: true, b: true });
  expect(result.sum).toBe(false);
  expect(result.carry).toBe(true);
});
```

### Phase 2: Integration Tests

Test end-to-end workflows:

```typescript
test('DSL to simulation', () => {
  const dsl = readFile('examples/half-adder.dsl');
  const ir = compileCircuit(dsl);
  const result = simulate(ir, { a: true, b: false });
  expect(result.sum).toBe(true);
});
```

### Phase 3: Example-Driven Tests

Use all examples from `/docs/dsl-examples.md`:
- HalfAdder
- FullAdder
- 4-bit Ripple Carry Adder
- Register
- Simple CPU

Each should compile and simulate correctly.

## File Structure Recommendation

```
/src
├── features/
│   ├── dsl/
│   │   ├── parser/
│   │   │   ├── grammar.ne          # Parser grammar
│   │   │   ├── parser.ts           # Parser implementation
│   │   │   └── parser.test.ts      # Parser tests
│   │   ├── linker/
│   │   │   ├── symbol-table.ts     # Symbol table builder
│   │   │   ├── resolver.ts         # Name resolution
│   │   │   ├── type-checker.ts     # Type checking
│   │   │   ├── ir-generator.ts     # AST → IR
│   │   │   └── compiler.ts         # Main entry point
│   │   └── types/
│   │       └── ast.ts              # AST type definitions
│   │
│   └── visual-editor/
│       ├── components/
│       │   ├── DSLEditor.tsx       # Text editor for DSL
│       │   ├── CompilerPanel.tsx   # Compile button + errors
│       │   ├── ComponentLibraryPanel.tsx  # Component browser
│       │   └── SaveComponentDialog.tsx    # Save circuit as component
│       ├── stores/
│       │   ├── ir-store.ts         # Current circuit (extend existing)
│       │   ├── library-store.ts    # Component definitions
│       │   └── compiler-store.ts   # Compilation state/errors
│       └── utils/
│           ├── simulator.ts        # Extend for composites
│           └── dsl-to-ir.ts        # Integration layer
│
└── lib/
    └── component-library/
        ├── primitives.ts           # Primitive definitions
        ├── standard.ts             # Standard library (DSL)
        └── index.ts                # Library initialization
```

## Success Criteria

### Phase 1 Complete When:
- [x] IR types match v0.1 spec
- [x] Can create Circuit objects programmatically
- [x] Simulator evaluates composite circuits correctly
- [x] Tests pass for sample circuits

### Phase 2 Complete When:
- [x] Parser handles all v0.1 DSL syntax
- [x] All examples from `dsl-examples.md` parse successfully
- [x] Parse errors are clear and actionable
- [x] 100+ unit tests pass

### Phase 3 Complete When:
- [x] Compiler resolves all component references
- [x] Type checker catches all invalid connections
- [x] Generated IR matches hand-written IR
- [x] Compilation errors are clear and actionable

### Phase 4 Complete When:
- [x] User can type DSL in UI
- [x] Compilation errors display in UI
- [x] Compiled circuit renders in visual editor
- [x] Can simulate DSL-defined circuits

### Phase 5 Complete When:
- [x] User can save circuits as components
- [x] Saved components appear in palette
- [x] Can instantiate and wire user components
- [x] Nested composites work (composite containing composite)

## Common Pitfalls to Avoid

### 1. Don't Hardcode Component Names in Parser
```typescript
// WRONG
if (componentType === 'And' || componentType === 'Or') { ... }

// RIGHT
const componentDef = library.resolve(componentType);
```

### 2. Don't Mix UI and IR Concerns
```typescript
// WRONG - position is UI metadata, not IR
interface Node {
  id: string;
  componentRef: string;
  x: number;  // ❌
  y: number;  // ❌
}

// RIGHT - IR is pure logic
interface Node {
  id: string;
  componentRef: string;
}

// UI metadata goes in separate store
interface UIMetadata {
  nodeId: string;
  position: { x: number; y: number };
}
```

### 3. Don't Generate IDs in DSL
```typescript
// WRONG - DSL specifies IDs
circuit Foo {
  node and1: And  // "and1" is user-specified name
}

// Compiler generates globally unique IDs
const node = {
  id: nanoid(),           // Globally unique
  label: "and1",          // User-friendly name
  componentRef: "And"
};
```

### 4. Don't Forget Topological Sort
Composite circuits must be evaluated in dependency order:
```typescript
// WRONG - evaluate in definition order
for (const node of circuit.nodes) {
  evaluate(node);
}

// RIGHT - topological sort first
const order = topologicalSort(circuit);
for (const nodeId of order) {
  evaluate(circuit.nodes[nodeId]);
}
```

## Questions & Answers

### Q: Can I skip the DSL parser and just use visual editing?

**A:** You can, but you'll lose:
- LLM generation capability
- Version control friendliness
- Easy testing
- Documentation clarity

**Better approach:** Implement both, DSL first for foundation.

### Q: How do I handle DSL syntax errors?

**A:** Return structured error objects:
```typescript
interface ParseError {
  line: number;
  column: number;
  message: string;
  expected?: string[];
  actual?: string;
}
```

Display in UI with:
- Line highlighting
- Error message
- Suggestions for fixes

### Q: Should composites be automatically inlined?

**A:** Not always. Provide options:
1. **Auto** - Inline if small, hierarchical if large
2. **Always inline** - Flatten everything (fast simulation)
3. **Never inline** - Preserve structure (easy debugging)

Start with "always inline" for simplicity.

### Q: How do I handle parameterized components?

**A:** Parameters are compile-time constants:
```dsl
circuit Adder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  output sum: Bus[width]
  // ...
}

// Instantiation
node adder: Adder(width = 8)
```

Compiler generates specialized IR for `width = 8`. Each width value creates a separate component definition.

### Q: Can composites contain state (registers)?

**A:** YES. State is supported:
```dsl
circuit Counter {
  input clk: Clock
  output count: Bus[8]

  state value: Bus[8] = 0

  on clk rising {
    value = Add(value, 1)
  }

  impl {
    connect value -> count
  }
}
```

Simulator maintains state map per component instance.

## Next Steps

### Immediate (This Week)
1. Read through Phase 1 tasks in detail
2. Study `ir-v0.1.ts` type definitions
3. Plan IR store extensions
4. Set up test environment

### Short-term (Next 2 Weeks)
1. Complete Phase 1 (IR extensions)
2. Start Phase 2 (parser)
3. Test with simple circuits

### Medium-term (Next Month)
1. Complete parser and linker
2. Basic UI integration
3. Create standard library components

### Long-term (Next Quarter)
1. Full component library UI
2. Visual editing improvements
3. Advanced features (imports, parameterization)

## Resources

### Documentation
- `/docs/DSL_SPECIFICATION_v0.1.md` - Complete DSL syntax
- `/docs/IR_SPECIFICATION_v0.1.md` - IR type definitions
- `/docs/dsl-examples.md` - Example circuits
- `/docs/component-library-model.md` - Component system
- `/docs/execution-semantics.md` - Simulation algorithms
- `/docs/linking-and-resolution.md` - Name resolution

### Tools
- [Nearley](https://nearley.js.org/) - Parser generator (recommended)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - DSL text editor
- [Zustand](https://docs.pmnd.rs/zustand/) - State management (already using)
- [Vitest](https://vitest.dev/) - Testing framework

### Similar Projects
- [Digital](https://github.com/hneemann/Digital) - Digital logic simulator (inspiration)
- [Logisim](http://www.cburch.com/logisim/) - Educational logic simulator
- [Verilog](https://en.wikipedia.org/wiki/Verilog) - Hardware description language (inspiration, not copy)

## Conclusion

**Start with Phase 1 (IR extensions) and Phase 2 (DSL parser).** These are completely independent of UI and can be built and tested in isolation. Once you have a working compiler pipeline (DSL → IR), integrate it into the UI (Phase 4). Only then add the visual component creation workflow (Phase 5).

This bottom-up approach ensures:
- Solid foundation before UI complexity
- Testable components at each step
- Clear milestone deliverables
- LLM-friendly development (LLMs are great at DSL parsing, not so much at UI state management)

**The MVP is achievable in 2-3 weeks of focused work.**

After MVP, you'll have:
- Users can write DSL text
- DSL compiles to IR
- IR renders in visual editor
- Circuits simulate correctly
- Users can define and reuse composite components

That's a complete, working system that matches the v0.1 specification.
