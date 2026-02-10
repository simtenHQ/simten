; Console Output Routine for 6502 Simulator
;
; Provides putchar() function for stdio.
; Writes characters to memory-mapped console at $F000.

.export _putchar

CONSOLE = $F000

.segment "CODE"

; void putchar(char c)
; Writes character to console output
; Input: A register contains the character
_putchar:
        sta     CONSOLE         ; Write character to console
        rts
