/*
 * Fibonacci - no runtime library needed
 * Avoids division/modulo and complex function calls
 */

#define CONSOLE (*(volatile unsigned char*)0xF000)

/* Print a single digit 0-9 */
void put_digit(unsigned char d) {
    CONSOLE = '0' + d;
}

/* Print number up to 255 (no division - use subtraction) */
void print_num(unsigned char n) {
    unsigned char hundreds, tens;

    hundreds = 0;
    while (n >= 100) {
        n -= 100;
        hundreds++;
    }

    tens = 0;
    while (n >= 10) {
        n -= 10;
        tens++;
    }

    if (hundreds) put_digit(hundreds);
    if (hundreds || tens) put_digit(tens);
    put_digit(n);
}

void main(void) {
    unsigned char a, b, next, i;

    /* Print "Fib: " */
    CONSOLE = 'F';
    CONSOLE = 'i';
    CONSOLE = 'b';
    CONSOLE = ':';
    CONSOLE = ' ';

    a = 0;
    b = 1;

    for (i = 0; i < 13; i++) {
        print_num(a);
        CONSOLE = ' ';

        next = a + b;
        a = b;
        b = next;
    }

    CONSOLE = '\n';

    while(1);
}
