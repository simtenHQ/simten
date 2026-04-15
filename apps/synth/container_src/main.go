package main

import (
	"context"
	"crypto/rand"
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

// Synthesis timeout — longer than iverilog since Yosys does more work
const synthTimeout = 30 * time.Second

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
func buildYosysScript(top, target, netlistPath string) string {
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

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "healthy",
		"service": "verilog-synth",
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/synth", synthHandler)
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
