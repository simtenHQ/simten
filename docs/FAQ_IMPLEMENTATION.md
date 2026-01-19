# Implementation FAQ: Quick Answers

**This document provides direct, actionable answers to common implementation questions.**

---

## Q0: What is the most important architectural principle?

**CRITICAL INVARIANT:**

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

**What this means in practice:**

When you write:
```dsl
circuit HalfAdder {
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

You are NOT defining "HalfAdder behavior." You are defining "HalfAdder structure."

The behavior (sum = a XOR b, carry = a AND b) comes from the Xor and And PRIMITIVES, not from HalfAdder.

**Component types:**
- **Primitive components** (And, Or, Not, Xor, Register, etc.) DO have inherent behavior - they have hardcoded execute() functions
- **Composite components** (HalfAdder, FullAdder, ALU, etc.) have NO inherent behavior - they are purely structural containers

**During simulation:**
1. HalfAdder is expanded into its components (xor1, and1)
2. Those components are further expanded if composite
3. Eventually you reach only primitives
4. ONLY primitives have execute() functions with hardcoded logic
5. The circuit evaluates by calling primitive.execute() in topological order

**Why this matters:**
- Prevents confusion about where "logic" lives (answer: only in primitives)
- Enables complete introspection (can always expand composites to see primitives)
- Allows optimization (inline, flatten, constant-fold, dead-code eliminate)
- Ensures determinism (no hidden state in composites)
- Makes debugging tractable (can single-step through primitive operations)

**Remember:** Composites are data structures (graphs), not functions. They describe topology, not computation. Primitives are functions that compute outputs from inputs.

---

## Q1: Can users create composite components that execute internal logic?

**YES.**

Composite components are a core feature of the v0.1 specification.

**What users can do:**
- Define new components built from existing components (primitives or other composites)
- Internal logic executes exactly like primitives during simulation
- Parameterize components (bit widths, array sizes)
- Nest composites inside other composites
- Test and debug composites independently
- Save composites to library for reuse

**Example:**
```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor    // Uses primitive Xor
    node and1: And    // Uses primitive And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

**Usage:**
```dsl
// HalfAdder is now a reusable component
node my_adder: HalfAdder

connect input_a -> my_adder.a
connect input_b -> my_adder.b
connect my_adder.sum -> output_sum
```

**During simulation:**
- Simulator resolves `HalfAdder` from component library
- Evaluates internal nodes (xor1, and1) in dependency order
- Returns results through output ports (sum, carry)
- Behaves identically to a primitive component from user's perspective

---

## Q2: How does creating composites work in the UI?

**Three approaches - Recommend Path A for v0.1:**

### Path A: DSL-First (RECOMMENDED)

**User workflow:**
1. Click "DSL Editor" tab
2. Type circuit definition in text editor
3. Click "Compile"
4. System parses, validates, generates IR
5. Component appears in component palette
6. User drags component onto canvas like any other component

**Why recommended:**
- Simpler to implement (text parsing is easier than visual interpretation)
- No UI complexity during initial development
- LLMs can generate DSL directly
- Text is version-control friendly
- Can validate logic before dealing with visual layout

**UI mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ [Visual Editor] [DSL Editor] [Component Library]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DSL Editor                                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ circuit HalfAdder {                              │  │
│  │   input a: Bit                                   │  │
│  │   input b: Bit                                   │  │
│  │   output sum: Bit                                │  │
│  │   output carry: Bit                              │  │
│  │                                                  │  │
│  │   impl {                                         │  │
│  │     node xor1: Xor                               │  │
│  │     node and1: And                               │  │
│  │     ...                                          │  │
│  │   }                                              │  │
│  │ }                                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [Compile] [Save to Library]                            │
│                                                         │
│  ✅ Compilation successful!                             │
│  Component "HalfAdder" added to library.                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Path B: Visual-First (FUTURE - NOT RECOMMENDED FOR v0.1)

**User workflow:**
1. Create circuit visually (drag, drop, wire)
2. Select components to group
3. Click "Create Component"
4. UI generates DSL from selection
5. DSL compiles to IR
6. Component appears in palette

**Why later:**
- Requires reverse compilation (IR → DSL)
- Complex UI for defining ports/parameters
- Harder to test (requires full visual editor working)
- Ambiguous interpretation (what counts as "input" vs "internal"?)

### Path C: Hybrid (LONG-TERM)

**User workflow:**
- Edit in either DSL or visual mode
- Changes sync through IR
- Round-trip preservation
- Best of both worlds

**Why long-term:**
- Requires both directions working perfectly
- Complex synchronization logic
- Need conflict resolution strategies

---

## Q3: Should you implement DSL/IR first, then UI? Or together?

**DSL/IR first, then UI integration. Absolutely.**

### Recommended Order

```
Phase 1: IR Extensions (2-3 days)
  └─→ NO UI changes, pure backend work
      Extend IR types to support Circuit definitions
      Add component library store
      Update simulator for composite evaluation

Phase 2: DSL Parser (3-5 days)
  └─→ Standalone, testable in Node.js
      Parse DSL text to AST
      Extensive unit tests

Phase 3: Linker/Compiler (2-3 days)
  └─→ Standalone, testable in Node.js
      Resolve component names
      Type check connections
      Generate IR from AST

Phase 4: Minimal UI Integration (1-2 days)
  └─→ NOW integrate with UI
      Add text editor component
      Wire up compile button
      Display results

Phase 5: Library UI (2-3 days)
  └─→ Polish user experience
      Component browser
      Save/load components
      Testing UI
```

### Why This Order?

**Benefits of backend-first:**
1. **Testability** - Test parser/compiler without browser
2. **Speed** - Backend development is faster (no React, no styling)
3. **Validation** - Prove DSL design works before UI investment
4. **Parallel work** - Backend dev can happen while UI is still being designed
5. **LLM friendly** - LLMs excel at backend logic, struggle with UI state management

**Example test (no UI needed):**
```typescript
test('compiles HalfAdder', () => {
  const dsl = `
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

  const circuit = compileCircuit(dsl);
  expect(circuit.name).toBe('HalfAdder');
  expect(circuit.nodes.length).toBe(2);

  const result = simulate(circuit, { a: true, b: true });
  expect(result.sum).toBe(false);
  expect(result.carry).toBe(true);
});
```

**This test runs in milliseconds, requires no UI, and validates everything.**

### What to Avoid

**DON'T do this:**
```
❌ Build UI for component creation
❌ Add buttons and forms
❌ Try to generate DSL from visual layout
❌ Fight with React state management
❌ Get stuck on visual design decisions
```

**DO this:**
```
✅ Write DSL parser in pure TypeScript
✅ Test with Jest/Vitest
✅ Validate with docs/dsl-examples.md
✅ Run 100+ unit tests in seconds
✅ Prove the design works
✅ THEN add UI wrapper
```

---

## Q4: What's the minimum viable path to working composites?

**2-3 weeks of focused work. Here's the concrete plan:**

### Week 1: Backend (No UI)

**Days 1-3: IR Extensions**
- File: `/src/features/visual-editor/types/ir.ts`
  - Add Circuit type (copy from ir-v0.1.ts)
  - Add Node type for component instances
  - Add Implementation type (primitive/composite/intrinsic)

- File: `/src/features/visual-editor/stores/library-store.ts` (NEW)
  - Create component library store
  - Methods: addCircuit(), getCircuit(), resolveComponent()

- File: `/src/features/visual-editor/utils/simulator.ts`
  - Extend evaluateComponent() to handle composites
  - Add expandComposite() function (inlining)

**Test:** Programmatically create HalfAdder IR and simulate it

**Days 4-7: DSL Parser**
- File: `/src/features/dsl/parser/parser.ts` (NEW)
  - Implement recursive descent parser
  - Parse circuit definitions
  - Generate AST

- File: `/src/features/dsl/types/ast.ts` (NEW)
  - Define AST node types

- File: `/src/features/dsl/parser/parser.test.ts` (NEW)
  - Test with all examples from docs/dsl-examples.md
  - Aim for 50+ test cases

**Test:** All examples from docs parse successfully

### Week 2: Compiler + Minimal UI

**Days 8-10: Linker/Compiler**
- File: `/src/features/dsl/linker/compiler.ts` (NEW)
  - Build symbol table
  - Resolve component references
  - Type check connections
  - Generate IR

- File: `/src/features/dsl/linker/compiler.test.ts` (NEW)
  - End-to-end compilation tests
  - Error handling tests

**Test:** compileCircuit(dsl) returns valid IR

**Days 11-12: UI Integration**
- File: `/src/features/visual-editor/components/DSLEditor.tsx` (NEW)
  - Text editor (use Monaco or CodeMirror)
  - Compile button
  - Error display

- Wire to existing visual editor
- Load compiled IR into canvas

**Test:** User can type DSL, see it rendered

### Week 3: Library UI + Polish

**Days 13-15: Component Library**
- File: `/src/features/visual-editor/components/ComponentLibraryPanel.tsx` (NEW)
  - Browse available components
  - Show user-defined components

- Update component palette
- Add save/load functionality

**Days 16-17: Testing + Documentation**
- User acceptance testing
- Bug fixes
- Documentation

**Deliverable:** Working system where users can define, save, and use composite components

---

## Q5: What files need to be created/modified?

### Files to Modify (Existing)

```
/src/features/visual-editor/types/ir.ts
  - Add Circuit, Node, Implementation types from ir-v0.1.ts

/src/features/visual-editor/stores/ir-store.ts
  - Keep for circuit instances (current working circuit)
  - No major changes needed

/src/features/visual-editor/utils/simulator.ts
  - Add composite evaluation logic
  - Function: evaluateComposite()
  - Function: inlineComposite() (flatten for performance)
```

### Files to Create (New)

```
/src/features/dsl/
  ├── parser/
  │   ├── parser.ts              # Main parser logic
  │   ├── parser.test.ts         # Parser tests
  │   └── tokenizer.ts           # Lexer (optional, can inline)
  │
  ├── linker/
  │   ├── compiler.ts            # Main entry point
  │   ├── symbol-table.ts        # Name resolution
  │   ├── type-checker.ts        # Connection validation
  │   ├── ir-generator.ts        # AST → IR
  │   └── compiler.test.ts       # End-to-end tests
  │
  └── types/
      └── ast.ts                 # AST type definitions

/src/features/visual-editor/
  ├── stores/
  │   └── library-store.ts       # Component definitions
  │
  └── components/
      ├── DSLEditor.tsx          # Text editor
      ├── CompilerPanel.tsx      # Compile UI
      └── ComponentLibraryPanel.tsx  # Library browser

/src/lib/component-library/
  ├── primitives.ts              # Primitive definitions
  └── standard.ts                # Standard library (DSL files)
```

### Dependencies to Add

```json
{
  "dependencies": {
    "monaco-editor": "^0.44.0",           // Or CodeMirror
    "@monaco-editor/react": "^4.6.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"                    // If not already added
  }
}
```

---

## Q6: How do composites execute during simulation?

**IMPORTANT:** Composites don't "execute" - they have no inherent behavior. They expand into primitives, and only primitives execute.

### Two Strategies for Handling Composites

Both strategies ultimately evaluate only primitives (the only components with executable behavior). The difference is WHEN expansion happens.

#### Strategy 1: Inlining (Flattening) - RECOMMENDED FOR v0.1

**Expand at compile time, before simulation starts.**

**Before inlining:**
```
Circuit:
  node ha1: HalfAdder
  connect a -> ha1.a
  connect b -> ha1.b
```

**After inlining:**
```
Circuit:
  node ha1_xor1: Xor    // Flattened from HalfAdder
  node ha1_and1: And    // Flattened from HalfAdder
  connect a -> ha1_xor1.a
  connect b -> ha1_xor1.b
  connect a -> ha1_and1.a
  connect b -> ha1_and1.b
```

**Pros:**
- Faster simulation (no function call overhead)
- Simple to implement
- Easy to optimize

**Cons:**
- Loses hierarchical structure
- Harder to debug
- Duplicates nodes if component used multiple times

**Implementation:**
```typescript
function inlineComposite(node: Node, circuit: Circuit): Node[] {
  const definition = library.getCircuit(node.componentRef);
  const inlinedNodes: Node[] = [];

  // Copy all nodes from definition
  // Note: The composite itself has no behavior to copy
  // We're copying its structural description (nodes and connections)
  for (const defNode of definition.nodes) {
    inlinedNodes.push({
      ...defNode,
      id: `${node.id}_${defNode.id}`,  // Prefix to avoid collisions
    });
  }

  // Rewire connections
  // ... (map internal connections to parent circuit)

  return inlinedNodes;
}
```

#### Strategy 2: Hierarchical Evaluation - FUTURE

**Expand on-demand during simulation.**

```typescript
function evaluateComposite(node: Node, inputs: InputValues): OutputValues {
  const definition = library.getCircuit(node.componentRef);

  // CRITICAL: This expands the composite recursively until only primitives remain
  // Composites have NO executable behavior - they are purely structural
  const expandedCircuit = expandToAllPrimitives(definition);

  // Now evaluate the primitive-only circuit
  // ONLY primitives have execute() functions with hardcoded behavior
  return evaluatePrimitiveCircuit(expandedCircuit, inputs);

  // NOTE: Still no "composite logic" - we're just deferring expansion
  // Behavior comes from primitives (which DO have inherent behavior),
  // not from the composite (which has NO inherent behavior)
}
```

**Pros:**
- Preserves structure
- Better debugging
- Shared implementation (uses same definition for multiple instances)

**Cons:**
- Function call overhead
- More complex state management
- Harder to optimize

---

## Q7: Where does UI metadata (positions, colors) live?

**SEPARATE from IR. Always.**

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ IR Store (Logic)                                        │
│ - Component definitions (Circuit objects)               │
│ - Current circuit (Nodes, Connections)                  │
│ - NO visual information                                 │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│ UI Metadata Store (Visual)                              │
│ - Node positions {nodeId: "xyz", x: 100, y: 200}        │
│ - Colors, labels, collapsed state                       │
│ - Edge waypoints                                        │
│ - NO logic information                                  │
└─────────────────────────────────────────────────────────┘
```

### Example

**IR (logic):**
```typescript
{
  id: "node_ha1",
  componentRef: "HalfAdder",
  inputs: [{name: "a", portType: {kind: "bit"}}],
  outputs: [{name: "sum", portType: {kind: "bit"}}]
}
```

**UI Metadata (visual):**
```typescript
{
  nodeId: "node_ha1",
  position: {x: 250, y: 100},
  color: "#3b82f6",
  collapsed: false,
  label: "My Adder"
}
```

### Why Separate?

1. **Clean DSL** - DSL only describes logic, not layout
2. **Multiple views** - Same IR can have different visual layouts
3. **Version control** - Logic changes tracked independently of layout
4. **LLM generation** - LLMs generate logic, not pixel coordinates
5. **Testing** - Test logic without UI concerns

---

## Q8: Can composites have parameters?

**YES. Parameters are compile-time constants.**

### Example

```dsl
circuit Adder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  output sum: Bus[width]

  impl {
    // Implementation uses 'width' parameter
    // Compiler generates specialized version for each width
  }
}

// Usage:
node adder8: Adder(width = 8)
node adder16: Adder(width = 16)
```

### How It Works

**Compile time:**
```
User writes: node adder8: Adder(width = 8)

Compiler:
  1. Looks up Adder definition
  2. Substitutes width = 8
  3. Generates specialized Circuit "Adder_width_8"
  4. Creates Node referencing "Adder_width_8"
```

**Result:**
```typescript
// Library contains:
circuits: {
  "Adder_width_8": { /* specialized for 8 bits */ },
  "Adder_width_16": { /* specialized for 16 bits */ }
}

// Circuit contains:
nodes: [
  {id: "adder8", componentRef: "Adder_width_8"},
  {id: "adder16", componentRef: "Adder_width_16"}
]
```

**Key point:** Parameters are NOT runtime values. They're template instantiation.

---

## Q9: How do I handle compilation errors?

**Return structured error objects with actionable information.**

### Error Structure

```typescript
interface CompilationError {
  phase: 'parse' | 'link' | 'typecheck';
  location: {
    line: number;
    column: number;
    length?: number;
  };
  message: string;
  suggestions?: string[];
  code: string;  // Error code like "E001"
}
```

### Examples

**Parse error:**
```typescript
{
  phase: 'parse',
  location: {line: 5, column: 10},
  message: "Expected '}' but found 'connect'",
  suggestions: [
    "Add closing brace before this line",
    "Check for missing semicolon on previous line"
  ],
  code: "E001"
}
```

**Link error:**
```typescript
{
  phase: 'link',
  location: {line: 8, column: 15},
  message: "Cannot resolve component 'HalfAder'",
  suggestions: [
    "Did you mean 'HalfAdder'?",
    "Check component is defined or imported"
  ],
  code: "E201"
}
```

**Type error:**
```typescript
{
  phase: 'typecheck',
  location: {line: 12, column: 20},
  message: "Type mismatch: cannot connect Bus[8] to Bit",
  suggestions: [
    "Use Bus[1] instead of Bit",
    "Extract single bit with a[0]"
  ],
  code: "E301"
}
```

### UI Display

```
┌─────────────────────────────────────────────────────────┐
│ Compilation Errors (3)                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ❌ Line 5, Column 10 - Parse Error (E001)               │
│    Expected '}' but found 'connect'                     │
│                                                         │
│    Suggestions:                                         │
│    • Add closing brace before this line                 │
│    • Check for missing semicolon on previous line       │
│                                                         │
│    [Show in Editor] [Learn More]                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ❌ Line 8, Column 15 - Link Error (E201)                │
│    Cannot resolve component 'HalfAder'                  │
│                                                         │
│    8 |    node ha1: HalfAder                            │
│                     ^^^^^^^^^ unknown component         │
│                                                         │
│    Suggestions:                                         │
│    • Did you mean 'HalfAdder'?                          │
│                                                         │
│    [Apply Suggestion] [Show in Editor]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Q10: What about state and sequential logic in composites?

**YES. Composites can contain state (registers, memory).**

### Example: Counter Component

```dsl
circuit Counter(width: Int) {
  input clk: Clock
  input reset: Bit
  output count: Bus[width]

  state value: Bus[width] = 0

  on clk rising {
    if (reset) {
      value = 0
    } else {
      value = value + 1
    }
  }

  impl {
    connect value -> count
  }
}
```

### How It Works

**IR includes state blocks:**
```typescript
{
  name: "Counter",
  state: [
    {
      id: "state_value",
      name: "value",
      stateType: {kind: "bus", width: 8},
      initialValue: 0,
      clockRef: "clk",
      edge: "rising",
      updateLogic: "..."  // AST of update expression
    }
  ]
}
```

**Simulation:**
1. Combinational phase: Evaluate all logic
2. Clock edge detection: Check if clk rising edge
3. State update: If edge detected, execute `value = value + 1`
4. Next cycle: Use new value

**Each instance has separate state:**
```
node counter1: Counter(width = 8)
node counter2: Counter(width = 8)

// counter1 and counter2 have independent state
// Incrementing counter1 doesn't affect counter2
```

---

## Summary: Start Here

1. **Read:** `/docs/IMPLEMENTATION_ROADMAP.md` - Detailed plan
2. **Read:** `/docs/WORKFLOW_EXAMPLES.md` - Visual examples
3. **Start:** Phase 1 - Extend IR types (no UI needed)
4. **Then:** Phase 2 - Build DSL parser (no UI needed)
5. **Then:** Phase 3 - Build compiler (no UI needed)
6. **Finally:** Phase 4 - Add UI integration

**The backend work (Phases 1-3) can be completed in 1-2 weeks with no UI complexity.**

**Test everything with unit tests before touching React.**

**Once backend works, UI integration is straightforward (1-2 days).**

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `/docs/IMPLEMENTATION_ROADMAP.md` | Step-by-step implementation plan |
| `/docs/WORKFLOW_EXAMPLES.md` | User workflows and UI mockups |
| `/docs/dsl-v0.1-spec.md` | Complete DSL syntax reference |
| `/docs/ir-v0.1-spec.md` | IR type definitions |
| `/docs/dsl-examples.md` | Example circuits to test with |
| `/src/features/visual-editor/types/ir-v0.1.ts` | TypeScript IR types |

---

## Questions Not Answered Here?

Open a GitHub issue with:
- Specific question
- Code example if applicable
- What you've tried
- Expected vs actual behavior

We'll update this FAQ with the answer.
