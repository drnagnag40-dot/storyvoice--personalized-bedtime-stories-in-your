import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import WarpStarField from '@/components/WarpStarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { getChildren, createStory, isSupabaseAvailable } from '@/lib/supabase';
import { buildStoryPrompt } from '@/lib/newell';
import type { Child } from '@/lib/supabase';

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
  }, [isSelected]);

  const handlePressIn  = () => { scale.value = withTiming(0.95, { duration: 100 }); };
  const handlePressOut = () => { scale.value = withTiming(1,    { duration: 150 }); };

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
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.themeCard,
          isSelected && { borderColor: theme.accentColor, borderWidth: 2 },
        ]}
      >
        <LinearGradient
          colors={isSelected ? theme.gradientColors : ['rgba(37,38,85,0.7)', 'rgba(37,38,85,0.3)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />
        <Text style={styles.themeIcon}>{theme.icon}</Text>
        <Text style={[styles.themeLabel, isSelected && { color: theme.accentColor }]}>
          {theme.label}
        </Text>
        <Text style={styles.themeDescription}>{theme.description}</Text>

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

export default function CreateStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user }  = useAuth();

  const [child,          setChild]          = useState<Child | null>(null);
  const [selectedTheme,  setSelectedTheme]  = useState<string | null>(null);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  const generationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animations
  const headerOpacity  = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonScale    = useSharedValue(1);

  // Nebula glow pulsing during generation
  const nebulaGlow     = useSharedValue(0);
  const nebulaScale    = useSharedValue(1);

  useEffect(() => {
    void loadChild();
    headerOpacity.value  = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));

    return () => {
      if (generationTimerRef.current) clearTimeout(generationTimerRef.current);
    };
  }, []);

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
  }, [isGenerating]);

  const loadChild = async () => {
    try {
      if (user?.id) {
        const { children } = await getChildren(user.id);
        if (children && children.length > 0) {
          setChild(children[0]);
          return;
        }
      }
      const local = await AsyncStorage.getItem('pending_child_profile');
      if (local) setChild(JSON.parse(local) as Child);
    } catch {
      const local = await AsyncStorage.getItem('pending_child_profile');
      if (local) setChild(JSON.parse(local) as Child);
    }
  };

  // ── Generate handler ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTheme) {
      Alert.alert('Choose a Theme', 'Please pick a story theme before generating.');
      return;
    }

    const themeObj = STORY_THEMES.find((t) => t.id === selectedTheme);

    // Button press bounce
    buttonScale.value = withSequence(
      withTiming(0.94, { duration: 100 }),
      withTiming(1,    { duration: 150 })
    );

    setIsGenerating(true);
    setGenerationStep('Gathering the stardust…');

    // Build prompt payload (used in next step when Newell AI is wired)
    const prompt = child
      ? buildStoryPrompt({
          child,
          voiceType: 'mom',
          theme: themeObj?.label,
          mood: selectedTheme === 'calming' ? 'very soothing and sleep-inducing' : undefined,
        })
      : '';

    // Store payload for the next step
    await AsyncStorage.setItem(
      'pending_story_payload',
      JSON.stringify({
        childId:   child?.id ?? null,
        childName: child?.name ?? 'your child',
        theme:     themeObj?.label ?? selectedTheme,
        prompt,
        createdAt: new Date().toISOString(),
      })
    );

    // Step-through generation messages
    const steps = [
      'Gathering the stardust…',
      'Weaving the magic words…',
      'Painting the dreamscape…',
      'Almost ready…',
    ];

    let stepIdx = 0;
    const advance = () => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setGenerationStep(steps[stepIdx]);
        generationTimerRef.current = setTimeout(advance, 1100);
      }
    };

    setGenerationStep(steps[0]);
    generationTimerRef.current = setTimeout(advance, 1100);

    // Simulate AI generation time, then save placeholder story & navigate
    generationTimerRef.current = setTimeout(async () => {
      try {
        // Save placeholder story metadata to Supabase (content filled in next step)
        if (user?.id && child?.id && isSupabaseAvailable) {
          await createStory({
            user_id:   user.id,
            child_id:  child.id,
            title:     `A ${themeObj?.label ?? 'Magical'} Story for ${child.name}`,
            content:   null,
            image_url: null,
            theme:     themeObj?.label ?? selectedTheme,
          });
        }
      } catch (err) {
        console.warn('[CreateStory] Failed to save story metadata:', err);
      } finally {
        setIsGenerating(false);
        setGenerationStep('');
        Alert.alert(
          '✨ Story Ready!',
          `Your ${themeObj?.label?.toLowerCase() ?? ''} story for ${child?.name ?? 'your child'} is queued! The AI generation will be completed in the next step.`,
          [{ text: 'Wonderful!', onPress: () => router.back() }]
        );
      }
    }, 4500);
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
      {/* Background gradient */}
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#2B1A5C']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

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
              <LinearGradient
                colors={['rgba(107,72,184,0.35)', 'rgba(74,56,128,0.15)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
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
              <LinearGradient
                colors={[
                  `${selectedThemeObj?.accentColor ?? Colors.celestialGold}18`,
                  'transparent',
                ]}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
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
  container:       { flex: 1, backgroundColor: Colors.deepSpace },
  content:         { paddingHorizontal: Spacing.lg },

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
    backgroundColor: Colors.cardBg,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  backIcon:        { fontSize: 28, color: Colors.moonlightCream, lineHeight: 32 },
  headerCenter:    { alignItems: 'center' },
  headerTitle:     { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream },
  headerSubtitle:  { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // ── Child mini-card
  childMiniCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    gap:             12,
  },
  childMiniAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.softPurple,
    alignItems:      'center',
    justifyContent:  'center',
  },
  childMiniAvatarText: { fontFamily: Fonts.extraBold, fontSize: 18, color: '#fff' },
  childMiniInfo:       { flex: 1 },
  childMiniLabel:      { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.textMuted },
  childMiniName:       { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  childMiniInterests:  { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.celestialGold, marginTop: 2 },
  childMiniEmoji:      { fontSize: 28 },

  noChildCard: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.lg,
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     Colors.borderColor,
    borderStyle:     'dashed',
    marginBottom:    Spacing.xl,
  },
  noChildText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },

  // ── Theme grid
  sectionTitle:    { fontFamily: Fonts.extraBold, fontSize: 19, color: Colors.moonlightCream, marginBottom: 4 },
  sectionSubtitle: { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.lg },

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
    shadowRadius:   16,
    shadowOpacity:  0.6,
    elevation:      8,
  },
  themeCard: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.lg,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    minHeight:       140,
    justifyContent:  'center',
    gap:             6,
  },
  themeIcon:        { fontSize: 36 },
  themeLabel:       { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream, textAlign: 'center' },
  themeDescription: { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  selectedBadge: {
    position:    'absolute',
    top:         10,
    right:       10,
    width:       22,
    height:      22,
    borderRadius: 11,
    alignItems:  'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { fontFamily: Fonts.extraBold, fontSize: 11, color: '#fff' },

  // ── Preview card
  previewCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    gap:             12,
    overflow:        'hidden',
  },
  previewIcon:   { fontSize: 28 },
  previewInfo:   { flex: 1 },
  previewTitle:  { fontFamily: Fonts.bold,    fontSize: 14, color: Colors.moonlightCream },
  previewDetail: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, marginTop: 3 },

  // ── Generate button
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
    shadowRadius: 30,
    shadowOpacity: 1,
    elevation:    20,
  },
  generateButtonContainer: { width: '100%' },
  generateButton: {
    borderRadius: Radius.full,
    overflow:     'hidden',
  },
  generateButtonDisabled: { opacity: 0.55 },
  generateButtonGradient: {
    paddingVertical:  20,
    paddingHorizontal: Spacing.xl,
    borderRadius:     Radius.full,
    alignItems:       'center',
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
    color:       Colors.textMuted,
    textAlign:   'center',
    marginBottom: Spacing.xl,
  },
  infoStrip: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    gap:             0,
  },
  infoItem:  { flex: 1, alignItems: 'center', gap: 4 },
  infoEmoji: { fontSize: 20 },
  infoText:  { fontFamily: Fonts.bold, fontSize: 11, color: Colors.textMuted },
  infoDivider: {
    width:           1,
    height:          32,
    backgroundColor: Colors.borderColor,
  },

  // ── Warp label during generation
  warpLabel: {
    alignItems:   'center',
    marginTop:    Spacing.lg,
  },
  warpLabelText: {
    fontFamily:  Fonts.medium,
    fontSize:    13,
    color:       NEBULA_PURPLE,
    letterSpacing: 1,
    textAlign:   'center',
  },

  // ── Nebula overlay
  nebulaOverlay: {
    backgroundColor: NEBULA_PURPLE,
  },
});
