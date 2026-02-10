/*
 * Function call test - demonstrates JSR/RTS with multiple function calls
 * Output: "OK:ABC"
 * Uses only void functions to avoid cc65 runtime library dependencies
 */

#define CONSOLE (*(volatile unsigned char*)0xF000)

void print_ok(void) {
    CONSOLE = 'O';
    CONSOLE = 'K';
}

void print_colon(void) {
    CONSOLE = ':';
}

void print_a(void) {
    CONSOLE = 'A';
}

void print_b(void) {
    CONSOLE = 'B';
}

void print_c(void) {
    CONSOLE = 'C';
}

void main(void) {
    print_ok();     /* JSR/RTS test 1 */
    print_colon();  /* JSR/RTS test 2 */
    print_a();      /* JSR/RTS test 3 */
    print_b();      /* JSR/RTS test 4 */
    print_c();      /* JSR/RTS test 5 */
    CONSOLE = '\n';
    while(1);
}
