# Hierarchical Navigation: Complete Example

This document shows a **concrete end-to-end example** of how hierarchical navigation works with real DSL code, IR structures, and UI interactions.

---

## Example Scenario: Building a Half Adder

We'll build a Half Adder from AND/XOR gates, then use it in a Main circuit.

### Step 1: Define Half Adder in Component Library

```typescript
// Component library definition (Circuit type from ir-v0.1.ts)
const halfAdderDefinition: Circuit = {
  name: 'HalfAdder',

  // Interface (what appears as ports on the black box)
  inputs: [
    { name: 'A', width: 1 },
    { name: 'B', width: 1 },
  ],
  outputs: [
    { name: 'Sum', width: 1 },
    { name: 'Carry', width: 1 },
  ],

  // Internals (what user sees when they "enter" HalfAdder)
  internals: {
    nodes: [
      { id: 'xor1', type: 'Xor' },
      { id: 'and1', type: 'And' },
    ],
    wires: [
      // Sum = A XOR B
      { from: { nodeId: 'INPUT.A', portIndex: 0 }, to: { nodeId: 'xor1', portIndex: 0 } },
      { from: { nodeId: 'INPUT.B', portIndex: 0 }, to: { nodeId: 'xor1', portIndex: 1 } },
      { from: { nodeId: 'xor1', portIndex: 0 }, to: { nodeId: 'OUTPUT.Sum', portIndex: 0 } },

      // Carry = A AND B
      { from: { nodeId: 'INPUT.A', portIndex: 0 }, to: { nodeId: 'and1', portIndex: 0 } },
      { from: { nodeId: 'INPUT.B', portIndex: 0 }, to: { nodeId: 'and1', portIndex: 1 } },
      { from: { nodeId: 'and1', portIndex: 0 }, to: { nodeId: 'OUTPUT.Carry', portIndex: 0 } },
    ],
  },
};

// Register in component library
useComponentLibraryStore.getState().registerUser(halfAdderDefinition);
```

---

## Step 2: User Creates Main Circuit with HalfAdder

### Main Canvas (Initial State)

User drags components from palette onto Main canvas:

```
Component Palette          Main Canvas
┌──────────────┐         ┌────────────────────────────┐
│ Primitives   │         │ [Breadcrumb: Main]        │
│  - Switch    │         │                            │
│  - Led       │         │  ┌─────┐   ┌──────────┐  │
│  - And       │         │  │ Sw1 │──>│          │  │
│  - Xor       │         │  └─────┘   │ HalfAdder│  │
│              │         │             │          │  │
│ Components   │         │  ┌─────┐   │  Sum Carry│  │
│  - HalfAdder │ drag──> │  │ Sw2 │──>│  ○    ○  │  │
│              │         │  └─────┘   └──┬───┬───┘  │
│              │         │               │   │       │
│              │         │            ┌──▼┐ ┌▼──┐  │
│              │         │            │Led1 │Led2│  │
└──────────────┘         │            └────┘ └───┘  │
                         └────────────────────────────┘
```

### IR State (Main Canvas)

```typescript
// IR Store state
{
  components: {
    'sw1': { id: 'sw1', type: 'Switch', value: false },
    'sw2': { id: 'sw2', type: 'Switch', value: false },
    'ha1': { id: 'ha1', type: 'HalfAdder' },  // References definition
    'led1': { id: 'led1', type: 'Led', value: false },
    'led2': { id: 'led2', type: 'Led', value: false },
  },
  connections: {
    'c1': { id: 'c1', sourceComponentId: 'sw1', sourcePortIndex: 0,
            targetComponentId: 'ha1', targetPortIndex: 0 },
    'c2': { id: 'c2', sourceComponentId: 'sw2', sourcePortIndex: 0,
            targetComponentId: 'ha1', targetPortIndex: 1 },
    'c3': { id: 'c3', sourceComponentId: 'ha1', sourcePortIndex: 0,
            targetComponentId: 'led1', targetPortIndex: 0 },
    'c4': { id: 'c4', sourceComponentId: 'ha1', sourcePortIndex: 1,
            targetComponentId: 'led2', targetPortIndex: 0 },
  },
}
```

### Metadata State (Main Canvas)

```typescript
// Metadata Store state
{
  components: {
    'sw1': { id: 'sw1', position: { x: 50, y: 100 }, selected: false },
    'sw2': { id: 'sw2', position: { x: 50, y: 200 }, selected: false },
    'ha1': { id: 'ha1', position: { x: 200, y: 150 }, selected: false },
    'led1': { id: 'led1', position: { x: 400, y: 130 }, selected: false },
    'led2': { id: 'led2', position: { x: 400, y: 170 }, selected: false },
  },
  connections: {
    // Wire routing metadata (optional)
  },
}
```

### Navigation State

```typescript
// EditorNavigationStore state
{
  currentCanvasId: 'Main',
  breadcrumb: ['Main'],
  canvasViewports: {
    'Main': { zoom: 1.0, pan: { x: 0, y: 0 } },
  },
}
```

---

## Step 3: User Double-Clicks HalfAdder to View Internals

### User Action
1. User double-clicks the HalfAdder component box
2. Canvas detects double-click event
3. Canvas checks if HalfAdder has internals
4. Navigation store updates to show HalfAdder canvas

### Code Flow

```typescript
// Canvas.tsx
const onNodeDoubleClick = useCallback(
  (event: React.MouseEvent, node: Node) => {
    const component = irComponents[node.id];  // ha1
    const componentDef = resolveComponent(component.type);  // 'HalfAdder'

    if (componentDef?.internals) {
      navigateToComponent(component.type);  // Navigate to 'HalfAdder' canvas
    }
  },
  [irComponents, resolveComponent, navigateToComponent]
);
```

### Navigation State (After Double-Click)

```typescript
// EditorNavigationStore state (UPDATED)
{
  currentCanvasId: 'HalfAdder',  // CHANGED
  breadcrumb: ['Main', 'HalfAdder'],  // CHANGED
  canvasViewports: {
    'Main': { zoom: 1.0, pan: { x: 0, y: 0 } },
    'HalfAdder': { zoom: 1.0, pan: { x: 0, y: 0 } },  // NEW
  },
}
```

---

## Step 4: HalfAdder Canvas Renders

### Canvas View (HalfAdder Internals)

```
┌────────────────────────────────────────┐
│ [Breadcrumb: Main > HalfAdder]        │
├────────────────────────────────────────┤
│                                        │
│  Input Ports (implicit)                │
│  ○ A                                   │
│  │                                     │
│  │  ┌─────┐           ┌──────────┐   │
│  ├─>│     │           │          │   │
│  │  │ XOR ├──────────>│ OUTPUT   │   │
│  ├─>│     │           │  (Sum)   │○  │
│  │  └─────┘           └──────────┘   │
│  │                                     │
│  │  ┌─────┐           ┌──────────┐   │
│  ├─>│     │           │          │   │
│  │  │ AND ├──────────>│ OUTPUT   │   │
│  └─>│     │           │ (Carry)  │○  │
│     └─────┘           └──────────┘   │
│                                        │
│  ○ B                                   │
│                                        │
└────────────────────────────────────────┘
```

### Visible IR (HalfAdder Canvas)

```typescript
// Canvas computes visible IR based on currentCanvasId
const visibleIR = useMemo(() => {
  if (currentCanvasId === 'Main') {
    return { components: irComponents, connections: irConnections };
  } else {
    const componentDef = resolveComponent(currentCanvasId);  // HalfAdder definition
    if (!componentDef?.internals) return { components: {}, connections: {} };

    // Convert definition internals to IR format
    const components = {};
    const connections = {};

    componentDef.internals.nodes.forEach(node => {
      components[node.id] = {
        id: node.id,
        type: node.type,
        // ... other fields
      };
    });

    componentDef.internals.wires.forEach((wire, idx) => {
      connections[`wire-${idx}`] = {
        id: `wire-${idx}`,
        sourceComponentId: wire.from.nodeId,
        sourcePortIndex: wire.from.portIndex,
        targetComponentId: wire.to.nodeId,
        targetPortIndex: wire.to.portIndex,
      };
    });

    return { components, connections };
  }
}, [currentCanvasId, resolveComponent, irComponents, irConnections]);

// For HalfAdder canvas, this returns:
{
  components: {
    'xor1': { id: 'xor1', type: 'Xor' },
    'and1': { id: 'and1', type: 'And' },
    // Note: INPUT/OUTPUT ports are rendered separately (as special nodes)
  },
  connections: {
    'wire-0': { sourceComponentId: 'INPUT.A', targetComponentId: 'xor1', ... },
    'wire-1': { sourceComponentId: 'INPUT.B', targetComponentId: 'xor1', ... },
    'wire-2': { sourceComponentId: 'xor1', targetComponentId: 'OUTPUT.Sum', ... },
    'wire-3': { sourceComponentId: 'INPUT.A', targetComponentId: 'and1', ... },
    'wire-4': { sourceComponentId: 'INPUT.B', targetComponentId: 'and1', ... },
    'wire-5': { sourceComponentId: 'and1', targetComponentId: 'OUTPUT.Carry', ... },
  },
}
```

### Metadata State (HalfAdder Canvas)

```typescript
// Metadata store maintains separate positions per canvas
{
  // Main canvas node positions (unchanged)
  'Main': {
    'sw1': { position: { x: 50, y: 100 } },
    'sw2': { position: { x: 50, y: 200 } },
    'ha1': { position: { x: 200, y: 150 } },
    // ...
  },

  // HalfAdder canvas node positions (auto-layout or manual)
  'HalfAdder': {
    'xor1': { position: { x: 150, y: 100 } },
    'and1': { position: { x: 150, y: 200 } },
    // INPUT/OUTPUT ports have fixed positions (left/right edges)
  },
}
```

---

## Step 5: User Navigates Back to Main

### User Action
User clicks "Main" in breadcrumb navigation.

### Code Flow

```typescript
// BreadcrumbNavigation.tsx
<button
  onClick={() => navigateToBreadcrumb(0)}  // Index 0 = Main
>
  Main
</button>

// EditorNavigationStore
navigateToBreadcrumb: (index) => {
  set((state) => {
    state.breadcrumb = state.breadcrumb.slice(0, index + 1);  // ['Main', 'HalfAdder'] -> ['Main']
    state.currentCanvasId = state.breadcrumb[index];  // 'Main'
  });
}
```

### Navigation State (After Breadcrumb Click)

```typescript
{
  currentCanvasId: 'Main',  // CHANGED back
  breadcrumb: ['Main'],  // CHANGED back
  canvasViewports: {
    'Main': { zoom: 1.0, pan: { x: 0, y: 0 } },
    'HalfAdder': { zoom: 1.0, pan: { x: 0, y: 0 } },  // Preserved for future navigation
  },
}
```

### Canvas View (Back to Main)

```
┌────────────────────────────────┐
│ [Breadcrumb: Main]            │
├────────────────────────────────┤
│                                │
│  ┌─────┐   ┌──────────┐      │
│  │ Sw1 │──>│          │      │
│  └─────┘   │ HalfAdder│      │  <- Back to black box view
│             │          │      │
│  ┌─────┐   │  Sum Carry│      │
│  │ Sw2 │──>│  ○    ○  │      │
│  └─────┘   └──┬───┬───┘      │
│               │   │           │
│            ┌──▼┐ ┌▼──┐      │
│            │Led1 │Led2│      │
│            └────┘ └───┘      │
└────────────────────────────────┘
```

---

## DSL Representation (Unchanged Throughout)

### Key Insight
The DSL **never changes** regardless of which canvas user is viewing.

```
// Main circuit DSL
component Main {
  node sw1: Switch
  node sw2: Switch
  node ha1: HalfAdder
  node led1: Led
  node led2: Led

  wire sw1.out -> ha1.A
  wire sw2.out -> ha1.B
  wire ha1.Sum -> led1.in
  wire ha1.Carry -> led2.in
}

// HalfAdder definition DSL
component HalfAdder {
  input A: 1
  input B: 1
  output Sum: 1
  output Carry: 1

  node xor1: Xor
  node and1: And

  wire A -> xor1.in0
  wire B -> xor1.in1
  wire xor1.out -> Sum

  wire A -> and1.in0
  wire B -> and1.in1
  wire and1.out -> Carry
}
```

**This DSL is the source of truth**. Navigation state is purely UI state.

---

## Simulation Flow (Independent of Navigation)

### Simulation Always Flattens Hierarchy

When user clicks "Simulate" (or auto-simulation runs for combinational circuits):

```typescript
// 1. Flatten Main circuit to primitives
const flattenedIR = flattenCircuit('Main', componentLibrary);

// Result:
{
  components: {
    'sw1': { type: 'Switch', value: false },
    'sw2': { type: 'Switch', value: false },
    'ha1.xor1': { type: 'Xor' },  // Flattened from HalfAdder
    'ha1.and1': { type: 'And' },  // Flattened from HalfAdder
    'led1': { type: 'Led' },
    'led2': { type: 'Led' },
  },
  connections: {
    // Direct connections from sw1 to xor1/and1
    { sourceComponentId: 'sw1', targetComponentId: 'ha1.xor1', ... },
    { sourceComponentId: 'sw2', targetComponentId: 'ha1.xor1', ... },
    { sourceComponentId: 'sw1', targetComponentId: 'ha1.and1', ... },
    { sourceComponentId: 'sw2', targetComponentId: 'ha1.and1', ... },
    // Outputs from xor1/and1 to led1/led2
    { sourceComponentId: 'ha1.xor1', targetComponentId: 'led1', ... },
    { sourceComponentId: 'ha1.and1', targetComponentId: 'led2', ... },
  },
}

// 2. Run simulation on flattened IR
const result = runSimulation(flattenedIR);

// 3. Map results back to hierarchical components
// (led1 shows Sum output, led2 shows Carry output)
```

**Key Point**: Simulation doesn't care about hierarchy. It flattens everything to primitives, then simulates.

---

## Advanced Example: Three-Level Hierarchy

### Scenario
```
Main
├── FullAdder
│   ├── HalfAdder (instance 1)
│   │   ├── Xor
│   │   └── And
│   ├── HalfAdder (instance 2)
│   │   ├── Xor
│   │   └── And
│   └── Or
```

### Navigation Flow

1. **User starts at Main**
   - Sees: FullAdder (black box), Switch, Led
   - Breadcrumb: `[Main]`

2. **User double-clicks FullAdder**
   - Sees: HalfAdder (instance 1), HalfAdder (instance 2), Or
   - Breadcrumb: `[Main > FullAdder]`

3. **User double-clicks HalfAdder (instance 1)**
   - Sees: Xor, And (primitives)
   - Breadcrumb: `[Main > FullAdder > HalfAdder]`

4. **User clicks "FullAdder" in breadcrumb**
   - Back to: HalfAdder instances, Or
   - Breadcrumb: `[Main > FullAdder]`

5. **User clicks "Main" in breadcrumb**
   - Back to: FullAdder (black box), Switch, Led
   - Breadcrumb: `[Main]`

### Navigation State Throughout

```typescript
// State snapshots at each step

// Step 1 (Main)
{ currentCanvasId: 'Main', breadcrumb: ['Main'] }

// Step 2 (FullAdder)
{ currentCanvasId: 'FullAdder', breadcrumb: ['Main', 'FullAdder'] }

// Step 3 (HalfAdder)
{ currentCanvasId: 'HalfAdder', breadcrumb: ['Main', 'FullAdder', 'HalfAdder'] }

// Step 4 (Back to FullAdder)
{ currentCanvasId: 'FullAdder', breadcrumb: ['Main', 'FullAdder'] }

// Step 5 (Back to Main)
{ currentCanvasId: 'Main', breadcrumb: ['Main'] }
```

---

## Comparison: With vs Without Hierarchy

### Without Hierarchical Navigation (Old Approach)

**Problem**: All components shown flattened on single canvas.

```
Main Canvas (Everything Flattened)
┌──────────────────────────────────────────┐
│  ┌─────┐  ┌───┐  ┌───┐  ┌───┐          │
│  │ Sw1 ├─>│XOR├─>│XOR├─>│ OR ├─>┌────┐ │
│  └─────┘  └─┬─┘  └─┬─┘  └─┬─┘  │Led │ │
│            │     │     │       └────┘ │
│            │ AND │     │ AND │           │
│            └──┬──┘     └──┬──┘           │
│  ┌─────┐     │           │              │
│  │ Sw2 ├─────┴───────────┘              │
│  └─────┘                                 │
│                                          │
│  (Messy! Hard to understand FullAdder)  │
└──────────────────────────────────────────┘
```

**Issues**:
- Canvas clutter (10s to 1000s of gates)
- Hard to understand structure
- Can't abstract away details
- No modularity

---

### With Hierarchical Navigation (New Approach)

**Solution**: Show components at appropriate abstraction level.

```
Main Canvas (High-Level View)
┌────────────────────────────────┐
│  ┌─────┐   ┌───────────┐      │
│  │ Sw1 │──>│           │      │
│  └─────┘   │ FullAdder │      │
│             │           │      │
│  ┌─────┐   │  Sum Carry│      │
│  │ Sw2 │──>│  ○    ○  │      │
│  └─────┘   └──┬───┬───┘      │
│               │   │           │
│            ┌──▼┐ ┌▼──┐      │
│            │Led1 │Led2│      │
│            └────┘ └───┘      │
│                                │
│  (Clean! FullAdder is a box)  │
└────────────────────────────────┘

Double-click FullAdder ↓

FullAdder Canvas (Mid-Level View)
┌────────────────────────────────┐
│ [Main > FullAdder]            │
│                                │
│  ┌──────────┐   ┌──────────┐ │
│  │HalfAdder1│──>│HalfAdder2│ │
│  └────┬─────┘   └────┬─────┘ │
│       │              │        │
│       └──────┬───────┘        │
│              │                │
│          ┌───▼──┐            │
│          │  OR  │            │
│          └──────┘            │
│                                │
│  (Medium detail: see blocks)  │
└────────────────────────────────┘

Double-click HalfAdder1 ↓

HalfAdder Canvas (Low-Level View)
┌────────────────────────────────┐
│ [Main > FullAdder > HalfAdder]│
│                                │
│  ○A  ┌─────┐                  │
│   ├─>│     │                  │
│   │  │ XOR ├──> Sum ○        │
│   ├─>│     │                  │
│  ○B  └─────┘                  │
│   │                            │
│   │  ┌─────┐                  │
│   ├─>│     │                  │
│   │  │ AND ├──> Carry ○      │
│   └─>│     │                  │
│      └─────┘                  │
│                                │
│  (Full detail: see gates)     │
└────────────────────────────────┘
```

**Benefits**:
- Clean canvas at each level
- User chooses abstraction level
- Easy to understand structure
- Supports modularity and reuse

---

## Summary

### Data Flow at Each Navigation Level

```
User Action          Navigation State          Visible IR              Canvas View
─────────────────────────────────────────────────────────────────────────────────
Start                currentCanvasId: Main     Main components         FullAdder as box
Double-click FA      currentCanvasId: FA       FA internals            HalfAdders + Or
Double-click HA      currentCanvasId: HA       HA internals            Xor + And
Click breadcrumb     currentCanvasId: Main     Main components         FullAdder as box
```

### Key Invariants

1. **DSL never changes**: Whether viewing Main, FullAdder, or HalfAdder canvas, the DSL remains the same.

2. **IR is per-canvas**: Each canvas has its own "visible IR" derived from the current component definition.

3. **Metadata is per-canvas**: Node positions are scoped to canvas (ha1 has different position on Main vs its internals).

4. **Simulation is flat**: Hierarchy is for authoring/visualization only. Simulation always flattens to primitives.

5. **Navigation is pure UI state**: Breadcrumb, currentCanvasId, viewport are ephemeral UI state.

---

## Code Checklist

When implementing, ensure:

- [ ] `EditorNavigationStore` manages `currentCanvasId` and `breadcrumb`
- [ ] `Canvas` filters IR based on `currentCanvasId`
- [ ] `Canvas` has `onNodeDoubleClick` handler to navigate into components
- [ ] `BreadcrumbNavigation` component renders and handles clicks
- [ ] `ComponentLibrary` has `Circuit.internals` structure
- [ ] Metadata store maintains per-canvas node positions
- [ ] Simulation flattens hierarchy before executing
- [ ] DSL generation works regardless of current canvas view

---

## Testing Checklist

- [ ] Can navigate from Main to component canvas
- [ ] Can navigate back using breadcrumb
- [ ] Can navigate multiple levels deep
- [ ] Viewport state preserved when switching canvases
- [ ] Node positions are per-canvas (not global)
- [ ] Simulation works with hierarchical circuits
- [ ] DSL generation includes hierarchical components
- [ ] Cannot navigate into primitives (they have no internals)

