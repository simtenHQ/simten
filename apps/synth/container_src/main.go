package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Max size of the single `verilog` field.
//
// 100KB was sized for pasting one module and is the wrong bound for a real
// design: SERV's 14 files concatenate to 81KB, picorv32 is 95KB (92% of the old
// limit), and the servant SoC's 18 files are 130KB and were rejected outright.
// Until multi-file `sources` lands, hand-concatenation is the only way to import
// a project, so this has to fit one. The request-body budget below is the real
// DoS guard.
const maxSourceSize = 256 * 1024

// Total sidecar data accepted alongside the source ($readmemh hex files etc).
const maxFilesSize = 256 * 1024

// Max decoded request body.
//
// JSON string escaping inflates the payload well past the source size: every
// newline, tab and quote costs two bytes instead of one. picorv32 is 94KB of
// tab-indented Verilog and arrives as a 106KB body — its 8506 tabs and 3049
// newlines add 11.7KB on their own. The previous budget of maxSourceSize+1024
// allowed 1KB for that, so real designs tripped the *body* limit before the
// source limit could be checked, and json.Decode's failure surfaced as a
// misleading "invalid request body".
//
// maxSourceSize remains the advertised limit and is enforced after decoding.
// This bound exists only to stop an unbounded read.
const maxRequestBody = 2*maxSourceSize + maxFilesSize + 8*1024

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

// SourceFile is one client-supplied file written into the work directory at
// `Path` (relative, '/'-separated). Sources are compiled; Includes are only
// placed on disk and on the -I search path, not compiled.
type SourceFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Param is one `chparam -set` assignment applied to the top module.
//
// Kind is carried explicitly rather than inferred because inference is
// genuinely ambiguous: a string parameter whose value happens to be all digits
// (memfile = "1234") would be emitted unquoted and mean something else. The
// client always knows which it meant.
type Param struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Kind  string `json:"kind"` // "string" | "number"
}

// SynthRequest is the wire format. With Sources, Includes and Params all empty
// every path below reduces to what it did before they existed, so backwards
// compatibility is structural rather than promised.
//
// Note for anyone adding a field: `apps/synth/src/index.ts` is a gateway in
// front of this service and re-serializes an explicit field list. A field added
// here and not there is dropped in production only — local dev POSTs straight
// to this container. `scripts/check-synth-limits.ts` fails the build on that.
type SynthRequest struct {
	Verilog  string            `json:"verilog"`  // single-file paste, written as dut.v
	Sources  []SourceFile      `json:"sources"`  // compiled, in the order given
	Includes []SourceFile      `json:"includes"` // on disk and on -I, not compiled
	Files    map[string]string `json:"files"`    // sidecar data ($readmemh hex etc)
	Params   []Param           `json:"params"`   // chparam, applied to Top
	Top      string            `json:"top"`
	Target   string            `json:"target"`
}

// The yosys script is one string handed to `yosys -p`, which splits on `;` and
// honours `"`. Filenames, parameter names and parameter values all come from
// the client, so each is checked against a rejecting whitelist rather than
// escaped — a whitelist is auditable in one line, an escaper is somewhere for
// bugs to hide. A file named `a;write_verilog /etc/x.v` is what this stops.
var (
	reIdent      = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_$]*$`)
	reIntValue   = regexp.MustCompile(`^-?[0-9]+$`)
	reSizedValue = regexp.MustCompile(`^[0-9]*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ_]+$`)
	reStrValue   = regexp.MustCompile(`^[A-Za-z0-9._/+-]*$`)
	// First character is alphanumeric or '_', which rejects ".", ".." and
	// dotfiles with the same rule that rejects everything else.
	rePathSeg = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9._-]*$`)
)

const (
	maxPathDepth      = 8
	maxParamStringLen = 128
)

// validRelPath checks a client-supplied path and returns it '/'-separated and
// relative to the work directory.
func validRelPath(p string) (string, error) {
	if p == "" {
		return "", errors.New("empty file path")
	}
	if strings.HasPrefix(p, "/") {
		return "", fmt.Errorf("absolute paths are not allowed: %s", p)
	}
	segs := strings.Split(p, "/")
	if len(segs) > maxPathDepth {
		return "", fmt.Errorf("path is more than %d levels deep: %s", maxPathDepth, p)
	}
	for _, seg := range segs {
		if !rePathSeg.MatchString(seg) {
			return "", fmt.Errorf(
				"path segment %q is not allowed in %s (letters, digits, '_', '.' and '-'; no leading dot, no '..')",
				seg, p)
		}
	}
	return strings.Join(segs, "/"), nil
}

// paramLiteral validates one parameter and returns the literal to interpolate.
func paramLiteral(p Param) (string, error) {
	if !reIdent.MatchString(p.Name) {
		return "", fmt.Errorf("invalid parameter name %q", p.Name)
	}
	switch p.Kind {
	case "number", "":
		if reIntValue.MatchString(p.Value) || reSizedValue.MatchString(p.Value) {
			return p.Value, nil
		}
		return "", fmt.Errorf(
			"parameter %s: %q is neither an integer nor a Verilog sized constant", p.Name, p.Value)
	case "string":
		if len(p.Value) > maxParamStringLen {
			return "", fmt.Errorf(
				"parameter %s: string value is longer than %d characters", p.Name, maxParamStringLen)
		}
		// The charset excludes '"', backslash, ';', '$' and whitespace, so the
		// value can be quoted without any escaping. That is the point of it.
		if !reStrValue.MatchString(p.Value) {
			return "", fmt.Errorf(
				"parameter %s: %q contains characters not allowed in a string parameter "+
					"(letters, digits, '.', '_', '/', '+' and '-')", p.Name, p.Value)
		}
		return `"` + p.Value + `"`, nil
	default:
		return "", fmt.Errorf(`parameter %s: kind must be "string" or "number", got %q`, p.Name, p.Kind)
	}
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

// yosysOpts is what buildYosysScript interpolates. It is a struct rather than
// five positional strings because every field but NetlistPath now comes from
// the client and the order would be easy to get wrong.
type yosysOpts struct {
	Top         string
	Target      string
	NetlistPath string   // server-generated, absolute
	Sources     []string // validated relative paths, in read order
	IncludeDirs []string // validated relative dirs for -I
	Params      []Param
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
//
// Source paths are relative because the command runs with Dir set to the work
// directory; that also keeps the container's scratch path out of the `src`
// attributes yosys writes into the netlist.
//
// Returns an error rather than panicking so a bad top module or parameter is a
// 400 with a sentence in it, not a 500.
func buildYosysScript(o yosysOpts) (string, error) {
	if !reIdent.MatchString(o.Top) {
		return "", fmt.Errorf("invalid top module name %q", o.Top)
	}
	if len(o.Sources) == 0 {
		return "", errors.New("no Verilog sources to read")
	}
	srcs := strings.Join(o.Sources, " ")

	if o.Target != "import" {
		var synthCmd string
		switch o.Target {
		case "ice40":
			synthCmd = fmt.Sprintf("synth_ice40 -top %s", o.Top)
		case "ecp5":
			synthCmd = fmt.Sprintf("synth_ecp5 -top %s", o.Top)
		default:
			synthCmd = fmt.Sprintf("synth -top %s", o.Top)
		}
		// Synthesis targets keep the default (Verilog-2005) read — reading the
		// source in-script rather than positionally so behavior matches import.
		return fmt.Sprintf("read_verilog %s; %s; write_json %s", srcs, synthCmd, o.NetlistPath), nil
	}

	// Read with -sv so SystemVerilog sources parse too. -sv is a superset of
	// Verilog-2005, so plain Verilog reads identically; language detection is
	// unnecessary. Then stop at the generic RTL netlist (no techmapping) for
	// @simten/core's importer.
	read := "read_verilog -sv"
	// Without -defer, read_verilog elaborates every module with its *default*
	// parameters as it reads them, which is too early to override: for servant
	// that runs $readmemh on the default firmware name before chparam can
	// change it. Gated on there being parameters at all, so the far more common
	// no-params path keeps the script this shipped with.
	if len(o.Params) > 0 {
		read += " -defer"
	}
	for _, dir := range o.IncludeDirs {
		read += " -I" + dir
	}

	var b strings.Builder
	b.WriteString(read)
	b.WriteString(" " + srcs)
	// chparam has to precede hierarchy: hierarchy is what elaborates the top
	// module, and a parameter set after that has nothing left to change.
	for _, p := range o.Params {
		lit, err := paramLiteral(p)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&b, "; chparam -set %s %s %s", p.Name, lit, o.Top)
	}
	fmt.Fprintf(&b, "; hierarchy -top %s; proc; opt_clean; memory_collect; stat; write_json %s",
		o.Top, o.NetlistPath)
	return b.String(), nil
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

// stagedDir writes the client's files into the work directory, keeping their
// relative layout and refusing anything that would land outside it or collide
// with a file already written.
//
// Collisions used to be silent: sidecars were flattened with filepath.Base, so
// two files named alu.v in different directories overwrote each other and the
// design synthesized against whichever arrived last. That is a wrong answer
// rather than an error, which is the one outcome worth spending code on.
type stagedDir struct {
	root        string
	written     map[string]bool
	sources     []string
	includeDirs []string
}

func newStagedDir(root string) *stagedDir {
	return &stagedDir{root: root, written: map[string]bool{}}
}

// writeChecked validates a client-supplied path, then writes the file.
func (s *stagedDir) writeChecked(path, content string) (string, error) {
	rel, err := validRelPath(path)
	if err != nil {
		return "", err
	}
	if err := s.write(rel, content); err != nil {
		return "", err
	}
	return rel, nil
}

func (s *stagedDir) write(rel, content string) error {
	if s.written[rel] {
		return fmt.Errorf("duplicate file %s — two files cannot share a path", rel)
	}
	full := filepath.Join(s.root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		return fmt.Errorf("failed to create directory for %s", rel)
	}
	if err := os.WriteFile(full, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write file %s", rel)
	}
	s.written[rel] = true
	return nil
}

// addIncludeDir records the directory an include file lives in, deduped, so it
// can be passed to read_verilog as -I.
func (s *stagedDir) addIncludeDir(rel string) {
	dir := path.Dir(rel)
	if dir == "." {
		return // the work directory is already on the search path
	}
	for _, existing := range s.includeDirs {
		if existing == dir {
			return
		}
	}
	s.includeDirs = append(s.includeDirs, dir)
}

func synthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBody)

	var req SynthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Distinguish "too big" from "malformed" — they need different fixes,
		// and conflating them is what made an oversized paste look like a
		// syntax problem.
		msg := "invalid request body"
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			msg = fmt.Sprintf(
				"request too large: over %d bytes once JSON-encoded (verilog source limit is %d bytes)",
				maxRequestBody, maxSourceSize)
		}
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error:   msg,
		})
		return
	}

	if len(req.Verilog) == 0 && len(req.Sources) == 0 {
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

	// maxSourceSize bounds everything that gets compiled, not just the single
	// `verilog` field — a project split across 30 files is the same load on
	// yosys as the same bytes concatenated.
	sourceTotal := len(req.Verilog)
	for _, f := range append(append([]SourceFile{}, req.Sources...), req.Includes...) {
		sourceTotal += len(f.Path) + len(f.Content)
	}
	if sourceTotal > maxSourceSize {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error: fmt.Sprintf("verilog source too large: %d bytes (limit %d)",
				sourceTotal, maxSourceSize),
		})
		return
	}

	filesTotal := 0
	for name, content := range req.Files {
		filesTotal += len(name) + len(content)
	}
	if filesTotal > maxFilesSize {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false,
			Log:     "",
			Error: fmt.Sprintf("sidecar files too large: %d bytes (limit %d)",
				filesTotal, maxFilesSize),
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

	stage := newStagedDir(dir)

	// A single pasted module still arrives in the verilog field and is compiled
	// first, so any macros it defines are visible to everything read after.
	if len(req.Verilog) > 0 {
		if err := stage.write("dut.v", req.Verilog); err != nil {
			writeJSON(w, http.StatusBadRequest, SynthResponse{
				Success: false, Log: "", Error: err.Error(),
			})
			return
		}
		stage.sources = append(stage.sources, "dut.v")
	}

	// Ordered, because source order is semantic: a macro defined in one file is
	// visible to files read after it in the same read_verilog.
	for _, f := range req.Sources {
		rel, err := stage.writeChecked(f.Path, f.Content)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, SynthResponse{
				Success: false, Log: "", Error: err.Error(),
			})
			return
		}
		stage.sources = append(stage.sources, rel)
	}

	// Includes land on disk and on -I, but are not compiled: the preprocessor
	// pulls them in where the source asks for them.
	for _, f := range req.Includes {
		rel, err := stage.writeChecked(f.Path, f.Content)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, SynthResponse{
				Success: false, Log: "", Error: err.Error(),
			})
			return
		}
		stage.addIncludeDir(rel)
	}

	// Sidecar data ($readmemh hex files and the like) is written at the path the
	// client gave, not its basename: flattening made two files called `mem.hex`
	// in different directories silently overwrite each other, and it broke any
	// $readmemh whose argument had a directory in it.
	for name, content := range req.Files {
		if _, err := stage.writeChecked(name, content); err != nil {
			writeJSON(w, http.StatusBadRequest, SynthResponse{
				Success: false, Log: "", Error: err.Error(),
			})
			return
		}
	}

	// Build and run Yosys. The sources are read in-script (see
	// buildYosysScript), so they are not passed positionally.
	netlistPath := filepath.Join(dir, "netlist.json")
	script, err := buildYosysScript(yosysOpts{
		Top:         req.Top,
		Target:      req.Target,
		NetlistPath: netlistPath,
		Sources:     stage.sources,
		IncludeDirs: stage.includeDirs,
		Params:      req.Params,
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, SynthResponse{
			Success: false, Log: "", Error: err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), synthTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "yosys", "-p", script)
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
		msg := "invalid request body"
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			msg = "request too large (netlist limit is 20MB)"
		}
		writeJSON(w, http.StatusBadRequest, BuildResponse{Error: msg})
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
