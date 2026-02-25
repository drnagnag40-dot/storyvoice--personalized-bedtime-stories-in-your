import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BreathingGradient from '@/components/BreathingGradient';
import { useAuth } from '@fastshot/auth';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import WarpStarField from '@/components/WarpStarField';
import PolaroidReveal from '@/components/PolaroidReveal';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { generateText, generateImage, useImageTransform } from '@fastshot/ai';
import { getChildren, createStory, isSupabaseAvailable, upsertUserPreferences } from '@/lib/supabase';
import { buildStoryPrompt, buildImagePrompt, buildInteractiveStoryPrompt, NARRATOR_PERSONALITIES, STORY_ART_STYLES, type NarratorPersonality, type ArtStyle, type ChoiceOption } from '@/lib/newell';
import type { Child } from '@/lib/supabase';
import { useAdapty } from '@/hooks/useAdapty';

// ─────────────────────────────────────────────────────────────────────────────
// Theme definitions
// ─────────────────────────────────────────────────────────────────────────────
const NEBULA_PURPLE = '#9B6FDE';

interface StoryTheme {
  id: string;
  label: string;
  icon: string;
  description: string;
  accentColor: string;
  gradientColors: [string, string];
}

const STORY_THEMES: StoryTheme[] = [
  {
    id: 'adventurous',
    label: 'Adventurous',
    icon: '🗺️',
    description: 'Brave heroes & thrilling quests',
    accentColor: '#FF8C42',
    gradientColors: ['rgba(255,140,66,0.25)', 'rgba(255,140,66,0.05)'],
  },
  {
    id: 'calming',
    label: 'Calming',
    icon: '🌙',
    description: 'Peaceful dreams & soft magic',
    accentColor: Colors.softBlue,
    gradientColors: ['rgba(126,200,227,0.25)', 'rgba(126,200,227,0.05)'],
  },
  {
    id: 'funny',
    label: 'Funny',
    icon: '😄',
    description: 'Silly characters & big laughs',
    accentColor: Colors.accentPink,
    gradientColors: ['rgba(255,107,157,0.25)', 'rgba(255,107,157,0.05)'],
  },
  {
    id: 'educational',
    label: 'Educational',
    icon: '📚',
    description: 'Learn something wonderful',
    accentColor: Colors.successGreen,
    gradientColors: ['rgba(107,203,119,0.25)', 'rgba(107,203,119,0.05)'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Theme card
// ─────────────────────────────────────────────────────────────────────────────
function ThemeCard({
  theme,
  isSelected,
  onPress,
  disabled,
}: {
  theme: StoryTheme;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const scale     = useSharedValue(1);
  const glowOpacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    glowOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 250 });
    // glowOpacity is a stable Reanimated shared value ref – safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);

  const handlePressIn  = () => { scale.value = withTiming(0.95, { duration: 100 }); };
  const handlePressOut = () => { scale.value = withTiming(1,    { duration: 150 }); };
  const handlePressWithHaptic = () => {
    // Selection haptic: Success when newly selecting, light when re-tapping
    if (!isSelected) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const cardStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle  = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <Animated.View style={[styles.themeCardWrapper, cardStyle]}>
      {/* Outer gold glow when selected */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.themeCardGlow,
          { shadowColor: theme.accentColor },
          glowStyle,
        ]}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePressWithHaptic}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.themeCard,
          isSelected && { borderColor: theme.accentColor, borderWidth: 2 },
        ]}
      >
        {/* Glass blur layer */}
        {Platform.OS !== 'web' && (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {/* Glass base */}
        <LinearGradient
          colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />
        {/* Accent tint when selected */}
        {isSelected && (
          <LinearGradient
            colors={theme.gradientColors}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
        )}
        {/* Top glass shine */}
        <View style={styles.glassTopEdge} />
        <Text style={styles.themeIcon}>{theme.icon}</Text>
        <Text style={[styles.themeLabel, isSelected && { color: theme.accentColor }]}>
          {theme.label}
        </Text>
        <Text style={styles.themeDescription} numberOfLines={2}>{theme.description}</Text>

        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: theme.accentColor }]}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');

// Responsive card padding: tighter on small phones (iPhone SE = 320px)
const CARD_PADDING = W < 360 ? Spacing.sm : W < 414 ? Spacing.md : Spacing.lg;

export default function CreateStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user }  = useAuth();
  const { isPremium, openPaywall } = useAdapty();

  const [child,          setChild]          = useState<Child | null>(null);
  const [selectedTheme,  setSelectedTheme]  = useState<string | null>(null);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [narratorPersonality, setNarratorPersonality] = useState<NarratorPersonality | null>(null);

  // AI Family Portrait state
  const [showPortraitSection,  setShowPortraitSection]  = useState(false);
  const [selectedPhotoUri,     setSelectedPhotoUri]     = useState<string | null>(null);
  const [selectedArtStyle,     setSelectedArtStyle]     = useState<ArtStyle | null>(STORY_ART_STYLES[0]);
  const [transformedPortrait,  setTransformedPortrait]  = useState<string | null>(null);
  const [isTransformingPhoto,  setIsTransformingPhoto]  = useState(false);
  const [transformStep,        setTransformStep]        = useState('');

  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [appLanguage, setAppLanguage] = useState('en');

  // Image transform hook
  const { transformImage } = useImageTransform();

  // Entrance animations
  const headerOpacity  = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonScale    = useSharedValue(1);

  // Nebula glow pulsing during generation
  const nebulaGlow     = useSharedValue(0);
  const nebulaScale    = useSharedValue(1);

  const loadChild = useCallback(async () => {
    try {
      if (user?.id) {
        const { children } = await getChildren(user.id);
        if (children && children.length > 0) {
          setChild(children[0]);
        }
      }
      if (!child) {
        const local = await AsyncStorage.getItem('pending_child_profile');
        if (local) setChild(JSON.parse(local) as Child);
      }
    } catch {
      const local = await AsyncStorage.getItem('pending_child_profile');
      if (local) setChild(JSON.parse(local) as Child);
    }
    // Load selected narrator personality
    try {
      const narratorId = await AsyncStorage.getItem('selected_narrator_id');
      if (narratorId) {
        const narrator = NARRATOR_PERSONALITIES.find((n) => n.id === narratorId);
        setNarratorPersonality(narrator ?? null);
      }
    } catch {
      // non-fatal
    }
    // Load app language
    try {
      const lang = await AsyncStorage.getItem('app_language');
      if (lang) setAppLanguage(lang);
    } catch {
      // non-fatal
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    void loadChild();
    headerOpacity.value  = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));
    // Reanimated shared values are stable refs – safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadChild]);

  // ── Start/stop nebula glow based on isGenerating ───────────────────────
  useEffect(() => {
    if (isGenerating) {
      nebulaGlow.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      );
      nebulaScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(nebulaGlow);
      cancelAnimation(nebulaScale);
      nebulaGlow.value  = withTiming(0, { duration: 400 });
      nebulaScale.value = withTiming(1, { duration: 300 });
    }
    // Reanimated shared values are stable refs – safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  // ── Family Portrait handlers ───────────────────────────────────────────
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add a family portrait.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedPhotoUri(result.assets[0].uri);
        setTransformedPortrait(null); // reset previous transform
      }
    } catch (err) {
      console.error('[FamilyPortrait] Photo picker error:', err);
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    }
  };

  const handleTransformPhoto = async () => {
    if (!selectedPhotoUri || !selectedArtStyle) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsTransformingPhoto(true);
    setTransformStep('Preparing your portrait…');
    try {
      setTransformStep('AI is painting your portrait…');
      const result = await transformImage({
        imageUrl: selectedPhotoUri,
        prompt: selectedArtStyle.transformPrompt,
      });
      const transformed = result?.images?.[0] ?? null;
      if (transformed) {
        setTransformedPortrait(transformed);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('No image returned from transform');
      }
    } catch (err) {
      console.error('[FamilyPortrait] Transform error:', err);
      Alert.alert('Portrait failed', 'Could not transform the photo. Please try again.');
    } finally {
      setIsTransformingPhoto(false);
      setTransformStep('');
    }
  };

  // ── Parse choice point from interactive story response ────────────────
  function parseChoicePoint(rawText: string): {
    storyContent: string;
    choiceOptions: ChoiceOption[];
  } {
    const choiceMatch = rawText.match(/\[CHOICE_POINT\]([\s\S]*?)\[\/CHOICE_POINT\]/);
    if (!choiceMatch) return { storyContent: rawText, choiceOptions: [] };

    const choiceBlock = choiceMatch[1];
    const storyContent = rawText.replace(choiceMatch[0], '').trim();

    const pathAEmoji = choiceBlock.match(/PATH_A_EMOJI:\s*(.+)/)?.[1]?.trim() ?? '🌟';
    const pathALabel = choiceBlock.match(/PATH_A_LABEL:\s*(.+)/)?.[1]?.trim() ?? 'Follow the magic path';
    const pathAHint  = choiceBlock.match(/PATH_A_HINT:\s*(.+)/)?.[1]?.trim() ?? pathALabel;
    const pathBEmoji = choiceBlock.match(/PATH_B_EMOJI:\s*(.+)/)?.[1]?.trim() ?? '🏠';
    const pathBLabel = choiceBlock.match(/PATH_B_LABEL:\s*(.+)/)?.[1]?.trim() ?? 'Return home to rest';
    const pathBHint  = choiceBlock.match(/PATH_B_HINT:\s*(.+)/)?.[1]?.trim() ?? pathBLabel;

    return {
      storyContent,
      choiceOptions: [
        { emoji: pathAEmoji, label: pathALabel, value: pathAHint },
        { emoji: pathBEmoji, label: pathBLabel, value: pathBHint },
      ],
    };
  }

  // ── Generate handler ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTheme) {
      Alert.alert('Choose a Theme', 'Please pick a story theme before generating.');
      return;
    }
    if (!child) {
      Alert.alert('Child Profile Missing', 'Please set up a child profile first.');
      return;
    }

    const themeObj = STORY_THEMES.find((t) => t.id === selectedTheme);
    const storyTitle = `A ${themeObj?.label ?? 'Magical'} Story for ${child.name}`;

    // Button press bounce + haptic
    buttonScale.value = withSequence(
      withTiming(0.94, { duration: 100 }),
      withTiming(1,    { duration: 150 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    setIsGenerating(true);
    setGenerationStep('Gathering the stardust…');

    try {
      // ── Step 1: Generate story text via Newell AI ───────────────────
      let storyText: string;
      let choiceOptions: ChoiceOption[] = [];

      if (isInteractiveMode) {
        const interactivePrompt = buildInteractiveStoryPrompt({
          child,
          voiceType: 'mom',
          theme:     themeObj?.label,
          narratorPersonality: narratorPersonality ?? undefined,
        }, appLanguage !== 'en' ? appLanguage : undefined);
        const rawText = await generateText({ prompt: interactivePrompt });
        if (!rawText || rawText.trim().length === 0) {
          throw new Error('AI returned an empty story. Please try again.');
        }
        const parsed = parseChoicePoint(rawText.trim());
        storyText = parsed.storyContent;
        choiceOptions = parsed.choiceOptions;
      } else {
        const storyPrompt = buildStoryPrompt({
          child,
          voiceType: 'mom',
          theme:     themeObj?.label,
          mood:      selectedTheme === 'calming' ? 'very soothing and sleep-inducing' : undefined,
          narratorPersonality: narratorPersonality ?? undefined,
        });
        const rawText = await generateText({ prompt: storyPrompt });
        if (!rawText || rawText.trim().length === 0) {
          throw new Error('AI returned an empty story. Please try again.');
        }
        storyText = rawText.trim();
      }

      setGenerationStep('Weaving the magic words…');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // ── Step 2: Generate cover illustration via Newell AI ───────────
      const imagePrompt = buildImagePrompt(child, storyTitle);
      let imageUrl: string | null = null;

      try {
        setGenerationStep('Painting the dreamscape…');
        const imageResult = await generateImage({
          prompt: imagePrompt,
          width:  1024,
          height: 1024,
        });
        imageUrl = imageResult?.images?.[0] ?? null;
      } catch (imgErr) {
        console.warn('[CreateStory] Image generation failed (non-fatal):', imgErr);
      }

      setGenerationStep('Almost ready…');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // ── Step 3: Save to Supabase ─────────────────────────────────────
      let savedStoryId: string | null = null;
      if (user?.id && isSupabaseAvailable) {
        try {
          const { story: savedStory } = await createStory({
            user_id:     user.id,
            child_id:    child?.id ?? null,
            title:       storyTitle,
            content:     storyText,
            image_url:   imageUrl,
            theme:       themeObj?.label ?? selectedTheme,
            is_favorite: false,
          });
          savedStoryId = savedStory?.id ?? null;

          // Update last_sync_at in user preferences
          await upsertUserPreferences(user.id, {
            last_sync_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('[CreateStory] Supabase save failed (non-fatal):', dbErr);
        }
      }

      // ── Step 4: Persist story for the player via AsyncStorage ────────
      // Use transformed portrait as cover if available, otherwise AI generated image
      const finalImageUrl = transformedPortrait ?? imageUrl;
      const storyEntry = {
        id:          savedStoryId ?? `local_${Date.now()}`,
        title:       storyTitle,
        content:     storyText,
        imageUrl:    finalImageUrl,
        childName:   child.name,
        theme:       themeObj?.label ?? selectedTheme,
        createdAt:   new Date().toISOString(),
        is_favorite: false,
        isInteractive: isInteractiveMode,
        choiceOptions: choiceOptions.length > 0 ? choiceOptions : undefined,
        branchContent: null,
        hasFamilyPortrait: Boolean(transformedPortrait),
        artStyleLabel: selectedArtStyle?.label,
      };

      await AsyncStorage.setItem('current_story', JSON.stringify(storyEntry));

      // Also append to local_stories for the Safe Mode bookshelf
      try {
        const existingRaw = await AsyncStorage.getItem('local_stories');
        const existing: typeof storyEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
        // Keep only the most recent 20 stories to avoid unbounded growth
        const updated = [storyEntry, ...existing].slice(0, 20);
        await AsyncStorage.setItem('local_stories', JSON.stringify(updated));
      } catch (storageErr) {
        console.warn('[CreateStory] Failed to update local_stories:', storageErr);
      }

      // ── Step 5: Navigate to the immersive player ─────────────────────
      setIsGenerating(false);
      setGenerationStep('');
      // Celebratory haptic cascade on story completion
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 120);
      setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 240);
      router.push('/(main)/player');

    } catch (err) {
      console.error('[CreateStory] Generation failed:', err);
      setIsGenerating(false);
      setGenerationStep('');
      Alert.alert(
        'Generation Failed',
        'Something went wrong while creating your story. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // ── Animated styles ────────────────────────────────────────────────────
  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const btnStyle     = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const nebulaRingStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(nebulaGlow.value, [0, 1], [0, 0.8]),
    transform: [{ scale: nebulaScale.value }],
  }));

  const selectedThemeObj = STORY_THEMES.find((t) => t.id === selectedTheme);

  return (
    <View style={styles.container}>
      {/* Crystal Night breathing gradient */}
      <BreathingGradient />

      {/* Warp star field – accelerates when generating */}
      <WarpStarField count={70} accelerating={isGenerating} />

      {/* Nebula purple overlay during generation */}
      {isGenerating && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.nebulaOverlay,
            { opacity: interpolate(nebulaGlow.value, [0, 1], [0, 0.18]) },
          ]}
          pointerEvents="none"
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isGenerating}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Animated.View style={[styles.header, headerStyle]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={isGenerating}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create Story</Text>
            <Text style={styles.headerSubtitle}>Personalised bedtime magic ✨</Text>
          </View>
          {/* Spacer to balance back button */}
          <View style={styles.backButton} />
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* ── Child profile mini-card ───────────────────────────────── */}
          {child ? (
            <View style={styles.childMiniCard}>
              {Platform.OS !== 'web' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <View style={styles.glassTopEdge} />
              <View style={styles.childMiniAvatar}>
                <Text style={styles.childMiniAvatarText}>
                  {child.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.childMiniInfo}>
                <Text style={styles.childMiniLabel}>Story for</Text>
                <Text style={styles.childMiniName}>{child.name}</Text>
                {child.interests.length > 0 && (
                  <Text style={styles.childMiniInterests} numberOfLines={1}>
                    Loves: {child.interests.slice(0, 3).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={styles.childMiniEmoji}>🌙</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noChildCard}
              onPress={() => router.push('/(onboarding)/child-profile')}
            >
              <Text style={styles.noChildText}>+ Set up a child profile first</Text>
            </TouchableOpacity>
          )}

          {/* ── AI Family Portrait (Pro Feature) ─────────────────────── */}
          <TouchableOpacity
            style={styles.portraitToggleBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPortraitSection(!showPortraitSection);
            }}
            disabled={isGenerating}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.portraitToggleLeft}>
              <Text style={styles.portraitToggleEmoji}>📸</Text>
              <View>
                <Text style={styles.portraitToggleLabel}>AI Family Portrait</Text>
                <Text style={styles.portraitToggleSubLabel}>Transform a photo into story art ✨</Text>
              </View>
            </View>
            <View style={styles.portraitProBadge}>
              <Text style={styles.portraitProText}>PRO</Text>
            </View>
            <Text style={styles.portraitToggleChevron}>{showPortraitSection ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showPortraitSection && (
            <View style={styles.portraitSection}>
              {/* Art style selection */}
              <Text style={styles.portraitSectionTitle}>Choose Art Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artStylesRow}>
                {STORY_ART_STYLES.map((style) => (
                  <TouchableOpacity
                    key={style.id}
                    style={[
                      styles.artStyleCard,
                      selectedArtStyle?.id === style.id && styles.artStyleCardSelected,
                    ]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedArtStyle(style);
                      setTransformedPortrait(null);
                    }}
                    disabled={isGenerating}
                    activeOpacity={0.85}
                  >
                    {selectedArtStyle?.id === style.id && (
                      <LinearGradient
                        colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.05)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
                      />
                    )}
                    <Text style={styles.artStyleCardEmoji}>{style.emoji}</Text>
                    <Text style={[
                      styles.artStyleCardLabel,
                      selectedArtStyle?.id === style.id && { color: Colors.celestialGold },
                    ]}>{style.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Photo picker */}
              <View style={styles.portraitPickerRow}>
                <TouchableOpacity
                  style={styles.pickPhotoBtn}
                  onPress={() => void handlePickPhoto()}
                  disabled={isGenerating || isTransformingPhoto}
                  activeOpacity={0.85}
                >
                  {selectedPhotoUri ? (
                    <Image source={{ uri: selectedPhotoUri }} style={styles.pickedPhotoThumb} />
                  ) : (
                    <>
                      <Text style={styles.pickPhotoBtnEmoji}>🖼️</Text>
                      <Text style={styles.pickPhotoBtnText}>Upload Photo</Text>
                    </>
                  )}
                </TouchableOpacity>

                {selectedPhotoUri && !transformedPortrait && (
                  <TouchableOpacity
                    style={[styles.transformBtn, isTransformingPhoto && styles.transformBtnDisabled]}
                    onPress={() => void handleTransformPhoto()}
                    disabled={isTransformingPhoto || isGenerating}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.celestialGold, Colors.softGold]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={styles.transformBtnText}>
                      {isTransformingPhoto ? '✨ Painting…' : `✨ Transform`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Polaroid reveal */}
              {(selectedPhotoUri && (isTransformingPhoto || transformedPortrait)) && (
                <View style={styles.polaroidContainer}>
                  <PolaroidReveal
                    imageUri={transformedPortrait}
                    caption={child?.name ? `${child.name}'s Story Portrait` : 'Story Portrait'}
                    artStyleLabel={selectedArtStyle?.label}
                    artStyleEmoji={selectedArtStyle?.emoji}
                    isTransforming={isTransformingPhoto}
                    transformStep={transformStep}
                    width={200}
                  />
                  {transformedPortrait && (
                    <TouchableOpacity
                      style={styles.retransformLink}
                      onPress={() => { setTransformedPortrait(null); setSelectedPhotoUri(null); }}
                    >
                      <Text style={styles.retransformLinkText}>Change photo or style</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Interactive Adventures (Pro Feature) ───────────────── */}
          <TouchableOpacity
            style={[styles.portraitToggleBtn, isInteractiveMode && styles.interactiveActiveBtn]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!isPremium && !isInteractiveMode) {
                // Gate with paywall
                void openPaywall();
                return;
              }
              setIsInteractiveMode(!isInteractiveMode);
            }}
            disabled={isGenerating}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={isInteractiveMode
                ? ['rgba(107,72,184,0.35)', 'rgba(107,72,184,0.12)']
                : ['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.portraitToggleLeft}>
              <Text style={styles.portraitToggleEmoji}>🗺️</Text>
              <View>
                <Text style={[styles.portraitToggleLabel, isInteractiveMode && { color: '#C9A8FF' }]}>
                  Interactive Adventure
                </Text>
                <Text style={styles.portraitToggleSubLabel}>
                  {isInteractiveMode ? '✓ Child chooses the story path!' : 'Let your child choose the story path ✨'}
                </Text>
              </View>
            </View>
            <View style={[styles.portraitProBadge, isInteractiveMode && { backgroundColor: 'rgba(107,72,184,0.4)' }]}>
              <Text style={styles.portraitProText}>{isInteractiveMode ? 'ON' : 'PRO'}</Text>
            </View>
          </TouchableOpacity>

          {/* ── Theme selection ───────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Choose a Theme</Text>
          <Text style={styles.sectionSubtitle}>
            What kind of adventure awaits tonight?
          </Text>

          <View style={styles.themesGrid}>
            {STORY_THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isSelected={selectedTheme === theme.id}
                onPress={() => setSelectedTheme(theme.id)}
                disabled={isGenerating}
              />
            ))}
          </View>

          {/* ── Story details preview ─────────────────────────────────── */}
          {selectedTheme && child && (
            <View style={styles.previewCard}>
              {Platform.OS !== 'web' && (
                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <LinearGradient
                colors={[
                  `${selectedThemeObj?.accentColor ?? Colors.celestialGold}18`,
                  'transparent',
                ]}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <View style={styles.glassTopEdge} />
              <Text style={styles.previewIcon}>📖</Text>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle}>
                  A {selectedThemeObj?.label} story for {child.name}
                </Text>
                <Text style={styles.previewDetail}>
                  {child.interests.length > 0
                    ? `Featuring: ${child.interests.slice(0, 2).join(', ')}`
                    : 'A unique, personalised adventure'}
                </Text>
              </View>
            </View>
          )}

          {/* ── Generate button ───────────────────────────────────────── */}
          <View style={styles.generateWrapper}>
            {/* Nebula glow ring */}
            <Animated.View style={[styles.nebulaRing, nebulaRingStyle]} />

            <Animated.View style={[styles.generateButtonContainer, btnStyle]}>
              <TouchableOpacity
                onPress={() => void handleGenerate()}
                disabled={isGenerating || !selectedTheme}
                activeOpacity={0.85}
                style={[
                  styles.generateButton,
                  (!selectedTheme || isGenerating) && styles.generateButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={
                    isGenerating
                      ? [NEBULA_PURPLE, '#7B4FBF', '#5A3A9A']
                      : selectedTheme
                        ? [Colors.celestialGold, Colors.softGold, '#FFA500']
                        : [Colors.borderColor, Colors.cardBg]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.generateButtonGradient}
                >
                  {isGenerating ? (
                    <View style={styles.generatingContent}>
                      <Text style={styles.generateIcon}>🌀</Text>
                      <View>
                        <Text style={[styles.generateLabel, { color: '#fff' }]}>
                          Crafting your story…
                        </Text>
                        <Text style={styles.generatingStep}>{generationStep}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.generateContent}>
                      <Text style={styles.generateIcon}>🪄</Text>
                      <Text
                        style={[
                          styles.generateLabel,
                          { color: selectedTheme ? Colors.deepSpace : Colors.textMuted },
                        ]}
                      >
                        Generate Story
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Hint text ─────────────────────────────────────────────── */}
          {!isGenerating && (
            <Text style={styles.hintText}>
              {!selectedTheme
                ? 'Select a theme above to begin'
                : `Ready to create a ${selectedThemeObj?.label?.toLowerCase()} story ✨`}
            </Text>
          )}

          {/* ── Info strip ────────────────────────────────────────────── */}
          {!isGenerating && (
            <View style={styles.infoStrip}>
              <View style={styles.infoItem}>
                <Text style={styles.infoEmoji}>🧠</Text>
                <Text style={styles.infoText}>AI personalised</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoEmoji}>🎙️</Text>
                <Text style={styles.infoText}>In your voice</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoEmoji}>🌙</Text>
                <Text style={styles.infoText}>Sleep magic</Text>
              </View>
            </View>
          )}

          {/* Warp-mode label during generation */}
          {isGenerating && (
            <Animated.View style={[styles.warpLabel, nebulaRingStyle]}>
              <Text style={styles.warpLabelText}>
                ✦  Travelling through the dream galaxy  ✦
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0E0820' },
  content:     { paddingHorizontal: Spacing.lg },

  // Glass utility
  glassTopEdge: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius:    1,
  },

  // ── Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.xl,
  },
  backButton: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    // Float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 4 },
    shadowRadius:    10,
    shadowOpacity:   0.28,
    elevation:       5,
  },
  backIcon:        { fontSize: 28, color: '#FFFFFF', lineHeight: 32 },
  headerCenter:    { alignItems: 'center' },
  headerTitle:     { fontFamily: Fonts.extraBold, fontSize: 20, color: '#FFFFFF', letterSpacing: 0.3 },
  headerSubtitle:  { fontFamily: Fonts.regular,   fontSize: 12, color: 'rgba(240,235,248,0.55)', marginTop: 2 },

  // ── Child mini-card
  childMiniCard: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    overflow:        'hidden',
    gap:             12,
    // Glass float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 6 },
    shadowRadius:    18,
    shadowOpacity:   0.25,
    elevation:       8,
  },
  childMiniAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(107,72,184,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.20)',
  },
  childMiniAvatarText: { fontFamily: Fonts.extraBold, fontSize: 18, color: '#fff' },
  childMiniInfo:       { flex: 1 },
  childMiniLabel:      { fontFamily: Fonts.regular,   fontSize: 11, color: 'rgba(240,235,248,0.55)' },
  childMiniName:       { fontFamily: Fonts.extraBold, fontSize: 16, color: '#FFFFFF' },
  childMiniInterests:  { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.celestialGold, marginTop: 2 },
  childMiniEmoji:      { fontSize: 28 },

  noChildCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius:    Radius.xl,
    padding:         Spacing.lg,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    borderStyle:     'dashed',
    marginBottom:    Spacing.xl,
  },
  noChildText: { fontFamily: Fonts.bold, fontSize: 14, color: 'rgba(240,235,248,0.5)' },

  // ── Theme grid
  sectionTitle:    { fontFamily: Fonts.extraBold, fontSize: 19, color: '#FFFFFF', marginBottom: 4, letterSpacing: 0.2 },
  sectionSubtitle: { fontFamily: Fonts.regular,   fontSize: 13, color: 'rgba(240,235,248,0.55)', marginBottom: Spacing.lg },

  themesGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
    marginBottom:  Spacing.xl,
  },

  themeCardWrapper: {
    width: (W - Spacing.lg * 2 - 12) / 2,
  },
  themeCardGlow: {
    borderRadius:   Radius.xl,
    shadowOffset:   { width: 0, height: 0 },
    shadowRadius:   20,
    shadowOpacity:  0.7,
    elevation:      10,
  },
  themeCard: {
    borderRadius:    Radius.xl,
    padding:         CARD_PADDING,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    overflow:        'hidden',
    minHeight:       CARD_PADDING * 2 + 110,
    justifyContent:  'center',
    gap:             4,
    // Glass float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 6 },
    shadowRadius:    18,
    shadowOpacity:   0.25,
    elevation:       8,
  },
  themeIcon:        { fontSize: W < 360 ? 28 : 36 },
  themeLabel:       { fontFamily: Fonts.extraBold, fontSize: W < 360 ? 13 : 15, color: '#FFFFFF', textAlign: 'center' },
  themeDescription: { fontFamily: Fonts.regular,   fontSize: W < 360 ? 10 : 11, color: 'rgba(240,235,248,0.55)', textAlign: 'center' },
  selectedBadge: {
    position:    'absolute',
    top:         10,
    right:       10,
    width:       22,
    height:      22,
    borderRadius: 11,
    alignItems:  'center',
    justifyContent: 'center',
    borderWidth:  1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  selectedBadgeText: { fontFamily: Fonts.extraBold, fontSize: 11, color: '#fff' },

  // ── Preview card
  previewCard: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    gap:             12,
    overflow:        'hidden',
    // Glass float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 5 },
    shadowRadius:    14,
    shadowOpacity:   0.22,
    elevation:       7,
  },
  previewIcon:   { fontSize: 28 },
  previewInfo:   { flex: 1 },
  previewTitle:  { fontFamily: Fonts.bold,    fontSize: 14, color: '#FFFFFF' },
  previewDetail: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(240,235,248,0.55)', marginTop: 3 },

  // ── Generate button — crystal gold float
  generateWrapper: {
    alignItems:    'center',
    justifyContent: 'center',
    marginBottom:  Spacing.md,
  },
  nebulaRing: {
    position:    'absolute',
    width:       W - Spacing.lg * 2 + 28,
    height:      76,
    borderRadius: Radius.full,
    backgroundColor: NEBULA_PURPLE,
    shadowColor:  NEBULA_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 1,
    elevation:    24,
  },
  generateButtonContainer: { width: '100%' },
  generateButton: {
    borderRadius: Radius.full,
    overflow:     'hidden',
    // Gold glow float
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 28,
    shadowOpacity: 0.50,
    elevation:    14,
  },
  generateButtonDisabled: { opacity: 0.55 },
  generateButtonGradient: {
    paddingVertical:  20,
    paddingHorizontal: Spacing.xl,
    borderRadius:     Radius.full,
    alignItems:       'center',
    // Top shine border
    borderWidth:      1,
    borderColor:      'rgba(255,255,255,0.28)',
  },
  generateContent: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  generatingContent: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  generateIcon:  { fontSize: 26 },
  generateLabel: { fontFamily: Fonts.extraBold, fontSize: 18 },
  generatingStep: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // ── Hint & info
  hintText: {
    fontFamily:  Fonts.regular,
    fontSize:    13,
    color:       'rgba(240,235,248,0.50)',
    textAlign:   'center',
    marginBottom: Spacing.xl,
  },
  infoStrip: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    gap:             0,
  },
  infoItem:  { flex: 1, alignItems: 'center', gap: 4 },
  infoEmoji: { fontSize: 20 },
  infoText:  { fontFamily: Fonts.bold, fontSize: 11, color: 'rgba(240,235,248,0.55)' },
  infoDivider: {
    width:           1,
    height:          32,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ── Warp label during generation
  warpLabel: {
    alignItems:   'center',
    marginTop:    Spacing.lg,
  },
  warpLabelText: {
    fontFamily:  Fonts.medium,
    fontSize:    13,
    color:       '#C9A8FF',
    letterSpacing: 1.5,
    textAlign:   'center',
  },

  // ── Nebula overlay
  nebulaOverlay: {
    backgroundColor: NEBULA_PURPLE,
  },

  // ── AI Family Portrait (glass panels)
  portraitToggleBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.20)',
    overflow:        'hidden',
    gap:             8,
    shadowColor:     '#FFD700',
    shadowOffset:    { width: 0, height: 4 },
    shadowRadius:    12,
    shadowOpacity:   0.15,
    elevation:       5,
  },
  portraitToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  portraitToggleEmoji: { fontSize: 22 },
  portraitToggleLabel: { fontFamily: Fonts.extraBold, fontSize: 14, color: '#FFFFFF' },
  portraitToggleSubLabel: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(240,235,248,0.55)', marginTop: 1 },
  portraitProBadge: {
    backgroundColor: Colors.celestialGold,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  portraitProText: { fontFamily: Fonts.black, fontSize: 9, color: Colors.deepSpace },
  portraitToggleChevron: { fontFamily: Fonts.bold, fontSize: 12, color: 'rgba(240,235,248,0.45)' },
  interactiveActiveBtn: {
    borderColor: 'rgba(107,72,184,0.45)',
    borderWidth: 1.5,
  },

  portraitSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    gap:             Spacing.md,
  },
  portraitSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      'rgba(240,235,248,0.50)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  artStylesRow: { flexGrow: 0 },
  artStyleCard: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight:     8,
    gap:             4,
    overflow:        'hidden',
    minWidth:        72,
  },
  artStyleCardSelected: {
    borderColor: 'rgba(255,215,0,0.45)',
    backgroundColor: 'rgba(255,215,0,0.07)',
  },
  artStyleCardEmoji: { fontSize: 22 },
  artStyleCardLabel: {
    fontFamily: Fonts.bold,
    fontSize:   11,
    color:      '#FFFFFF',
    textAlign:  'center',
  },

  portraitPickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pickPhotoBtn: {
    width:           80,
    height:          80,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    borderStyle:     'dashed',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    gap:             4,
  },
  pickedPhotoThumb: { width: '100%', height: '100%', borderRadius: Radius.md },
  pickPhotoBtnEmoji: { fontSize: 22 },
  pickPhotoBtnText: { fontFamily: Fonts.bold, fontSize: 10, color: 'rgba(240,235,248,0.50)', textAlign: 'center' },

  transformBtn: {
    flex:            1,
    height:          44,
    borderRadius:    Radius.full,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    // Gold float
    shadowColor:     Colors.celestialGold,
    shadowOffset:    { width: 0, height: 4 },
    shadowRadius:    14,
    shadowOpacity:   0.45,
    elevation:       8,
  },
  transformBtnDisabled: { opacity: 0.55 },
  transformBtnText: { fontFamily: Fonts.extraBold, fontSize: 13, color: Colors.deepSpace },

  polaroidContainer: { alignItems: 'center', gap: Spacing.sm },
  retransformLink: { marginTop: 4 },
  retransformLinkText: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(240,235,248,0.50)', textDecorationLine: 'underline' },
});
