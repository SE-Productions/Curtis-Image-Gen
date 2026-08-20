import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: colors.muted }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentItem,
              selected && { backgroundColor: colors.card },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: selected ? colors.foreground : colors.mutedForeground },
                selected && styles.segmentTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  tone = 'primary',
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
}) {
  const colors = useColors();
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? colors.primary : colors.secondary,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={primary ? colors.primaryForeground : colors.secondaryForeground}
      />
      <Text
        style={[
          styles.actionText,
          { color: primary ? colors.primaryForeground : colors.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ImagePreview({
  uri,
  caption,
  compact = false,
}: {
  uri: string;
  caption: string;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.previewFrame,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.previewFrameCompact,
      ]}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={[styles.previewImage, compact && styles.previewImageCompact]}
      />
      <View style={styles.previewCaption}>
        <Feather name="check-circle" size={14} color={colors.primary} />
        <Text style={[styles.previewCaptionText, { color: colors.mutedForeground }]}>
          {caption}
        </Text>
      </View>
    </View>
  );
}

export function InlineNotice({
  message,
  kind = 'error',
}: {
  message: string;
  kind?: 'error' | 'info';
}) {
  const colors = useColors();
  const tint = kind === 'error' ? colors.destructive : colors.primary;
  return (
    <View style={[styles.notice, { borderColor: tint, backgroundColor: colors.card }]}>
      <Feather name={kind === 'error' ? 'alert-circle' : 'info'} size={17} color={tint} />
      <Text style={[styles.noticeText, { color: colors.foreground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  segmentTextSelected: {
    fontFamily: 'Inter_700Bold',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  actionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  previewFrame: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewFrameCompact: {
    flexDirection: 'row',
  },
  previewImage: {
    aspectRatio: 1,
    width: '100%',
  },
  previewImageCompact: {
    aspectRatio: 1,
    height: 76,
    width: 76,
  },
  previewCaption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  previewCaptionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  notice: {
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
});