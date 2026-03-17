/**
 * CPU0 "Sender" program for the dual-CPU networking demo.
 *
 * Sends a PING frame to CPU1 via NIC, waits for PONG reply.
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
    uart_puts("CPU0: Sending PING\n");

    /* Send a 2-word frame: magic + "PING" */
    nic_tx_word(0xDEADBEEF);   /* magic header */
    nic_tx_word(0x50494E47);   /* ASCII "PING" */
    nic_tx_end();

    uart_puts("CPU0: Waiting for reply...\n");

    /* Poll until we receive something */
    while (nic_rx_count() == 0) {
        /* spin */
    }

    /* Read the reply */
    uint32_t header = nic_rx_read();
    nic_rx_pop();
    uint32_t payload = nic_rx_read();
    nic_rx_pop();

    if (payload == 0x504F4E47) {   /* ASCII "PONG" */
        uart_puts("CPU0: Got PONG!\n");
    } else {
        uart_puts("CPU0: Got unknown reply\n");
    }

    uart_puts("CPU0: Done.\n");
}
