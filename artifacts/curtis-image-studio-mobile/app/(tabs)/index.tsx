import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    fidelity,
    setFidelity,
    referenceImage,
    currentImage,
    isGenerating,
    generationError,
    pickReferenceImage,
    clearReferenceImage,
    generateImage,
    saveImageToLibrary,
  } = useStudio();
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  async function chooseReference() {
    setReferenceError(null);
    try {
      await pickReferenceImage();
    } catch (error) {
      setReferenceError(error instanceof Error ? error.message : 'The photo could not be selected.');
    }
  }

  async function saveImage() {
    setSaveError(null);
    try {
      await saveImageToLibrary();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The image could not be saved.');
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
        <View>
          <Text style={[styles.brand, { color: colors.primary }]}>CURTIS</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Image Studio</Text>
        </View>
        <View style={[styles.headerMark, { backgroundColor: colors.accent }]}>
          <Feather name="aperture" size={21} color={colors.primary} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FACE REFERENCE</Text>
          {referenceImage && (
            <Pressable
              accessibilityRole="button"
              onPress={clearReferenceImage}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={[styles.smallAction, { color: colors.primary }]}>Remove</Text>
            </Pressable>
          )}
        </View>
        {referenceImage ? (
          <ImagePreview uri={referenceImage} compact caption="Reference ready" />
        ) : (
          <Pressable
            accessibilityRole="button"
            testID="pick-reference-button"
            onPress={() => void chooseReference()}
            style={({ pressed }) => [
              styles.uploadCard,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <View style={[styles.uploadIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="upload-cloud" size={21} color={colors.primary} />
            </View>
            <View style={styles.uploadCopy}>
              <Text style={[styles.uploadTitle, { color: colors.foreground }]}>Choose a face photo</Text>
              <Text style={[styles.uploadText, { color: colors.mutedForeground }]}>
                Camera Roll · JPG or PNG · 10 MB max
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
        {referenceError && <InlineNotice message={referenceError} />}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionHeadingSerif, { color: colors.foreground }]}>Scene Direction</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
          Describe the scene, style, setting, wardrobe, and mood.
        </Text>
        <TextInput
          multiline
          value={prompt}
          onChangeText={setPrompt}
          placeholder="A moody coastal evening, overcast sky, golden hour light..."
          placeholderTextColor={colors.mutedForeground}
          textAlignVertical="top"
          style={[
            styles.promptInput,
            { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionHeadingSerif, { color: colors.foreground }]}>Composition</Text>
        <Segment
          value={aspectRatio}
          onChange={setAspectRatio}
          options={[
            { value: '9:16', label: 'Portrait' },
            { value: '1:1', label: 'Square' },
            { value: '16:9', label: 'Wide' },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionHeadingSerif, { color: colors.foreground }]}>Fidelity</Text>
        <Segment
          value={fidelity}
          onChange={setFidelity}
          options={[
            { value: 'high', label: 'High' },
            { value: 'balanced', label: 'Balanced' },
          ]}
        />
      </View>

      {generationError && <InlineNotice message={generationError} />}
      <ActionButton
        label={isGenerating ? 'Generating scene…' : 'Generate scene'}
        icon="star"
        disabled={isGenerating || !prompt.trim()}
        onPress={() => void generateImage()}
      />

      {isGenerating && (
        <View style={[styles.loading, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Matching the reference and building your scene…
          </Text>
        </View>
      )}

      {currentImage && (
        <View style={styles.resultSection}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LATEST SCENE</Text>
            <Pressable
              accessibilityRole="button"
              testID="save-image-button"
              onPress={() => void saveImage()}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
            >
              <Feather name="download" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Image
            source={{ uri: currentImage.imageDataUrl }}
            resizeMode="cover"
            style={[styles.resultImage, { backgroundColor: colors.muted }]}
          />
          <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
            Ready to save, or open the Render tab to animate it.
          </Text>
          {saveError && <InlineNotice message={saveError} />}
        </View>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 20, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2.5, color: '#D95F3B' },
  title: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 28, letterSpacing: -0.5, marginTop: 1, color: '#1A1A1A' },
  headerMark: { alignItems: 'center', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  section: { gap: 8 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeadingSerif: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  sectionLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8 },
  smallAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  uploadCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  uploadIcon: { alignItems: 'center', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  uploadCopy: { flex: 1, gap: 3 },
  uploadTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  uploadText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  promptInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 130,
    padding: 14,
  },
  loading: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  loadingText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  resultSection: { gap: 10 },
  resultImage: { aspectRatio: 9 / 12, borderRadius: 18, width: '100%' },
  resultNote: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
});
