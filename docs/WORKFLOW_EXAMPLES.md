# Workflow Examples: Creating and Using Composite Components

This document shows concrete examples of how users will create and use composite components in the Turing Incomplete system.

## Table of Contents

1. [DSL-First Workflow](#dsl-first-workflow)
2. [Visual-First Workflow](#visual-first-workflow-future)
3. [Hybrid Workflow](#hybrid-workflow-future)
4. [Component Library Management](#component-library-management)

---

## DSL-First Workflow

**Recommended for v0.1 - Simplest to implement**

### Step 1: User Opens DSL Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Turing Incomplete                                           │
├─────────────────────────────────────────────────────────────┤
│ [Visual Editor] [DSL Editor] [Component Library]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DSL Editor                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1 circuit HalfAdder {                                │  │
│  │ 2   input a: Bit                                     │  │
│  │ 3   input b: Bit                                     │  │
│  │ 4   output sum: Bit                                  │  │
│  │ 5   output carry: Bit                                │  │
│  │ 6                                                    │  │
│  │ 7   impl {                                           │  │
│  │ 8     node xor1: Xor                                 │  │
│  │ 9     node and1: And                                 │  │
│  │10                                                    │  │
│  │11     connect a -> xor1.a                            │  │
│  │12     connect b -> xor1.b                            │  │
│  │13     connect xor1.out -> sum                        │  │
│  │14                                                    │  │
│  │15     connect a -> and1.a                            │  │
│  │16     connect b -> and1.b                            │  │
│  │17     connect and1.out -> carry                      │  │
│  │18   }                                                │  │
│  │19 }                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Compile] [Save to Library]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: User Clicks "Compile"

System processes the DSL:

```
DSL Text
   ↓
┌─────────────┐
│   Parser    │ Tokenize → Parse → Build AST
└─────┬───────┘
      ↓
   AST {
     name: "HalfAdder",
     inputs: [{name: "a", type: Bit}, {name: "b", type: Bit}],
     outputs: [{name: "sum", type: Bit}, {name: "carry", type: Bit}],
     nodes: [
       {id: "xor1", type: "Xor"},
       {id: "and1", type: "And"}
     ],
     connections: [
       {source: "a", target: "xor1.a"},
       ...
     ]
   }
   ↓
┌─────────────┐
│   Linker    │ Resolve "Xor" → Primitive Xor definition
└─────┬───────┘  Resolve "And" → Primitive And definition
      ↓           Check port types match
┌─────────────┐
│Type Checker │ Verify Bit connects to Bit
└─────┬───────┘  Verify no combinational loops
      ↓
┌─────────────┐
│IR Generator │ Generate Circuit IR object
└─────┬───────┘
      ↓
   IR {
     id: "circuit_halfadder_1",
     name: "HalfAdder",
     implementation: {kind: "composite"},
     nodes: [
       {id: "node_xor1", componentRef: "Xor", ...},
       {id: "node_and1", componentRef: "And", ...}
     ],
     connections: [...]
   }
   ↓
┌─────────────┐
│   Library   │ Store in component library
└─────────────┘
```

### Step 3: Compilation Success

```
┌─────────────────────────────────────────────────────────────┐
│ DSL Editor                                                  │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐    │
│ │ [DSL code...]                                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ✅ Compilation successful!                                  │
│                                                             │
│ Component "HalfAdder" has been added to your library.       │
│ You can now use it in circuits like:                        │
│                                                             │
│    node my_adder: HalfAdder                                 │
│                                                             │
│ [Save to Library] [View in Visual Editor]                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Component Appears in Palette

```
┌─────────────────────────────────────────────────────────────┐
│ Visual Editor                                               │
├─────────────────────────────────────────────────────────────┤
│ Component Palette                                           │
│ ┌─────────────────────┐                                     │
│ │ Primitives          │                                     │
│ │   • And             │                                     │
│ │   • Or              │                                     │
│ │   • Xor             │                                     │
│ │   • Not             │                                     │
│ │                     │                                     │
│ │ Standard Library    │                                     │
│ │   • FullAdder       │                                     │
│ │   • Register        │                                     │
│ │                     │                                     │
│ │ My Components ⭐     │                                     │
│ │   • HalfAdder       │  ← NEW!                             │
│ └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: User Drags HalfAdder into Canvas

```
┌─────────────────────────────────────────────────────────────┐
│ Visual Editor                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐                                               │
│   │ Switch  │                                               │
│   │  [sw1]  │─────┐                                         │
│   └─────────┘     │                                         │
│                   │     ┌──────────────┐                    │
│   ┌─────────┐     ├────→│  HalfAdder   │                    │
│   │ Switch  │     │     │    [ha1]     │────→ ┌─────────┐   │
│   │  [sw2]  │─────┘     │              │     │   LED   │   │
│   └─────────┘           │  a    sum    │     │ [led1]  │   │
│                         │  b    carry   │     └─────────┘   │
│                         └──────┬───────┘                    │
│                                │                            │
│                                └──────────→ ┌─────────┐     │
│                                            │   LED   │     │
│                                            │ [led2]  │     │
│                                            └─────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Behind the scenes:**
- IR creates a Node with componentRef="HalfAdder"
- Simulator resolves HalfAdder definition from library
- During simulation, evaluates internal xor1 and and1 nodes

### Step 6: User Inspects Component (Double-click)

```
┌─────────────────────────────────────────────────────────────┐
│ HalfAdder Internal Structure                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Input Ports:                                              │
│   ┌─────┐                                                   │
│   │  a  │────────┬─────────────────────┐                    │
│   └─────┘        │                     │                    │
│                  │                     │                    │
│   ┌─────┐        │                     │                    │
│   │  b  │────────┼────────┐            │                    │
│   └─────┘        │        │            │                    │
│                  ↓        ↓            ↓                    │
│                ┌───┐    ┌───┐        ┌───┐                 │
│                │XOR│    │AND│        │XOR│                 │
│                └─┬─┘    └─┬─┘        └─┬─┘                 │
│                  │        │            │                    │
│   ┌──────┐      │        │            │   ┌──────┐         │
│   │ sum  │←─────┘        └────────────┴──→│carry │         │
│   └──────┘                                └──────┘         │
│                                                             │
│   [Close] [Edit DSL]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual-First Workflow (Future)

**Not recommended for v0.1 - Requires reverse compilation**

### Step 1: User Creates Circuit Visually

```
┌─────────────────────────────────────────────────────────────┐
│ Visual Editor                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐                                               │
│   │ Input A │──────┐                                        │
│   └─────────┘      │                                        │
│                    ↓                                        │
│   ┌─────────┐    ┌───┐    ┌──────────┐                     │
│   │ Input B │───→│XOR│───→│ Output   │                     │
│   └─────────┘    └───┘    │   Sum    │                     │
│       │                    └──────────┘                     │
│       │          ┌───┐    ┌──────────┐                     │
│       └─────────→│AND│───→│ Output   │                     │
│                  └───┘    │  Carry   │                     │
│                            └──────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: User Selects Components and Clicks "Create Component"

```
┌─────────────────────────────────────────────────────────────┐
│ Create Component Dialog                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Component Name: [HalfAdder________________]                 │
│                                                             │
│ Detected Inputs:                                            │
│   • Input A → Rename to: [a___]  Type: [Bit ▼]             │
│   • Input B → Rename to: [b___]  Type: [Bit ▼]             │
│                                                             │
│ Detected Outputs:                                           │
│   • Output Sum → Rename to: [sum___]  Type: [Bit ▼]        │
│   • Output Carry → Rename to: [carry_]  Type: [Bit ▼]      │
│                                                             │
│ Description (optional):                                     │
│ [Adds two bits, producing sum and carry_____________]       │
│                                                             │
│ [Cancel]  [Create Component]                                │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: System Generates DSL

**Reverse compilation:**
```typescript
function generateDSL(selection: Component[]): string {
  // Analyze selected components
  const inputs = detectInputs(selection);
  const outputs = detectOutputs(selection);
  const internal = detectInternalNodes(selection);
  const connections = detectConnections(selection);

  // Generate DSL text
  return `
circuit ${componentName} {
  ${inputs.map(i => `input ${i.name}: ${i.type}`).join('\n  ')}
  ${outputs.map(o => `output ${o.name}: ${o.type}`).join('\n  ')}

  impl {
    ${internal.map(n => `node ${n.name}: ${n.type}`).join('\n    ')}

    ${connections.map(c => `connect ${c.source} -> ${c.target}`).join('\n    ')}
  }
}
  `.trim();
}
```

### Step 4: DSL Compiles to IR

Same as DSL-first workflow from here on.

**Why this is harder:**
- Must infer port names from visual labels
- Must detect which components are inputs vs internal
- Must generate valid DSL syntax
- Potential for ambiguity (what if user didn't label things?)

---

## Hybrid Workflow (Future)

**Best of both worlds - Requires both directions working**

### Scenario: Edit in DSL, View Visually

1. User writes DSL
2. DSL compiles to IR
3. IR projects to visual layout (auto-layout)
4. User adjusts positions visually
5. Positions saved as UI metadata (not in IR)
6. User switches back to DSL
7. DSL unchanged (positions ignored)

### Scenario: Edit Visually, Export DSL

1. User creates circuit visually
2. Clicks "Export as DSL"
3. System generates DSL from IR
4. User copies DSL text
5. Can version control, share, or edit in text editor

---

## Component Library Management

### Viewing Library

```
┌─────────────────────────────────────────────────────────────┐
│ Component Library                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Search: [half_____________] [🔍]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Primitives (10)                                             │
│ ├─ And                    [View] [Docs]                     │
│ ├─ Or                     [View] [Docs]                     │
│ └─ Xor                    [View] [Docs]                     │
│                                                             │
│ Standard Library (15)                                       │
│ ├─ HalfAdder              [View] [Edit] [Docs]              │
│ ├─ FullAdder              [View] [Edit] [Docs]              │
│ └─ RippleCarryAdder       [View] [Edit] [Docs]              │
│                                                             │
│ My Components (3)                                           │
│ ├─ HalfAdder ⭐            [View] [Edit] [Delete]            │
│ ├─ CustomALU              [View] [Edit] [Delete]            │
│ └─ StateMachine           [View] [Edit] [Delete]            │
│                                                             │
│ [Import from File] [Export Library]                         │
└─────────────────────────────────────────────────────────────┘
```

### Editing a Component

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Component: HalfAdder                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Visual View] [DSL View] [Tests]                            │
│                                                             │
│ DSL View:                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ circuit HalfAdder {                                     │ │
│ │   input a: Bit                                          │ │
│ │   input b: Bit                                          │ │
│ │   output sum: Bit                                       │ │
│ │   output carry: Bit                                     │ │
│ │                                                         │ │
│ │   impl {                                                │ │
│ │     node xor1: Xor                                      │ │
│ │     node and1: And                                      │ │
│ │     ...                                                 │ │
│ │   }                                                     │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Revert] [Save Changes]                                     │
└─────────────────────────────────────────────────────────────┘
```

### Running Tests

```
┌─────────────────────────────────────────────────────────────┐
│ Test: HalfAdder                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Test Cases:                                                 │
│                                                             │
│ ✅ Test "0 + 0"                                              │
│    Inputs:  { a: 0, b: 0 }                                  │
│    Expected: { sum: 0, carry: 0 }                           │
│    Actual:   { sum: 0, carry: 0 }                           │
│                                                             │
│ ✅ Test "0 + 1"                                              │
│    Inputs:  { a: 0, b: 1 }                                  │
│    Expected: { sum: 1, carry: 0 }                           │
│    Actual:   { sum: 1, carry: 0 }                           │
│                                                             │
│ ✅ Test "1 + 0"                                              │
│    Inputs:  { a: 1, b: 0 }                                  │
│    Expected: { sum: 1, carry: 0 }                           │
│    Actual:   { sum: 1, carry: 0 }                           │
│                                                             │
│ ✅ Test "1 + 1"                                              │
│    Inputs:  { a: 1, b: 1 }                                  │
│    Expected: { sum: 0, carry: 1 }                           │
│    Actual:   { sum: 0, carry: 1 }                           │
│                                                             │
│ All tests passed! (4/4) ✅                                   │
│                                                             │
│ [Add Test] [Run All Tests]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Using Composites in Larger Circuits

### Example: Building a Full Adder from Half Adders

**DSL:**
```dsl
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    // Use HalfAdder components
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

    // First stage: add a and b
    connect a -> ha1.a
    connect b -> ha1.b

    // Second stage: add ha1.sum and cin
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b

    // Final sum
    connect ha2.sum -> sum

    // Carry out is OR of both carries
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

**Visual representation:**
```
                    ┌─────────────┐
        a ─────────→│  HalfAdder  │
                    │    (ha1)    │
        b ─────────→│             │
                    │  a    sum   │─────┐
                    │  b    carry │─┐   │
                    └─────────────┘ │   │
                                    │   │
                    ┌─────────────┐ │   │
                    │  HalfAdder  │ │   │
      cin ─────────→│    (ha2)    │←┘   │
                    │             │     │
                    │  a    sum   │────→ sum
                    │  b    carry │─┐
                    └─────────────┘ │
                                    │
                    ┌───┐           │
                    │OR │←──────────┤
                    │   │←──────────┘
                    └─┬─┘
                      │
                    cout
```

### Simulation Flow

**When simulating:**
```
1. User sets inputs: a=1, b=1, cin=1
2. Simulator starts with FullAdder
3. Resolves ha1: HalfAdder definition
   - Evaluates ha1 with inputs {a: 1, b: 1}
   - Result: {sum: 0, carry: 1}
4. Resolves ha2: HalfAdder definition
   - Evaluates ha2 with inputs {a: 0 (from ha1.sum), b: 1 (cin)}
   - Result: {sum: 1, carry: 0}
5. Evaluates or1: Or gate
   - Inputs: {a: 1 (ha1.carry), b: 0 (ha2.carry)}
   - Result: {out: 1}
6. Final outputs: {sum: 1, cout: 1}
```

**If inlined (flattened):**
```
FullAdder becomes:
  xor1: Xor (from ha1)
  and1: And (from ha1)
  xor2: Xor (from ha2)
  and2: And (from ha2)
  or1: Or (original)

All evaluated in topological order.
```

---

## Data Flow Summary

### DSL-First Flow
```
User Types DSL
    ↓
Parse to AST
    ↓
Link and Resolve
    ↓
Type Check
    ↓
Generate IR
    ↓
Add to Library Store
    ↓
Update Component Palette
    ↓
User Drags into Canvas
    ↓
Create Node Instance
    ↓
User Wires Connections
    ↓
Simulate Circuit
```

### Visual-First Flow (Future)
```
User Creates Visually
    ↓
IR Store Captures Structure
    ↓
User Clicks "Create Component"
    ↓
System Analyzes IR
    ↓
Generate DSL from IR
    ↓
Parse DSL to AST
    ↓
Link and Resolve
    ↓
Generate Clean IR
    ↓
Add to Library Store
    ↓
Update Component Palette
```

### Key Insight

**The IR is always the source of truth.** Whether you start with DSL or visual editing, everything goes through IR:

```
   DSL Text ────────────┐
                        ↓
                    ┌───────┐
                    │  IR   │ ← Source of Truth
                    └───────┘
                        ↓
   Visual Editor ───────┘
```

Both DSL and visual editor are **projections** of the IR:
- **DSL** is a textual projection
- **Visual editor** is a graphical projection
- **Simulator** executes the IR directly

This architecture ensures:
- No conflicts between text and visual
- Single source of truth
- Easy to add new projections (e.g., Verilog export, waveform view)
- Clear separation of concerns

---

## Conclusion

**For v0.1, implement DSL-First workflow:**
1. Text editor for DSL
2. Compile button
3. Error display
4. Add to component library
5. Drag from palette
6. Simulate

**Visual-First can come later** once you have:
- Robust DSL parser
- Clean IR generation
- Working simulator
- Then add reverse compilation (IR → DSL)

This approach:
- Gets you to MVP fastest
- Validates the DSL design early
- Enables LLM generation immediately
- Provides a solid foundation for visual editing
