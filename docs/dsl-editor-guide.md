# DSL Editor User Guide

## Getting Started

The DSL Editor allows you to define custom circuit components using a text-based Domain Specific Language (DSL). These components can then be used in the visual editor or referenced by other DSL components.

## Accessing the DSL Editor

1. Open the application
2. Click the **DSL Editor** tab at the top of the screen
3. You'll see:
   - **Left Panel**: Monaco text editor with syntax highlighting
   - **Right Panel**: Component Library browser

## Writing Your First Component

### Basic Structure

Every component definition follows this structure:

```dsl
component ComponentName {
  // Input ports
  input portName: type

  // Output ports
  output portName: type

  // Circuit implementation
  gate GateName(inputs...) -> output
}
```

### Example: Simple AND Gate

```dsl
component MyAnd {
  input a: bit
  input b: bit
  output out: bit

  gate And(a, b) -> out
}
```

### Port Types

- **`bit`**: Single binary signal (0 or 1)
- **`bus<N>`**: Multi-bit signal with N bits (e.g., `bus<8>` for 8 bits)

### Using Primitive Gates

Available primitive gates:
- `And`, `Or`, `Not`, `Xor`
- `Nand`, `Nor`, `Xnor`
- `Buffer`

Example with multiple gates:

```dsl
component HalfAdder {
  input a: bit
  input b: bit
  output sum: bit
  output carry: bit

  gate Xor(a, b) -> sum
  gate And(a, b) -> carry
}
```

## Compiling Your Component

1. Write your DSL code in the editor
2. Click the **Compile** button (lightning bolt icon)
3. Watch for:
   - **Success**: Green banner showing "Successfully compiled N component(s)"
   - **Errors**: Red panel at bottom with line:column and error messages

### Compilation Success

When compilation succeeds:
- Your component is added to the Component Library
- It appears in the **User** tab of the library browser
- You can now use it in other components
- Success message auto-dismisses after 5 seconds

### Handling Errors

If compilation fails:
- Error panel shows at the bottom
- Each error shows line number and column
- Click the ✕ to dismiss errors
- Fix the errors and click Compile again

Common errors:
- **Unknown component**: Referenced gate/component doesn't exist
- **Type mismatch**: Connecting incompatible port types
- **Missing connection**: Unconnected required ports
- **Syntax error**: Invalid DSL syntax

## Component Instances

For more complex circuits, create instances of other components:

```dsl
component FullAdder {
  input a: bit
  input b: bit
  input cin: bit
  output sum: bit
  output cout: bit

  // Create component instances
  instance HalfAdder ha1
  instance HalfAdder ha2
  instance Or orGate

  // Connect them together
  connect a -> ha1.a
  connect b -> ha1.b
  connect ha1.sum -> ha2.a
  connect cin -> ha2.b
  connect ha2.sum -> sum
  connect ha1.carry -> orGate.a
  connect ha2.carry -> orGate.b
  connect orGate.out -> cout
}
```

### Instance Syntax

```dsl
instance ComponentType instanceName
```

### Connection Syntax

```dsl
connect source -> target
```

Sources and targets can be:
- Circuit input: `inputName`
- Circuit output: `outputName`
- Instance port: `instanceName.portName`

## Working with Buses

For multi-bit operations:

```dsl
component BusAdder {
  input a: bus<8>
  input b: bus<8>
  output sum: bus<8>

  gate BusAnd(a, b) -> sum
}
```

Available bus operations:
- `BusAnd`, `BusOr`, `BusXor`, `BusNot`

## Viewing Your Components

### Component Library Panel

The right panel shows all available components in three tabs:

#### User Tab
- Shows components you've compiled
- Click component name to expand details
- See inputs, outputs, and descriptions
- Click **Remove** button to delete a component

#### Standard Tab
- Pre-built composite components (future)
- Reusable building blocks

#### Primitives Tab
- Built-in gates provided by the simulator
- And, Or, Not, Xor, Nand, Nor, Xnor, Buffer
- Switch, Led (I/O components)
- BusAnd, BusOr, BusXor, BusNot (bus operations)

### Component Details

When you expand a component, you see:
- **Inputs**: Port names and types (e.g., `a: bit`)
- **Outputs**: Port names and types
- **Clocks**: Clock signal names (if any)
- **Description**: Component purpose

## Multiple Components in One File

You can define multiple components in a single DSL file:

```dsl
component HalfAdder {
  input a: bit
  input b: bit
  output sum: bit
  output carry: bit

  gate Xor(a, b) -> sum
  gate And(a, b) -> carry
}

component FullAdder {
  input a: bit
  input b: bit
  input cin: bit
  output sum: bit
  output cout: bit

  instance HalfAdder ha1
  instance HalfAdder ha2
  instance Or orGate

  connect a -> ha1.a
  connect b -> ha1.b
  connect ha1.sum -> ha2.a
  connect cin -> ha2.b
  connect ha2.sum -> sum
  connect ha1.carry -> orGate.a
  connect ha2.carry -> orGate.b
  connect orGate.out -> cout
}
```

Both components will be compiled and registered.

## Component Composition

You can use your own compiled components in new components:

1. Define and compile `ComponentA`
2. Write `ComponentB` that uses `ComponentA`
3. Compile `ComponentB`
4. Both are now in your library

Example workflow:

**Step 1**: Compile HalfAdder
```dsl
component HalfAdder {
  input a: bit
  input b: bit
  output sum: bit
  output carry: bit
  gate Xor(a, b) -> sum
  gate And(a, b) -> carry
}
```

**Step 2**: Use HalfAdder in FullAdder
```dsl
component FullAdder {
  input a: bit
  input b: bit
  input cin: bit
  output sum: bit
  output cout: bit

  instance HalfAdder ha1
  instance HalfAdder ha2
  // ... connections
}
```

## Syntax Highlighting

The editor provides automatic syntax highlighting:
- **Blue**: Keywords (component, input, output)
- **Teal**: Types (bit, bus, memory)
- **Green**: Comments
- **Purple**: Numbers

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Format document (future)
- **Ctrl/Cmd + F**: Find in document
- **Ctrl/Cmd + /**: Toggle line comment

## Tips and Best Practices

### 1. Start Simple
Begin with basic gates, then build up to complex components.

### 2. Use Comments
```dsl
// This is a comment explaining the component
component MyComponent {
  // Document each port
  input data: bit  // Data input signal
  output result: bit
}
```

### 3. Descriptive Names
Use clear, descriptive names:
- ✅ `halfAdder`, `carryOut`, `enableSignal`
- ❌ `ha`, `c`, `e`

### 4. Test After Each Compile
Compile frequently to catch errors early.

### 5. Build Component Libraries
Create reusable components like:
- Adders (half, full, ripple-carry)
- Multiplexers
- Decoders
- Registers

### 6. Check Component Library
Before writing a component, check if it already exists in the library.

## Advanced Features

### Clock Signals (Future)

For sequential circuits:
```dsl
component Register {
  clock clk
  input d: bit
  output q: bit

  state reg: bit

  on clk rising {
    reg <= d
  }
}
```

### Memory (Future)

For memory arrays:
```dsl
component RAM {
  input addr: bus<8>
  input data: bus<8>
  input write: bit
  output out: bus<8>

  state mem: memory<8, 8>
}
```

## Troubleshooting

### Component Not Showing in Library

**Problem**: Compiled but don't see component in User tab

**Solutions**:
- Check for compilation errors
- Ensure you clicked Compile
- Refresh the library panel

### "Unknown component" Error

**Problem**: Compiler says component doesn't exist

**Solutions**:
- Check spelling of component name
- Ensure referenced component was compiled first
- Check if component is in Primitives tab

### Type Mismatch Error

**Problem**: "Cannot connect bit to bus<8>"

**Solutions**:
- Verify port types match
- Use bit-to-bus converters (future)
- Check component definitions

### Syntax Error

**Problem**: Unexpected token or missing semicolon

**Solutions**:
- Check DSL syntax guide
- Ensure proper braces and keywords
- Look at example code

## Example Projects

### 4-bit Ripple Carry Adder

```dsl
component FullAdder {
  input a: bit
  input b: bit
  input cin: bit
  output sum: bit
  output cout: bit

  instance HalfAdder ha1
  instance HalfAdder ha2
  instance Or orGate

  connect a -> ha1.a
  connect b -> ha1.b
  connect ha1.sum -> ha2.a
  connect cin -> ha2.b
  connect ha2.sum -> sum
  connect ha1.carry -> orGate.a
  connect ha2.carry -> orGate.b
  connect orGate.out -> cout
}

component Adder4 {
  input a: bus<4>
  input b: bus<4>
  input cin: bit
  output sum: bus<4>
  output cout: bit

  // TODO: Implement bit slicing and concatenation
  // This is a simplified example
}
```

### 2-to-1 Multiplexer

```dsl
component Mux2to1 {
  input a: bit
  input b: bit
  input sel: bit
  output out: bit

  instance Not notSel
  instance And and1
  instance And and2
  instance Or orGate

  connect sel -> notSel.in
  connect a -> and1.a
  connect notSel.out -> and1.b
  connect b -> and2.a
  connect sel -> and2.b
  connect and1.out -> orGate.a
  connect and2.out -> orGate.b
  connect orGate.out -> out
}
```

## Next Steps

1. **Practice**: Try building simple components first
2. **Explore**: Look at primitives in the library
3. **Compose**: Build complex components from simple ones
4. **Experiment**: Test different gate combinations
5. **Document**: Add comments to your components

## Getting Help

- Check the DSL syntax reference
- Review example components
- Look at error messages carefully
- Start with simpler components and build up

Happy circuit designing!
