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
    wire [3:0] n1 = data[0] + data[1] + data[2] + data[3]
                  + data[4] + data[5] + data[6] + data[7];
    wire use_xnor = (n1 > 4) || (n1 == 4 && !data[0]);

    wire [8:0] q_m;
    assign q_m[0] = data[0];
    assign q_m[1] = use_xnor ? ~(q_m[0] ^ data[1]) : (q_m[0] ^ data[1]);
    assign q_m[2] = use_xnor ? ~(q_m[1] ^ data[2]) : (q_m[1] ^ data[2]);
    assign q_m[3] = use_xnor ? ~(q_m[2] ^ data[3]) : (q_m[2] ^ data[3]);
    assign q_m[4] = use_xnor ? ~(q_m[3] ^ data[4]) : (q_m[3] ^ data[4]);
    assign q_m[5] = use_xnor ? ~(q_m[4] ^ data[5]) : (q_m[4] ^ data[5]);
    assign q_m[6] = use_xnor ? ~(q_m[5] ^ data[6]) : (q_m[5] ^ data[6]);
    assign q_m[7] = use_xnor ? ~(q_m[6] ^ data[7]) : (q_m[6] ^ data[7]);
    assign q_m[8] = ~use_xnor;

    wire [3:0] n1_qm = q_m[0] + q_m[1] + q_m[2] + q_m[3]
                     + q_m[4] + q_m[5] + q_m[6] + q_m[7];
    wire [3:0] n0_qm = 4'd8 - n1_qm;

    reg signed [4:0] cnt;

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
// TMDS 10:1 serialiser using two 5-bit shift registers + ODDRX1F
// ============================================================
module tmds_serializer (
    input  wire        clk_shift,
    input  wire [9:0]  tmds,
    output wire        q,
    output wire        qn
);
    reg [4:0] sr0 = 5'b0;
    reg [4:0] sr1 = 5'b0;
    reg [2:0] cnt = 3'd4;

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

    ODDRX1F ddr_p (.D0(sr0[0]),  .D1(sr1[0]),  .SCLK(clk_shift), .RST(1'b0), .Q(q));
    ODDRX1F ddr_n (.D0(~sr0[0]), .D1(~sr1[0]), .SCLK(clk_shift), .RST(1'b0), .Q(qn));
endmodule

// ============================================================
// ECP5 PLL — 25 MHz in → 125 MHz (clkop) + 25 MHz (clkos)
// ============================================================
module ecp5pll (
    input  wire clki,
    output wire clkop,
    output wire clkos,
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
        .CLKI (clki), .CLKFB (clkop), .CLKINTFB (),
        .CLKOP (clkop), .CLKOS (clkos), .CLKOS2 (), .CLKOS3 (),
        .RST (1'b0), .STDBY (1'b0),
        .PHASESEL0 (1'b0), .PHASESEL1 (1'b0), .PHASEDIR (1'b0),
        .PHASESTEP (1'b0), .PHASELOADREG (1'b0), .PLLWAKESYNC (1'b0),
        .ENCLKOP (1'b0), .LOCK (locked)
    );
endmodule

// ============================================================
// Top-level: VGA timing + 32x16 grid + Breakout + TMDS out
//
// The Breakout core is clocked at the 25 MHz pixel clock so its wall-fill
// FSM redraws all 128 bricks in ~5 us (instant). The playable game rate is
// set by pulsing game_en at ~30 Hz — the ball/paddle only step on that pulse.
// The video scan drives scan_addr continuously; pixel_out is combinational.
// ============================================================
module breakout_top (
    input  wire       clk_25mhz,
    input  wire [6:5] btn,        // btn[5] = left, btn[6] = right
    output wire [3:0] gpdi_dp,
    output wire [3:0] gpdi_dn
);
    // ── Clocks ──────────────────────────────────────────────
    wire clk_pixel, clk_shift, pll_locked;
    ecp5pll pll (.clki(clk_25mhz), .clkop(clk_shift), .clkos(clk_pixel), .locked(pll_locked));

    // ── Power-on reset (active-low, gated by PLL lock) ──────
    reg [7:0] por_counter = 8'd0;
    wire por_done = (por_counter == 8'hFF);
    always @(posedge clk_25mhz) if (!por_done) por_counter <= por_counter + 8'd1;
    wire rst_n = por_done & pll_locked;

    // ── VGA timing (640×480 @ 60 Hz, 25 MHz pixel clock) ────
    reg [9:0] hcnt = 0, vcnt = 0;
    always @(posedge clk_pixel) begin
        if (hcnt == 10'd799) begin
            hcnt <= 0;
            vcnt <= (vcnt == 10'd524) ? 10'd0 : vcnt + 10'd1;
        end else hcnt <= hcnt + 10'd1;
    end
    wire hactive = (hcnt < 640);
    wire vactive = (vcnt < 480);
    wire active  = hactive & vactive;
    wire hsync   = ~((hcnt >= 10'd656) && (hcnt < 10'd752));
    wire vsync   = ~((vcnt >= 10'd490) && (vcnt < 10'd492));

    // ── 32×16 cell grid (20 px/col, 30 px/row) ──────────────
    reg [4:0] cell_col = 0;   // 0..31
    reg [3:0] cell_row = 0;   // 0..15
    reg [4:0] col_px   = 0;   // 0..19
    reg [4:0] row_px   = 0;   // 0..29
    always @(posedge clk_pixel) begin
        if (!hactive) begin col_px <= 0; cell_col <= 0; end
        else if (col_px == 5'd19) begin col_px <= 0; cell_col <= cell_col + 5'd1; end
        else col_px <= col_px + 5'd1;

        if (hcnt == 10'd799) begin
            if (!vactive) begin row_px <= 0; cell_row <= 0; end
            else if (row_px == 5'd29) begin row_px <= 0; cell_row <= cell_row + 4'd1; end
            else row_px <= row_px + 5'd1;
        end
    end

    // Register scan_addr (= cell_row*32 + cell_col) and keep cell_row aligned
    reg [8:0] scan_addr  = 0;
    reg [3:0] cell_row_r = 0;
    always @(posedge clk_pixel) begin
        scan_addr  <= {cell_row, cell_col};
        cell_row_r <= cell_row;
    end

    // ── Game-clock enable: ~30 Hz pulse (25e6 / 833333) ─────
    reg [19:0] game_div = 0;
    reg        game_en  = 0;
    always @(posedge clk_pixel) begin
        if (game_div == 20'd833332) begin game_div <= 0; game_en <= 1'b1; end
        else begin game_div <= game_div + 20'd1; game_en <= 1'b0; end
    end

    // ── Paddle input from buttons (75 = left, 77 = right) ───
    wire [7:0] keyboard = btn[5] ? 8'd75 : (btn[6] ? 8'd77 : 8'd0);

    // ── Breakout core ───────────────────────────────────────
    wire [7:0] pixel_out;
    wire       is_filling;
    Breakout game (
        .clk        (clk_pixel),
        .rst_n      (rst_n),
        .scan_addr  (scan_addr),
        .keyboard   (keyboard),
        .game_en    (game_en),
        .pixel_out  (pixel_out),
        .is_filling (is_filling)
    );

    // ── Colour: bricks orange, paddle blue, ball white ──────
    reg [7:0] r = 0, g = 0, b = 0;
    reg       active_r = 0;
    always @(posedge clk_pixel) begin
        active_r <= active;
        if (!active_r) begin
            r <= 8'h00; g <= 8'h00; b <= 8'h00;
        end else if (pixel_out != 8'h00) begin
            if (cell_row_r < 4'd4)        begin r <= 8'hF9; g <= 8'h73; b <= 8'h16; end // orange
            else if (cell_row_r == 4'd15) begin r <= 8'h3B; g <= 8'h82; b <= 8'hF6; end // blue
            else                          begin r <= 8'hFF; g <= 8'hFF; b <= 8'hFF; end // white
        end else begin
            r <= 8'h00; g <= 8'h00; b <= 8'h00;
        end
    end

    // Sync delayed to match the colour pipeline
    reg hsync_r = 1, vsync_r = 1, hsync_rr = 1, vsync_rr = 1;
    always @(posedge clk_pixel) begin
        hsync_r  <= hsync;   vsync_r  <= vsync;
        hsync_rr <= hsync_r; vsync_rr <= vsync_r;
    end

    // ── TMDS encode + serialise ─────────────────────────────
    wire [9:0] tmds_r, tmds_g, tmds_b;
    tmds_encoder enc_b (.clk(clk_pixel), .data(b), .ctrl({vsync_rr, hsync_rr}), .active(active_r), .tmds(tmds_b));
    tmds_encoder enc_g (.clk(clk_pixel), .data(g), .ctrl(2'b00),                .active(active_r), .tmds(tmds_g));
    tmds_encoder enc_r (.clk(clk_pixel), .data(r), .ctrl(2'b00),                .active(active_r), .tmds(tmds_r));

    tmds_serializer ser_b_inst   (.clk_shift(clk_shift), .tmds(tmds_b),         .q(gpdi_dp[0]), .qn(gpdi_dn[0]));
    tmds_serializer ser_g_inst   (.clk_shift(clk_shift), .tmds(tmds_g),         .q(gpdi_dp[1]), .qn(gpdi_dn[1]));
    tmds_serializer ser_r_inst   (.clk_shift(clk_shift), .tmds(tmds_r),         .q(gpdi_dp[2]), .qn(gpdi_dn[2]));
    tmds_serializer ser_clk_inst (.clk_shift(clk_shift), .tmds(10'b0000011111), .q(gpdi_dp[3]), .qn(gpdi_dn[3]));

endmodule
