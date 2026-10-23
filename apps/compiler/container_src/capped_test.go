package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestCappedCombinedOutputTruncates(t *testing.T) {
	// Prints well past the cap, on both stdout and stderr.
	cmd := exec.Command("sh", "-c", "yes 0123456789 | head -c 3000000; yes err | head -c 3000000 >&2")
	out, err := cappedCombinedOutput(cmd)
	if err != nil {
		t.Fatalf("command failed: %v", err)
	}
	if len(out) > maxProcessOutput+100 {
		t.Fatalf("kept %d bytes, want at most ~%d", len(out), maxProcessOutput)
	}
	if !strings.HasSuffix(string(out), "[output truncated at 1048576 bytes]\n") {
		t.Fatalf("missing truncation note")
	}
}

func TestCappedCombinedOutputKeepsShortOutput(t *testing.T) {
	out, err := cappedCombinedOutput(exec.Command("sh", "-c", "echo hello; echo oops >&2; exit 3"))
	if err == nil {
		t.Fatal("expected the exit status to come through as an error")
	}
	if got := string(out); got != "hello\noops\n" {
		t.Fatalf("got %q", got)
	}
}
