/*
 * Minimal function call test
 */

#define CONSOLE (*(volatile unsigned char*)0xF000)

void say_hi(void) {
    CONSOLE = 'H';
    CONSOLE = 'i';
}

void main(void) {
    say_hi();
    CONSOLE = '!';
    CONSOLE = '\n';
    while(1);
}
