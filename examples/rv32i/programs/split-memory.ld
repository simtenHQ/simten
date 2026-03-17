/*
 * Split-memory linker script for the dual-CPU networking demo.
 *
 * Code (text + rodata) goes to IMEM at 0x00000000 (InstrMem ROM).
 * Data (data + bss + stack) goes to DMEM at 0x00010000 (DataMem RAM via MemBusMux).
 *
 * This script is passed to the compiler service via the linkerScript field.
 * The compiler itself remains architecture-agnostic.
 */

OUTPUT_ARCH(riscv)
ENTRY(_start)

MEMORY {
    IMEM (rx)  : ORIGIN = 0x00000000, LENGTH = 64K
    DMEM (rwx) : ORIGIN = 0x00010000, LENGTH = 64K
}

SECTIONS {
    .text : {
        *(.text._start)
        *(.text*)
    } > IMEM

    .rodata : { *(.rodata*) } > IMEM

    .data : { *(.data*) } > DMEM

    .bss : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    } > DMEM

    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
    __heap_start = __bss_end;
    __heap_end = __stack_top - 2048;
}
