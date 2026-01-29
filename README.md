# Turing Incomplete

A visual circuit simulator and DSL-based hardware description environment for learning and experimenting with digital logic.

## What is Turing Incomplete?

Turing Incomplete is a browser-based platform for designing, simulating, and debugging digital circuits. It combines:

- **Visual Editor** - Drag-and-drop circuit construction
- **DSL** - Text-based hardware description language
- **Live Simulation** - Interactive execution with real-time feedback
- **Time-Travel Debugging** - Step backward/forward through simulation history
- **Component Library** - Rich set of primitives and composites

## Key Features

- **Clear Architecture** - Primitives (executable) vs Composites (structural)
- **Deterministic Simulation** - Predictable, reproducible execution
- **Time-Travel Debugging** - Navigate simulation history, branch timelines
- **LLM-Friendly DSL** - Clean syntax optimized for AI-assisted development
- **Educational Focus** - Designed for learning digital logic fundamentals

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/turing-incomplete.git
cd turing-incomplete

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser to `http://localhost:3000`

## Your First Circuit

**Visual Editor:**
1. Drag an **Xor** gate and **And** gate onto the canvas
2. Add two **Switch** inputs and two **LED** outputs
3. Connect switches to gate inputs, gates to LEDs
4. Toggle switches to test your half adder!

**DSL:**
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

## Documentation

**Start here:**
- [Getting Started Guide](./docs/getting-started.md) - Complete onboarding tutorial
- [Component Model](./docs/SPECIFICATIONS/component-model.md) - Understand the architecture
- [DSL Specification](./docs/SPECIFICATIONS/DSL-and-IR-specification.md) - Language reference

**Full documentation:** [`/docs/`](./docs/)

## Project Structure

```
src/
├── features/
│   └── visual-editor/        # Visual editor and simulation
│       ├── components/        # UI components
│       ├── lib/              # Primitives, evaluation, time-travel
│       ├── stores/           # State management
│       └── types/            # TypeScript interfaces
├── app/                      # Next.js app router
└── ...

docs/
├── getting-started.md        # User onboarding
├── SPECIFICATIONS/           # Core specs
│   ├── component-model.md
│   └── DSL-and-IR-specification.md
├── ARCHITECTURE/             # System design docs
├── GUIDES/                   # How-to guides
├── FEATURES/                 # Feature documentation
└── REFERENCE/                # API references
```

## Architecture Highlights

### The Fundamental Principle

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

This architectural invariant ensures:
- Complete transparency (no hidden behavior)
- Full introspection (always expandable to primitives)
- Predictable execution (behavior = primitives + connections)
- Optimization freedom (can inline, flatten, reorder)

See [Component Model](./docs/SPECIFICATIONS/component-model.md) for details.

### DSL → IR → Simulation Pipeline

```
DSL Text → Parse → AST → Resolve → IR → Simulate
                    ↓               ↓
                 Names          Executables
```

- **DSL** - Human-readable circuit descriptions
- **IR** - Platform-independent executable representation
- **Simulator** - Topological evaluation engine

## Tech Stack

- **Framework:** Next.js 15, React 19
- **State Management:** Zustand with Immer
- **Visualization:** ReactFlow, TailwindCSS
- **Language:** TypeScript
- **Testing:** Vitest

## Development

```bash
# Development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

## Contributing

Contributions are welcome! Please read the documentation in `/docs/` to understand the architecture before making changes.

**Key areas for contribution:**
- Additional primitive components
- Standard library circuits (composites)
- Documentation improvements
- Bug fixes
- Performance optimizations

## License

MIT License - see LICENSE file for details

## Learn More

- **Repository:** [GitHub](https://github.com/yourusername/turing-incomplete)
- **Documentation:** [`/docs/`](./docs/)
- **Issues:** [GitHub Issues](https://github.com/yourusername/turing-incomplete/issues)

---

Built with ❤️ for digital logic education
