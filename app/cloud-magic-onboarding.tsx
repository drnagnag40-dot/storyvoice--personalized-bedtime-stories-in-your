/**
 * Cloud Magic Onboarding
 *
 * Three frosted glass slides explaining the benefits of Cloud Magic:
 *  1. Syncing Stardust   – your progress lives in the cloud
 *  2. Saving Parent Voices – your voice recordings are safe forever
 *  3. Keeping Stories Safe – encrypted story vault
 *
 * After all slides the user is taken to the Crystal Gate (sign-in).
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 'stardust',
    emoji: '✨',
    nebula: ['rgba(255,215,0,0.22)', 'rgba(107,72,184,0.18)', 'transparent'] as const,
    title: 'Syncing Stardust',
    subtitle: 'Your magical rewards follow you everywhere',
    body: 'Every stardust crystal you earn syncs instantly across all your devices. Pick up from any screen — your streak, rewards, and progress are always right where you left them.',
    pillLabel: 'Cloud Sync',
    pillIcon: '☁️',
    accentColor: Colors.celestialGold,
    bgGlow: 'rgba(255,215,0,0.07)',
  },
  {
    id: 'voices',
    emoji: '🎙️',
    nebula: ['rgba(126,200,227,0.22)', 'rgba(107,72,184,0.18)', 'transparent'] as const,
    title: 'Saving Parent Voices',
    subtitle: 'Your voice, preserved forever',
    body: "Your recordings are securely backed up to the cloud vault. Even if you change your phone, your child's favourite voice — yours — will always be waiting for them.",
    pillLabel: 'Secure Backup',
    pillIcon: '🔐',
    accentColor: Colors.softBlue,
    bgGlow: 'rgba(126,200,227,0.07)',
  },
  {
    id: 'stories',
    emoji: '📖',
    nebula: ['rgba(107,72,184,0.25)', 'rgba(255,107,157,0.12)', 'transparent'] as const,
    title: 'Keeping Stories Safe',
    subtitle: 'Every tale, safe in the stars',
    body: "All the bedtime stories you create are encrypted and stored in your personal cosmic library. They'll never be lost, and you can share them with family across the galaxy.",
    pillLabel: 'Story Vault',
    pillIcon: '🌟',
    accentColor: Colors.softPurple,
    bgGlow: 'rgba(107,72,184,0.07)',
  },
] as const;

// ─── FloatingOrb — decorative animated glow orb ──────────────────────────────
function FloatingOrb({
  color,
  size,
  top,
  left,
  delay,
}: {
  color: string;
  size: number;
  top: number;
  left: number;
  delay: number;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    float.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    pulse.value = withDelay(
      delay + 600,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        orbStyles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          top,
          left,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

const orbStyles = StyleSheet.create({
  orb: { position: 'absolute' },
});

// ─── Slide component ──────────────────────────────────────────────────────────
function Slide({
  slide,
  isActive,
}: {
  slide: (typeof SLIDES)[number];
  isActive: boolean;
}) {
  const emojiScale = useSharedValue(0.6);
  const emojiOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(24);
  const emojiFloat = useSharedValue(0);

  React.useEffect(() => {
    if (isActive) {
      emojiScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 180 }));
      emojiOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      contentOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
      contentY.value = withDelay(350, withSpring(0, { damping: 16, stiffness: 200 }));

      // Float loop for emoji
      emojiFloat.value = withDelay(
        800,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );
    } else {
      emojiScale.value = withTiming(0.6, { duration: 250 });
      emojiOpacity.value = withTiming(0, { duration: 200 });
      contentOpacity.value = withTiming(0, { duration: 200 });
      contentY.value = withTiming(16, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: emojiOpacity.value,
    transform: [{ scale: emojiScale.value }, { translateY: emojiFloat.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  return (
    <View style={slideStyles.container}>
      {/* Nebula gradient backdrop */}
      <LinearGradient
        colors={[...slide.nebula]}
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />

      {/* Bg glow orb */}
      <View
        style={[
          slideStyles.bgGlow,
          { backgroundColor: slide.bgGlow },
        ]}
        pointerEvents="none"
      />

      {/* Reflective top shine */}
      <View style={slideStyles.topShine} />

      {/* Emoji icon */}
      <Animated.Text style={[slideStyles.emoji, emojiStyle]}>
        {slide.emoji}
      </Animated.Text>

      {/* Text content */}
      <Animated.View style={[slideStyles.textBlock, contentStyle]}>
        {/* Feature pill */}
        <View style={[slideStyles.pill, { borderColor: `${slide.accentColor}44` }]}>
          <LinearGradient
            colors={[`${slide.accentColor}22`, `${slide.accentColor}08`]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={slideStyles.pillIcon}>{slide.pillIcon}</Text>
          <Text style={[slideStyles.pillLabel, { color: slide.accentColor }]}>
            {slide.pillLabel}
          </Text>
        </View>

        <Text style={[slideStyles.title, { color: slide.accentColor }]}>
          {slide.title}
        </Text>

        <Text style={slideStyles.subtitle}>{slide.subtitle}</Text>

        <Text style={slideStyles.body}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  container: {
    width: W - 40,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 28,
    alignItems: 'center',
    gap: 20,
    minHeight: H * 0.48,
    justifyContent: 'center',
    // Depth shadow
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 16,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,8,36,0.7)' : 'rgba(20,10,50,0.92)',
  },
  bgGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -40,
    alignSelf: 'center',
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
  },
  emoji: {
    fontSize: 80,
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  textBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pillIcon: { fontSize: 14 },
  pillLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.black,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(107,72,184,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.moonlightCream,
    textAlign: 'center',
    opacity: 0.85,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── Dot indicator ────────────────────────────────────────────────────────────
function DotIndicator({
  count,
  active,
  accentColor,
}: {
  count: number;
  active: number;
  accentColor: string;
}) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }, (_, i) => (
        <DotItem key={i} isActive={i === active} accentColor={accentColor} />
      ))}
    </View>
  );
}

function DotItem({
  isActive,
  accentColor,
}: {
  isActive: boolean;
  accentColor: string;
}) {
  const width = useSharedValue(isActive ? 20 : 6);
  const opacity = useSharedValue(isActive ? 1 : 0.4);

  React.useEffect(() => {
    width.value = withSpring(isActive ? 20 : 6, { damping: 15, stiffness: 200 });
    opacity.value = withTiming(isActive ? 1 : 0.4, { duration: 250 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        dotStyles.dot,
        { backgroundColor: accentColor },
        style,
      ]}
    />
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CloudMagicOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // CTA press scale
  const ctaScale = useSharedValue(1);

  const slide = SLIDES[currentSlide];

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= SLIDES.length) return;
      setCurrentSlide(index);
      scrollRef.current?.scrollTo({ x: index * (W - 40 + 16), animated: true });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Last slide → go to Crystal Gate (sign-in)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      ctaScale.value = withSequence(
        withTiming(0.94, { duration: 80 }),
        withSpring(1, { damping: 8, stiffness: 300 })
      );
      setTimeout(() => router.push('/(auth)/sign-in'), 180);
    }
  };

  const handleSkip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/sign-in');
  };

  const handleScroll = useCallback(
    (x: number) => {
      const index = Math.round(x / (W - 40 + 16));
      if (index !== currentSlide && index >= 0 && index < SLIDES.length) {
        setCurrentSlide(index);
      }
    },
    [currentSlide]
  );

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      {/* Deep space gradient */}
      <LinearGradient
        colors={['#0D0E24', '#180D38', '#2A1155']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Star field */}
      <StarField count={60} />

      {/* Floating orbs */}
      <FloatingOrb color="rgba(255,215,0,0.06)" size={180} top={-60} left={-60} delay={0} />
      <FloatingOrb color="rgba(107,72,184,0.08)" size={220} top={H * 0.3} left={W * 0.6} delay={600} />
      <FloatingOrb color="rgba(126,200,227,0.05)" size={160} top={H * 0.65} left={-40} delay={1200} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoMoon}>🌙</Text>
          <View>
            <Text style={styles.logoTitle}>Cloud Magic</Text>
            <Text style={styles.logoSub}>StoryVoice</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides horizontal scroll */}
      <View style={styles.slidesWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
          onScroll={(e) => handleScroll(e.nativeEvent.contentOffset.x)}
          snapToInterval={W - 40 + 16}
          decelerationRate="fast"
        >
          {SLIDES.map((s, i) => (
            <View key={s.id} style={styles.slideCell}>
              {Platform.OS !== 'web' && (
                <BlurView
                  intensity={18}
                  tint="dark"
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
              )}
              <Slide slide={s} isActive={i === currentSlide} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dot indicators */}
        <DotIndicator
          count={SLIDES.length}
          active={currentSlide}
          accentColor={slide.accentColor}
        />

        {/* Progress hint */}
        <Text style={styles.progressHint}>
          {currentSlide + 1} of {SLIDES.length}
        </Text>

        {/* CTA button */}
        <Animated.View style={[styles.ctaWrapper, ctaStyle]}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleNext}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={
                isLast
                  ? (['#FFD700', '#FFC857', '#FF9F1C'] as const)
                  : (['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'] as const)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={[styles.ctaText, isLast && styles.ctaTextDark]}>
                {isLast ? '✨ Enter the Crystal Gate' : 'Continue →'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Dot nav taps */}
        <View style={styles.dotTapRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              style={styles.dotTapTarget}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0E24' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMoon: { fontSize: 28 },
  logoTitle: {
    fontFamily: Fonts.black,
    fontSize: 14,
    color: Colors.celestialGold,
    letterSpacing: 0.6,
  },
  logoSub: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  skipText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },

  slidesWrapper: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
    alignItems: 'center',
  },
  slideCell: {
    width: W - 40,
    marginRight: 16,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },

  bottom: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  progressHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(153,153,187,0.6)',
    letterSpacing: 0.3,
  },

  ctaWrapper: { width: '100%' },
  ctaBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.moonlightCream,
    letterSpacing: 0.4,
  },
  ctaTextDark: {
    color: Colors.deepSpace,
  },

  dotTapRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: -8,
  },
  dotTapTarget: {
    width: 32,
    height: 32,
  },
});
