static volatile unsigned int* const UART = (volatile unsigned int*)0x80000000;

void main(void) __attribute__((noreturn, optimize("O0")));
void main(void) {
    static const unsigned char msg[] = "Hi there\r\n";
    while (1) {
        for (int i = 0; i < 10; i++) {
            unsigned char c = msg[i];        /* load BEFORE poll — same shape as broken Rust */
            while (!(*UART & 1));            /* poll */
            *UART = c;                       /* write */
        }
    }
}
