import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StudioImage,
  StudioImageInput,
  StudioScene,
  useGetStudioScenes,
  useCreateStudioScene,
  useDeleteStudioScene,
  getGetStudioScenesQueryKey,
} from "@workspace/api-client-react";

export type ScriptState = {
  title: string;
  visualDescription: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  fidelity: "high" | "balanced";
};

/**
 * HistoryItem is a view over a persisted StudioScene that preserves the
 * shape the rest of the UI expects (input/output split, numeric timestamp).
 */
export type HistoryItem = {
  id: string;
  /** Unix timestamp derived from the scene's createdAt ISO string */
  timestamp: number;
  input: StudioImageInput;
  output: StudioImage;
};

const STORAGE_KEYS = {
  SCRIPT: "curtis-script-v1",
  REFERENCE: "curtis-reference-v1",
};

const defaultScript: ScriptState = {
  title: "Untitled Scene",
  visualDescription: "",
  prompt: "",
  aspectRatio: "16:9",
  fidelity: "high",
};

function sceneToHistoryItem(scene: StudioScene): HistoryItem {
  return {
    id: scene.id,
    timestamp: new Date(scene.createdAt).getTime(),
    input: {
      prompt: scene.prompt,
      aspectRatio: scene.aspectRatio,
      fidelity: scene.fidelity,
    },
    output: {
      imageDataUrl: scene.imageDataUrl,
      provider: scene.provider,
      referenceUsed: scene.referenceUsed,
      fidelity: scene.fidelity,
    },
  };
}

// ---------------------------------------------------------------------------
// Script state — still local (draft, not persisted to the DB)
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";

export function useStudioStore() {
  const queryClient = useQueryClient();

  const [script, setScript] = useState<ScriptState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SCRIPT);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultScript, ...parsed };
      }
      return defaultScript;
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

  // Persist draft script to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCRIPT, JSON.stringify(script));
    } catch (e) {
      console.warn("Failed to save script to localStorage", e);
    }
  }, [script]);

  // Persist reference image to localStorage
  useEffect(() => {
    try {
      if (referenceImage) {
        localStorage.setItem(STORAGE_KEYS.REFERENCE, referenceImage);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REFERENCE);
      }
    } catch (e) {
      console.warn(
        "Failed to save reference image. Might be too large for localStorage.",
        e,
      );
    }
  }, [referenceImage]);

  // ---------------------------------------------------------------------------
  // Server-backed history
  // ---------------------------------------------------------------------------

  const { data: scenes, isLoading: historyLoading } = useGetStudioScenes();

  const history: HistoryItem[] = (scenes ?? []).map(sceneToHistoryItem);

  const createMutation = useCreateStudioScene({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetStudioScenesQueryKey(),
        });
      },
      onError: (error: unknown) => {
        const apiError = error as { status?: number; data?: { error?: string } };
        const msg =
          apiError?.status === 401
            ? "The studio session expired before this scene could be saved. Unlock the studio and generate it again."
            : apiError?.status === 413
            ? "This scene is too large to save to the album. You can still download it from the canvas."
            : "Could not save the scene to the album. Check your connection and try again.";
        toast.warning("Scene not saved to album", { description: msg });
      },
    },
  });

  const deleteMutation = useDeleteStudioScene({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetStudioScenesQueryKey(),
        });
      },
    },
  });

  const addHistoryItem = useCallback(
    (input: StudioImageInput, output: StudioImage) => {
      createMutation.mutate({
        data: {
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          fidelity: input.fidelity ?? "high",
          referenceUsed: output.referenceUsed,
          imageDataUrl: output.imageDataUrl,
          provider: output.provider,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createMutation.mutate],
  );

  const deleteHistoryItem = useCallback(
    (id: string) => {
      deleteMutation.mutate({ sceneId: id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMutation.mutate],
  );

  const updateScript = useCallback((updates: Partial<ScriptState>) => {
    setScript((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearScript = useCallback(() => {
    setScript(defaultScript);
    setReferenceImage(null);
  }, []);

  return {
    script,
    updateScript,
    clearScript,
    referenceImage,
    setReferenceImage,
    history,
    historyLoading,
    addHistoryItem,
    deleteHistoryItem,
  };
}
