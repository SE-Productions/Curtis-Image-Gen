import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type StudioImage,
  type StudioImageInputAspectRatio,
  type StudioImageInputFidelity,
  type StudioVideoTask,
  useGenerateStudioImage,
  useGetStudioVideo,
  useStartStudioVideo,
} from '@workspace/api-client-react';

type VideoFormat = 'reel' | 'story';

type StudioContextValue = {
  prompt: string;
  setPrompt: (value: string) => void;
  aspectRatio: StudioImageInputAspectRatio;
  setAspectRatio: (value: StudioImageInputAspectRatio) => void;
  fidelity: StudioImageInputFidelity;
  setFidelity: (value: StudioImageInputFidelity) => void;
  referenceImage: string | null;
  currentImage: StudioImage | null;
  isGenerating: boolean;
  generationError: string | null;
  pickReferenceImage: () => Promise<void>;
  clearReferenceImage: () => void;
  generateImage: () => Promise<void>;
  saveImageToLibrary: () => Promise<void>;
  startVideoRender: (format: VideoFormat, motionPrompt: string) => Promise<void>;
  videoTask: StudioVideoTask | null;
  isStartingVideo: boolean;
  videoError: string | null;
  downloadVideo: () => Promise<void>;
};

const StudioContext = createContext<StudioContextValue | null>(null);
const DRAFT_KEY = 'curtis-mobile-draft-v1';
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

type SavedDraft = {
  prompt: string;
  aspectRatio: StudioImageInputAspectRatio;
  fidelity: StudioImageInputFidelity;
};

function errorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    typeof (error as { data?: { error?: unknown } }).data?.error === 'string'
  ) {
    return (error as { data: { error: string } }).data.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function dataUrlParts(dataUrl: string) {
  const [header, base64] = dataUrl.split(',', 2);
  return {
    base64,
    extension: header.includes('image/png') ? 'png' : 'jpg',
  };
}

async function ensureLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const existing = await MediaLibrary.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await MediaLibrary.requestPermissionsAsync();
  if (requested.granted) return true;
  if (!requested.canAskAgain) {
    await Linking.openSettings().catch(() => undefined);
  }
  throw new Error('Photo Library permission is needed to save this file.');
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] =
    useState<StudioImageInputAspectRatio>('9:16');
  const [fidelity, setFidelity] =
    useState<StudioImageInputFidelity>('high');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<StudioImage | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);
  const [startingVideoTask, setStartingVideoTask] = useState<StudioVideoTask | null>(
    null,
  );
  const [videoError, setVideoError] = useState<string | null>(null);
  const hydrated = useRef(false);

  const generation = useGenerateStudioImage();
  const startVideo = useStartStudioVideo();
  const videoQuery = useGetStudioVideo(videoTaskId ?? '', {
    query: {
      queryKey: ['mobile-studio-video', videoTaskId ?? 'idle'],
      enabled: Boolean(videoTaskId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'completed' || status === 'failed' ? false : 3000;
      },
    },
  });

  useEffect(() => {
    async function restoreDraft() {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved) as Partial<SavedDraft>;
          if (typeof draft.prompt === 'string') setPrompt(draft.prompt);
          if (
            draft.aspectRatio === '16:9' ||
            draft.aspectRatio === '9:16' ||
            draft.aspectRatio === '1:1'
          ) {
            setAspectRatio(draft.aspectRatio);
          }
          if (draft.fidelity === 'high' || draft.fidelity === 'balanced') {
            setFidelity(draft.fidelity);
          }
        }
      } catch {
        // A missing or corrupt local draft should never block studio access.
      } finally {
        hydrated.current = true;
      }
    }
    void restoreDraft();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const draft: SavedDraft = { prompt, aspectRatio, fidelity };
    void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => undefined);
  }, [aspectRatio, fidelity, prompt]);

  useEffect(() => {
    if (videoQuery.data?.status === 'failed') {
      setVideoError(videoQuery.data.error ?? 'The render could not be completed.');
    }
  }, [videoQuery.data]);

  const pickReferenceImage = useCallback(async () => {
    setGenerationError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain && Platform.OS !== 'web') {
        await Linking.openSettings().catch(() => undefined);
      }
      throw new Error('Allow photo access to choose a face reference.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
      selectionLimit: 1,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      throw new Error('That image could not be prepared. Try another photo.');
    }
    if (asset.fileSize && asset.fileSize > MAX_REFERENCE_BYTES) {
      throw new Error('Choose a photo smaller than 10 MB.');
    }

    if (asset.mimeType && !['image/png', 'image/jpeg'].includes(asset.mimeType)) {
      throw new Error('Choose a PNG or JPEG photo so the studio can read it.');
    }
    const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    setReferenceImage(`data:${mime};base64,${asset.base64}`);
    await Haptics.selectionAsync();
  }, []);

  const clearReferenceImage = useCallback(() => {
    setReferenceImage(null);
    void Haptics.selectionAsync();
  }, []);

  const generateImage = useCallback(async () => {
    if (!prompt.trim()) {
      setGenerationError('Describe the scene before generating.');
      return;
    }

    setGenerationError(null);
    try {
      const image = await generation.mutateAsync({
        data: {
          prompt: prompt.trim(),
          aspectRatio,
          fidelity,
          referenceImage,
        },
      });
      setCurrentImage(image);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setGenerationError(errorMessage(error, 'The image could not be generated.'));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [aspectRatio, fidelity, generation, prompt, referenceImage]);

  const saveImageToLibrary = useCallback(async () => {
    if (!currentImage) throw new Error('Generate an image before saving it.');
    if (Platform.OS === 'web') {
      await Linking.openURL(currentImage.imageDataUrl);
      return;
    }

    await ensureLibraryPermission();
    const { base64, extension } = dataUrlParts(currentImage.imageDataUrl);
    if (!base64) throw new Error('The generated image is unavailable.');
    const destination = `${FileSystem.cacheDirectory}curtis-${Date.now()}.${extension}`;
    await FileSystem.writeAsStringAsync(destination, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await MediaLibrary.saveToLibraryAsync(destination);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentImage]);

  const startVideoRender = useCallback(
    async (format: VideoFormat, motionPrompt: string) => {
      if (!currentImage) {
        setVideoError('Generate an image before creating a video.');
        return;
      }
      if (!motionPrompt.trim()) {
        setVideoError('Add a short motion direction before rendering.');
        return;
      }

      setVideoError(null);
      try {
        const task = await startVideo.mutateAsync({
          data: {
            imageDataUrl: currentImage.imageDataUrl,
            prompt: motionPrompt.trim(),
            format,
            durationSeconds: 5,
          },
        });
        setStartingVideoTask(task);
        setVideoTaskId(task.taskId);
        await Haptics.selectionAsync();
      } catch (error) {
        setVideoError(errorMessage(error, 'The video render could not be started.'));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [currentImage, startVideo],
  );

  const videoTask = videoQuery.data ?? startingVideoTask;

  const downloadVideo = useCallback(async () => {
    if (!videoTask?.videoUrl) throw new Error('Your completed video is unavailable.');
    if (Platform.OS === 'web') {
      await Linking.openURL(videoTask.videoUrl);
      return;
    }

    await ensureLibraryPermission();
    const destination = `${FileSystem.cacheDirectory}curtis-${videoTask.format}-${Date.now()}.mp4`;
    const download = await FileSystem.downloadAsync(videoTask.videoUrl, destination);
    await MediaLibrary.saveToLibraryAsync(download.uri);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [videoTask]);

  const value = useMemo<StudioContextValue>(
    () => ({
      prompt,
      setPrompt,
      aspectRatio,
      setAspectRatio,
      fidelity,
      setFidelity,
      referenceImage,
      currentImage,
      isGenerating: generation.isPending,
      generationError,
      pickReferenceImage,
      clearReferenceImage,
      generateImage,
      saveImageToLibrary,
      startVideoRender,
      videoTask,
      isStartingVideo: startVideo.isPending,
      videoError,
      downloadVideo,
    }),
    [
      aspectRatio,
      clearReferenceImage,
      currentImage,
      downloadVideo,
      fidelity,
      generateImage,
      generation.isPending,
      generationError,
      pickReferenceImage,
      prompt,
      referenceImage,
      saveImageToLibrary,
      startVideo.isPending,
      startVideoRender,
      videoError,
      videoTask,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used inside StudioProvider.');
  return context;
}