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
	"strings"
	"syscall"
	"time"
)

// Max source size: 100KB (Verilog can be larger than C)
const maxSourceSize = 100 * 1024

// Simulation timeout
const simTimeout = 10 * time.Second

type VerifyRequest struct {
	Verilog   string `json:"verilog"`
	Testbench string `json:"testbench"`
}

type OutputResult struct {
	TestCase int            `json:"testCase"`
	Cycle    int            `json:"cycle"`
	Outputs  map[string]int `json:"outputs"`
}

type VerifyResponse struct {
	Success       bool           `json:"success"`
	CompileError  string         `json:"compileError,omitempty"`
	SimError      string         `json:"simError,omitempty"`
	Results       []OutputResult `json:"results,omitempty"`
	SimulationLog string         `json:"simulationLog,omitempty"`
	IverilogStderr string        `json:"iverilogStderr,omitempty"`
	// VcdBase64 is the base64-encoded contents of verify.vcd, if the testbench
	// emitted one via $dumpfile/$dumpvars. Capped at maxVcdSize.
	VcdBase64 string `json:"vcdBase64,omitempty"`
}

// Cap returned VCDs at 8MB raw — larger than that is almost never useful for
// debugging a single test and would blow the worker response budget.
const maxVcdSize = 8 * 1024 * 1024

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

// Parse RESULT lines from vvp output
// Format: RESULT|test|<id>|cycle|<n>|<port>|<val>|<port>|<val>|...
func parseResults(output string) []OutputResult {
	var results []OutputResult
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "RESULT|") {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) < 7 || parts[1] != "test" || parts[3] != "cycle" {
			continue
		}

		testCase := 0
		cycle := 0
		fmt.Sscanf(parts[2], "%d", &testCase)
		fmt.Sscanf(parts[4], "%d", &cycle)

		outputs := make(map[string]int)
		for i := 5; i+1 < len(parts); i += 2 {
			portName := parts[i]
			var val int
			fmt.Sscanf(parts[i+1], "%d", &val)
			outputs[portName] = val
		}

		results = append(results, OutputResult{
			TestCase: testCase,
			Cycle:    cycle,
			Outputs:  outputs,
		})
	}
	return results
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSourceSize+1024)

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, VerifyResponse{
			Success:      false,
			CompileError: "invalid request body",
		})
		return
	}

	if len(req.Verilog) == 0 {
		writeJSON(w, http.StatusBadRequest, VerifyResponse{
			Success:      false,
			CompileError: "verilog source is required",
		})
		return
	}

	if len(req.Testbench) == 0 {
		writeJSON(w, http.StatusBadRequest, VerifyResponse{
			Success:      false,
			CompileError: "testbench source is required",
		})
		return
	}

	// Create temp directory
	dir := filepath.Join("/tmp/verify", randomID())
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, VerifyResponse{
			Success:    false,
			SimError:   "failed to create temp directory",
		})
		return
	}
	defer os.RemoveAll(dir)

	// Write source files
	dutPath := filepath.Join(dir, "dut.v")
	tbPath := filepath.Join(dir, "tb.v")
	simPath := filepath.Join(dir, "sim.vvp")

	if err := os.WriteFile(dutPath, []byte(req.Verilog), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, VerifyResponse{
			Success:  false,
			SimError: "failed to write verilog file",
		})
		return
	}

	if err := os.WriteFile(tbPath, []byte(req.Testbench), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, VerifyResponse{
			Success:  false,
			SimError: "failed to write testbench file",
		})
		return
	}

	// Step 1: Compile with iverilog
	ctx, cancel := context.WithTimeout(context.Background(), simTimeout)
	defer cancel()

	compileCmd := exec.CommandContext(ctx, "iverilog", "-o", simPath, dutPath, tbPath)
	compileOut, compileErr := compileCmd.CombinedOutput()

	if compileErr != nil {
		writeJSON(w, http.StatusOK, VerifyResponse{
			Success:        false,
			CompileError:   fmt.Sprintf("iverilog compilation failed: %s", compileErr.Error()),
			IverilogStderr: string(compileOut),
		})
		return
	}

	// Step 2: Simulate with vvp
	simCtx, simCancel := context.WithTimeout(context.Background(), simTimeout)
	defer simCancel()

	simCmd := exec.CommandContext(simCtx, "vvp", simPath)
	// Run vvp from the temp dir so any $dumpfile path the testbench emits
	// (e.g. "verify.vcd") lands inside `dir` where we can read it back.
	simCmd.Dir = dir
	simOut, simErr := simCmd.CombinedOutput()
	simOutput := string(simOut)

	if simErr != nil {
		// Check if it's a timeout
		if simCtx.Err() == context.DeadlineExceeded {
			writeJSON(w, http.StatusOK, VerifyResponse{
				Success:       false,
				SimError:      "simulation timed out (10s limit)",
				SimulationLog: simOutput,
			})
			return
		}
		// vvp returns non-zero on $finish which is normal
		// Only fail if there's no output at all
		if len(simOutput) == 0 {
			writeJSON(w, http.StatusOK, VerifyResponse{
				Success:       false,
				SimError:      fmt.Sprintf("simulation failed: %s", simErr.Error()),
				SimulationLog: simOutput,
			})
			return
		}
	}

	// Step 3: Parse results
	results := parseResults(simOutput)

	// Step 4: Read VCD if the testbench emitted one
	var vcdB64 string
	if data, err := os.ReadFile(filepath.Join(dir, "verify.vcd")); err == nil {
		if len(data) > maxVcdSize {
			data = data[:maxVcdSize]
		}
		vcdB64 = base64.StdEncoding.EncodeToString(data)
	}

	writeJSON(w, http.StatusOK, VerifyResponse{
		Success:       true,
		Results:       results,
		SimulationLog: simOutput,
		VcdBase64:     vcdB64,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "healthy",
		"service": "verilog-verifier",
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/verify", verifyHandler)
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

	log.Printf("Verilog verifier listening on :8080")
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
