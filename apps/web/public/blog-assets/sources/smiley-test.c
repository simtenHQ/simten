/*
 * Smiley test - another function call test
 * Output: ":) YAY :)"
 */

#define CONSOLE (*(volatile unsigned char*)0xF000)

void print_smiley(void) {
    CONSOLE = ':';
    CONSOLE = ')';
}

void print_space(void) {
    CONSOLE = ' ';
}

void print_yay(void) {
    CONSOLE = 'Y';
    CONSOLE = 'A';
    CONSOLE = 'Y';
}

void main(void) {
    print_smiley();
    print_space();
    print_yay();
    print_space();
    print_smiley();
    CONSOLE = '\n';
    while(1);
}
