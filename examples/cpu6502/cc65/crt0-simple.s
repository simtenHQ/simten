; Minimal C runtime startup for 6502 Simulator
;
; This version has no dependencies on the cc65 runtime library.
; It just initializes the stack and falls through to main.
;
; Note: Uses JSR/RTS pattern since JMP absolute isn't implemented yet.

.export _init
.export __STARTUP__ : absolute = 1      ; Marker for cc65

.import _main

.segment "CODE"

; Entry point called by reset vector
; Main must be placed immediately after this for fall-through
_init:
        ; Initialize stack pointer to $01FF
        ldx     #$FF
        txs
        ; Fall through to _main (linker places main right after crt0)

; Reset and interrupt vectors
.segment "VECTORS"
        .word   0           ; NMI vector (unused)
        .word   _init       ; Reset vector
        .word   0           ; IRQ vector (unused)
