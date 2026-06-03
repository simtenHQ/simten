/*
 * link.ld — simten arch-test memory map.
 *
 * Mirrors the DUT's two-memory machine: instruction memory at the reset
 * vector (0x0) and data memory at 0x10000 — the same bases the CPU's
 * production linker script uses (hardware/ulx3s/projects/cpu/index.ts), just
 * enlarged. Enlarging IMEM/DMEM is netlist-neutral: the core is address-bare
 * (the 0x1ff word mask lives only in sim.ts, not in the circuit), so a bigger
 * sim memory changes no hardware.
 *
 * The DUT's reset vector (0x0) dictates the base; Spike is told to match via
 * `-m0x0:<IMEM+DMEM span>` derived from these ORIGIN/LENGTH values. We never
 * relink to Spike's default 0x80000000 DRAM convention.
 */

OUTPUT_ARCH(riscv)
ENTRY(rvtest_entry_point)

MEMORY {
    /* IMEM ends at 0x0FFFF, abutting DMEM at 0x10000 — no overlap. 64K easily
       holds the largest arch-test's code; the DUT's reset vector is 0x0. */
    IMEM (rx)  : ORIGIN = 0x00000000, LENGTH = 64K
    DMEM (rwx) : ORIGIN = 0x00010000, LENGTH = 256K
}

SECTIONS {
    .text.init : { *(.text.init) } > IMEM
    .text : {
        *(.text)
        *(.text*)
        *(.rodata*)
    } > IMEM

    .data : {
        *(.data*)
        *(.sdata*)
    } > DMEM

    /* HTIF mailbox — Spike looks up `tohost`/`fromhost` here. */
    .tohost : {
        *(.tohost)
    } > DMEM

    .bss : {
        __bss_start = .;
        *(.bss*)
        *(.sbss*)
        *(COMMON)
        __bss_end = .;
    } > DMEM

    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
}
