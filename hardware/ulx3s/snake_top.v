// ============================================================
// TMDS encoder — DVI 8b/10b with DC balance
// ============================================================
module tmds_encoder (
    input  wire       clk,
    input  wire [7:0] data,
    input  wire [1:0] ctrl,
    input  wire       active,
    output reg  [9:0] tmds
);
    // Count ones in input byte
    wire [3:0] n1 = data[0] + data[1] + data[2] + data[3]
                  + data[4] + data[5] + data[6] + data[7];

    // Choose XNOR (use_xnor=1) when >4 ones, or exactly 4 ones and data[0]=0
    wire use_xnor = (n1 > 4) || (n1 == 4 && !data[0]);

    // Transition-minimised word q_m[7:0], q_m[8] = 1 means XOR used
    wire [8:0] q_m;
    assign q_m[0] = data[0];
    assign q_m[1] = use_xnor ? ~(q_m[0] ^ data[1]) : (q_m[0] ^ data[1]);
    assign q_m[2] = use_xnor ? ~(q_m[1] ^ data[2]) : (q_m[1] ^ data[2]);
    assign q_m[3] = use_xnor ? ~(q_m[2] ^ data[3]) : (q_m[2] ^ data[3]);
    assign q_m[4] = use_xnor ? ~(q_m[3] ^ data[4]) : (q_m[3] ^ data[4]);
    assign q_m[5] = use_xnor ? ~(q_m[4] ^ data[5]) : (q_m[4] ^ data[5]);
    assign q_m[6] = use_xnor ? ~(q_m[5] ^ data[6]) : (q_m[5] ^ data[6]);
    assign q_m[7] = use_xnor ? ~(q_m[6] ^ data[7]) : (q_m[6] ^ data[7]);
    assign q_m[8] = ~use_xnor;  // 1 = XOR used, 0 = XNOR used

    wire [3:0] n1_qm = q_m[0] + q_m[1] + q_m[2] + q_m[3]
                     + q_m[4] + q_m[5] + q_m[6] + q_m[7];
    wire [3:0] n0_qm = 4'd8 - n1_qm;

    reg signed [4:0] cnt;  // running disparity

    always @(posedge clk) begin
        if (!active) begin
            case (ctrl)
                2'b00: tmds <= 10'b1101010100;
                2'b01: tmds <= 10'b0010101011;
                2'b10: tmds <= 10'b0101010100;
                2'b11: tmds <= 10'b1010101011;
            endcase
            cnt <= 5'sd0;
        end else if (cnt == 5'sd0 || n1_qm == n0_qm) begin
            tmds[9]   <= ~q_m[8];
            tmds[8]   <=  q_m[8];
            tmds[7:0] <= q_m[8] ? q_m[7:0] : ~q_m[7:0];
            if (q_m[8])
                cnt <= cnt + ($signed({1'b0, n1_qm}) - $signed({1'b0, n0_qm}));
            else
                cnt <= cnt + ($signed({1'b0, n0_qm}) - $signed({1'b0, n1_qm}));
        end else begin
            if ((!cnt[4] && n1_qm > n0_qm) || (cnt[4] && n1_qm < n0_qm)) begin
                tmds[9]   <= 1'b1;
                tmds[8]   <= q_m[8];
                tmds[7:0] <= ~q_m[7:0];
                cnt <= cnt + {{3{q_m[8]}}, q_m[8], 1'b0}
                           + ($signed({1'b0, n0_qm}) - $signed({1'b0, n1_qm}));
            end else begin
                tmds[9]   <= 1'b0;
                tmds[8]   <= q_m[8];
                tmds[7:0] <= q_m[7:0];
                cnt <= cnt - {{3{~q_m[8]}}, ~q_m[8], 1'b0}
                           + ($signed({1'b0, n1_qm}) - $signed({1'b0, n0_qm}));
            end
        end
    end
endmodule

// ============================================================
// TMDS 10:1 serialiser using two 5-bit shift registers + ODDRX1F.
//
// Split even/odd bits: at each of the 5 clk_shift cycles per pixel,
// ODDRX1F outputs sr0[0] at rising edge and sr1[0] at falling edge,
// giving bits [0,1], [2,3], [4,5], [6,7], [8,9] in order.
// ============================================================
module tmds_serializer (
    input  wire        clk_shift,  // 125 MHz
    input  wire [9:0]  tmds,       // TMDS word from encoder (pixel-clock domain)
    output wire        q,          // positive differential output
    output wire        qn          // negative differential output (complement)
);
    reg [4:0] sr0 = 5'b0;  // even bits: tmds[0,2,4,6,8]
    reg [4:0] sr1 = 5'b0;  // odd  bits: tmds[1,3,5,7,9]
    reg [2:0] cnt = 3'd4;  // starts at 4 so first cycle loads

    always @(posedge clk_shift) begin
        if (cnt == 3'd4) begin
            cnt <= 0;
            sr0 <= {tmds[8], tmds[6], tmds[4], tmds[2], tmds[0]};
            sr1 <= {tmds[9], tmds[7], tmds[5], tmds[3], tmds[1]};
        end else begin
            cnt <= cnt + 1;
            sr0 <= {1'b0, sr0[4:1]};
            sr1 <= {1'b0, sr1[4:1]};
        end
    end

    // Two DDR flip-flops: one for positive, one for inverted (negative)
    // Both registered in the IO cell for matched timing / minimal skew
    ODDRX1F ddr_p (.D0(sr0[0]),  .D1(sr1[0]),  .SCLK(clk_shift), .RST(1'b0), .Q(q));
    ODDRX1F ddr_n (.D0(~sr0[0]), .D1(~sr1[0]), .SCLK(clk_shift), .RST(1'b0), .Q(qn));
endmodule

// ============================================================
// ECP5 PLL — 25 MHz in → 125 MHz (clkop) + 25 MHz (clkos)
// VCO = 500 MHz: CLKI_DIV=1 CLKFB_DIV=5 CLKOP_DIV=4 CLKOS_DIV=20
// ============================================================
module ecp5pll (
    input  wire clki,
    output wire clkop,    // 125 MHz — TMDS shift clock
    output wire clkos,    // 25 MHz  — pixel clock
    output wire locked
);
    (* FREQUENCY_PIN_CLKI="25" *)
    (* FREQUENCY_PIN_CLKOP="125" *)
    (* FREQUENCY_PIN_CLKOS="25" *)
    (* ICP_CURRENT="12" *)
    (* LPF_RESISTOR="8" *)
    EHXPLLL #(
        .PLLRST_ENA      ("DISABLED"),
        .INTFB_WAKE      ("DISABLED"),
        .STDBY_ENABLE    ("DISABLED"),
        .DPHASE_SOURCE   ("DISABLED"),
        .OUTDIVIDER_MUXA ("DIVA"),
        .OUTDIVIDER_MUXB ("DIVB"),
        .CLKOP_ENABLE    ("ENABLED"),
        .CLKOS_ENABLE    ("ENABLED"),
        .CLKOS2_ENABLE   ("DISABLED"),
        .CLKOS3_ENABLE   ("DISABLED"),
        .CLKOP_DIV       (4),
        .CLKOS_DIV       (20),
        .CLKOS2_DIV      (1),
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
        .CLKOS2    (),
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
// Top-level: VGA timing + game clock + SnakeAdvanced + TMDS out
// ============================================================
module snake_top (
    input  wire       clk_25mhz,
    input  wire [6:3] btn,        // [3]=up [4]=down [5]=left [6]=right
    output wire [3:0] gpdi_dp,
    output wire [3:0] gpdi_dn
);
    // ── Clocks ──────────────────────────────────────────────
    wire clk_pixel, clk_shift, pll_locked;

    ecp5pll pll (
        .clki   (clk_25mhz),
        .clkop  (clk_shift),
        .clkos  (clk_pixel),
        .locked (pll_locked)
    );

    // ── VGA timing (640×480 @ 60 Hz, 25 MHz pixel clock) ───
    // H: 640 active + 16 FP + 96 sync + 48 BP = 800
    // V: 480 active + 10 FP +  2 sync + 33 BP = 525
    reg [9:0] hcnt = 0;
    reg [9:0] vcnt = 0;

    always @(posedge clk_pixel) begin
        if (hcnt == 10'd799) begin
            hcnt <= 0;
            if (vcnt == 10'd524) vcnt <= 0;
            else                 vcnt <= vcnt + 1;
        end else
            hcnt <= hcnt + 1;
    end

    wire hactive = (hcnt < 640);
    wire vactive = (vcnt < 480);
    wire active  = hactive & vactive;
    wire hsync   = ~((hcnt >= 10'd656) && (hcnt < 10'd752));
    wire vsync   = ~((vcnt >= 10'd490) && (vcnt < 10'd492));

    // ── 8×8 cell grid counters (60 pixels per cell) ────────
    reg [2:0] cell_row = 0;
    reg [2:0] cell_col = 0;
    reg [5:0] row_px   = 0;
    reg [6:0] col_px   = 0;  // 0–79 (80px per column, 640/8)

    always @(posedge clk_pixel) begin
        // Column pixel counter — resets on each new row or end of active area
        if (!hactive) begin
            col_px   <= 0;
            cell_col <= 0;
        end else if (col_px == 7'd79) begin
            col_px   <= 0;
            cell_col <= cell_col + 1;
        end else
            col_px <= col_px + 1;

        // Row pixel counter — advances once per full horizontal line
        if (hcnt == 10'd799) begin
            if (!vactive) begin
                row_px   <= 0;
                cell_row <= 0;
            end else if (row_px == 6'd59) begin
                row_px   <= 0;
                cell_row <= cell_row + 1;
            end else
                row_px <= row_px + 1;
        end
    end

    reg [5:0] scan_addr = 0;
    always @(posedge clk_pixel)
        scan_addr <= {cell_row, cell_col};

    // ── Game clock divider (~5 steps/sec at 25 MHz) ────────
    // Toggle at 25e6 / 625000 = 40 Hz → 20 posedges/sec
    // 4 phases per game step → 5 game steps/sec
    reg [19:0] snake_div = 0;
    reg        snake_clk = 0;

    always @(posedge clk_pixel) begin
        if (snake_div == 20'd624999) begin
            snake_div <= 0;
            snake_clk <= ~snake_clk;
        end else
            snake_div <= snake_div + 1;
    end

    // ── Direction latch ─────────────────────────────────────
    // Sampled on slow snake_clk so it is stable across game steps
    // Encoding: 0=up 1=right 2=down 3=left
    reg [1:0] dir = 0;

    always @(posedge snake_clk) begin
        if      (btn[3]) dir <= 2'd0;  // up
        else if (btn[6]) dir <= 2'd1;  // right
        else if (btn[4]) dir <= 2'd2;  // down
        else if (btn[5]) dir <= 2'd3;  // left
    end

    // ── SnakeAdvanced game circuit ──────────────────────────
    wire [7:0] pixel_out;

    SnakeAdvanced snake_inst (
        .clk       (snake_clk),
        .dir       (dir),
        .scan_addr (scan_addr),
        .pixel_out (pixel_out)
    );

    // ── Colour mapping (registered, absorbs 1-cycle RAM latency) ──
    reg [7:0] r = 0, g = 0, b = 0;
    reg       active_r = 0;

    always @(posedge clk_pixel) begin
        active_r <= active;
        if (!active_r) begin
            r <= 8'h00; g <= 8'h00; b <= 8'h00;
        end else if (pixel_out != 8'h00) begin
            r <= 8'h00; g <= 8'hFF; b <= 8'h00;  // green — snake / food
        end else begin
            r <= 8'h00; g <= 8'h00; b <= 8'h00;  // black background
        end
    end

    // Sync signals registered to match colour pipeline delay (2 cycles)
    reg hsync_r = 1, vsync_r = 1;
    reg hsync_rr = 1, vsync_rr = 1;

    always @(posedge clk_pixel) begin
        hsync_r  <= hsync;   vsync_r  <= vsync;
        hsync_rr <= hsync_r; vsync_rr <= vsync_r;
    end

    // ── TMDS encode (runs on clk_pixel) ────────────────────
    wire [9:0] tmds_r, tmds_g, tmds_b;

    // Blue channel carries hsync/vsync during blanking
    tmds_encoder enc_b (.clk(clk_pixel), .data(b), .ctrl({vsync_rr, hsync_rr}), .active(active_r), .tmds(tmds_b));
    tmds_encoder enc_g (.clk(clk_pixel), .data(g), .ctrl(2'b00),                .active(active_r), .tmds(tmds_g));
    tmds_encoder enc_r (.clk(clk_pixel), .data(r), .ctrl(2'b00),                .active(active_r), .tmds(tmds_r));

    // ── 10:1 TMDS serialisers (shift register + ODDRX1F) ───
    // gpdi_dp pins use LVCMOS33D in LPF — the B companion pin is driven
    // automatically as the complement; no OLVDS primitive needed.
    // gpdi: [0]=Blue [1]=Green [2]=Red [3]=Clock
    // gpdi: [0]=Blue [1]=Green [2]=Red [3]=Clock
    tmds_serializer ser_b_inst   (.clk_shift(clk_shift), .tmds(tmds_b),         .q(gpdi_dp[0]), .qn(gpdi_dn[0]));
    tmds_serializer ser_g_inst   (.clk_shift(clk_shift), .tmds(tmds_g),         .q(gpdi_dp[1]), .qn(gpdi_dn[1]));
    tmds_serializer ser_r_inst   (.clk_shift(clk_shift), .tmds(tmds_r),         .q(gpdi_dp[2]), .qn(gpdi_dn[2]));
    tmds_serializer ser_clk_inst (.clk_shift(clk_shift), .tmds(10'b0000011111), .q(gpdi_dp[3]), .qn(gpdi_dn[3]));

endmodule
