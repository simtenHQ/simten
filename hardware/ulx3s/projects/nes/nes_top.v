// ============================================================
// NES on the ULX3S: the exported NesBoard, a frame buffer, and HDMI.
//
// The board runs on its own clock, one tick per PPU dot (~5.37 MHz). Every
// pixel it draws goes into a 256x240 frame buffer in block RAM, which the
// 640x480 HDMI side reads at 25 MHz, each NES pixel doubled both ways and
// the picture centred (64 black columns either side).
//
// The TMDS encoder and serialiser come from the Snake project; nes_palette
// is generated from PALETTE_2C02 by index.ts.
// ============================================================

// ECP5 PLL: 25 MHz in, VCO 500 MHz.
//   CLKOP  125 MHz   TMDS shift clock (DDR, so 250 Mbit/s)
//   CLKOS   25 MHz   pixel clock
//   CLKOS2 ~5.376 MHz NES dot clock (500/93; a real NTSC NES is 5.369)
module nes_pll (
    input  wire clki,
    output wire clkop,
    output wire clkos,
    output wire clkos2,
    output wire locked
);
    (* FREQUENCY_PIN_CLKI="25" *)
    (* FREQUENCY_PIN_CLKOP="125" *)
    (* FREQUENCY_PIN_CLKOS="25" *)
    (* FREQUENCY_PIN_CLKOS2="5.376" *)
    (* ICP_CURRENT="12" *)
    (* LPF_RESISTOR="8" *)
    EHXPLLL #(
        .PLLRST_ENA      ("DISABLED"),
        .INTFB_WAKE      ("DISABLED"),
        .STDBY_ENABLE    ("DISABLED"),
        .DPHASE_SOURCE   ("DISABLED"),
        .OUTDIVIDER_MUXA ("DIVA"),
        .OUTDIVIDER_MUXB ("DIVB"),
        .OUTDIVIDER_MUXC ("DIVC"),
        .CLKOP_ENABLE    ("ENABLED"),
        .CLKOS_ENABLE    ("ENABLED"),
        .CLKOS2_ENABLE   ("ENABLED"),
        .CLKOS3_ENABLE   ("DISABLED"),
        .CLKOP_DIV       (4),
        .CLKOS_DIV       (20),
        .CLKOS2_DIV      (93),
        .CLKOS3_DIV      (1),
        .CLKFB_DIV       (5),
        .CLKI_DIV        (1),
        .FEEDBK_PATH     ("CLKOP")
    ) pll_i (
        .CLKI      (clki),
        .CLKFB     (clkop),
        .CLKINTFB  (),
        .CLKOP     (clkop),
        .CLKOS     (clkos),
        .CLKOS2    (clkos2),
        .CLKOS3    (),
        .RST       (1'b0),
        .STDBY     (1'b0),
        .PHASESEL0 (1'b0),
        .PHASESEL1 (1'b0),
        .PHASEDIR  (1'b0),
        .PHASESTEP (1'b0),
        .PHASELOADREG (1'b0),
        .PLLWAKESYNC  (1'b0),
        .ENCLKOP   (1'b0),
        .LOCK      (locked)
    );
endmodule

// ============================================================
// UART receiver, 8N1. CLKS_PER_BIT clocks per bit; 25 at 25 MHz is 1 Mbaud.
// ============================================================
module uart_rx #(parameter CLKS_PER_BIT = 25) (
    input  wire       clk,
    input  wire       rx,
    output reg        valid = 0,
    output reg  [7:0] data = 0
);
    reg rx1 = 1, rx2 = 1;
    reg [1:0] state = 0;          // 0 idle, 1 start bit, 2 data bits, 3 stop bit
    reg [7:0] count = 0;
    reg [2:0] bitn = 0;
    always @(posedge clk) begin
        rx1 <= rx;
        rx2 <= rx1;
        valid <= 1'b0;
        case (state)
            2'd0: if (!rx2) begin state <= 2'd1; count <= 0; end
            2'd1: if (count == CLKS_PER_BIT / 2) begin
                      // Middle of the start bit: still low, or it was a glitch.
                      state <= rx2 ? 2'd0 : 2'd2;
                      count <= 0;
                      bitn  <= 0;
                  end else count <= count + 8'd1;
            2'd2: if (count == CLKS_PER_BIT - 1) begin
                      count <= 0;
                      data  <= {rx2, data[7:1]};
                      bitn  <= bitn + 3'd1;
                      if (bitn == 3'd7) state <= 2'd3;
                  end else count <= count + 8'd1;
            2'd3: if (count == CLKS_PER_BIT - 1) begin
                      state <= 2'd0;
                      valid <= rx2;    // a missing stop bit drops the byte
                  end else count <= count + 8'd1;
        endcase
    end
endmodule

module nes_top (
    input  wire       clk_25mhz,
    input  wire [6:0] btn,        // [0]=PWR (active low) [1]=F1 [2]=F2 [3]=up [4]=down [5]=left [6]=right
    input  wire       ftdi_txd,   // USB serial from the computer
    output wire [7:0] led,
    output wire [3:0] gpdi_dp,
    output wire [3:0] gpdi_dn
);
    // ── Clocks ──────────────────────────────────────────────
    wire clk_shift, clk_pixel, clk_nes, pll_locked;
    nes_pll pll (
        .clki   (clk_25mhz),
        .clkop  (clk_shift),
        .clkos  (clk_pixel),
        .clkos2 (clk_nes),
        .locked (pll_locked)
    );

    // ── Cartridge ───────────────────────────────────────────
    // A real NROM cart has two unclocked ROMs: address in, data out within
    // a cycle. Here they are block RAM, which only reads on a clock edge, so
    // they read on the NES clock's falling edge: the address has settled half
    // a dot after the rising edge, and the data is there before the next one.
    // The NES sees what it would see from a real ROM.
    //
    // PRG is always 32 KB; a 16 KB game is loaded twice, which is what NROM-128
    // looks like at $8000-$FFFF anyway. The cart also decides the nametable
    // mirroring (on real hardware, a solder pad wiring CIRAM A10).
    reg [7:0] prg_mem [0:32767];
    reg [7:0] chr_mem [0:8191];
`ifdef NES_BAKED
    initial $readmemh("nes_prg.hex", prg_mem);
    initial $readmemh("nes_chr.hex", chr_mem);
    reg loaded   = 1'b1;
    reg mirror_v = `NES_BAKED_VERTICAL;
`else
    reg loaded   = 1'b0;
    reg mirror_v = 1'b0;
`endif

    wire [15:0] prg_addr, chr_addr;
    reg  [7:0]  prg_q, chr_q;
    always @(negedge clk_nes) begin
        prg_q <= prg_mem[prg_addr[14:0]];
        chr_q <= chr_mem[chr_addr[12:0]];
    end

    // ── Loader: a game over USB serial at 1 Mbaud ──────────
    // "SIMN", a flags byte (bit 0: vertical mirroring), 32768 bytes of PRG,
    // 8192 of CHR. The NES is held in reset while it loads, then starts.
    wire       rx_valid;
    wire [7:0] rx_data;
    uart_rx #(.CLKS_PER_BIT(25)) rx (.clk(clk_pixel), .rx(ftdi_txd), .valid(rx_valid), .data(rx_data));

    reg [31:0] last4 = 0;
    reg        loading = 0, want_flags = 0;
    reg [15:0] n = 0;
    reg [21:0] idle = 0;
    always @(posedge clk_pixel) begin
        if (rx_valid) begin
            idle  <= 0;
            last4 <= {last4[23:0], rx_data};
            if (want_flags) begin
                mirror_v   <= rx_data[0];
                want_flags <= 1'b0;
                loading    <= 1'b1;
                n          <= 0;
            end else if (loading) begin
                if (n[15]) chr_mem[n[12:0]] <= rx_data;
                else       prg_mem[n[14:0]] <= rx_data;
                n <= n + 16'd1;
                if (n == 16'd40959) begin
                    loading <= 1'b0;
                    loaded  <= 1'b1;
                end
            end else if ({last4[23:0], rx_data} == "SIMN") begin
                want_flags <= 1'b1;
                loaded     <= 1'b0;
            end
        end else if (loading || want_flags) begin
            // A transfer that stalls for ~0.17 s is abandoned.
            idle <= idle + 22'd1;
            if (&idle) begin
                loading    <= 1'b0;
                want_flags <= 1'b0;
            end
        end
    end

    // ── Reset ───────────────────────────────────────────────
    // Run once a game is in and the PLL has locked; reset for 256 NES clocks
    // after that, and again after every load.
    reg run1 = 0, run2 = 0;
    always @(posedge clk_nes) begin
        run1 <= pll_locked && loaded && !loading && !want_flags;
        run2 <= run1;
    end
    reg [7:0] por = 8'd0;
    wire rst_n = (por == 8'hFF);
    always @(posedge clk_nes) begin
        if (!run2) por <= 8'd0;
        else if (!rst_n) por <= por + 8'd1;
    end

    // ── Controller ──────────────────────────────────────────
    // Buttons into the NES clock domain through two flip-flops. NES bit
    // order (BUTTON in nes/src/pads.ts): A B Select Start Up Down Left Right.
    // F1 = A (jump), F2 = B (run), PWR = Start. Select has no button.
    wire [7:0] pad_raw = {btn[6], btn[5], btn[4], btn[3], ~btn[0], 1'b0, btn[2], btn[1]};
    reg  [7:0] pad_s1 = 8'd0, pad = 8'd0;
    always @(posedge clk_nes) begin
        pad_s1 <= pad_raw;
        pad    <= pad_s1;
    end

    // ── The NES ─────────────────────────────────────────────
    wire [7:0] video_x, video_y;
    wire       video_we;
    wire [5:0] color;
    wire [15:0] cpu_addr;
    wire [7:0]  cpu_data;
    wire        cpu_rw, cpu_sync;

    NesBoard nes (
        .clk      (clk_nes),
        .rst_n    (rst_n),
        .mirror_v (mirror_v),
        .prg_addr (prg_addr),
        .prg_data (prg_q),
        .chr_addr (chr_addr),
        .chr_data (chr_q),
        .pad1     (pad),
        .pad2     (8'd0),
        .addr     (cpu_addr),
        .rw       (cpu_rw),
        .sync     (cpu_sync),
        .data     (cpu_data),
        .video_x  (video_x),
        .video_y  (video_y),
        .video_we (video_we),
        .color    (color)
    );

    // ── Frame buffer: written at the NES clock, read at the pixel clock ──
    reg [5:0] fb [0:65535];
    always @(posedge clk_nes) begin
        if (video_we && video_y < 8'd240) fb[{video_y, video_x}] <= color;
    end

    // ── 640x480 @ 60 Hz timing ──────────────────────────────
    // H: 640 active + 16 FP + 96 sync + 48 BP = 800
    // V: 480 active + 10 FP +  2 sync + 33 BP = 525
    reg [9:0] hcnt = 0;
    reg [9:0] vcnt = 0;
    always @(posedge clk_pixel) begin
        if (hcnt == 10'd799) begin
            hcnt <= 0;
            vcnt <= (vcnt == 10'd524) ? 10'd0 : vcnt + 10'd1;
        end else
            hcnt <= hcnt + 10'd1;
    end

    wire active  = (hcnt < 10'd640) && (vcnt < 10'd480);
    wire picture = (hcnt >= 10'd64) && (hcnt < 10'd576) && (vcnt < 10'd480);
    wire hsync   = ~((hcnt >= 10'd656) && (hcnt < 10'd752));
    wire vsync   = ~((vcnt >= 10'd490) && (vcnt < 10'd492));
    wire [9:0] px = hcnt - 10'd64;

    // Stage 1: read the frame buffer.
    reg [5:0] fb_q = 0;
    reg active1 = 0, picture1 = 0, hsync1 = 1, vsync1 = 1;
    always @(posedge clk_pixel) begin
        fb_q     <= fb[{vcnt[8:1], px[8:1]}];
        active1  <= active;
        picture1 <= picture;
        hsync1   <= hsync;
        vsync1   <= vsync;
    end

    // Stage 2: colour.
    wire [23:0] rgb;
    nes_palette palette (.index(fb_q), .rgb(rgb));
    reg [7:0] r = 0, g = 0, b = 0;
    reg active2 = 0, hsync2 = 1, vsync2 = 1;
    always @(posedge clk_pixel) begin
        {r, g, b} <= picture1 ? rgb : 24'd0;
        active2   <= active1;
        hsync2    <= hsync1;
        vsync2    <= vsync1;
    end

    // ── TMDS out ────────────────────────────────────────────
    wire [9:0] tmds_r, tmds_g, tmds_b;
    tmds_encoder enc_b (.clk(clk_pixel), .data(b), .ctrl({vsync2, hsync2}), .active(active2), .tmds(tmds_b));
    tmds_encoder enc_g (.clk(clk_pixel), .data(g), .ctrl(2'b00),            .active(active2), .tmds(tmds_g));
    tmds_encoder enc_r (.clk(clk_pixel), .data(r), .ctrl(2'b00),            .active(active2), .tmds(tmds_r));

    // gpdi: [0]=Blue [1]=Green [2]=Red [3]=Clock
    tmds_serializer ser_b   (.clk_shift(clk_shift), .tmds(tmds_b),         .q(gpdi_dp[0]), .qn(gpdi_dn[0]));
    tmds_serializer ser_g   (.clk_shift(clk_shift), .tmds(tmds_g),         .q(gpdi_dp[1]), .qn(gpdi_dn[1]));
    tmds_serializer ser_r   (.clk_shift(clk_shift), .tmds(tmds_r),         .q(gpdi_dp[2]), .qn(gpdi_dn[2]));
    tmds_serializer ser_clk (.clk_shift(clk_shift), .tmds(10'b0000011111), .q(gpdi_dp[3]), .qn(gpdi_dn[3]));

    // ── LEDs, for when the screen is blank ──────────────────
    // [0] PLL locked  [1] running  [2] frames (toggles every 32)
    // [3] CPU reached the cartridge  [7:4] buttons up/down/left/right
    // While a game loads, [1] is off and [0] shows serial bytes arriving.
    reg [5:0] frames = 0;
    reg       in_cart = 0;
    always @(posedge clk_nes) begin
        if (video_we && video_x == 8'd255 && video_y == 8'd239) frames <= frames + 6'd1;
        if (!rst_n) in_cart <= 1'b0;
        else if (cpu_sync && cpu_addr[15]) in_cart <= 1'b1;
    end
    assign led = {btn[6], btn[5], btn[4], btn[3], in_cart, frames[5], rst_n,
                  loading ? n[9] : pll_locked};
endmodule
