# Turing Incomplete Documentation

Welcome to the Turing Incomplete documentation. This guide helps you navigate the documentation based on your role and goals.

## Quick Start Paths

### 🆕 New Users

**Start here:**
1. [Getting Started](./getting-started.md) - Complete onboarding tutorial
2. [Component Model](./SPECIFICATIONS/component-model.md) - Understand the architecture
3. [Visual Editor Guide](./GUIDES/visual-editor-guide.md) - Learn the visual interface

### 👨‍💻 Developers

**Start here:**
1. [Component Model](./SPECIFICATIONS/component-model.md) - Fundamental principles
2. [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) - Language and data structures
3. [Architecture Overview](./ARCHITECTURE/system-architecture.md) - System design
4. [How to Add a Primitive](./how-to-add-primitive.md) - Extend the system

### 🎓 Educators

**Start here:**
1. [Getting Started](./getting-started.md) - Student onboarding path
2. [Component Model](./SPECIFICATIONS/component-model.md) - Core concepts to teach
3. [Example Circuits](./dsl-examples.md) - Teaching materials

---

## Documentation Structure

### 📋 Entry Points

| Document | Description | Audience |
|----------|-------------|----------|
| [Getting Started](./getting-started.md) | Complete onboarding guide | All users |
| [README](./README.md) | This navigation guide | Everyone |

### 📐 SPECIFICATIONS/

**Canonical specifications for the system:**

| Document | Description |
|----------|-------------|
| [Component Model](./SPECIFICATIONS/component-model.md) | **The fundamental architectural invariant - primitives vs composites** |
| [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) | **Language syntax and data structures** |

### 🏗️ ARCHITECTURE/

**System design and implementation:**

| Document | Description |
|----------|-------------|
| [System Architecture](./ARCHITECTURE/system-architecture.md) | Overall system design |
| [Primitive Components](./ARCHITECTURE/architecture-primitive-components.md) | Generator pattern architecture |

### 📖 GUIDES/

**How-to guides and tutorials:**

| Document | Description |
|----------|-------------|
| [Visual Editor Guide](./GUIDES/visual-editor-guide.md) | UI usage and API reference |
| [DSL Editor Guide](./GUIDES/dsl-editor-guide.md) | DSL syntax and Monaco editor |
| [How to Add a Primitive](./how-to-add-primitive.md) | Extend with new components |

### 🎯 FEATURES/

**Implemented and proposed features:**

| Document | Status | Description |
|----------|--------|-------------|
| [Time-Travel Debugging](./FEATURES/time-travel-debugging.md) | ✅ Implemented | Bidirectional simulation navigation |
| [Systolic Array Architecture](./FEATURES/systolic-array-architecture.md) | ✅ Implemented | Systolic array support |
| [Parameter UI](./FEATURES/parameter-ui-implementation-plan.md) | 🚧 Planned | Component parameterization UI |
| [Hierarchy Navigation](./FEATURES/hierarchy-navigation-proposal.md) | 🚧 Proposal | Drill-down into composites |

### 📚 REFERENCE/

**Quick reference materials:**

| Document | Description |
|----------|-------------|
| [Primitive Quick Reference](./REFERENCE/primitive-quick-reference.md) | All primitive components |
| [Linking and Resolution](./REFERENCE/linking-and-resolution.md) | Component resolution |
| [Reference Implementations](./REFERENCE/reference-implementations.md) | Complete examples |

### 📝 Examples and Tutorials

| Document | Description |
|----------|-------------|
| [DSL Examples](./dsl-examples.md) | Circuit examples |
| [Workflow Examples](./WORKFLOW_EXAMPLES.md) | User workflows |


---

## Core Principles

### The Fundamental Architectural Invariant

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

This is the most important principle in the entire system. See [Component Model](./SPECIFICATIONS/component-model.md) for the complete explanation.

### Key Implications

1. **Primitives** (And, Or, Register, RAM) have hardcoded behavior in TypeScript
2. **Composites** (HalfAdder, FullAdder, ALU) are purely structural (describe connections)
3. **All execution** ultimately reduces to primitive operations
4. **No magic** - you can always expand composites to see what's happening

---

## Learning Paths

### Path 1: Build Your First Circuit (1 hour)

1. [Getting Started](./getting-started.md) - Follow "Your First Circuit"
2. Build a half adder (visual editor)
3. Define it in DSL
4. Test with different inputs
5. Try building a full adder

### Path 2: Understand the Architecture (2 hours)

1. [Component Model](./SPECIFICATIONS/component-model.md) - Read carefully
2. [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) - Skim syntax
3. [How to Add a Primitive](./how-to-add-primitive.md) - See implementation
4. [Primitive Components Architecture](./ARCHITECTURE/architecture-primitive-components.md) - Understand generators

### Path 3: Master the DSL (3 hours)

1. [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) - Full read
2. [DSL Examples](./dsl-examples.md) - Study examples
3. [Workflow Examples](./WORKFLOW_EXAMPLES.md) - See user workflows
4. Build progressively complex circuits
5. [Reference Implementations](./reference-implementations.md) - See complete traces

### Path 4: Contribute to the Project (5+ hours)

1. Complete Path 2 (Architecture)
2. [How to Add a Primitive](./how-to-add-primitive.md) - Implementation guide
3. [Primitive Components Architecture](./ARCHITECTURE/architecture-primitive-components.md) - Generator pattern
4. Study existing primitives in `/src/features/visual-editor/lib/primitives.ts`
5. Add your primitive component
6. Write tests
7. Submit PR

---

## Document Status Legend

- ✅ **Complete** - Fully implemented and documented
- 🚧 **Proposal** - Planned feature, not yet implemented
- 🏛️ **Historical** - Completed planning, preserved for context
- 📦 **Archived** - Superseded by consolidated document

---

## Finding What You Need

### "How do I..."

- **"...create a circuit?"** → [Getting Started](./getting-started.md)
- **"...use the visual editor?"** → [Visual Editor Guide](./GUIDES/visual-editor-guide.md)
- **"...write DSL?"** → [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md)
- **"...add a new primitive?"** → [How to Add a Primitive](./how-to-add-primitive.md)
- **"...debug circuits?"** → [Time-Travel Debugging](./FEATURES/time-travel-debugging.md)
- **"...understand the architecture?"** → [Component Model](./SPECIFICATIONS/component-model.md)

### "What is..."

- **"...a primitive?"** → [Component Model](./SPECIFICATIONS/component-model.md)
- **"...a composite?"** → [Component Model](./SPECIFICATIONS/component-model.md)
- **"...the DSL?"** → [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md)
- **"...the IR?"** → [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md)
- **"...time-travel debugging?"** → [Time-Travel Debugging](./FEATURES/time-travel-debugging.md)

### "Why does..."

- **"...the system use primitives and composites?"** → [Component Model](./SPECIFICATIONS/component-model.md) (Design Rationale)
- **"...DSL separate from IR?"** → [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) (Overview)
- **"...primitive definition work this way?"** → [Primitive Components Architecture](./ARCHITECTURE/architecture-primitive-components.md)

---

## Recent Changes

### IDE-Grade Diagnostics & DSL Guide Update (2026-02-17)

**DSL Parser Improvements:**
- IDE-grade diagnostics pipeline: shows all errors at once (syntax + semantic)
- Best-effort AST parsing with incomplete node marking
- Defensive validation that skips broken nodes
- Optional component library integration for "unknown component" errors
- Error categories: `syntax`, `structure`, `semantic`

**Documentation Updates:**
- [DSL Editor Guide](./GUIDES/dsl-editor-guide.md) - Complete rewrite with correct syntax
- [DSL README](../src/features/dsl/README.md) - Updated with IDE diagnostics docs

### Documentation Consolidation (2026-01-28)

**Reduced documentation from 45+ files to ~15 core files:**

- **Created consolidated specifications:**
  - [Component Model](./SPECIFICATIONS/component-model.md) - Merged 6 files
  - [DSL and IR Specification](./SPECIFICATIONS/DSL-and-IR-specification.md) - Merged 2 files

- **Created feature documentation:**
  - [Time-Travel Debugging](./FEATURES/time-travel-debugging.md) - Merged 4 files
  - [Visual Editor Guide](./GUIDES/visual-editor-guide.md) - Merged 2 files
  - [Hierarchy Navigation Proposal](./FEATURES/hierarchy-navigation-proposal.md) - Merged 4 files

- **Updated guides:**
  - [How to Add a Primitive](./how-to-add-primitive.md) - Fixed critical accuracy issues
  - [Primitive Components Architecture](./ARCHITECTURE/architecture-primitive-components.md) - Added generator pattern

- **Created new entry points:**
  - [Getting Started](./getting-started.md) - User onboarding
  - [README](./README.md) - This navigation guide

**Benefits:**
- Single source of truth for core concepts
- 50% fewer files to maintain
- No duplicated content
- Clear documentation hierarchy

---

## Contributing to Documentation

### Documentation Standards

1. **Single source of truth** - No duplication of concepts
2. **Clear audience** - Specify who should read this
3. **Examples** - Show, don't just tell
4. **Cross-references** - Link to related documents
5. **Keep updated** - Update docs with code changes

### Adding New Documentation

**For new features:**
- Add to `/FEATURES/` with implementation status
- Update this master index
- Link from relevant guides

**For new specifications:**
- Add to `/SPECIFICATIONS/`
- Reference from Component Model if applicable
- Update architecture docs

**For new guides:**
- Add to `/GUIDES/`
- Link from Getting Started if applicable
- Provide clear examples

### Updating Existing Documentation

1. Check if document is canonical (not archived)
2. Maintain existing structure
3. Add examples where helpful
4. Update cross-references
5. Update this master index if structure changes

---

## Getting Help

- **Questions about documentation:** [GitHub Issues](https://github.com/yourusername/turing-incomplete/issues) with `documentation` label
- **Questions about usage:** Start with [Getting Started](./getting-started.md)
- **Questions about architecture:** Read [Component Model](./SPECIFICATIONS/component-model.md) first

---

## Version Information

**Documentation Version:** 1.1.0 (2026-02-17)
**System Version:** 0.1.0
**Last Major Update:** IDE-grade diagnostics pipeline, DSL editor guide rewrite

Historical versions of consolidated documentation are preserved in git history.
