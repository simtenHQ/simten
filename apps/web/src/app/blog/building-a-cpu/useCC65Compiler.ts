"use client";

import { useState, useCallback, useRef } from "react";
import {
  compileC,
  preloadWasm,
  type CompileResult,
  type StageStatus,
} from "@/lib/cc65-compiler";

interface UseCC65CompilerReturn {
  compile: (source: string) => Promise<CompileResult>;
  compiling: boolean;
  stages: { cc65: StageStatus; ca65: StageStatus; ld65: StageStatus };
  errors: string[];
  loaded: boolean;
  loadWasm: () => Promise<void>;
}

export function useCC65Compiler(): UseCC65CompilerReturn {
  const [compiling, setCompiling] = useState(false);
  const [stages, setStages] = useState<CompileResult["stages"]>({
    cc65: "pending",
    ca65: "pending",
    ld65: "pending",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useRef(false);

  const loadWasm = useCallback(async () => {
    if (loaded || loadingRef.current) return;
    loadingRef.current = true;
    try {
      await preloadWasm();
      setLoaded(true);
    } finally {
      loadingRef.current = false;
    }
  }, [loaded]);

  const compile = useCallback(async (source: string): Promise<CompileResult> => {
    setCompiling(true);
    setErrors([]);
    setStages({ cc65: "pending", ca65: "pending", ld65: "pending" });

    try {
      const result = await compileC(source, (s) => setStages(s));
      if (!result.success) {
        setErrors(result.errors);
      }
      return result;
    } finally {
      setCompiling(false);
    }
  }, []);

  return { compile, compiling, stages, errors, loaded, loadWasm };
}
