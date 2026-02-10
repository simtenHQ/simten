; Minimal cc65 Startup Code for 6502 Simulator
;
; Simple version that just sets up stack and calls main.
; No BSS/DATA initialization (not needed for simple programs).

.export _init
.export __STARTUP__ : absolute = 1
.import _main

.segment "CODE"

_init:
        ; Initialize stack pointer to $01FF
        ldx     #$FF
        txs

        ; Jump to main (never returns)
        jmp     _main

; Reset and interrupt vectors
.segment "VECTORS"
        .word   0           ; NMI vector (unused)
        .word   _init       ; Reset vector
        .word   0           ; IRQ vector (unused)
