; Minimal cc65 Startup Code for 6502 Simulator
; No runtime library dependencies - just init stack and call main

.export _init
.export __STARTUP__ : absolute = 1
.import _main

.segment "CODE"

_init:
        ; Initialize stack pointer
        ldx     #$FF
        txs

        ; Call main() directly - no BSS/DATA init needed for simple programs
        jsr     _main

        ; Halt (infinite loop)
@halt:  jmp     @halt

; Reset and interrupt vectors
.segment "VECTORS"
        .word   0           ; NMI vector (unused)
        .word   _init       ; Reset vector
        .word   0           ; IRQ vector (unused)
