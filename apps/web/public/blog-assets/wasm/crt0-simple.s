; Startup code for the blog's 6502 computer (cc65, target none).
;
; Reset lands on _init: set up the hardware stack and cc65's C stack (which
; grows down from the top of RAM), clear BSS, copy initialised data into RAM,
; run the library's constructors, then call main. If main returns, the CPU
; loops at _exit.
;
; There is no operating system, so this file also provides `write`, which the
; C library's stdio (printf, puts, putchar) uses for output: every byte goes to
; the console at $F000.

        .export   _init, _exit, _write
        .export   __STARTUP__ : absolute = 1
        .import   _main, copydata, zerobss, initlib
        .import   popax, popptr1
        .import   __RAM_START__, __RAM_SIZE__
        .include  "zeropage.inc"

CONSOLE = $F000

        .segment  "CODE"

_init:  ldx     #$FF
        txs
        cld
        lda     #<(__RAM_START__ + __RAM_SIZE__)
        sta     c_sp
        lda     #>(__RAM_START__ + __RAM_SIZE__)
        sta     c_sp+1
        jsr     zerobss
        jsr     copydata
        jsr     initlib
        jsr     _main
_exit:  jmp     _exit

; int __fastcall__ write (int fd, const void* buf, unsigned count);
; Prints count bytes from buf, whatever fd is, and returns count.
_write: sta     ptr2            ; ptr2 = bytes left
        stx     ptr2+1
        sta     ptr3            ; ptr3 = count, the return value
        stx     ptr3+1
        jsr     popptr1         ; ptr1 = buf
        jsr     popax           ; fd, unused
        ldy     #0
@next:  lda     ptr2
        ora     ptr2+1
        beq     @done
        lda     (ptr1),y
        sta     CONSOLE
        inc     ptr1
        bne     :+
        inc     ptr1+1
:       lda     ptr2
        bne     :+
        dec     ptr2+1
:       dec     ptr2
        jmp     @next
@done:  lda     ptr3
        ldx     ptr3+1
        rts

; NMI and IRQ/BRK return straight away; there are no interrupt sources.
_irq:   rti

        .segment  "VECTORS"
        .addr     _irq          ; NMI
        .addr     _init         ; RESET
        .addr     _irq          ; IRQ/BRK
