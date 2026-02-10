/*
 * Hello World for 6502 Simulator
 *
 * Simple test program that outputs "Hello, 6502!" to the console.
 * Uses putchar() which writes to memory-mapped console at $F000.
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

int main(void) {
    puts("Hello, 6502!");
    return 0;
}
