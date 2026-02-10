; C runtime startup for 6502 Simulator
;
; Initializes both the hardware stack and cc65's software stack

.export _init
.export __STARTUP__ : absolute = 1

.import _main

; cc65 runtime imports
.importzp sp                           ; Software stack pointer (zero page)

.segment "CODE"

_init:
        ; Initialize hardware stack pointer to $01FF
        ldx     #$FF
        txs

        ; Initialize cc65 software stack pointer
        ; Stack grows downward from top of RAM ($0800)
        lda     #$00
        ldx     #$08                    ; sp = $0800 (top of RAM)
        sta     sp
        stx     sp+1

        ; Call main
        jsr     _main

        ; Halt if main returns
@halt:  jmp     @halt

; Reset and interrupt vectors
.segment "VECTORS"
        .word   0           ; NMI vector (unused)
        .word   _init       ; Reset vector
        .word   0           ; IRQ vector (unused)
