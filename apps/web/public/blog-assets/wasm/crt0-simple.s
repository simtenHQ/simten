; Startup code for the blog's 6502 computer (cc65, target none).
;
; Reset lands on _init: set up the hardware stack and cc65's C stack (which
; grows down from the top of RAM), clear BSS, copy initialised data into RAM,
; then call main. If main returns, the CPU loops at _exit.

        .export   _init, _exit
        .export   __STARTUP__ : absolute = 1
        .import   _main, copydata, zerobss
        .import   __RAM_START__, __RAM_SIZE__
        .include  "zeropage.inc"

        .segment  "CODE"

_init:  ldx     #$FF
        txs
        cld
        lda     #<(__RAM_START__ + __RAM_SIZE__)
        sta     sp
        lda     #>(__RAM_START__ + __RAM_SIZE__)
        sta     sp+1
        jsr     zerobss
        jsr     copydata
        jsr     _main
_exit:  jmp     _exit

; NMI and IRQ/BRK return straight away; there are no interrupt sources.
_irq:   rti

        .segment  "VECTORS"
        .addr     _irq          ; NMI
        .addr     _init         ; RESET
        .addr     _irq          ; IRQ/BRK
