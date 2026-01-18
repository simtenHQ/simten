# Component Palette - User Guide

## Overview

The improved Component Palette organizes circuit components into logical, collapsible categories with smooth hover-based expansion. This makes it easier to find and use components as your circuit library grows.

## Visual Layout

```
┌─────────────────────────────────────────────┐
│ Components                                  │
│ Hover to expand, drag or click to add      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ ⚡  Input/Output            2 ▼     │  │ ← Category Header (Collapsed)
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ &   Basic Gates            4 ▲     │  │ ← Category Header (Expanded)
│  └──────────────────────────────────────┘  │
│     ┌─────────────────────────────────┐    │
│     │ &  AND Gate          2i / 1o   │    │ ← Component Item
│     └─────────────────────────────────┘    │
│     ┌─────────────────────────────────┐    │
│     │ ≥1 OR Gate           2i / 1o   │    │
│     └─────────────────────────────────┘    │
│     ┌─────────────────────────────────┐    │
│     │ ¬  NOT Gate          1i / 1o   │    │
│     └─────────────────────────────────┘    │
│     ┌─────────────────────────────────┐    │
│     │ ▷  Buffer            1i / 1o   │    │
│     └─────────────────────────────────┘    │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ ⊕  Advanced Gates          4 ▼     │  │
│  └──────────────────────────────────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│ Tip: Hover over a category to see          │
│      available components                  │
└─────────────────────────────────────────────┘
```

## Component Categories

### 1. Input/Output (2 components)
Essential components for interacting with your circuit:

- **Switch (⚡)**: User-controlled input
  - Outputs: 1
  - Click on canvas to toggle ON/OFF
  - Primary input source for testing circuits

- **LED (💡)**: Visual output indicator
  - Inputs: 1
  - Lights up when receiving ON signal
  - Essential for viewing circuit results

### 2. Basic Gates (4 components)
Fundamental building blocks of digital logic:

- **AND Gate (&)**: Logical AND operation
  - Inputs: 2 (A, B)
  - Outputs: 1
  - ON when both inputs are ON

- **OR Gate (≥1)**: Logical OR operation
  - Inputs: 2 (A, B)
  - Outputs: 1
  - ON when at least one input is ON

- **NOT Gate (¬)**: Logical inversion
  - Inputs: 1
  - Outputs: 1
  - Inverts the input signal

- **Buffer (▷)**: Signal pass-through
  - Inputs: 1
  - Outputs: 1
  - Passes signal unchanged (useful for timing/buffering)

### 3. Advanced Gates (4 components)
Complex logic operations for sophisticated circuits:

- **NAND Gate (⊼)**: Universal gate (NOT-AND)
  - Inputs: 2 (A, B)
  - Outputs: 1
  - OFF only when both inputs are ON
  - Can build any logic circuit using only NAND gates

- **NOR Gate (⊽)**: Universal gate (NOT-OR)
  - Inputs: 2 (A, B)
  - Outputs: 1
  - ON only when both inputs are OFF
  - Can build any logic circuit using only NOR gates

- **XOR Gate (⊕)**: Exclusive OR
  - Inputs: 2 (A, B)
  - Outputs: 1
  - ON when inputs are different
  - Key component in arithmetic circuits

- **XNOR Gate (⊙)**: Exclusive NOR (equivalence)
  - Inputs: 2 (A, B)
  - Outputs: 1
  - ON when inputs are the same
  - Useful for equality checking

## How to Use

### Expanding Categories

1. **Hover over a category** to expand it
   - Smooth 300ms animation
   - Items appear with staggered delay for visual polish
   - Category border turns blue
   - Arrow indicator rotates 180°

2. **Move mouse away** to collapse
   - Group collapses automatically
   - Exception: Group stays open while dragging

### Adding Components to Canvas

#### Method 1: Drag and Drop (Recommended)
1. Hover over category to expand
2. Click and hold on desired component
3. Drag to canvas position
4. Release to place component
5. Group collapses after drag completes

**Drag Features:**
- Group stays expanded during drag
- Visual feedback on component being dragged
- Drop anywhere on canvas
- Tooltip hidden during drag

#### Method 2: Click to Add
1. Hover over category to expand
2. Click on desired component
3. Component appears at center of canvas (250, 250)
4. Reposition manually as needed

**When to use:**
- Quick addition without precise positioning
- Adding multiple components rapidly
- Keyboard/mouse workflow preference

### Component Information

**Hover tooltips** provide detailed information:
- Full component name
- Functional description
- Input ports with labels
- Output ports with labels
- Appears after 300ms hover delay
- Positioned to right of component

**Quick info** visible on component card:
- Component name
- Input/output count (e.g., "2i / 1o")
- Icon representation

## Interaction Details

### Visual Feedback

**Category Headers:**
- Default: Gray border, subtle gradient
- Hovered: Blue border, enhanced shadow
- Arrow rotates smoothly on expand/collapse

**Component Items:**
- Default: Light gray border
- Hovered: Blue border, lifted shadow
- Clicked: Scale down to 95%
- Indented 16px from left to show hierarchy

**Animations:**
- Category expansion: 300ms ease-in-out
- Arrow rotation: 300ms
- Component stagger: 30ms per item
- Border/shadow: 200ms

### Smart Behavior

**Drag State Management:**
- Group remains expanded while dragging
- Prevents accidental collapse mid-drag
- Auto-collapses when drag completes
- Smooth transition back to collapsed state

**Efficient Rendering:**
- Items remain in DOM when collapsed
- Uses CSS for show/hide (not mount/unmount)
- Better for drag-and-drop performance
- Minimal re-renders per category

## Keyboard Shortcuts (Future)

Currently being considered:
- `Tab` - Navigate between categories
- `Enter` - Expand/collapse focused category
- `Arrow Keys` - Navigate within expanded category
- `Space` - Add focused component to canvas
- `Ctrl+F` - Focus search box (when implemented)

## Tips and Best Practices

### Efficient Workflow
1. Learn category contents to reduce hover time
2. Use drag-and-drop for precise placement
3. Use click-to-add for rapid prototyping
4. Keep tooltip visible to verify component before adding

### Organization Principles
- **Input/Output**: Start and end of signal flow
- **Basic Gates**: Core logic building blocks
- **Advanced Gates**: Optimization and complex operations

### Common Patterns
1. **Simple logic**: Start with Switch → Basic Gate → LED
2. **Complex circuits**: Combine multiple basic gates
3. **Optimization**: Replace gate combinations with single advanced gates

## Troubleshooting

### Category won't expand
- Ensure mouse is fully over category header
- Check that JavaScript is enabled
- Try refreshing the page

### Drag and drop not working
- Ensure component is from expanded category
- Click and hold before dragging
- Check that canvas is ready to receive drops

### Component added in wrong position
- Use drag-and-drop instead of click
- Reposition manually after click-to-add
- Default position is (250, 250)

### Tooltip not appearing
- Wait full 300ms after hover
- Ensure mouse is over component, not whitespace
- Tooltip won't appear during drag

## Future Enhancements

Planned improvements based on user feedback:

1. **Search/Filter**
   - Quick search box at top of palette
   - Filter components by name or function
   - Highlight matching categories

2. **Favorites System**
   - Star frequently used components
   - Dedicated "Favorites" category at top
   - Persistent across sessions

3. **Custom Categories**
   - User-defined groupings
   - Drag components between categories
   - Save/load category configurations

4. **Keyboard Navigation**
   - Full keyboard accessibility
   - Shortcut keys for common components
   - Tab navigation support

5. **Click-to-Pin**
   - Click category header to keep expanded
   - Allow multiple categories open
   - Persist state in session storage

## Developer Notes

### File Location
`/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/components/ComponentPalette.tsx`

### Adding New Components

Edit `COMPONENT_CATEGORIES` array:

```typescript
{
  id: 'category-id',
  label: 'Display Name',
  icon: '📦', // Emoji or symbol
  description: 'What this category contains',
  items: [
    {
      type: 'COMPONENT_TYPE', // Must match ComponentType
      label: 'Component Name',
      description: 'What it does',
      icon: '🔧',
      inputs: [...], // Optional
      outputs: [...], // Optional
    },
  ],
}
```

### Animation Customization

**Timing adjustments** in ComponentGroup:
- Expansion speed: `duration-300` (line 220)
- Arrow rotation: `duration-300` (line 207)
- Item stagger: `index * 30` (line 244)
- Border transition: `duration-200` (line 193)

**Height limits** for categories:
- Current max: `max-h-[1000px]`
- Adjust if category exceeds ~20 items
- Consider splitting large categories

## Accessibility

Current accessibility features:
- High contrast mode compatible
- Screen reader friendly labels
- Semantic HTML structure
- Clear visual hierarchy

Future improvements:
- ARIA labels for expand/collapse state
- Keyboard navigation support
- Focus management
- Screen reader announcements

## Performance

Optimized for smooth interaction:
- CSS-based animations (GPU accelerated)
- Minimal JavaScript state changes
- Efficient event handling
- No unnecessary re-renders

Tested with:
- Categories: 3 current, up to 10 estimated
- Components per category: 2-4 current, up to 20 estimated
- Total components: 10 current, up to 50-100 estimated

## Feedback and Improvements

This design balances:
- Visual clarity vs. information density
- Discoverability vs. efficiency
- Simplicity vs. advanced features

User feedback welcome on:
- Category organization logic
- Interaction patterns
- Missing features
- Performance issues
