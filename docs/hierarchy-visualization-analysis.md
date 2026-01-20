# Hierarchical Component Visualization Analysis

## Industry Precedents

### Logisim/Logisim-Evolution
**Approach**: Separate subcircuit navigation
- Each component is a **separate circuit/canvas**
- Click "View → [ComponentName]" or double-click to enter subcircuit
- When viewing subcircuit, you see ONLY that level's internals
- Component instances appear as black boxes with ports
- **Hierarchy navigation**: Breadcrumb at top (Main → CPU → ALU)

**Pros**:
- Clean separation of concerns
- No canvas clutter
- Clear mental model (one level at a time)

**Cons**:
- Can't see multiple levels simultaneously
- Lots of navigation to understand system
- Hard to trace signals across hierarchy

---

### Digital (by hneemann)
**Approach**: Hierarchical with selective expansion
- Default: Components appear as labeled boxes with ports
- Double-click: Opens component in **new tab** (separate canvas)
- Can have multiple tabs open simultaneously
- **No in-place expansion**

**Pros**:
- Tab model is familiar to users
- Can compare different hierarchy levels side-by-side
- Clean canvas at each level

**Cons**:
- Still can't see multiple levels on same canvas
- Signal tracing requires switching tabs

---

### Verilog Simulators (ModelSim, Verilator)
**Approach**: Hierarchical scope browser + waveform viewer
- **Text-based hierarchy browser** (tree view)
- Can expand/collapse modules in scope browser
- Waveform viewer shows signals from ANY level
- Can probe internal signals by navigating hierarchy in browser

**Pros**:
- Powerful signal tracing
- Can observe any level of abstraction
- Efficient for large designs

**Cons**:
- Not visual/schematic
- Requires understanding text hierarchy

---

### Quartus/Vivado (FPGA Schematic Viewers)
**Approach**: Hierarchical schematic with dynamic expansion
- **In-place expansion/collapse** (!)
- Double-click box → expands to show internals **on same canvas**
- Expanded instances show subcomponents as boxes
- Can recursively expand
- **Minimap** and **hierarchy tree panel** for navigation

**Pros**:
- Visual continuity (see connections across levels)
- User controls abstraction level
- Can selectively expand only parts of interest

**Cons**:
- Canvas can get cluttered with deep expansions
- Complex layout management (where do expanded nodes go?)
- Wires crossing multiple abstraction levels

---

### Falstad Circuit Simulator
**Approach**: Single-level, no hierarchy
- All components are primitives
- No custom components (or very limited)
- **Not applicable to hierarchical designs**

---

## User Mental Model Implications

### Key Insight
Users want **selective abstraction**:
- See RAM as a **black box** (16 gates inside is too noisy)
- See ALU as a **black box** (but maybe expand to see Adder vs Shifter)
- See Adder as **expanded** (to debug ripple carry logic)

**This is context-dependent!** No single abstraction level is "correct".

---

## Recommended Approach for Turing Incomplete

Based on industry analysis and user needs, I recommend a **hybrid approach**:

### Primary Model: Logisim-style Subcircuit Navigation
- Each component definition has its own canvas/view
- Component instances appear as labeled boxes with ports
- Double-click instance → navigate to component definition canvas
- Breadcrumb navigation at top

### Enhancement: In-place Expansion (MVP Phase 2)
- Right-click component instance → "Expand In Place"
- Shows internals **on current canvas** with visual grouping
- Can collapse back to black box
- **Expansion state is UI state only** (not in DSL)

---

## DSL Implications

### Critical Separation
```
DSL (Source of Truth)          UI State (Ephemeral)
━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━
node cpu: CPU                  cpu: {expanded: true, layoutHint: {...}}
node alu: ALU                  alu: {expanded: false}
wire cpu.alu_out -> alu.a      (visual wire routing)
```

**The DSL describes WHAT exists, not HOW it's visualized.**

### Expansion State MUST NOT be in DSL
Why?
1. **Simulation independence**: Expansion doesn't affect behavior
2. **Multi-user**: Different users may want different views
3. **Ephemeral preferences**: User might expand/collapse frequently
4. **LLM generation**: LLMs should generate behavior, not layout

**Expansion state lives in**:
- UI component state (React state)
- Optional: User preferences JSON (saved layouts)
- Optional: Canvas metadata file (separate from DSL)

---

## Concrete Architecture Recommendation

### Data Model

```typescript
// DSL-derived (immutable during simulation)
interface IRNode {
  id: string;
  type: string;  // "CPU", "ALU", "AND", etc.
  definition?: ComponentDefinition;  // Reference to definition
  ports: IRPort[];
  // NO expansion state here!
}

// UI State (mutable, canvas-specific)
interface CanvasNodeState {
  nodeId: string;
  position: {x: number, y: number};
  expanded: boolean;  // <-- THIS IS UI STATE
  layoutHint?: 'grid' | 'flow' | 'manual';
  // Visual-only metadata
}

// Canvas State (per-component-definition)
interface CanvasState {
  componentId: string;  // Which component definition we're viewing
  nodes: CanvasNodeState[];
  wires: WireRouting[];
  viewport: {zoom: number, pan: {x, y}};
}
```

### Navigation Model (MVP)

```
User's Canvas View
┌─────────────────────────────────────┐
│ Breadcrumb: Main > CPU             │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │   ALU    │─────>│ Register │   │
│  │  [box]   │      │   File   │   │
│  └──────────┘      └──────────┘   │
│       ▲                             │
│       │                             │
│  ┌────┴─────┐                      │
│  │ Control  │                      │
│  │   Unit   │                      │
│  └──────────┘                      │
│                                     │
│  Double-click ALU to view inside   │
└─────────────────────────────────────┘
```

After double-clicking ALU:

```
User's Canvas View
┌─────────────────────────────────────┐
│ Breadcrumb: Main > CPU > ALU       │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │  Adder   │─────>│ Shifter  │   │
│  │   [box]  │      │  [box]   │   │
│  └──────────┘      └──────────┘   │
│       ▲                  │         │
│       │                  ▼         │
│  ┌────┴─────┐      ┌──────────┐   │
│  │   Mux    │<─────│  Compare │   │
│  │  [box]   │      │   [box]  │   │
│  └──────────┘      └──────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

### Expansion Model (Phase 2)

Right-click ALU → "Expand In Place":

```
User's Canvas View
┌─────────────────────────────────────┐
│ Breadcrumb: Main > CPU             │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ALU (expanded)              │   │
│  │ ┌────────┐    ┌──────────┐ │   │
│  │ │ Adder  │───>│ Shifter  │─┼──>│
│  │ └────────┘    └──────────┘ │   │
│  └─────────────────────────────┘   │
│       ▲                             │
│  ┌────┴─────┐                      │
│  │ Control  │                      │
│  └──────────┘                      │
└─────────────────────────────────────┘
```

**Key**: Expanded view shows components with **visual container** indicating hierarchy.

---

## Answers to Specific Questions

### 1. When user has `node cpu: CPU` on canvas, what do they SEE?

**Answer**: **A) Single black box labeled "CPU" with ports** (by default)

**Reasoning**:
- Matches Logisim/Digital mental model
- Prevents canvas clutter
- User explicitly navigates deeper (double-click)
- **Expansion is opt-in, not automatic**

**Optional**: User can right-click → "Expand In Place" to see internals without navigation.

---

### 2. What does the DSL represent?

**Answer**: **The logical structure (always references CPU)**

**DSL**:
```
component Main {
  node cpu: CPU
  node ram: RAM
  wire cpu.mem_addr -> ram.addr
}
```

This DSL **always** means:
- There exists a node of type CPU
- It is connected to a RAM node
- **Regardless** of whether UI shows it expanded or collapsed

**The DSL is invariant to visualization state.**

---

### 3. How do users navigate hierarchy?

**Answer**: **Primary: "Enter" component (Logisim-style); Secondary: Expand/collapse in-place**

**MVP (Phase 1)**:
- Double-click component instance → navigate to definition canvas
- Breadcrumb navigation to go back up
- Each component definition has ONE canonical canvas

**Phase 2 (Enhancement)**:
- Right-click → "Expand In Place" → shows internals on current canvas
- Collapse back to black box
- Expansion state is **per-instance, per-canvas** (ephemeral)

---

### 4. At what abstraction level should components appear?

**Answer**: **User-defined, with smart defaults**

**Default Behavior**:
- Primitives (AND, OR, NOT, etc.) → always shown as single boxes
- Custom components → shown as black boxes by default
- User can expand any component to see internals

**Smart Defaults** (optional heuristic):
- Components with >20 internal nodes → default collapsed
- Components with <5 internal nodes → **maybe** default expanded?
- Let user set "default expansion" per component type in settings

**Example**:
- RAM (1000s of flip-flops inside) → ALWAYS default collapsed
- ALU (10-20 components inside) → default collapsed, user can expand
- FullAdder (5 gates inside) → user's choice

---

## Implementation Roadmap

### MVP (Phase 1): Subcircuit Navigation Only

**What to build**:
1. **Component Definition Canvas**
   - Each component has a canvas view
   - Shows internal nodes as black boxes
   - Wiring between internals

2. **Instance Navigation**
   - Double-click component instance → navigate to definition canvas
   - Breadcrumb navigation at top
   - "Back" button

3. **DSL Generation**
   - DSL always references component types
   - No expansion metadata in DSL

**Data Structure**:
```typescript
interface EditorState {
  currentCanvas: string;  // Which component we're viewing
  canvasStack: string[];  // For breadcrumb navigation
  canvasStates: Map<string, CanvasState>;  // Per-component layout
}
```

---

### Phase 2: In-Place Expansion

**What to add**:
1. **Expansion Toggle**
   - Right-click menu: "Expand In Place" / "Collapse"
   - Visual container around expanded internals

2. **Layout Management**
   - Auto-layout expanded internals (grid or flow)
   - Manual drag to adjust

3. **Wire Routing**
   - Wires connect to expanded internals
   - Visual grouping indicates hierarchy

**Data Structure**:
```typescript
interface CanvasNodeState {
  nodeId: string;
  position: {x: number, y: number};
  expanded: boolean;  // <-- NEW
  expandedLayout?: {
    internalPositions: Map<string, {x, y}>;
    boundingBox: {width, height};
  };
}
```

---

## Critical Design Decisions

### Decision 1: Expansion State Storage

**DECISION**: Expansion state is **UI state only**, never in DSL.

**Storage Options**:
- **Option A** (MVP): React state only (lost on refresh)
- **Option B**: LocalStorage/IndexedDB (persisted per-project)
- **Option C**: Separate `.canvas.json` file (saved with project, not in DSL)

**Recommendation**: Option A for MVP, Option C for production.

---

### Decision 2: Visual Editor Drag Behavior

**DECISION**: When user drags component from palette, it appears **collapsed by default**.

**Why?**
- Prevents canvas clutter
- User can expand if needed
- Matches industry tools (Logisim, Digital)

**Workflow**:
1. User drags "ALU" from palette onto canvas
2. ALU appears as black box with ports
3. User can:
   - Wire it up immediately (common case)
   - Double-click to view/edit internals
   - Right-click → Expand In Place (Phase 2)

---

### Decision 3: DSL ↔ Canvas Synchronization

**DECISION**: DSL is **write-only from canvas** (canvas state is derived from DSL + UI state).

**Data Flow**:
```
User edits canvas
    ↓
Canvas generates DSL (structural changes only)
    ↓
DSL is parsed → IR
    ↓
IR is rendered to canvas + UI state (expansion, positions)
    ↓
User sees updated canvas
```

**Key Invariant**:
- Changing expansion state does NOT regenerate DSL
- Only structural changes (add node, wire, etc.) regenerate DSL

---

## Example: Complete User Flow

### Scenario: User builds a CPU and wants to debug ALU

**Step 1**: User creates CPU component
- Canvas shows: Main (empty)
- User drags "CPU" from palette
- CPU appears as black box

**Step 2**: User wants to see CPU internals
- User double-clicks CPU
- Canvas now shows: Main > CPU
- Sees: ALU, RegisterFile, ControlUnit as boxes

**Step 3**: User wants to debug ALU output
- User double-clicks ALU
- Canvas now shows: Main > CPU > ALU
- Sees: Adder, Shifter, Mux, etc. as boxes

**Step 4**: User realizes Adder is wrong
- User double-clicks Adder
- Canvas now shows: Main > CPU > ALU > Adder
- Sees: 8 FullAdder instances
- User edits wiring

**Step 5**: User goes back to high level
- User clicks breadcrumb "Main"
- Back to top-level view with CPU as black box

---

### Alternative Flow (Phase 2): In-place expansion

**Step 1-2**: Same as above

**Step 3**: User wants to see ALU internals **without leaving CPU canvas**
- User right-clicks ALU → "Expand In Place"
- ALU box expands to show Adder, Shifter, etc. **on CPU canvas**
- Wires from ControlUnit connect to expanded Adder

**Step 4**: User collapses ALU
- User right-clicks expanded ALU → "Collapse"
- ALU returns to black box
- Wires still connected

---

## Visual Mockup (Text-Based)

### Canvas View: Main Component

```
┌─────────────────────────────────────────────────────────┐
│ Turing Incomplete                                       │
│ Breadcrumb: Main                                        │
├─────────────────────────────────────────────────────────┤
│ Component Palette         │  Canvas                     │
│ ┌──────────────┐         │                             │
│ │ Primitives   │         │   ┌──────────────┐          │
│ │  - AND       │         │   │              │          │
│ │  - OR        │         │   │     CPU      │          │
│ │  - NOT       │         │   │              │          │
│ │  - XOR       │         │   │  in[8]  out[8]         │
│ │              │         │   │   ○      ○   │          │
│ │ Components   │         │   │   ○ clk      │          │
│ │  - CPU  ←drag│         │   └──────────────┘          │
│ │  - ALU       │         │          ▲                   │
│ │  - RAM       │         │          │                   │
│ │  - Register  │         │          │ (wire)            │
│ │              │         │   ┌──────┴───────┐          │
│ └──────────────┘         │   │     RAM      │          │
│                          │   │              │          │
│                          │   │ addr    data │          │
│                          │   │  ○        ○  │          │
│                          │   └──────────────┘          │
│                          │                             │
│                          │  [Double-click CPU to       │
│                          │   view internals]           │
└─────────────────────────────────────────────────────────┘
```

---

### Canvas View: CPU Component (after double-clicking)

```
┌─────────────────────────────────────────────────────────┐
│ Turing Incomplete                                       │
│ Breadcrumb: Main > CPU                    [← Back]     │
├─────────────────────────────────────────────────────────┤
│ Component Palette         │  Canvas (CPU internals)     │
│ ┌──────────────┐         │                             │
│ │ ...          │         │   ┌──────────┐              │
│ │              │         │   │   ALU    │              │
│ │              │         │   │          │              │
│ │              │         │   │ a  out   │              │
│ │              │         │   │ ○   ○────┼─────────────>│
│ │              │         │   │ ○        │    (to out)  │
│ │              │         │   └──────────┘              │
│ │              │         │        ▲                     │
│ │              │         │        │                     │
│ │              │         │   ┌────┴──────┐             │
│ │              │         │   │ Register  │             │
│ │              │         │   │   File    │             │
│ │              │         │   │           │             │
│ │              │         │   │  out  in  │             │
│ │              │         │   │   ○   ○   │             │
│ │              │         │   └───────────┘             │
│ │              │         │                             │
│ │              │         │  [Right-click ALU for       │
│ │              │         │   Expand/Collapse menu]     │
│ │              │         │  [Double-click ALU to       │
│ │              │         │   view ALU internals]       │
└─────────────────────────────────────────────────────────┘
```

---

### Canvas View: ALU Expanded In-Place (Phase 2)

```
┌─────────────────────────────────────────────────────────┐
│ Turing Incomplete                                       │
│ Breadcrumb: Main > CPU                    [← Back]     │
├─────────────────────────────────────────────────────────┤
│ Component Palette         │  Canvas (CPU internals)     │
│ ┌──────────────┐         │                             │
│ │ ...          │         │   ┌───────────────────────┐ │
│ │              │         │   │ ALU (expanded)        │ │
│ │              │         │   │ ┌────────┐ ┌────────┐│ │
│ │              │         │   │ │ Adder  │ │Shifter ││ │
│ │              │         │   │ │  ○  ○──┼─┤○    ○──┼┼─>│
│ │              │         │   │ └────────┘ └────────┘│ │
│ │              │         │   │     ▲                 │ │
│ │              │         │   │     │ ┌────────┐     │ │
│ │              │         │   │     └─│  Mux   │     │ │
│ │              │         │   │       │  ○  ○  │     │ │
│ │              │         │   │       └────────┘     │ │
│ │              │         │   └───────────────────────┘ │
│ │              │         │        ▲                     │
│ │              │         │        │                     │
│ │              │         │   ┌────┴──────┐             │
│ │              │         │   │ Register  │             │
│ │              │         │   │   File    │             │
│ └──────────────┘         │   └───────────┘             │
│                          │                             │
│                          │  [Right-click ALU →         │
│                          │   "Collapse" to close]      │
└─────────────────────────────────────────────────────────┘
```

---

## Code Structure (TypeScript Interfaces)

```typescript
// ============================================
// DSL-Derived Data (Immutable during view)
// ============================================

interface ComponentDefinition {
  id: string;
  name: string;
  ports: PortDefinition[];
  internals: {
    nodes: ComponentNode[];
    wires: WireDefinition[];
  };
}

interface ComponentNode {
  id: string;
  type: string;  // References another ComponentDefinition
  // NO position, NO expansion state!
}

// ============================================
// UI State (Mutable, ephemeral)
// ============================================

interface EditorState {
  // Navigation
  currentComponentId: string;  // Which component canvas we're viewing
  breadcrumb: string[];  // ["Main", "CPU", "ALU"]

  // Canvas states (one per component definition)
  canvasStates: Map<string, CanvasState>;
}

interface CanvasState {
  componentId: string;
  nodes: Map<string, CanvasNodeState>;
  wires: WireVisual[];
  viewport: {
    zoom: number;
    pan: {x: number, y: number};
  };
}

interface CanvasNodeState {
  nodeId: string;  // Links to ComponentNode.id
  position: {x: number, y: number};

  // Phase 2: Expansion
  expanded: boolean;
  expandedLayout?: {
    // Auto-layout or manual positions for internals
    internalNodes: Map<string, {x: number, y: number}>;
    boundingBox: {width: number, height: number};
  };
}

// ============================================
// Persistence (Optional)
// ============================================

interface ProjectMetadata {
  dsl: string;  // The source of truth
  canvasLayout?: {
    // Optional saved layouts (NOT required for simulation)
    [componentId: string]: {
      nodePositions: {[nodeId: string]: {x: number, y: number}};
      // NO expansion state in saved metadata (too ephemeral)
    };
  };
}
```

---

## Summary: Architecture Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Default View** | Collapsed (black box) | Prevents clutter, matches Logisim |
| **Navigation** | Subcircuit enter/exit (MVP) | Clean mental model, easy to implement |
| **Expansion** | Optional in-place (Phase 2) | Power-user feature, not MVP-critical |
| **DSL Content** | Structure only, NO expansion state | DSL is source of truth for behavior, not UI |
| **Expansion Storage** | UI state (React), optionally persisted | Ephemeral preference, not simulation-critical |
| **Drag from Palette** | Always collapsed | Prevents accidental complexity |
| **Abstraction Level** | User-controlled | Context-dependent; no "correct" default |

---

## Final Recommendation

**MVP Implementation**:
1. Build Logisim-style subcircuit navigation
2. Each component has a canvas view
3. Double-click to enter/exit components
4. Breadcrumb navigation
5. **NO in-place expansion yet**

**Why this first?**
- Simplest to implement
- Matches user expectations from Logisim
- Cleanly separates DSL from UI state
- Sufficient for 90% of use cases

**Phase 2** (after MVP is stable):
- Add right-click → "Expand In Place"
- Implement auto-layout for expanded internals
- Add visual grouping for hierarchy
- Save expansion preferences

**This approach**:
- Keeps DSL clean and simulation-focused
- Gives users control over abstraction
- Prevents canvas clutter by default
- Scales to complex hierarchies
- Matches industry best practices

---

## Questions for User

1. **Does the "subcircuit navigation" (Logisim-style) model feel right for MVP?**
2. **Do you want in-place expansion in Phase 1, or is it okay to defer?**
3. **Should expansion state be saved to disk, or only in-memory during session?**
4. **Any other navigation patterns you've seen that you like/dislike?**

