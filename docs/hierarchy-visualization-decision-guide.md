# Hierarchical Visualization: Decision Guide

## Direct Answers to Your Questions

### 1. When user has `node cpu: CPU` on canvas, what do they SEE?

**Answer: A) Single black box labeled "CPU" with just ports (by default)**

```
Visual Representation on Main Canvas:

┌─────────────────────┐
│       CPU           │  ← Component label
│                     │
│  Inputs:            │
│   ○ A[8]            │  ← Input ports
│   ○ B[8]            │
│   ○ clk             │
│                     │
│  Outputs:           │
│   ○ result[8]       │  ← Output port
│   ○ zero_flag       │
│                     │
└─────────────────────┘
     (Black Box)
```

**Why this choice?**
- Prevents canvas clutter
- Matches industry tools (Logisim, Digital)
- User explicitly chooses when to view internals
- Clean separation of abstraction levels

**How to see internals?**
- Double-click component → navigate to CPU canvas
- (Phase 2) Right-click → "Expand In Place"

---

### 2. What does the DSL represent?

**Answer: The logical structure (always references CPU)**

The DSL is **invariant** to visualization state. It represents:
- **WHAT** components exist (types, instances)
- **HOW** they're connected (wiring)
- **PARAMETERS** (bit widths, initial values)

The DSL does **NOT** represent:
- **WHERE** components appear on canvas (metadata)
- **WHETHER** components are expanded (UI state)
- **HOW** wires are routed (visual metadata)

#### Example DSL (Never Changes)

```
component Main {
  node cpu: CPU
  node ram: RAM
  wire cpu.mem_addr -> ram.addr
}
```

**This DSL means**:
- There exists a CPU component instance
- It is connected to a RAM component
- **Regardless** of whether CPU is shown as black box or expanded
- **Regardless** of which canvas user is viewing

---

### 3. How do users navigate hierarchy?

**Answer: "Enter" component (Logisim-style) for MVP; optional expand/collapse in Phase 2**

#### Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Main Canvas                       │
│  [Breadcrumb: Main]                                 │
│                                                     │
│  ┌──────────┐         ┌──────────┐                │
│  │   CPU    │────────>│   RAM    │                │
│  │  [box]   │         │  [box]   │                │
│  └──────────┘         └──────────┘                │
│       ▲                                             │
│       │ Double-click                                │
│       │                                             │
└───────┼─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                   CPU Canvas                        │
│  [Breadcrumb: Main > CPU]                          │
│                                                     │
│  ┌──────┐    ┌───────────┐    ┌──────────┐       │
│  │ ALU  │───>│ Register  │───>│ Control  │       │
│  │[box] │    │   File    │    │  Unit    │       │
│  └──────┘    └───────────┘    └──────────┘       │
│     ▲                                               │
│     │ Double-click                                  │
│     │                                               │
└─────┼───────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────┐
│                   ALU Canvas                        │
│  [Breadcrumb: Main > CPU > ALU]                    │
│                                                     │
│  ┌────────┐  ┌────────┐  ┌─────┐  ┌──────┐      │
│  │ Adder  │  │Shifter │  │ Mux │  │ Comp │      │
│  │ [box]  │  │ [box]  │  │[box]│  │[box] │      │
│  └────────┘  └────────┘  └─────┘  └──────┘      │
│                                                     │
│  [All primitives or composites]                     │
└─────────────────────────────────────────────────────┘

Click "Main" in breadcrumb → Jump back to Main canvas
Click "CPU" in breadcrumb → Jump to CPU canvas
Press Escape → Navigate back one level
```

#### Navigation Methods (MVP)

| Action | Result |
|--------|--------|
| **Double-click component** | Navigate into component canvas |
| **Click breadcrumb level** | Jump to that level |
| **Press Escape** | Navigate back one level |
| **Press Cmd+Home** | Jump to Main canvas |

#### Phase 2: In-Place Expansion (Future)

```
Before Expansion (Right-click CPU):
┌─────────────────────────────────────┐
│  [Main]                             │
│                                     │
│  ┌──────────┐                       │
│  │   CPU    │  ← Right-click menu: │
│  │  [box]   │     "Expand In Place"│
│  └──────────┘                       │
└─────────────────────────────────────┘

After Expansion:
┌─────────────────────────────────────┐
│  [Main]                             │
│                                     │
│  ┌─ CPU (expanded) ────────────┐   │
│  │ ┌──────┐  ┌────────────┐  │   │
│  │ │ ALU  │─>│ RegisterFile│  │   │
│  │ └──────┘  └────────────┘  │   │
│  └─────────────────────────────┘   │
│  (Shows internals on same canvas)   │
└─────────────────────────────────────┘
```

---

### 4. At what abstraction level should components appear?

**Answer: User-controlled, with sensible defaults**

#### Default Behavior (MVP)

| Component Type | Default View | Can Expand? | Reasoning |
|---------------|--------------|-------------|-----------|
| **Primitives** (And, Or, Xor) | Always black box | No | Atomic, no internals |
| **Standard Library** (HalfAdder, Register) | Black box | Yes (navigate) | Common building blocks |
| **User Components** (MyCPU, MyALU) | Black box | Yes (navigate) | User-defined composites |
| **Large Components** (RAM, ROM) | Black box | Yes (navigate) | 1000s of internals |

#### User Control (Phase 1)

- **Always starts collapsed** (black box)
- **User navigates in** (double-click) to see internals
- **User navigates out** (breadcrumb) to return to higher level

#### Smart Defaults (Phase 2 - Optional)

```typescript
// Example: Heuristic for auto-expansion (NOT RECOMMENDED for MVP)
function shouldAutoExpand(component: Circuit): boolean {
  if (!component.internals) return false;  // Primitive

  const nodeCount = component.internals.nodes.length;

  if (nodeCount === 0) return false;  // Empty
  if (nodeCount > 20) return false;   // Too complex
  if (nodeCount < 5) return true;     // Simple enough to show

  return false;  // Default: collapsed
}
```

**Recommendation**: Do NOT auto-expand for MVP. Always show as black box, let user choose.

---

## Visual Comparison: Navigation Styles

### Option A: Logisim-Style (RECOMMENDED for MVP)

**How it works**: Each component definition has its own canvas. Navigate between canvases.

```
User View Timeline:

t=0: Main Canvas
┌─────────────────┐
│ [Main]          │
│                 │
│ ┌─────────┐    │
│ │   CPU   │    │
│ └─────────┘    │
└─────────────────┘

  (User double-clicks CPU)

t=1: CPU Canvas
┌─────────────────┐
│ [Main > CPU]    │
│                 │
│ ┌─────┐ ┌─────┐│
│ │ ALU │ │ Reg ││
│ └─────┘ └─────┘│
└─────────────────┘

  (User clicks "Main" breadcrumb)

t=2: Back to Main Canvas
┌─────────────────┐
│ [Main]          │
│                 │
│ ┌─────────┐    │
│ │   CPU   │    │
│ └─────────┘    │
└─────────────────┘
```

**Pros**:
- ✅ Simple to implement
- ✅ Clean separation of levels
- ✅ No canvas clutter
- ✅ Easy to understand

**Cons**:
- ❌ Can't see multiple levels at once
- ❌ Requires navigation to see internals

---

### Option B: In-Place Expansion (Phase 2)

**How it works**: Component expands on current canvas to show internals.

```
User View Timeline:

t=0: Main Canvas (Collapsed)
┌───────────────────────┐
│ [Main]                │
│                       │
│ ┌─────────┐          │
│ │   CPU   │          │
│ └─────────┘          │
└───────────────────────┘

  (User right-clicks CPU → "Expand")

t=1: Main Canvas (Expanded)
┌───────────────────────┐
│ [Main]                │
│                       │
│ ┌─ CPU ────────────┐ │
│ │ ┌────┐  ┌─────┐ │ │
│ │ │ALU │─>│ Reg │ │ │
│ │ └────┘  └─────┘ │ │
│ └──────────────────┘ │
└───────────────────────┘

  (User right-clicks CPU → "Collapse")

t=2: Main Canvas (Collapsed)
┌───────────────────────┐
│ [Main]                │
│                       │
│ ┌─────────┐          │
│ │   CPU   │          │
│ └─────────┘          │
└───────────────────────┘
```

**Pros**:
- ✅ See multiple levels on same canvas
- ✅ Visual continuity (wires connect across levels)
- ✅ Faster for debugging (no navigation)

**Cons**:
- ❌ Complex implementation (layout management)
- ❌ Canvas clutter (many expanded components)
- ❌ Interaction ambiguity (click inside vs outside)

---

### Option C: Hybrid (RECOMMENDED Long-Term)

**How it works**: Combine both approaches. Default to navigation, allow optional expansion.

```
Primary: Navigate between canvases (Option A)
Secondary: Right-click → "Expand In Place" (Option B)

User can choose based on context:
- Debugging specific component → Navigate in
- Quick peek at internals → Expand in place
- High-level design → Keep collapsed
```

**Pros**:
- ✅ Best of both worlds
- ✅ User control over abstraction
- ✅ Flexible for different workflows

**Cons**:
- ❌ More complex to implement
- ❌ Requires clear UI for expansion state

---

## Data Architecture Decision Tree

### Question: Where does expansion state live?

```
Is expansion state needed for simulation?
│
├─ YES → Store in IR (structural data)
│         Example: Component parameter (bit width)
│
└─ NO  → Store in metadata or UI state
          │
          ├─ Should it persist across sessions?
          │  │
          │  ├─ YES → Store in metadata file (.canvas.json)
          │  │         Example: Node positions, viewport zoom
          │  │
          │  └─ NO  → Store in React state (ephemeral)
          │            Example: Expansion state, hover state
```

**For hierarchical navigation**:

| Data | Storage Location | Rationale |
|------|------------------|-----------|
| **Component type** (CPU, ALU) | IR | Structural truth |
| **Component internals** (nodes, wires) | Component Library | Reusable definitions |
| **Current canvas view** (Main, CPU, ALU) | React state | Ephemeral navigation state |
| **Breadcrumb stack** | React state | Ephemeral navigation state |
| **Node positions** | Metadata file | Persist across sessions |
| **Expansion state** (collapsed/expanded) | React state (MVP) | Too ephemeral to save |
| **Viewport** (zoom, pan) | React state or metadata | Could persist, not critical |

---

## Implementation Recommendation

### Phase 1 (MVP): Logisim-Style Navigation

**Implement**:
1. ✅ Navigation store (`currentCanvasId`, `breadcrumb`)
2. ✅ Breadcrumb component (clickable hierarchy)
3. ✅ Canvas filters IR by current canvas
4. ✅ Double-click handler to navigate into components
5. ✅ Keyboard shortcuts (Escape to go back)

**Skip for now**:
- ❌ In-place expansion
- ❌ Auto-layout
- ❌ Visual grouping

**Effort**: ~2-3 days (with testing)

**Result**: Users can navigate into components to see internals, like Logisim.

---

### Phase 2 (Enhancement): In-Place Expansion

**Implement** (after Phase 1 is stable and user-tested):
1. ✅ Expansion state in metadata
2. ✅ Right-click menu → "Expand In Place" / "Collapse"
3. ✅ Auto-layout for expanded internals
4. ✅ Visual grouping (border around expanded components)
5. ✅ Wire routing to expanded internals

**Effort**: ~4-5 days (complex layout logic)

**Result**: Users can optionally expand components in place for quick debugging.

---

## User Scenarios

### Scenario 1: Building a CPU from scratch

**User wants to**:
- Design ALU separately
- Design Register File separately
- Combine them in CPU
- Use CPU in Main circuit

**With hierarchical navigation**:
1. Create ALU component (navigate to ALU canvas, add gates)
2. Create RegisterFile component (navigate to RegisterFile canvas)
3. Create CPU component (navigate to CPU canvas, add ALU + RegisterFile instances)
4. Use CPU in Main (drag CPU from palette, wire it up)

**Without hierarchy**:
- User would need to flatten everything (1000s of gates on one canvas)
- Impossible to reuse components
- Nightmare to debug

---

### Scenario 2: Debugging a RAM read issue

**User wants to**:
- Trace signal from CPU through RAM to see why read is wrong
- Check address decoder inside RAM
- Verify data bus connections

**With hierarchical navigation**:
1. Start at Main canvas
2. Double-click CPU → verify mem_addr output
3. Back to Main, double-click RAM → see address decoder
4. Double-click AddressDecoder → see gate-level logic
5. Navigate back to Main, verify connection

**With in-place expansion** (Phase 2):
1. Start at Main canvas
2. Right-click CPU → Expand In Place → see mem_addr output
3. Right-click RAM → Expand In Place → see address decoder
4. Trace wire visually from CPU.mem_addr to RAM.addr
5. Collapse both when done

**Best**: Hybrid approach (navigate for deep dives, expand for quick peeks)

---

## Final Recommendation

### For MVP (Ship This First)

**Navigation Style**: Logisim-style subcircuit navigation
- Each component has its own canvas
- Double-click to navigate in
- Breadcrumb to navigate out
- Components shown as black boxes by default

**DSL**: Structural only (no expansion state)
- Component definitions with internals
- Instance references by type
- Wiring between instances

**Metadata**: Node positions per canvas
- Separate positions for each canvas
- Optional persistence to file
- No expansion state saved

**Why this order?**
1. Simpler to implement and test
2. Matches user expectations from Logisim
3. Provides immediate value (clean abstraction)
4. Establishes foundation for Phase 2

---

### For Phase 2 (Add After User Feedback)

**Navigation Enhancement**: Optional in-place expansion
- Right-click → "Expand In Place"
- Visual grouping with borders
- Collapse back to black box
- Expansion state is ephemeral (not saved)

**Why defer this?**
1. Complex implementation (layout, routing, interaction)
2. Uncertain user demand (need feedback from Phase 1)
3. Not required for core functionality
4. Can be added incrementally

---

## Code Example: Navigation in Action

```typescript
// User double-clicks CPU component on Main canvas

// 1. Canvas detects event
onNodeDoubleClick = (event, node) => {
  const component = irStore.getComponent(node.id);  // Get CPU component
  const componentDef = componentLibrary.resolveComponent(component.type);  // Get CPU definition

  if (componentDef?.internals) {
    // 2. Navigate to CPU canvas
    navigationStore.navigateToComponent(component.type);  // currentCanvasId = 'CPU'
  }
};

// 3. Canvas re-renders with new currentCanvasId
const currentCanvasId = navigationStore.currentCanvasId;  // 'CPU'

// 4. Canvas computes visible IR based on currentCanvasId
const visibleIR = useMemo(() => {
  if (currentCanvasId === 'Main') {
    return irStore.getState();  // Top-level components
  } else {
    const componentDef = componentLibrary.resolveComponent(currentCanvasId);
    return convertDefinitionToIR(componentDef);  // CPU's internal nodes/wires
  }
}, [currentCanvasId]);

// 5. Canvas renders CPU's internals (ALU, RegisterFile, etc.)
// User now sees CPU canvas with ALU and RegisterFile as black boxes

// 6. User clicks "Main" in breadcrumb
navigationStore.navigateToBreadcrumb(0);  // currentCanvasId = 'Main'

// 7. Canvas re-renders with Main's components
// User now sees CPU as black box again
```

---

## Questions for User/Team

Before implementing, confirm:

1. **Does the "navigate into component" mental model feel right?**
   - Similar to Logisim (separate canvas per component)
   - Or prefer in-place expansion from the start?

2. **How important is seeing multiple hierarchy levels simultaneously?**
   - If critical → prioritize in-place expansion
   - If not → Logisim-style is sufficient

3. **Should we save any navigation state to disk?**
   - Node positions: YES (already doing this)
   - Viewport zoom/pan: MAYBE (user preference)
   - Expansion state: NO (too ephemeral)

4. **What's the most common debugging workflow?**
   - Navigate deep → need good breadcrumb navigation
   - Quick peek → need in-place expansion

5. **How deep do hierarchies typically go?**
   - 2-3 levels (Main → CPU → ALU) → Logisim-style is fine
   - 5+ levels (deep nesting) → Need search/jump features

---

## Summary

| Question | Answer |
|----------|--------|
| **What do users see?** | Black box with ports (by default) |
| **What does DSL represent?** | Structural truth (component types, connections) |
| **How do users navigate?** | Double-click to enter, breadcrumb to exit |
| **What abstraction level?** | User-controlled (starts collapsed) |
| **MVP approach?** | Logisim-style subcircuit navigation |
| **Phase 2 enhancement?** | Optional in-place expansion |
| **Where is expansion state?** | React state (ephemeral, not saved) |

