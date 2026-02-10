; cc65 Startup Code for 6502 Simulator
;
; This is the C runtime startup code that initializes the system
; and calls main(). It also sets up the reset vector.
;
; Uses the standard cc65 runtime from none.lib for BSS/DATA init.

.export _init
.export __STARTUP__ : absolute = 1      ; Required by cc65 runtime
.import _main, _exit
.import copydata, zerobss
.import __STACK_START__, __STACK_SIZE__

.segment "CODE"

; Entry point called by reset vector
_init:
        ; Initialize stack pointer
        ldx     #$FF
        txs

        ; Clear BSS segment (zero-initialize static variables)
        jsr     zerobss

        ; Copy DATA segment from ROM to RAM
        jsr     copydata

        ; Call main()
        jsr     _main

        ; Exit (infinite loop from none.lib)
        jmp     _exit

; Reset and interrupt vectors
.segment "VECTORS"
        .word   0           ; NMI vector (unused)
        .word   _init       ; Reset vector
        .word   0           ; IRQ vector (unused)
