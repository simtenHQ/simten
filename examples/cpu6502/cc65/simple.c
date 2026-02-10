/*
 * Simplest test - direct console output without any library calls
 * This avoids cc65 runtime requirements
 */

/* Direct memory-mapped I/O */
#define CONSOLE (*(volatile unsigned char*)0xF000)

void main(void) {
    /* Write "Hi Naz!" directly to console */
    CONSOLE = 'H';
    CONSOLE = 'i';
    CONSOLE = ' ';
    CONSOLE = 'N';
    CONSOLE = 'a';
    CONSOLE = 'z';
    CONSOLE = '!';
    CONSOLE = '\n';

    /* Halt - infinite loop */
    while(1);
}
