# Primitive Component Architecture

## Overview

This document explains how primitive components are defined, created, and managed in the system. It addresses the architectural changes made to eliminate hacky type checking and create a maintainable, extensible system.

## Problem Statement

Previously, we had a fragmented primitive component system:

1. **Old enum-based system** (`ir.ts`): Only 13 primitive types using SCREAMING_SNAKE_CASE naming
2. **New array-based system** (`primitives.ts`): 31+ primitives using PascalCase naming
3. **Hacky workaround**: Individual if statements in `ir-store.ts` checking for HexDisplay, SevenSegment, etc.

This created:
- Type safety issues
- Maintenance burden (adding primitives required updates in multiple places)
- Naming inconsistencies
- Unclear source of truth

## Solution Architecture

### Single Source of Truth: `primitives.ts`

All primitive components are now defined in a single place:

```typescript
// primitives.ts
export const PRIMITIVES: Circuit[] = [
  createPrimitiveCircuit('And', [...], [...], 'Logical AND gate'),
  createPrimitiveCircuit('HexDisplay', [...], [...], 'Hex display'),
  // ... all 31+ primitives
];
```

### Dynamic Component Creation

The `createPrimitiveComponent()` function handles **all** primitive types:

```typescript
// primitives.ts
export function createPrimitiveComponent(
  id: string,
  type: string,
  initialValue?: boolean | number
): Record<string, any> | null {
  // Verify this is a primitive
  const primitive = getPrimitiveCircuit(type);
  if (!primitive) return null;

  // Create component with proper initial state
  const component: Record<string, any> = { id, type };

  switch (type) {
    case 'Switch': component.value = initialValue ?? false; break;
    case 'HexDisplay': component.value = 0; component.width = 8; break;
    // ... other stateful/parameterized components
  }

  return component;
}
```

### Component Resolution Flow

When adding a component to the IR:

```
User requests component type "HexDisplay"
         ↓
ir-store.ts: addComponent("HexDisplay")
         ↓
1. Check component library (user-defined components)
         ↓ (not found)
2. Call createPrimitiveComponent("HexDisplay")
         ↓
   primitives.ts: lookup in PRIMITIVES array
         ↓
   Found! Create component with { id, type: "HexDisplay", value: 0, width: 8 }
         ↓
Return component to IR store
```

**No more switch statements in ir-store.ts!**
**No more individual if statements for each type!**

## Naming Conventions

We have two naming systems for historical reasons:

### Legacy System (SCREAMING_SNAKE_CASE)
Used in older code and IR types:
- `AND_GATE`, `OR_GATE`, `NOT_GATE`
- `SWITCH`, `LED`, `INPUT`
- `D_FLIP_FLOP`, `REGISTER`, `RAM`

### New System (PascalCase)
Used in `primitives.ts` and new code:
- `And`, `Or`, `Not`
- `Switch`, `Led`, `Input`
- `DFlipFlop`, `Register`, `RAM`
- `HexDisplay`, `SevenSegment` (these were never in legacy system)

### Mapping

The `primitive-metadata.ts` file maps between these systems:

```typescript
export const PRIMITIVE_METADATA: Record<string, PrimitiveMetadata> = {
  // PascalCase name -> legacy ComponentType
  And: { category: '...', icon: '&', componentType: 'AND_GATE' },
  HexDisplay: { category: '...', icon: '🖥', componentType: 'HexDisplay' },
};
```

**New primitives should use PascalCase** (they don't need legacy names).

## Type System Updates

### Before (Hacky)
```typescript
export type PrimitiveComponentType =
  | 'SWITCH' | 'LED' | 'AND_GATE' // ... only 13 types

// In ir-store.ts:
default:
  if (type === 'HexDisplay') {
    return { id, type: 'HexDisplay', value: 0, width: 8 };
  }
  if (type === 'SevenSegment') {
    return { id, type: 'SevenSegment', value: 0 };
  }
  throw new Error(`Unknown component type: ${type}`);
```

### After (Clean)
```typescript
// Legacy type for backward compatibility
export type LegacyPrimitiveComponentType =
  | 'SWITCH' | 'LED' | 'AND_GATE' // ...

// Modern type (allows all primitives)
export type PrimitiveComponentType = string;

// Dynamic lookup from primitives.ts
export function isPrimitiveComponentType(type: ComponentType): boolean {
  const { isPrimitive } = require('../lib/primitives');
  return isPrimitive(type); // Checks PRIMITIVES array
}

// In ir-store.ts:
const primitiveComponent = createPrimitiveComponent(id, type, initialValue);
if (primitiveComponent) {
  return primitiveComponent as Component;
}
throw new Error(`Unknown component type: ${type}`);
```

## Adding New Primitives

To add a new primitive component:

### 1. Define in `primitives.ts`

```typescript
// Add evaluator
export const PRIMITIVE_EVALUATORS = {
  MyNewComponent: createCombinationalEvaluator((inputs) => {
    // evaluation logic
  }),
};

// Add to PRIMITIVES array
export const PRIMITIVES: Circuit[] = [
  // ...
  createPrimitiveCircuit(
    'MyNewComponent',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Description of my component'
  ),
];

// If it needs initial state, add to createPrimitiveComponent():
export function createPrimitiveComponent(id, type, initialValue) {
  // ...
  switch (type) {
    // ...
    case 'MyNewComponent':
      component.value = initialValue ?? 0;
      break;
  }
}
```

### 2. Add metadata in `primitive-metadata.ts`

```typescript
export const PRIMITIVE_METADATA = {
  // ...
  MyNewComponent: {
    category: PRIMITIVE_CATEGORIES.UTILITIES,
    icon: '🆕',
    componentType: 'MyNewComponent',
  },
};
```

### 3. That's it!

The component will automatically:
- Be available in the component palette
- Work with `addComponent()`
- Have proper port specifications
- Be recognized as a primitive
- Evaluate correctly in simulation

## Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `primitives.ts` | **Source of truth** - All primitive definitions, evaluators, circuit specs |
| `ir.ts` | Type definitions, legacy compatibility, helper functions |
| `ir-store.ts` | Component creation orchestration (delegates to `primitives.ts`) |
| `primitive-metadata.ts` | UI metadata (icons, categories) - presentation layer only |
| `simulator.ts` | Uses legacy type checking (will be migrated to new system) |

## Migration Path

The system is designed for gradual migration:

1. **Phase 1 (Complete)**: New primitives use PascalCase, `createPrimitiveComponent()` handles all types
2. **Phase 2 (In Progress)**: Update type checking to use dynamic lookup
3. **Phase 3 (Future)**: Migrate simulator to use new IR v0.1 system completely
4. **Phase 4 (Future)**: Remove legacy SCREAMING_SNAKE_CASE types entirely

## Design Principles

1. **Single Source of Truth**: `primitives.ts` is authoritative for all primitive definitions
2. **Explicit over Implicit**: State initialization is explicit in `createPrimitiveComponent()`
3. **Fail Fast**: Unknown types return `null` / throw errors immediately
4. **Type Safety**: TypeScript ensures compile-time safety where possible
5. **Extensibility**: Adding primitives requires minimal changes
6. **Backward Compatibility**: Legacy code continues to work during migration

## Benefits

### Before
- Adding HexDisplay required changes in 3+ files
- Type checking was scattered across codebase
- Easy to miss a case and get runtime errors
- No clear source of truth

### After
- Adding a primitive requires changes in 2 files (primitives.ts + metadata.ts)
- Type checking centralized in `primitives.ts`
- Dynamic lookup prevents missed cases
- Clear architectural boundaries

## Testing Strategy

All primitive components should be tested through:

1. **Unit tests**: `createPrimitiveComponent()` returns correct initial state
2. **Integration tests**: Components work in IR store and simulator
3. **Type tests**: TypeScript catches invalid component types at compile time

Example test:

```typescript
describe('createPrimitiveComponent', () => {
  it('creates HexDisplay with correct initial state', () => {
    const component = createPrimitiveComponent('test-id', 'HexDisplay');
    expect(component).toEqual({
      id: 'test-id',
      type: 'HexDisplay',
      value: 0,
      width: 8,
    });
  });

  it('returns null for unknown types', () => {
    const component = createPrimitiveComponent('test-id', 'UnknownType');
    expect(component).toBeNull();
  });
});
```

## Related Documents

- [IR v0.1 Specification](./ir-v0.1-spec.md)
- [Primitive Interface](../src/features/visual-editor/lib/primitive-interface.ts)
- [Sequential Circuits Implementation](./SEQUENTIAL_CIRCUITS_IMPLEMENTATION.md)
