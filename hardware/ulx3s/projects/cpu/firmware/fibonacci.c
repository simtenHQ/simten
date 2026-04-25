/*
 * Prints the first 30 Fibonacci numbers over UART, then halts.
 *
 * fib(29) = 514229, safely within unsigned 32-bit range (fib(47) overflows).
 * After printing "done.", spins in a forever loop so the CPU doesn't run into
 * undefined instructions past the end of the program.
 */

static volatile unsigned int* const UART = (volatile unsigned int*)0x80000000;

static void putc(unsigned char c) {
    while (!(*UART & 1)) { }
    *UART = c;
}

static void puts_(const char* s) {
    while (*s) putc((unsigned char)*s++);
}

/* Decimal print. Uses software DIV/MOD from -lgcc (RV32I has no DIV). */
static void putn(unsigned int n) {
    char buf[12];
    int i = 0;
    if (n == 0) { putc('0'); return; }
    while (n > 0) {
        buf[i++] = (char)('0' + (n % 10));
        n /= 10;
    }
    while (i-- > 0) putc((unsigned char)buf[i]);
}

static void delay(unsigned int n) {
    for (volatile unsigned int i = 0; i < n; i++) { }
}

void main(void) __attribute__((noreturn));
void main(void) {
    for (;;) {
        puts_("Fibonacci:\r\n");

        unsigned int a = 0, b = 1;
        for (int i = 0; i < 47; i++) {
            putn(a);
            puts_("\r\n");
            unsigned int t = a + b;
            a = b;
            b = t;
        }

        puts_("done.\r\n\r\n");
        delay(5000000);  /* ~1.5s idle so picocom can resync + user can read */
    }
}
