# DSL Editor User Guide

## Getting Started

The DSL Editor allows you to define custom circuit components using a text-based Domain Specific Language (DSL). These components can then be used in the visual editor or referenced by other DSL components.

## Accessing the DSL Editor

1. Open the application
2. Click the **DSL Editor** tab at the top of the screen
3. You'll see:
   - **Left Panel**: Monaco text editor with syntax highlighting
   - **Right Panel**: Component Library browser

## Writing Your First Circuit

### Basic Structure

Every circuit definition follows this structure:

```dsl
circuit CircuitName {
  // Input ports
  input portName: Type

  // Output ports
  output portName: Type

  // Implementation (for composite circuits)
  impl {
    node instanceName: ComponentType
    connect source -> target
  }
}
```

### Example: Half Adder

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

### Port Types

- **`Bit`**: Single binary signal (0 or 1)
- **`Bus[N]`**: Multi-bit signal with N bits (e.g., `Bus[8]` for 8 bits)

### Using Primitive Components

Available primitive components:
- Logic gates: `And`, `Or`, `Not`, `Xor`, `Nand`, `Nor`, `Xnor`
- Utility: `Buffer`, `Splitter`, `Merger`
- Sequential: `Register`, `RAM`, `ROM`
- I/O: `Switch`, `Led`

Example with multiple components:

```dsl
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

## IDE Features

### Real-Time Error Reporting

The editor provides IDE-grade diagnostics that show **all errors at once**:

- **Syntax errors**: Missing colons, invalid keywords, etc.
- **Semantic errors**: Duplicate names, undefined references, unknown components

Errors appear as red underlines in the editor with hover tooltips showing details.

### Error Categories

1. **Syntax errors** - Parser-level issues (missing tokens, unexpected characters)
2. **Semantic errors** - Validation issues (undefined references, duplicates)

The editor filters semantic errors on lines that have syntax errors to prevent "error storms".

### Syntax Highlighting

The editor provides automatic syntax highlighting:
- **Blue**: Keywords (`circuit`, `input`, `output`, `impl`, `node`, `connect`)
- **Teal**: Types (`Bit`, `Bus`)
- **Green**: Comments
- **Purple**: Numbers

## Compiling Your Circuit

1. Write your DSL code in the editor
2. Click the **Compile** button (lightning bolt icon) or press **Cmd/Ctrl + Enter**
3. Watch for:
   - **Success**: Green banner showing "Successfully compiled N circuit(s)"
   - **Errors**: Red panel at bottom with line:column and error messages

### Compilation Success

When compilation succeeds:
- Your circuit is added to the Component Library
- It appears in the **User** tab of the library browser
- You can now use it in other circuits
- Success message auto-dismisses after 5 seconds
- **Diagnostics panel** updates with validation results and metrics

### Handling Errors

If compilation fails:
- Error panel shows at the bottom
- Each error shows line number and column
- Click the X to dismiss errors
- Fix the errors and click Compile again

Common errors:
- **Unknown component**: Referenced component doesn't exist (check spelling)
- **Duplicate name**: Two ports or nodes with the same name
- **Undefined reference**: Connection references non-existent port or node
- **Syntax error**: Invalid DSL syntax (missing colon, brace, etc.)

## Diagnostics Panel

The **Diagnostics** tab in the right sidebar provides detailed analysis of your circuit after compilation.

### Status Banner

Shows overall validation status:
- **Green checkmark**: Circuit is valid and ready for simulation
- **Red X**: Validation failed with errors

### Circuit Metrics

When compilation succeeds, you'll see hardware metrics:

| Metric | Description |
|--------|-------------|
| **Nodes** | Total number of component instances |
| **Registers** | Count of sequential elements (Register, DFlipFlop) |
| **Critical Path** | Longest combinational path (gate levels) |
| **Max Fan-out** | Highest number of connections from a single output |

These metrics help you understand your circuit's complexity:
- High **critical path** suggests the circuit may need pipelining for higher clock speeds
- High **fan-out** (>8) may indicate timing issues; consider adding buffers

### Analysis Summary

Shows what the compiler found:
- **Circuits defined**: Names of all circuits in your DSL
- **Components used**: Which primitives/composites are referenced
- **Unresolved references**: Components that couldn't be found (errors)

### Diagnostics List

Detailed list of all issues found, grouped by severity:

1. **Errors** (red): Must be fixed before simulation
   - `UNKNOWN_COMPONENT`: Referenced component doesn't exist
   - `DUPLICATE_NAME`: Two items share the same name
   - `COMBINATIONAL_CYCLE`: Illegal feedback loop detected
   - `FLOATING_INPUT`: Input port not connected
   - `WIDTH_MISMATCH`: Bus width incompatibility

2. **Warnings** (yellow): Circuit will work but may have issues
   - `FLOATING_OUTPUT`: Output port not driven

3. **Info** (blue): Suggestions for improvement

Each diagnostic includes:
- **Error code**: Machine-readable identifier
- **Phase**: When the error was detected (syntax, semantic, type, structural)
- **Message**: Human-readable description
- **Location**: Line and column number
- **Suggestions**: How to fix the issue

## Node Instantiation

Create instances of components inside `impl` blocks:

```dsl
impl {
  node instanceName: ComponentType
  node adder: FullAdder
  node reg: Register(width = 8)
}
```

### With Parameters

Some components accept parameters:

```dsl
node adder: RippleCarryAdder(width = 16)
node ram: RAM(addrWidth = 10, dataWidth = 8)
```

## Connections

Wire ports together with the `connect` statement:

```dsl
connect source -> target
```

Sources and targets can be:
- Circuit input: `inputName`
- Circuit output: `outputName`
- Node port: `nodeName.portName`

Examples:
```dsl
connect a -> xor1.a           // Circuit input to node input
connect xor1.out -> sum       // Node output to circuit output
connect ha1.carry -> or1.a    // Node output to node input
```

## Working with Buses

For multi-bit signals:

```dsl
circuit BusExample {
  input data: Bus[8]
  output result: Bus[8]

  impl {
    node reg: Register(width = 8)

    connect data -> reg.d
    connect reg.q -> result
  }
}
```

## Viewing Your Circuits

### Component Library Panel

The right panel shows all available components in tabs:

#### User Tab
- Shows circuits you've compiled
- Click component name to expand details
- See inputs, outputs, and descriptions
- Click **Remove** button to delete a circuit

#### Primitives Tab
- Built-in components provided by the simulator
- Logic gates, registers, memory, I/O components

### Component Details

When you expand a component, you see:
- **Inputs**: Port names and types (e.g., `a: Bit`)
- **Outputs**: Port names and types
- **Clocks**: Clock signal names (if any)
- **Parameters**: Configurable values

## Multiple Circuits in One File

You can define multiple circuits in a single DSL file:

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

circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

Both circuits will be compiled and registered. Order matters - define dependencies first.

## Keyboard Shortcuts

- **Ctrl/Cmd + F**: Find in document
- **Ctrl/Cmd + /**: Toggle line comment
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo

## Tips and Best Practices

### 1. Start Simple
Begin with basic logic gates, then build up to complex circuits.

### 2. Use Comments
```dsl
// This is a comment explaining the circuit
circuit MyCircuit {
  // Document each port
  input data: Bit  // Data input signal
  output result: Bit
}
```

### 3. Descriptive Names
Use clear, descriptive names:
- Good: `halfAdder`, `carryOut`, `enableSignal`
- Avoid: `ha`, `c`, `e`

### 4. Build Incrementally
Compile frequently to catch errors early. Define simpler circuits first, then use them in more complex ones.

### 5. Check Component Library
Before writing a circuit, check if it already exists in the library.

## Troubleshooting

### Circuit Not Showing in Library

**Problem**: Compiled but don't see circuit in User tab

**Solutions**:
- Check for compilation errors
- Ensure you clicked Compile
- Refresh the library panel

### "Unknown component" Error

**Problem**: Compiler says component doesn't exist

**Solutions**:
- Check spelling of component name (case-sensitive)
- Ensure referenced circuit was compiled first
- Check if component is in Primitives tab

### Syntax Error

**Problem**: Unexpected token or missing element

**Solutions**:
- Check for missing colons after port names (e.g., `input a: Bit`)
- Ensure proper braces `{` `}` are matched
- Look at example code for correct syntax

## Next Steps

1. **Practice**: Try building simple circuits first
2. **Explore**: Look at primitives in the library
3. **Compose**: Build complex circuits from simple ones
4. **Experiment**: Test different component combinations

## Related Documentation

- [DSL and IR Specification](/docs/SPECIFICATIONS/DSL-and-IR-specification.md) - Complete syntax reference
- [DSL Examples](/docs/dsl-examples.md) - Example circuits from simple to complex
- [Component Model](/docs/SPECIFICATIONS/component-model.md) - Understanding primitives vs composites
