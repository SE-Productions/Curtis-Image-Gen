import { create } from "zustand";
import type { FaceRecord, StudioCapabilities, StudioPost, StudioSettings } from "./types";

type StudioState = {
  topic: string;
  days: 3 | 7 | 14;
  format: "feed" | "story" | "reel";
  facePreview: string | null;
  filling: boolean;
  renderingId: string | null;
  setTopic: (topic: string) => void;
  setDays: (days: 3 | 7 | 14) => void;
  setFormat: (format: "feed" | "story" | "reel") => void;
  setFacePreview: (src: string | null) => void;
  setFilling: (v: boolean) => void;
  setRenderingId: (id: string | null) => void;
};

export const useStudioUi = create<StudioState>((set) => ({
  topic: "",
  days: 7,
  format: "feed",
  facePreview: null,
  filling: false,
  renderingId: null,
  setTopic: (topic) => set({ topic }),
  setDays: (days) => set({ days }),
  setFormat: (format) => set({ format }),
  setFacePreview: (facePreview) => set({ facePreview }),
  setFilling: (filling) => set({ filling }),
  setRenderingId: (renderingId) => set({ renderingId }),
}));

export type StudioSnapshot = {
  settings: StudioSettings;
  face: FaceRecord | null;
  posts: StudioPost[];
  capabilities: StudioCapabilities;
};
