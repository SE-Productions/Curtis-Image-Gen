import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ActionButton, ImagePreview, InlineNotice, Segment } from '@/components/studio-ui';
import { useColors } from '@/hooks/useColors';
import { useStudio } from '@/providers/studio-context';

export default function RenderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    currentImage,
    startVideoRender,
    videoTask,
    isStartingVideo,
    videoError,
    downloadVideo,
  } = useStudio();
  const [format, setFormat] = useState<'reel' | 'story'>('reel');
  const [motionPrompt, setMotionPrompt] = useState(
    'Slow cinematic camera drift with natural, subtle movement.',
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const taskStatus = videoTask?.status;
  const isPolling = taskStatus === 'queued' || taskStatus === 'processing';
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  async function handleRender() {
    setSaveError(null);
    await startVideoRender(format, motionPrompt);
  }

  async function handleDownload() {
    setSaveError(null);
    try {
      await downloadVideo();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The video could not be saved.');
    }
  }

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={[
        styles.content,
        { backgroundColor: colors.background, paddingTop: topInset, paddingBottom: insets.bottom + 108 },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
          <Feather name="film" size={19} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>MOTION STUDIO</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Bring it to life</Text>
        </View>
      </View>

      {!currentImage ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="image" size={26} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No scene selected</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
            Create a still image first, then return here to make a short Reel or Story.
          </Text>
        </View>
      ) : (
        <>
          <ImagePreview uri={currentImage.imageDataUrl} caption="Current generated scene" />

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FORMAT</Text>
            <Segment
              value={format}
              onChange={setFormat}
              options={[
                { value: 'reel', label: 'Reel' },
                { value: 'story', label: 'Story' },
              ]}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MOTION DIRECTION</Text>
            <TextInput
              multiline
              value={motionPrompt}
              onChangeText={setMotionPrompt}
              placeholder="Describe the movement you want..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.motionInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.input,
                  color: colors.foreground,
                },
              ]}
              textAlignVertical="top"
            />
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              Your source image remains the identity guide throughout the render.
            </Text>
          </View>

          {(videoError || saveError) && <InlineNotice message={videoError ?? saveError ?? ''} />}

          {!videoTask || taskStatus === 'failed' ? (
            <ActionButton
              label={isStartingVideo ? 'Starting render…' : `Create ${format === 'reel' ? 'Reel' : 'Story'}`}
              icon="play"
              disabled={isStartingVideo || !motionPrompt.trim()}
              onPress={() => void handleRender()}
            />
          ) : isPolling ? (
            <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <View style={styles.progressCopy}>
                <Text style={[styles.progressTitle, { color: colors.foreground }]}>
                  {taskStatus === 'queued' ? 'Render queued' : 'Rendering your video'}
                </Text>
                <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                  Checking progress automatically. This can take a few minutes.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.doneIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="check" size={18} color={colors.primary} />
              </View>
              <View style={styles.doneCopy}>
                <Text style={[styles.progressTitle, { color: colors.foreground }]}>Your video is ready</Text>
                <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                  Save it to your Camera Roll to post whenever you are ready.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                testID="download-video-button"
                onPress={() => void handleDownload()}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="download" size={21} color={colors.primary} />
              </Pressable>
            </View>
          )}
        </>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerCopy: { gap: 2 },
  eyebrow: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.4, color: '#64748B' },
  title: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 26, letterSpacing: -0.4, color: '#1A1A1A' },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 42,
  },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  section: { gap: 8 },
  sectionLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8, color: '#64748B' },
  motionInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 21,
    minHeight: 108,
    padding: 14,
  },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  progressCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  progressCopy: { flex: 1, gap: 3 },
  progressTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  doneCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  doneIcon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  doneCopy: { flex: 1, gap: 3 },
});