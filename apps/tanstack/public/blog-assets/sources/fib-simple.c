/*
 * Fibonacci sequence - no stdlib needed
 */

#define CONSOLE (*(volatile unsigned char*)0xF000)

void print_char(char c) {
    CONSOLE = c;
}

void print_string(const char* s) {
    while (*s) print_char(*s++);
}

void print_number(unsigned int n) {
    if (n >= 10) print_number(n / 10);
    print_char('0' + (n % 10));
}

void main(void) {
    unsigned int a, b, next;
    unsigned char i;

    print_string("Fibonacci: ");

    a = 0;
    b = 1;
    for (i = 0; i < 10; i++) {
        print_number(a);
        print_char(' ');
        next = a + b;
        a = b;
        b = next;
    }
    print_char('\n');

    while(1);
}
