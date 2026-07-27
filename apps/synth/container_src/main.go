package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Max source size: 100KB
const maxSourceSize = 100 * 1024

// Synthesis timeout — longer than iverilog since Yosys does more work.
// 30s default (DoS guard for the public service); override with
// SYNTH_TIMEOUT_SECONDS for local runs where big designs brush the limit.
var synthTimeout = timeoutFromEnv("SYNTH_TIMEOUT_SECONDS", 30*time.Second)

// P&R timeout — nextpnr can be slow on large designs
const buildTimeout = 120 * time.Second

func timeoutFromEnv(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return fallback
}

type SynthRequest struct {
	Verilog string            `json:"verilog"`
	Files   map[string]string `json:"files"`
	Top     string            `json:"top"`
	Target  string            `json:"target"`
}

type SynthStats struct {
	Cells         int            `json:"cells"`
	Wires         int            `json:"wires"`
	CellBreakdown map[string]int `json:"cellBreakdown"`
}

type SynthResponse struct {
	Success bool        `json:"success"`
	Stats   *SynthStats `json:"stats,omitempty"`
	Netlist string      `json:"netlist,omitempty"`
	Log     string      `json:"log"`
	Error   string      `json:"error,omitempty"`
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// buildYosysScript returns the Yosys synthesis script for the given target.
//
// The "import" target stops at the coarse-grain RTL netlist: it runs the
// generic front-end passes but NOT techmapping, so word-level cells ($add,
// $mux, $dff, $mem_v2, …) survive for @simten/core's Verilog importer to lift
// into stdlib components. Every synth* target (including plain "synth") lowers
// those to gate/tech primitives ($_AND_, LUT4, TRELLIS_FF …), which the
// importer can't recover into clean source. `hierarchy` (no `flatten`) keeps
// submodules as separate modules so the importer emits one Circuit per module.
func buildYosysScript(top, target, netlistPath string) string {
	if target == "import" {
		return fmt.Sprintf(
			"hierarchy -top %s; proc; opt_clean; memory_collect; stat; write_json %s",
			top, netlistPath,
		)
	}

	var synthCmd string
	switch target {
	case "ice40":
		synthCmd = fmt.Sprintf("synth_ice40 -top %s", top)
	case "ecp5":
		synthCmd = fmt.Sprintf("synth_ecp5 -top %s", top)
	default:
		synthCmd = fmt.Sprintf("synth -top %s", top)
	}
	return fmt.Sprintf("%s; write_json %s", synthCmd, netlistPath)
}

// parseStats extracts cell and wire counts from Yosys stdout.
//
// Yosys prints a statistics section like:
//
//	Number of wires:                  5
//	Number of cells:                  3
//	  $_AND_                          1
//	  $_XOR_                          2
func parseStats(output string) *SynthStats {
	stats := &SynthStats{
		CellBreakdown: make(map[string]int),
	}

	reTotal := regexp.MustCompile(`Number of (\w+):\s+(\d+)`)
	// Cell breakdown lines are indented with spaces and look like:
	//   <cell_type>    <count>
	reCell := regexp.MustCompile(`^\s{2,}(\S+)\s+(\d+)\s*$`)

	inCellSection := false

	for _, line := range strings.Split(output, "\n") {
		if m := reTotal.FindStringSubmatch(line); m != nil {
			n, _ := strconv.Atoi(m[2])
			switch m[1] {
			case "wires":
				stats.Wires = n
			case "cells":
				stats.Cells = n
				inCellSection = true
			}
			continue
		}
		if inCellSection {
			if m := reCell.FindStringSubmatch(line); m != nil {
				n, _ := strconv.Atoi(m[2])
				stats.CellBreakdown[m[1]] = n
			} else if strings.TrimSpace(line) == "" {
				// blank line ends the cell breakdown section
				inCellSection = false
			}
		}
	}

	return stats
}

func synthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSourceSize+1024)

	var req SynthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error:   "invalid request body",
		})
		return
	}

	if len(req.Verilog) == 0 {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error:   "verilog source is required",
		})
		return
	}

	if len(req.Top) == 0 {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error:   "top module name is required",
		})
		return
	}

	if req.Target == "" {
		req.Target = "generic"
	}

	// Create temp directory
	dir := filepath.Join("/tmp/synth", randomID())
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, SynthResponse{
			Success: false,
			Log:     "",
			Error:   "failed to create temp directory",
		})
		return
	}
	defer os.RemoveAll(dir)

	// Write Verilog source
	dutPath := filepath.Join(dir, "dut.v")
	if err := os.WriteFile(dutPath, []byte(req.Verilog), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, SynthResponse{
			Success: false,
			Log:     "",
			Error:   "failed to write verilog file",
		})
		return
	}

	// Write sidecar files (e.g. $readmemh hex files)
	for name, content := range req.Files {
		// Sanitise: only allow basename, no path traversal
		name = filepath.Base(name)
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			writeJSON(w, http.StatusInternalServerError, SynthResponse{
				Success: false,
				Log:     "",
				Error:   fmt.Sprintf("failed to write sidecar file %s", name),
			})
			return
		}
	}

	// Build and run Yosys
	netlistPath := filepath.Join(dir, "netlist.json")
	script := buildYosysScript(req.Top, req.Target, netlistPath)

	ctx, cancel := context.WithTimeout(context.Background(), synthTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "yosys", "-p", script, dutPath)
	cmd.Dir = dir // so $readmemh relative paths resolve correctly
	out, err := cmd.CombinedOutput()
	yosysLog := string(out)

	if ctx.Err() == context.DeadlineExceeded {
		writeJSON(w, http.StatusOK, SynthResponse{
			Success: false,
			Log:     yosysLog,
			Error:   "synthesis timed out (30s limit)",
		})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusOK, SynthResponse{
			Success: false,
			Log:     yosysLog,
			Error:   fmt.Sprintf("yosys failed: %s", err.Error()),
		})
		return
	}

	// Parse stats from log
	stats := parseStats(yosysLog)

	// Read netlist JSON if written
	var netlist string
	if data, err := os.ReadFile(netlistPath); err == nil {
		netlist = string(data)
	}

	writeJSON(w, http.StatusOK, SynthResponse{
		Success: true,
		Stats:   stats,
		Netlist: netlist,
		Log:     yosysLog,
	})
}

// ---- /build types ----------------------------------------------------------

type BuildRequest struct {
	Netlist string `json:"netlist"` // JSON netlist from /synth
	Top     string `json:"top"`
	LPF     string `json:"lpf"`     // optional pin constraints
	Device  string `json:"device"`  // default "LFE5U-85F"
	Package string `json:"package"` // default "CABGA381"
}

type TimingStats struct {
	AchievedMHz   float64 `json:"achieved_mhz"`
	ConstraintMHz float64 `json:"constraint_mhz"`
}

type UtilStats struct {
	Comb int `json:"comb"` // TRELLIS_COMB (combinational LUTs)
	FF   int `json:"ff"`   // TRELLIS_FF (flip-flops)
	BRAM int `json:"bram"` // TRELLIS_BRAM
	IO   int `json:"io"`   // TRELLIS_IO
}

type BuildResponse struct {
	Success     bool         `json:"success"`
	Bitstream   string       `json:"bitstream,omitempty"` // base64-encoded .bit file
	Timing      *TimingStats `json:"timing,omitempty"`
	Utilization *UtilStats   `json:"utilization,omitempty"`
	Log         string       `json:"log"`
	Error       string       `json:"error,omitempty"`
}

// parseTiming extracts the achieved MHz from nextpnr output.
// nextpnr prints lines like:
//
//	Info: Max frequency for clock 'clk': 87.32 MHz (PASS at 50.00 MHz)
func parseTiming(output string) *TimingStats {
	re := regexp.MustCompile(`Max frequency for clock[^:]*:\s+([\d.]+) MHz(?:\s+\((?:PASS|FAIL) at ([\d.]+) MHz\))?`)
	stats := &TimingStats{}
	if m := re.FindStringSubmatch(output); m != nil {
		stats.AchievedMHz, _ = strconv.ParseFloat(m[1], 64)
		if m[2] != "" {
			stats.ConstraintMHz, _ = strconv.ParseFloat(m[2], 64)
		}
	}
	return stats
}

// parseUtilization extracts resource usage from nextpnr output.
// Newer nextpnr versions use TRELLIS_COMB/TRELLIS_FF instead of TRELLIS_SLICE.
// Format: "Info: \t        TRELLIS_COMB:      16/  83640     0%"
func parseUtilization(output string) *UtilStats {
	util := &UtilStats{}
	reComb := regexp.MustCompile(`TRELLIS_COMB:\s+(\d+)`)
	reFF := regexp.MustCompile(`TRELLIS_FF:\s+(\d+)`)
	reBRAM := regexp.MustCompile(`TRELLIS_BRAM:\s+(\d+)`)
	reIO := regexp.MustCompile(`TRELLIS_IO:\s+(\d+)`)
	if m := reComb.FindStringSubmatch(output); m != nil {
		util.Comb, _ = strconv.Atoi(m[1])
	}
	if m := reFF.FindStringSubmatch(output); m != nil {
		util.FF, _ = strconv.Atoi(m[1])
	}
	if m := reBRAM.FindStringSubmatch(output); m != nil {
		util.BRAM, _ = strconv.Atoi(m[1])
	}
	if m := reIO.FindStringSubmatch(output); m != nil {
		util.IO, _ = strconv.Atoi(m[1])
	}
	return util
}

// deviceToFlag maps a device string to the nextpnr-ecp5 size flag.
// nextpnr-ecp5 uses --25k / --45k / --85k, not --device.
func deviceToFlag(device string) string {
	switch device {
	case "LFE5U-25F", "LFE5UM-25F", "LFE5UM5G-25F":
		return "--25k"
	case "LFE5U-45F", "LFE5UM-45F", "LFE5UM5G-45F":
		return "--45k"
	default: // LFE5U-85F and anything else → 85K (ULX3S default)
		return "--85k"
	}
}

func buildHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 20*1024*1024) // 20MB — netlist can be large

	var req BuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, BuildResponse{Error: "invalid request body"})
		return
	}

	if len(req.Netlist) == 0 {
		writeJSON(w, http.StatusBadRequest, BuildResponse{Error: "netlist is required"})
		return
	}
	if len(req.Top) == 0 {
		writeJSON(w, http.StatusBadRequest, BuildResponse{Error: "top module name is required"})
		return
	}
	if req.Device == "" {
		req.Device = "LFE5U-85F"
	}
	if req.Package == "" {
		req.Package = "CABGA381"
	}

	// Create temp directory
	dir := filepath.Join("/tmp/synth", randomID())
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, BuildResponse{Error: "failed to create temp directory"})
		return
	}
	defer os.RemoveAll(dir)

	// Write netlist
	netlistPath := filepath.Join(dir, "netlist.json")
	if err := os.WriteFile(netlistPath, []byte(req.Netlist), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, BuildResponse{Error: "failed to write netlist"})
		return
	}

	// Write LPF if provided
	lpfPath := filepath.Join(dir, "constraints.lpf")
	if req.LPF != "" {
		if err := os.WriteFile(lpfPath, []byte(req.LPF), 0644); err != nil {
			writeJSON(w, http.StatusInternalServerError, BuildResponse{Error: "failed to write LPF"})
			return
		}
	}

	// Build nextpnr-ecp5 command.
	// Device size is specified as a flag (--25k / --45k / --85k), not --device.
	configPath := filepath.Join(dir, "output.config")
	deviceFlag := deviceToFlag(req.Device)
	args := []string{
		"--json", netlistPath,
		"--textcfg", configPath,
		deviceFlag,
		"--package", req.Package,
		"--timing-allow-fail",
		"--seed", "1",
	}
	if req.LPF != "" {
		args = append(args, "--lpf", lpfPath)
	}

	ctx, cancel := context.WithTimeout(context.Background(), buildTimeout)
	defer cancel()

	var fullLog strings.Builder

	cmd := exec.CommandContext(ctx, "nextpnr-ecp5", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	fullLog.Write(out)
	nextpnrLog := fullLog.String()

	if ctx.Err() == context.DeadlineExceeded {
		writeJSON(w, http.StatusOK, BuildResponse{
			Success: false,
			Log:     nextpnrLog,
			Error:   "place-and-route timed out (120s limit)",
		})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusOK, BuildResponse{
			Success: false,
			Log:     nextpnrLog,
			Error:   fmt.Sprintf("nextpnr-ecp5 failed: %s", err.Error()),
		})
		return
	}

	// Run ecppack
	bitPath := filepath.Join(dir, "output.bit")
	ecpCmd := exec.Command("ecppack", "--input", configPath, "--bit", bitPath)
	ecpCmd.Dir = dir
	ecpOut, ecpErr := ecpCmd.CombinedOutput()
	fullLog.Write(ecpOut)
	combinedLog := fullLog.String()

	if ecpErr != nil {
		writeJSON(w, http.StatusOK, BuildResponse{
			Success: false,
			Log:     combinedLog,
			Error:   fmt.Sprintf("ecppack failed: %s", ecpErr.Error()),
		})
		return
	}

	// Read and base64-encode the bitstream
	bitData, err := os.ReadFile(bitPath)
	if err != nil {
		writeJSON(w, http.StatusOK, BuildResponse{
			Success: false,
			Log:     combinedLog,
			Error:   "failed to read bitstream",
		})
		return
	}

	bitstream := base64.StdEncoding.EncodeToString(bitData)
	timing := parseTiming(nextpnrLog)
	util := parseUtilization(nextpnrLog)

	writeJSON(w, http.StatusOK, BuildResponse{
		Success:     true,
		Bitstream:   bitstream,
		Timing:      timing,
		Utilization: util,
		Log:         combinedLog,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "healthy",
		"service": "verilog-synth",
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/synth", synthHandler)
	mux.HandleFunc("/build", buildHandler)
	mux.HandleFunc("/health", healthHandler)

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("Yosys synth server listening on :8080")
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
