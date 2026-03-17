/**
 * CPU1 "Receiver" program for the dual-CPU networking demo.
 *
 * Listens for a PING frame from CPU0, replies with PONG.
 * All output goes to the memory-mapped UART.
 *
 * Memory map (set by MemBusMux defaults):
 *   0x00000000  InstrMem (ROM) — code lives here
 *   0x00010000  DataMem  (RAM) — data/stack
 *   0x80000000  UART TX  — write byte to +0x0, read ready at +0x0
 *   0x80001000  NIC TX   — write word +0x0, read count +0x8, frame-end +0xC
 *   0x80002000  NIC RX   — read front +0x0, pop +0x4, count +0x8
 */

#define UART_BASE    0x80000000
#define NIC_TX_BASE  0x80001000
#define NIC_RX_BASE  0x80002000

typedef unsigned int uint32_t;

/* ---------- UART ---------- */

static inline void uart_putc(char c) {
    *(volatile uint32_t *)(UART_BASE) = (uint32_t)(unsigned char)c;
}

static void uart_puts(const char *s) {
    while (*s) uart_putc(*s++);
}

/* ---------- NIC TX ---------- */

static inline void nic_tx_word(uint32_t w) {
    *(volatile uint32_t *)(NIC_TX_BASE + 0x0) = w;
}

static inline void nic_tx_end(void) {
    *(volatile uint32_t *)(NIC_TX_BASE + 0xC) = 1;
}

/* ---------- NIC RX ---------- */

static inline uint32_t nic_rx_count(void) {
    return *(volatile uint32_t *)(NIC_RX_BASE + 0x8);
}

static inline uint32_t nic_rx_read(void) {
    return *(volatile uint32_t *)(NIC_RX_BASE + 0x0);
}

static inline void nic_rx_pop(void) {
    *(volatile uint32_t *)(NIC_RX_BASE + 0x4) = 1;
}

/* ---------- Main ---------- */

void main(void) {
    uart_puts("CPU1: Listening...\n");

    /* Wait for incoming frame */
    while (nic_rx_count() == 0) {
        /* spin */
    }

    /* Read the frame */
    uint32_t header = nic_rx_read();
    nic_rx_pop();
    uint32_t payload = nic_rx_read();
    nic_rx_pop();

    if (payload == 0x50494E47) {   /* ASCII "PING" */
        uart_puts("CPU1: Got PING!\n");
    } else {
        uart_puts("CPU1: Got unknown frame\n");
    }

    /* Send PONG reply */
    uart_puts("CPU1: Sending PONG\n");
    nic_tx_word(0xDEADBEEF);   /* magic header */
    nic_tx_word(0x504F4E47);   /* ASCII "PONG" */
    nic_tx_end();

    uart_puts("CPU1: Done.\n");
}
