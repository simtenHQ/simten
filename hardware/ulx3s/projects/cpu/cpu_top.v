// RV32I CPU top-level for ULX3S 85K
//
// Memory map (matches MemBusMux defaults):
//   0x0000_0000 - 0x0000_07FF  IMEM (2KB ROM, initialized from firmware.hex)
//   0x0001_0000 - 0x0001_0FFF  DMEM (4KB RAM)
//   0x8000_0000 - 0x8000_0FFF  UART TX
//     write [7:0]  → transmit byte
//     read  [0]    → tx_ready (1 = idle)
//
// UART: 8N1, 115200 baud, 25 MHz clock → 217 clocks/bit
// Output: ftdi_rxd (L4) → USB-serial → `screen /dev/ttyUSB0 115200`

// ─────────────────────────────────────────────────────────────────────────────
// UART TX  –  8N1, parametric baud rate
// ─────────────────────────────────────────────────────────────────────────────
module uart_tx_bb (
    input        clk,
    input  [7:0] tx_byte,
    input        tx_write,   // single-cycle write strobe
    output reg   tx_serial,
    output wire  tx_ready    // 1 = skid has room
);
    localparam CLKS_PER_BIT = 217;  // 25 MHz / 115200

    reg [8:0]  shift;       // {stop, data[7:0]}
    reg [3:0]  bits_left;   // bits remaining after start
    reg [7:0]  cnt;
    reg        busy;

    // 1-deep skid buffer. Decouples tx_ready from busy so a write that
    // arrives while the shifter is mid-byte (or in the cycle busy is
    // flipping) is captured rather than dropped. Software polls
    // tx_ready=!skid_valid; the skid drains into the shifter as soon as
    // the line is idle.
    reg [7:0]  skid_data;
    reg        skid_valid;

    assign tx_ready = !skid_valid;

    initial begin
        tx_serial  = 1'b1;
        busy       = 1'b0;
        bits_left  = 4'd0;
        cnt        = 8'd0;
        shift      = 9'd0;
        skid_data  = 8'd0;
        skid_valid = 1'b0;
    end

    always @(posedge clk) begin
        // ── Shifter ─────────────────────────────────────────────────────
        if (!busy) begin
            if (skid_valid) begin
                busy       <= 1'b1;
                shift      <= {1'b1, skid_data};  // stop=1, then 8 data bits
                bits_left  <= 4'd9;               // 8 data + 1 stop
                cnt        <= 8'd0;
                tx_serial  <= 1'b0;               // start bit
                skid_valid <= 1'b0;
            end
        end else begin
            if (cnt == CLKS_PER_BIT - 1) begin
                cnt <= 8'd0;
                if (bits_left == 4'd0) begin
                    busy      <= 1'b0;
                    tx_serial <= 1'b1;
                end else begin
                    tx_serial <= shift[0];
                    shift     <= {1'b1, shift[8:1]};
                    bits_left <= bits_left - 4'd1;
                end
            end else begin
                cnt <= cnt + 8'd1;
            end
        end

        // ── Capture (last; on simultaneous drain+write, new byte wins) ──
        if (tx_write) begin
            skid_data  <= tx_byte;
            skid_valid <= 1'b1;
        end
    end
endmodule

// ─────────────────────────────────────────────────────────────────────────────
// cpu_top  –  top-level
// ─────────────────────────────────────────────────────────────────────────────
module cpu_top (
    input  clk_25mhz,
    input  btn_reset,       // BTN_F1 / FIRE1 (R1): active-high when pressed → assert rst_n low
    output uart_tx,         // to ftdi_rxd (L4)
    output [1:0] led        // led[0]=blink ~0.75Hz alive, led[1]=uart_write
);

    // ── Reset generation ──────────────────────────────────────────────────
    // Power-on reset: 8-bit counter holds rst_n low for the first 256
    // cycles after bitstream load (~10us at 25 MHz), then releases.
    // The button (active-high) ORs into the reset path: press → rst_n low.
    reg [7:0] por_counter = 8'd0;
    wire por_done = (por_counter == 8'hFF);
    always @(posedge clk_25mhz) begin
        if (!por_done) por_counter <= por_counter + 8'd1;
    end
    wire rst_n = por_done & ~btn_reset;

    // ── Instruction memory (2KB = 512 × 32-bit words) ──────────────────────
    reg [31:0] imem [0:511];
    initial $readmemh("firmware.hex", imem);

    // ── Data memory (4KB = 1024 × 32-bit words) ────────────────────────────
    reg [31:0] dmem [0:1023];

    // ── CPU interface wires ─────────────────────────────────────────────────
    wire [31:0] instr_addr;
    wire [31:0] data_addr;
    wire [31:0] data_write;
    wire        data_mem_read;
    wire        data_mem_write;
    wire [2:0]  data_funct3;
    wire [31:0] instruction;
    reg  [31:0] data_read;

    RV32I_CPU_Core cpu (
        .clk           (clk_25mhz),
        .rst_n         (rst_n),
        .instruction   (instruction),
        .data_read     (data_read),
        .instr_addr    (instr_addr),
        .data_addr     (data_addr),
        .data_write    (data_write),
        .data_mem_read (data_mem_read),
        .data_mem_write(data_mem_write),
        .data_funct3   (data_funct3)
    );

    // ── Instruction fetch (combinational) ─────────────────────────────────
    assign instruction = imem[instr_addr[10:2]];

    // ── Address decode ─────────────────────────────────────────────────────
    wire sel_imem = (data_addr[31:11] == 21'd0);               // 0x000–0x7FF
    wire sel_dmem = (data_addr[31:12] == 20'h00010);           // 0x10000–0x10FFF
    wire sel_uart = (data_addr[31:12] == 20'h80000);           // 0x80000000–0x80000FFF

    // ── Debug LEDs ─────────────────────────────────────────────────────────
    reg [24:0] blink_ctr = 0;
    always @(posedge clk_25mhz) blink_ctr <= blink_ctr + 1;
    assign led[0] = blink_ctr[24]; // toggles at 25MHz/2^25 ≈ 0.75 Hz

    // ── UART TX ────────────────────────────────────────────────────────────
    wire uart_ready;
    wire uart_write = data_mem_write & sel_uart;

    // CPU-alive heartbeat: counts UART writes from the CPU. The CPU only
    // performs UART writes if its entire pipeline is correctly out of reset
    // and executing instructions — so a blinking led[1] proves the reset
    // arms inside RV32I_CPU_Core successfully released every sequential
    // primitive (Register, RV32I_RegisterFile, RV32I_DataMem, the pipeline
    // stage registers, etc.) from reset.
    //
    // Reset semantics:
    //   B1 held  → rst_n=0 → heartbeat resets to 0 → led[1] off
    //   B1 free  → rst_n=1 → CPU runs hello.c, ~11kHz UART writes →
    //              heartbeat[10] blinks at ~1.5 Hz (visible)
    reg [24:0] cpu_heartbeat = 25'd0;
    always @(posedge clk_25mhz) begin
        if (!rst_n)        cpu_heartbeat <= 25'd0;
        else if (uart_write) cpu_heartbeat <= cpu_heartbeat + 25'd1;
    end
    assign led[1] = cpu_heartbeat[10];

    uart_tx_bb uart_inst (
        .clk       (clk_25mhz),
        .tx_byte   (data_write[7:0]),
        .tx_write  (uart_write),
        .tx_serial (uart_tx),
        .tx_ready  (uart_ready)
    );

    // ── IMEM data-path read (raw word — CPU WB stage handles alignment) ──────
    wire [31:0] imem_rdata = imem[data_addr[10:2]];

    // ── DMEM read (raw word — CPU WB stage handles alignment) ─────────────
    wire [31:0] dmem_rdata = dmem[data_addr[11:2]];

    // ── DMEM write with byte-enables ───────────────────────────────────────
    always @(posedge clk_25mhz) begin
        if (data_mem_write & sel_dmem) begin
            case (data_funct3[1:0])
                2'd0: begin // SB – write one byte
                    case (data_addr[1:0])
                        2'd0: dmem[data_addr[11:2]][ 7: 0] <= data_write[7:0];
                        2'd1: dmem[data_addr[11:2]][15: 8] <= data_write[7:0];
                        2'd2: dmem[data_addr[11:2]][23:16] <= data_write[7:0];
                        2'd3: dmem[data_addr[11:2]][31:24] <= data_write[7:0];
                    endcase
                end
                2'd1: begin // SH – write halfword
                    if (data_addr[1])
                        dmem[data_addr[11:2]][31:16] <= data_write[15:0];
                    else
                        dmem[data_addr[11:2]][15: 0] <= data_write[15:0];
                end
                default: // SW – write full word
                    dmem[data_addr[11:2]] <= data_write;
            endcase
        end
    end

    // ── Data read mux ──────────────────────────────────────────────────────
    always @(*) begin
        if (sel_imem & data_mem_read)
            data_read = imem_rdata;
        else if (sel_dmem & data_mem_read)
            data_read = dmem_rdata;
        else if (sel_uart & data_mem_read)
            data_read = {31'b0, uart_ready};
        else
            data_read = 32'b0;
    end

endmodule
