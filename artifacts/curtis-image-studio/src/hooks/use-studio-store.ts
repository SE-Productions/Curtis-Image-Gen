import { useState, useEffect, useCallback } from "react";
import { StudioImageInput, StudioImage } from "@workspace/api-client-react";

export type ScriptState = {
  title: string;
  visualDescription: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
};

export type HistoryItem = {
  id: string;
  timestamp: number;
  input: StudioImageInput;
  output: StudioImage;
};

const STORAGE_KEYS = {
  SCRIPT: "curtis-script-v1",
  REFERENCE: "curtis-reference-v1",
  HISTORY: "curtis-history-v1",
};

const defaultScript: ScriptState = {
  title: "Untitled Scene",
  visualDescription: "",
  prompt: "",
  aspectRatio: "16:9",
};

export function useStudioStore() {
  const [script, setScript] = useState<ScriptState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SCRIPT);
      return stored ? JSON.parse(stored) : defaultScript;
    } catch {
      return defaultScript;
    }
  });

  const [referenceImage, setReferenceImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.REFERENCE);
    } catch {
      return null;
    }
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save script whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCRIPT, JSON.stringify(script));
    } catch (e) {
      console.warn("Failed to save script to localStorage", e);
    }
  }, [script]);

  // Save reference image whenever it changes
  useEffect(() => {
    try {
      if (referenceImage) {
        localStorage.setItem(STORAGE_KEYS.REFERENCE, referenceImage);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REFERENCE);
      }
    } catch (e) {
      console.warn("Failed to save reference image. Might be too large for localStorage.", e);
    }
  }, [referenceImage]);

  // Save history whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn("Failed to save history.", e);
    }
  }, [history]);

  const updateScript = useCallback((updates: Partial<ScriptState>) => {
    setScript((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearScript = useCallback(() => {
    setScript(defaultScript);
    setReferenceImage(null);
  }, []);

  const addHistoryItem = useCallback((input: StudioImageInput, output: StudioImage) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      input,
      output,
    };
    setHistory((prev) => [newItem, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    script,
    updateScript,
    clearScript,
    referenceImage,
    setReferenceImage,
    history,
    addHistoryItem,
    deleteHistoryItem,
  };
}
