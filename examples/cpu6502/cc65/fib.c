/*
 * Fibonacci Sequence for 6502 Simulator
 *
 * Outputs the first 10 Fibonacci numbers to the console.
 * Uses simple integer arithmetic to demonstrate cc65 code generation.
 */

/* Simple putchar - defined in putchar.s */
void putchar(char c);

/* Simple puts - outputs string followed by newline */
void puts(const char *s) {
    while (*s) {
        putchar(*s++);
    }
    putchar('\n');
}

/* Output a decimal number (0-255 range) */
void putnum(unsigned char n) {
    unsigned char d;

    /* Hundreds digit */
    d = 0;
    while (n >= 100) {
        n -= 100;
        d++;
    }
    if (d > 0) putchar('0' + d);

    /* Tens digit */
    d = 0;
    while (n >= 10) {
        n -= 10;
        d++;
    }
    if (d > 0 || n >= 10) putchar('0' + d);

    /* Units digit */
    putchar('0' + n);
}

int main(void) {
    unsigned char a = 0;
    unsigned char b = 1;
    unsigned char i;
    unsigned char next;

    puts("Fibonacci:");

    for (i = 0; i < 10; i++) {
        putnum(a);
        putchar('\n');
        next = a + b;
        a = b;
        b = next;
    }

    return 0;
}
