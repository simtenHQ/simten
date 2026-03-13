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
	"syscall"
	"time"
)

// Max source code size: 50KB
const maxSourceSize = 50 * 1024

// Compilation timeout
const compileTimeout = 10 * time.Second

type CompileRequest struct {
	Source   string `json:"source"`
	Language string `json:"language"` // "c", "cpp", "rust", "asm"
}

type CompileResponse struct {
	Success bool   `json:"success"`
	Binary  []byte `json:"binary,omitempty"`  // Raw ELF or flat binary
	Stdout  string `json:"stdout,omitempty"`  // Compiler stdout
	Stderr  string `json:"stderr,omitempty"`  // Compiler stderr
	Error   string `json:"error,omitempty"`   // Server-level error
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func compileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, maxSourceSize+1024)

	var req CompileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, CompileResponse{
			Success: false,
			Error:   "invalid request body",
		})
		return
	}

	if len(req.Source) == 0 {
		writeJSON(w, http.StatusBadRequest, CompileResponse{
			Success: false,
			Error:   "source code is empty",
		})
		return
	}

	if len(req.Source) > maxSourceSize {
		writeJSON(w, http.StatusBadRequest, CompileResponse{
			Success: false,
			Error:   fmt.Sprintf("source code exceeds %dKB limit", maxSourceSize/1024),
		})
		return
	}

	switch req.Language {
	case "c":
		compileGCC(w, req.Source, "c")
	case "cpp":
		compileGCC(w, req.Source, "cpp")
	case "rust":
		compileRust(w, req.Source)
	case "asm":
		compileASM(w, req.Source)
	default:
		writeJSON(w, http.StatusBadRequest, CompileResponse{
			Success: false,
			Error:   fmt.Sprintf("unsupported language: %q (supported: c, cpp, rust, asm)", req.Language),
		})
	}
}

// linkerScript is shared by C, C++, and Rust bare-metal builds
const linkerScript = `
OUTPUT_ARCH(riscv)
ENTRY(_start)

MEMORY {
    RAM (rwx) : ORIGIN = 0x00000000, LENGTH = 64K
}

SECTIONS {
    .text : {
        *(.text._start)
        *(.text*)
    } > RAM

    .rodata : { *(.rodata*) } > RAM
    .data : { *(.data*) } > RAM

    .bss : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    } > RAM

    __stack_top = ORIGIN(RAM) + LENGTH(RAM);
    __heap_start = __bss_end;
    __heap_end = __stack_top - 2048;
}
`

// crt0Source is the minimal startup stub for C/C++/Rust programs.
// Sets stack pointer, calls main, then halts in an infinite loop.
const crt0Source = `.section .text._start
.global _start
_start:
    la sp, __stack_top
    call main
1:  j 1b
`

// buildCrt0 writes and assembles crt0.S in the given directory.
// Returns the path to crt0.o, or an error.
func buildCrt0(ctx context.Context, dir string) (string, error) {
	crt0Asm := filepath.Join(dir, "crt0.S")
	crt0Obj := filepath.Join(dir, "crt0.o")

	if err := os.WriteFile(crt0Asm, []byte(crt0Source), 0644); err != nil {
		return "", fmt.Errorf("failed to write crt0.S: %w", err)
	}

	cmd := exec.CommandContext(ctx, "riscv-none-elf-as",
		"-march=rv32i", "-mabi=ilp32",
		"-o", crt0Obj,
		crt0Asm,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to assemble crt0.S: %s", string(out))
	}

	return crt0Obj, nil
}

// compileGCC handles C and C++ via riscv-none-elf-gcc / g++
func compileGCC(w http.ResponseWriter, source string, lang string) {
	id := randomID()
	dir := filepath.Join("/tmp/compile", id)
	os.MkdirAll(dir, 0755)
	defer os.RemoveAll(dir)

	ext := ".c"
	compiler := "riscv-none-elf-gcc"
	if lang == "cpp" {
		ext = ".cpp"
		compiler = "riscv-none-elf-g++"
	}

	srcFile := filepath.Join(dir, "main"+ext)
	elfFile := filepath.Join(dir, "main.elf")
	binFile := filepath.Join(dir, "main.bin")
	linkerFile := filepath.Join(dir, "link.ld")

	if err := os.WriteFile(srcFile, []byte(source), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to write source file",
		})
		return
	}

	if err := os.WriteFile(linkerFile, []byte(linkerScript), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to write linker script",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), compileTimeout)
	defer cancel()

	// Build crt0 startup stub
	crt0Obj, crt0Err := buildCrt0(ctx, dir)
	if crt0Err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   crt0Err.Error(),
		})
		return
	}

	args := []string{
		"-march=rv32i", "-mabi=ilp32",
		"-nostdlib", "-ffreestanding",
		"-O1",
		"-T", linkerFile,
		"-o", elfFile,
		crt0Obj, // link startup stub
		srcFile,
	}
	// C++ extras: no exceptions or RTTI (bare metal)
	if lang == "cpp" {
		args = append([]string{"-fno-exceptions", "-fno-rtti"}, args...)
	}

	compileCmd := exec.CommandContext(ctx, compiler, args...)
	compileOut, compileErr := compileCmd.CombinedOutput()

	if compileCmd.ProcessState != nil && !compileCmd.ProcessState.Success() {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Stderr:  string(compileOut),
		})
		return
	}
	if compileErr != nil {
		writeTimeoutOrError(w, ctx, compileErr, compileOut)
		return
	}

	binary, err := extractBinary(ctx, elfFile, binFile)
	if err != nil {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, CompileResponse{
		Success: true,
		Binary:  binary,
		Stdout:  string(compileOut),
	})
}

// compileRust handles Rust via rustc targeting riscv32i
func compileRust(w http.ResponseWriter, source string) {
	id := randomID()
	dir := filepath.Join("/tmp/compile", id)
	os.MkdirAll(dir, 0755)
	defer os.RemoveAll(dir)

	srcFile := filepath.Join(dir, "main.rs")
	elfFile := filepath.Join(dir, "main.elf")
	binFile := filepath.Join(dir, "main.bin")
	linkerFile := filepath.Join(dir, "link.ld")

	if err := os.WriteFile(srcFile, []byte(source), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to write source file",
		})
		return
	}

	if err := os.WriteFile(linkerFile, []byte(linkerScript), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to write linker script",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), compileTimeout)
	defer cancel()

	// Build crt0 startup stub
	crt0Obj, crt0Err := buildCrt0(ctx, dir)
	if crt0Err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   crt0Err.Error(),
		})
		return
	}

	// rustc targeting bare-metal riscv32i
	// -C link-arg=-T passes linker script
	// -C linker= uses our cross-linker
	// crt0.o provides _start which calls main
	compileCmd := exec.CommandContext(ctx, "rustc",
		"--target", "riscv32i-unknown-none-elf",
		"--edition", "2021",
		"-C", "opt-level=1",
		"-C", "linker=riscv-none-elf-ld",
		"-C", "link-arg=-T"+linkerFile,
		"-C", "link-arg="+crt0Obj,
		"-o", elfFile,
		srcFile,
	)
	compileOut, compileErr := compileCmd.CombinedOutput()

	if compileCmd.ProcessState != nil && !compileCmd.ProcessState.Success() {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Stderr:  string(compileOut),
		})
		return
	}
	if compileErr != nil {
		writeTimeoutOrError(w, ctx, compileErr, compileOut)
		return
	}

	binary, err := extractBinary(ctx, elfFile, binFile)
	if err != nil {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, CompileResponse{
		Success: true,
		Binary:  binary,
		Stdout:  string(compileOut),
	})
}

// extractBinary runs objcopy to produce a flat binary from an ELF
func extractBinary(ctx context.Context, elfFile, binFile string) ([]byte, error) {
	objcopyCmd := exec.CommandContext(ctx, "riscv-none-elf-objcopy",
		"-O", "binary",
		elfFile, binFile,
	)
	objcopyOut, objcopyErr := objcopyCmd.CombinedOutput()

	if objcopyErr != nil {
		return nil, fmt.Errorf("objcopy failed: %s", string(objcopyOut))
	}

	binary, err := os.ReadFile(binFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read output binary")
	}
	return binary, nil
}

// writeTimeoutOrError writes a compile error or timeout response
func writeTimeoutOrError(w http.ResponseWriter, ctx context.Context, err error, output []byte) {
	if ctx.Err() == context.DeadlineExceeded {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Error:   "compilation timed out",
		})
	} else {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Error:   err.Error(),
			Stderr:  string(output),
		})
	}
}

func compileASM(w http.ResponseWriter, source string) {
	id := randomID()
	dir := filepath.Join("/tmp/compile", id)
	os.MkdirAll(dir, 0755)
	defer os.RemoveAll(dir)

	srcFile := filepath.Join(dir, "main.S")
	objFile := filepath.Join(dir, "main.o")
	binFile := filepath.Join(dir, "main.bin")

	// Write source file
	if err := os.WriteFile(srcFile, []byte(source), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to write source file",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), compileTimeout)
	defer cancel()

	// Assemble
	asmCmd := exec.CommandContext(ctx, "riscv-none-elf-as",
		"-march=rv32i", "-mabi=ilp32",
		"-o", objFile,
		srcFile,
	)
	asmOut, asmErr := asmCmd.CombinedOutput()

	if asmErr != nil {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Stderr:  string(asmOut),
		})
		return
	}

	// Extract flat binary
	objcopyCmd := exec.CommandContext(ctx, "riscv-none-elf-objcopy",
		"-O", "binary",
		objFile, binFile,
	)
	objcopyOut, objcopyErr := objcopyCmd.CombinedOutput()

	if objcopyErr != nil {
		writeJSON(w, http.StatusOK, CompileResponse{
			Success: false,
			Error:   "objcopy failed: " + string(objcopyOut),
		})
		return
	}

	binary, err := os.ReadFile(binFile)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, CompileResponse{
			Success: false,
			Error:   "failed to read output binary",
		})
		return
	}

	writeJSON(w, http.StatusOK, CompileResponse{
		Success: true,
		Binary:  binary,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	// Verify toolchain is available
	cmd := exec.Command("riscv-none-elf-gcc", "--version")
	out, err := cmd.Output()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status": "unhealthy",
			"error":  "riscv-none-elf-gcc not found",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "healthy",
		"toolchain": string(out[:min(len(out), 80)]),
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func main() {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	router := http.NewServeMux()
	router.HandleFunc("/compile", compileHandler)
	router.HandleFunc("/health", healthHandler)
	router.HandleFunc("/", healthHandler)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("Compiler server listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	sig := <-stop
	log.Printf("Received signal (%s), shutting down...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal(err)
	}

	log.Println("Server shutdown successfully")
}
