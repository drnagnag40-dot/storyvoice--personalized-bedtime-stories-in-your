/**
 * NarratorGallery – Bedtime Buddies
 *
 * Horizontal scrolling carousel of AI narrator characters.
 * Each card glows and pulses when selected.
 * Includes AI-powered preview using Newell @fastshot/ai.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateText } from '@fastshot/ai';
import { getCached, setCached, previewCacheKey } from '@/lib/magicCache';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import {
  NARRATOR_PERSONALITIES,
  buildNarratorPreviewPrompt,
  type NarratorPersonality,
} from '@/lib/newell';
import { trackNarratorSelected } from '@/lib/analytics';

const { width: W } = Dimensions.get('window');
const CARD_SIZE = 110;
const STORAGE_KEY = 'selected_narrator_id';

// ─────────────────────────────────────────────────────────────────────────────
// Character Card
// ─────────────────────────────────────────────────────────────────────────────
function CharacterCard({
  narrator,
  isSelected,
  onPress,
  onPreview,
}: {
  narrator: NarratorPersonality;
  isSelected: boolean;
  onPress: () => void;
  onPreview: () => void;
}) {
  const glowOpacity = useSharedValue(isSelected ? 1 : 0);
  const pulseScale  = useSharedValue(1);
  const emojiScale  = useSharedValue(1);

  useEffect(() => {
    glowOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 300 });

    if (isSelected) {
      // Gentle pulse when awakened
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      );
      emojiScale.value = withSequence(
        withTiming(1.3, { duration: 250, easing: Easing.out(Easing.back(3)) }),
        withTiming(1.0, { duration: 300, easing: Easing.out(Easing.quad) }),
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 300 });
    }

    return () => {
      cancelAnimation(pulseScale);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPress();
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <Animated.View style={[styles.cardWrapper, cardStyle]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.cardGlow,
          {
            shadowColor:   narrator.glowColor,
            borderColor:   isSelected ? narrator.accentColor : 'transparent',
          },
          glowStyle,
        ]}
      />

      <TouchableOpacity
        style={[styles.card, isSelected && { borderColor: narrator.accentColor, borderWidth: 2 }]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={
            isSelected
              ? [`${narrator.glowColor}40`, `${narrator.glowColor}15`]
              : ['rgba(37,38,85,0.8)', 'rgba(37,38,85,0.4)']
          }
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />

        {/* Character emoji */}
        <Animated.Text style={[styles.cardEmoji, emojiStyle]}>
          {narrator.emoji}
        </Animated.Text>

        {/* Name */}
        <Text style={[styles.cardName, isSelected && { color: narrator.accentColor }]}>
          {narrator.name}
        </Text>
        <Text style={styles.cardSpecies}>{narrator.species}</Text>

        {/* Style tag */}
        <View style={[styles.styleTag, { backgroundColor: `${narrator.accentColor}22` }]}>
          <Text style={[styles.styleTagText, { color: narrator.accentColor }]}>
            {narrator.style}
          </Text>
        </View>

        {/* Selected indicator */}
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: narrator.accentColor }]} />
        )}
      </TouchableOpacity>

      {/* Preview button */}
      <TouchableOpacity
        style={styles.previewBtn}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPreview();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.previewBtnText}>▷ Preview</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Modal
// ─────────────────────────────────────────────────────────────────────────────
function PreviewModal({
  visible,
  narrator,
  childName,
  onClose,
}: {
  visible: boolean;
  narrator: NarratorPersonality | null;
  childName?: string;
  onClose: () => void;
}) {
  const [previewText, setPreviewText] = useState<string>('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Portrait pulsing glow ─────────────────────────────────────────────
  // Fast pulse while loading → slow gentle pulse when text is visible
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (visible && narrator) {
      cancelAnimation(glowPulse);
      // Fast when loading, slow and soothing when text is displayed
      const halfCycle = isLoading ? 600 : 1600;
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(glowPulse);
      glowPulse.value = withTiming(0, { duration: 350 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isLoading, narrator?.id]);

  const portraitGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowPulse.value, [0, 1], [0.12, 0.9], Extrapolation.CLAMP),
    shadowRadius:  interpolate(glowPulse.value, [0, 1], [5,    26],   Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (visible && narrator) {
      void loadPreview();
    }
    if (!visible) {
      setPreviewText('');
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, narrator?.id]);

  const loadPreview = async () => {
    if (!narrator) return;
    setIsLoading(true);
    setError(null);
    try {
      // Check Magic Cache before calling AI
      const cKey   = previewCacheKey(narrator.id, childName);
      const cached = await getCached(cKey);
      if (cached) {
        setPreviewText(cached);
      } else {
        const prompt = buildNarratorPreviewPrompt(narrator, childName);
        const result = await generateText({ prompt, temperature: 0.7 });
        const text   = result?.trim() ?? narrator.previewText;
        setPreviewText(text);
        if (result?.trim()) await setCached(cKey, text);
      }
    } catch {
      setPreviewText(narrator.previewText);
    } finally {
      setIsLoading(false);
    }
  };

  if (!narrator) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.previewOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.previewModal}
          onPress={() => { /* prevent close */ }}
        >
          {Platform.OS !== 'web' && (
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={[Colors.midnightNavy, Colors.deepPurple, Colors.deepSpace]}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Narrator portrait with pulsing glow ring */}
          <Animated.View
            style={[
              styles.previewPortrait,
              {
                backgroundColor: `${narrator.glowColor}25`,
                borderColor:     narrator.accentColor,
                shadowColor:     narrator.glowColor,
                shadowOffset:    { width: 0, height: 0 },
              },
              portraitGlowStyle,
            ]}
          >
            <Text style={styles.previewEmoji}>{narrator.emoji}</Text>
          </Animated.View>

          <Text style={[styles.previewNarratorName, { color: narrator.accentColor }]}>
            {narrator.name} {narrator.species}
          </Text>
          <Text style={styles.previewNarratorDesc}>{narrator.description}</Text>
          <Text style={styles.previewTagline}>&ldquo;{narrator.tagline}&rdquo;</Text>

          {/* AI Preview Text */}
          <View style={[styles.previewTextCard, { borderColor: `${narrator.accentColor}40` }]}>
            {isLoading ? (
              <View style={styles.previewLoading}>
                <ActivityIndicator color={narrator.accentColor} size="small" />
                <Text style={[styles.previewLoadingText, { color: narrator.accentColor }]}>
                  {narrator.name} is preparing a sample…
                </Text>
              </View>
            ) : error ? (
              <Text style={styles.previewTextContent}>{narrator.previewText}</Text>
            ) : (
              <Text style={styles.previewTextContent}>
                {previewText || narrator.previewText}
              </Text>
            )}
          </View>

          <TouchableOpacity style={[styles.previewCloseBtn, { borderColor: narrator.accentColor }]} onPress={onClose}>
            <LinearGradient
              colors={[`${narrator.glowColor}40`, `${narrator.glowColor}20`]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
            />
            <Text style={[styles.previewCloseBtnText, { color: narrator.accentColor }]}>
              ✓ Got it!
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
interface NarratorGalleryProps {
  childName?: string;
  onNarratorSelected?: (narrator: NarratorPersonality) => void;
}

export default function NarratorGallery({ childName, onNarratorSelected }: NarratorGalleryProps) {
  const [selectedId,     setSelectedId]     = useState<string>('luna');
  const [previewNarrator, setPreviewNarrator] = useState<NarratorPersonality | null>(null);
  const [showPreview,    setShowPreview]    = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load saved narrator on mount
  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && NARRATOR_PERSONALITIES.find((n) => n.id === saved)) {
          setSelectedId(saved);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSelect = useCallback(async (narrator: NarratorPersonality) => {
    setSelectedId(narrator.id);
    await AsyncStorage.setItem(STORAGE_KEY, narrator.id);
    // Track narrator popularity for internal analytics
    void trackNarratorSelected(narrator.id);
    onNarratorSelected?.(narrator);
  }, [onNarratorSelected]);

  const handlePreview = useCallback((narrator: NarratorPersonality) => {
    setPreviewNarrator(narrator);
    setShowPreview(true);
  }, []);

  const selectedNarrator = NARRATOR_PERSONALITIES.find((n) => n.id === selectedId);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>🌟 Bedtime Buddies</Text>
          <Text style={styles.sectionSubtitle}>Choose your AI narrator</Text>
        </View>
        {selectedNarrator && (
          <View style={[styles.activeBadge, { borderColor: selectedNarrator.accentColor }]}>
            <Text style={styles.activeBadgeEmoji}>{selectedNarrator.emoji}</Text>
            <Text style={[styles.activeBadgeText, { color: selectedNarrator.accentColor }]}>
              {selectedNarrator.name}
            </Text>
          </View>
        )}
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={NARRATOR_PERSONALITIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CharacterCard
            narrator={item}
            isSelected={item.id === selectedId}
            onPress={() => void handleSelect(item)}
            onPreview={() => handlePreview(item)}
          />
        )}
      />

      {/* Selected narrator tagline */}
      {selectedNarrator && (
        <View style={styles.taglineRow}>
          <Text style={[styles.taglineText, { color: selectedNarrator.accentColor }]}>
            ✦  {selectedNarrator.tagline}  ✦
          </Text>
        </View>
      )}

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        narrator={previewNarrator}
        childName={childName}
        onClose={() => setShowPreview(false)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom:    14,
  },
  sectionTitle:    { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream },
  sectionSubtitle: { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  activeBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      Radius.full,
    borderWidth:       1,
    backgroundColor:   'rgba(255,255,255,0.05)',
  },
  activeBadgeEmoji: { fontSize: 16 },
  activeBadgeText:  { fontFamily: Fonts.bold, fontSize: 12 },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
    paddingRight: Spacing.lg,
  },

  // Card
  cardWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  cardGlow: {
    borderRadius: Radius.xl,
    borderWidth:  2,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    shadowOpacity: 0.7,
    elevation:    12,
  },
  card: {
    width:           CARD_SIZE,
    height:          CARD_SIZE + 20,
    borderRadius:    Radius.xl,
    backgroundColor: Colors.cardBg,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    gap:             3,
    paddingHorizontal: 6,
  },
  cardEmoji:   { fontSize: 36 },
  cardName: {
    fontFamily: Fonts.extraBold,
    fontSize:   13,
    color:      Colors.moonlightCream,
    textAlign:  'center',
  },
  cardSpecies: {
    fontFamily: Fonts.regular,
    fontSize:   10,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  styleTag: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      Radius.full,
    marginTop:         2,
  },
  styleTagText: {
    fontFamily: Fonts.bold,
    fontSize:   9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedDot: {
    position:     'absolute',
    top:          8,
    right:        8,
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  previewBtn: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.borderColor,
    backgroundColor:   'rgba(255,255,255,0.04)',
  },
  previewBtnText: {
    fontFamily: Fonts.bold,
    fontSize:   10,
    color:      Colors.textMuted,
  },

  // Tagline row
  taglineRow: {
    alignItems:        'center',
    paddingHorizontal: Spacing.lg,
    marginTop:         8,
  },
  taglineText: {
    fontFamily:  Fonts.medium,
    fontSize:    13,
    textAlign:   'center',
    letterSpacing: 0.5,
  },

  // Preview Modal
  previewOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         Spacing.lg,
  },
  previewModal: {
    width:        Math.min(W - 40, 360),
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  Colors.borderColor,
    padding:      Spacing.xl,
    alignItems:   'center',
    gap:          Spacing.md,
  },
  previewPortrait: {
    width:        88,
    height:       88,
    borderRadius: 44,
    alignItems:   'center',
    justifyContent: 'center',
    borderWidth:  2,
  },
  previewEmoji:        { fontSize: 44 },
  previewNarratorName: { fontFamily: Fonts.extraBold, fontSize: 20, textAlign: 'center' },
  previewNarratorDesc: { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  previewTagline:      { fontFamily: Fonts.medium,    fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center' },

  previewTextCard: {
    width:         '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius:  Radius.lg,
    borderWidth:   1,
    padding:       Spacing.md,
    minHeight:     80,
    justifyContent: 'center',
  },
  previewLoading: {
    alignItems: 'center',
    gap: 8,
  },
  previewLoadingText: {
    fontFamily: Fonts.medium,
    fontSize:   12,
    textAlign:  'center',
  },
  previewTextContent: {
    fontFamily: Fonts.regular,
    fontSize:   14,
    color:      Colors.moonlightCream,
    lineHeight: 22,
    textAlign:  'center',
    fontStyle:  'italic',
  },
  previewCloseBtn: {
    width:        '100%',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth:  1,
    alignItems:   'center',
    overflow:     'hidden',
    marginTop:    4,
  },
  previewCloseBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
  },
});
