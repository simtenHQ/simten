# Phase 3 Architecture: DSL Editor Integration

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VisualEditor (Root)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Tab Bar (Visual | DSL)                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │   Visual Mode        │  │     DSL Mode             │   │
│  │                      │  │                          │   │
│  │  ┌────────────────┐ │  │  ┌─────────────────────┐ │   │
│  │  │ComponentPalette│ │  │  │   DSLEditor         │ │   │
│  │  │  (Primitives)  │ │  │  │  ┌──────────────┐   │ │   │
│  │  └────────────────┘ │  │  │  │ Monaco       │   │ │   │
│  │                      │  │  │  │ Editor       │   │ │   │
│  │  ┌────────────────┐ │  │  │  │ (Syntax      │   │ │   │
│  │  │   Canvas       │ │  │  │  │  Highlight)  │   │ │   │
│  │  │  (React Flow)  │ │  │  │  └──────────────┘   │ │   │
│  │  │                │ │  │  │  ┌──────────────┐   │ │   │
│  │  └────────────────┘ │  │  │  │CompileButton │   │ │   │
│  │                      │  │  │  └──────────────┘   │ │   │
│  │  ┌────────────────┐ │  │  │  ┌──────────────┐   │ │   │
│  │  │  Test Panel    │ │  │  │  │ErrorDisplay  │   │ │   │
│  │  └────────────────┘ │  │  │  └──────────────┘   │ │   │
│  │                      │  │  └─────────────────────┘ │   │
│  └──────────────────────┘  │                          │   │
│                             │  ┌─────────────────────┐ │   │
│                             │  │ ComponentLibrary    │ │   │
│                             │  │ ┌─────────────────┐ │ │   │
│                             │  │ │ User Tab       │ │ │   │
│                             │  │ ├─────────────────┤ │ │   │
│                             │  │ │ Standard Tab   │ │ │   │
│                             │  │ ├─────────────────┤ │ │   │
│                             │  │ │ Primitives Tab │ │ │   │
│                             │  │ └─────────────────┘ │ │   │
│                             │  └─────────────────────┘ │   │
│                             └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: DSL Compilation

```
┌──────────────┐
│ User Types   │
│ DSL Code     │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Monaco Editor    │
│ (Syntax HL)      │
└──────┬───────────┘
       │
       ▼ [User Clicks Compile]
┌──────────────────┐
│ DSLEditor.tsx    │
│ handleCompile()  │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ DSL Compilation Pipeline             │
│                                      │
│  Text → Lexer → Parser → Validator  │
│         ↓       ↓         ↓          │
│       Tokens   AST    Validated AST  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ IR Generator (Compiler)              │
│ + Component Library (Primitives)     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Result: Circuit[] | Error[]          │
└──────────────┬───────────────────────┘
               │
               ├─── Success ────────────┐
               │                        │
               ▼                        ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ registerUser()   │    │ Success Message  │
    │ Component Store  │    │ "Compiled X comp"│
    └────────┬─────────┘    └──────────────────┘
             │
             ▼
    ┌──────────────────┐
    │ Component Library│
    │ UI Updates       │
    │ (User Tab)       │
    └──────────────────┘
               │
               └─── Error ─────────────┐
                                       │
                                       ▼
                            ┌──────────────────┐
                            │ ErrorDisplay     │
                            │ Shows line:col   │
                            └──────────────────┘
```

## Store Architecture

```
┌──────────────────────────────────────────────────────────┐
│           ComponentLibraryStore (Zustand)                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  library: ComponentLibrary                     │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │ primitives: Map<string, Circuit>         │  │    │
│  │  │  - And, Or, Not, Xor, Nand, Nor, etc.   │  │    │
│  │  │  - Switch, Led                            │  │    │
│  │  │  - BusAnd, BusOr, BusNot, BusXor         │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │ standard: Map<string, Circuit>           │  │    │
│  │  │  - (Future: HalfAdder, FullAdder, etc.) │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │ user: Map<string, Circuit>               │  │    │
│  │  │  - User-compiled DSL components          │  │    │
│  │  │  - Dynamically added/removed             │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Actions:                                                │
│  - registerPrimitive(circuit)                           │
│  - registerStandard(circuit)                            │
│  - registerUser(circuit)                                │
│  - removeUser(name)                                     │
│  - resolveComponent(name) → Circuit | undefined         │
│  - getAllPrimitiveNames() → string[]                    │
│  - getAllStandardNames() → string[]                     │
│  - getAllUserNames() → string[]                         │
│                                                          │
└──────────────────────────────────────────────────────────┘

Resolution Order: primitives → standard → user
```

## Monaco Editor Configuration

```javascript
// Language Registration
monaco.languages.register({ id: 'dsl' });

// Syntax Highlighting Rules
monaco.languages.setMonarchTokensProvider('dsl', {
  keywords: [
    'component', 'input', 'output', 'clock', 'state',
    'bit', 'bus', 'memory', 'gate', 'instance',
    'connect', 'on', 'rising', 'falling'
  ],
  tokenizer: {
    root: [
      [/\/\/.*/, 'comment'],
      [/\b(component|input|output)\b/, 'keyword'],
      [/\b(bit|bus|memory)\b/, 'type'],
      // ... more rules
    ]
  }
});

// Custom Theme
monaco.editor.defineTheme('dsl-theme', {
  base: 'vs',
  rules: [
    { token: 'comment', foreground: '6a9955' },
    { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
    { token: 'type', foreground: '267f99' },
    // ... more rules
  ]
});
```

## Component Library Interface

```typescript
// Compiler Interface (from DSL compiler)
interface ComponentLibrary {
  getCircuit(name: string): Circuit | undefined;
  hasCircuit(name: string): boolean;
}

// Store Adapter (in DSLEditor)
const library = {
  getCircuit: (name: string) => resolveComponent(name),
  hasCircuit: (name: string) => resolveComponent(name) !== undefined,
};

// Resolution Flow
User types: "gate And(a, b) -> out"
              ↓
Compiler calls: library.getCircuit("And")
              ↓
Store resolves: primitives.get("And")
              ↓
Returns: Circuit { name: "And", inputs: [...], ... }
```

## Initialization Flow

```
App Starts
    ↓
VisualEditor mounts
    ↓
usePrimitivesInit() hook runs
    ↓
Check: getAllPrimitiveNames().length === 0 ?
    ↓
Yes: Initialize primitives
    ↓
getPrimitives() → Circuit[]
    ↓
registerPrimitives(circuits)
    ↓
Store populated with 12+ primitives
    ↓
Available for DSL compilation
    ↓
Available in ComponentLibrary UI (Primitives tab)
```

## Error Handling Flow

```
DSL Code with Error
    ↓
Lexer → Tokens (may have lexer errors)
    ↓
Parser → AST (may have parse errors)
    ↓
Validator → Validation errors
    ↓
Compiler → Compilation errors (e.g., unknown component)
    ↓
Return: { circuits: [], errors: [...] }
    ↓
DSLEditor.tsx:
  - setErrors(result.errors)
  - Display in ErrorDisplay component
    ↓
ErrorDisplay shows:
  - Line:Column for each error
  - Error message
  - Red highlighting
  - Scrollable list
```

## Key Integration Points

1. **Monaco ↔ DSL Compiler**: Text input to compilation
2. **Compiler ↔ Component Store**: Component resolution during compilation
3. **DSLEditor ↔ Component Store**: Registering compiled components
4. **ComponentLibrary ↔ Component Store**: Displaying registered components
5. **Visual Editor ↔ DSL Editor**: Tab-based mode switching

## Performance Considerations

1. **Async Compilation**: Uses `setTimeout` to keep UI responsive
2. **Debounced Search**: ComponentLibrary search debounced to 200ms
3. **Lazy Rendering**: Component details only shown when expanded
4. **Map Storage**: O(1) lookup for component resolution
5. **Immer with MapSet**: Efficient immutable updates to Map/Set
