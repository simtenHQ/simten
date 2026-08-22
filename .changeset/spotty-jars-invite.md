---
'@simten/core': patch
---

New `UART_RX({ cyclesPerBit })` in the standard library.

Imported SoCs talk over one bit-banged pin — SERV's `servant`, picosoc and most
soft cores expose a serial output and nothing else. Wiring that pin here and
`data`/`valid` into a `Console` prints what the program prints, with no glue
written per design.

Standard 8-N-1 framing, one sample per bit taken at the middle of the bit.
`cyclesPerBit` is clock rate over baud rate and is worth setting explicitly;
`servant` bit-bangs at 279 cycles per bit.

The receiver waits for the line to rest high before accepting a start bit.
Simulation is 2-state, so a pin that is undriven until the design boots reads 0,
which is indistinguishable from a start bit — without that wait it locks to the
power-on low and garbles the first several characters.
