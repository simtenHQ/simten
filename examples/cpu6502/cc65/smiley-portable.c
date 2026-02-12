/*
 * Portable smiley test - runs on both 6502 simulator and native OS
 * Output: ":) YAY :)"
 */

#ifdef __CC65__
  /* 6502 simulator: memory-mapped I/O */
  #define OUTPUT(c) (*(volatile unsigned char*)0xF000) = (c)
#else
  /* Normal OS: use stdio */
  #include <stdio.h>
  #define OUTPUT(c) putchar(c)
#endif

void print_smiley(void) {
    OUTPUT(':');
    OUTPUT(')');
}

void print_space(void) {
    OUTPUT(' ');
}

void print_yay(void) {
    OUTPUT('Y');
    OUTPUT('A');
    OUTPUT('Y');
}

int main(void) {
    print_smiley();
    print_space();
    print_yay();
    print_space();
    print_smiley();
    OUTPUT('\n');

#ifdef __CC65__
    while(1);  /* Halt on 6502 */
#endif

    return 0;
}
