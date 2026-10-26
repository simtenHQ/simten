# 0005. A TypeScript DSL, not Verilog, Chisel or Amaranth

**Status:** Accepted. Tracked in #442.

## Context

Hardware is normally described in Verilog or VHDL, or generated from a host language (Chisel in Scala, Amaranth in Python, SpinalHDL). Simten's audience is web and TypeScript developers and learners, not hardware engineers.

## Decision

Circuits are written in TypeScript with `circuit()`, `bit` and `bus`. There's no new language to learn and no toolchain to install, it runs in the browser, and the type checker and editor support come free: completion, port names, errors as you type. Verilog is still available both ways: export for FPGAs, and import through Yosys.

## Rejected

- **Verilog as the input language.** The language the audience is least likely to know, and simulating it in the browser means shipping a Verilog front end.
- **Chisel or Amaranth.** Mature and well designed, but they need a JVM or Python and a local install, and they target people who already do hardware.

## What would change it

An audience of hardware engineers would want Verilog/SystemVerilog as the primary input. The import path already exists for that.
