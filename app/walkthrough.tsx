/**
 * High-End Welcome Walkthrough
 *
 * A first-time-only multi-screen visual introduction to StoryVoice.
 * Showcases the three core pillars with StarField background,
 * Celestial Gold typography, smooth Reanimated transitions & haptics.
 *
 * Slides:
 *  1. The Voice Studio  – Voice Cloning
 *  2. The AI Engine     – Personalised Stories
 *  3. The Player        – Sleep-First Design
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Slide data
// ─────────────────────────────────────────────────────────────────────────────
interface Slide {
  icon: string;
  tag: string;
  title: string;
  subtitle: string;
  body: string;
  accentColor: string;
  gradientColors: [string, string, string];
}

const SLIDES: Slide[] = [
  {
    icon: '🎙️',
    tag: 'THE VOICE STUDIO',
    title: 'Your Voice.\nTheir Dreams.',
    subtitle: 'Narrated by the person they love most.',
    body: 'Record your voice just once, and hear yourself tell personalised bedtime stories every single night. Your child will drift off to the most familiar, comforting sound in the world — yours.',
    accentColor: Colors.celestialGold,
    gradientColors: ['#2D1B69', '#1A1B41', '#0D0E24'],
  },
  {
    icon: '✨',
    tag: 'THE AI ENGINE',
    title: 'Stories Made\nJust For Them.',
    subtitle: 'Infinitely personalised. Endlessly magical.',
    body: 'Our AI weaves your child\'s name, age, interests, and personality into unique tales that feel written especially for them. No two stories are ever the same.',
    accentColor: '#B48EFF',
    gradientColors: ['#1A1250', '#0D0E24', '#0A0A1E'],
  },
  {
    icon: '🌙',
    tag: 'THE PLAYER',
    title: 'Designed\nFor Sleep.',
    subtitle: 'A calm sanctuary at bedtime.',
    body: 'Every pixel is crafted to ease the transition to sleep. No distractions. No bright lights. Just a warm, dim glow, your voice, and a story guiding your child gently into dreamland.',
    accentColor: Colors.softBlue,
    gradientColors: ['#0D1E3A', '#0D0E24', '#060810'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Floating icon with breathing glow
// ─────────────────────────────────────────────────────────────────────────────
function FloatingIcon({ icon, color }: { icon: string; color: string }) {
  const scale    = useSharedValue(1);
  const glowSize = useSharedValue(16);

  useEffect(() => {
    // 4-second calming breathing cycle
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.00, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glowSize.value = withRepeat(
      withSequence(
        withTiming(32, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(16, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glowSize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowRadius:  glowSize.value,
    shadowOpacity: interpolate(glowSize.value, [16, 32], [0.4, 0.7], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.iconWrapper, glowStyle, { shadowColor: color }]}>
      <Animated.Text style={[styles.slideIcon, iconStyle]}>{icon}</Animated.Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual slide content (animated entrance)
// ─────────────────────────────────────────────────────────────────────────────
function SlideContent({
  slide,
  isActive,
}: {
  slide: Slide;
  isActive: boolean;
}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    if (isActive) {
      opacity.value    = withDelay(100, withTiming(1, { duration: 500 }));
      translateY.value = withDelay(100, withSpring(0, { damping: 14, stiffness: 120 }));
    } else {
      opacity.value    = withTiming(0, { duration: 200 });
      translateY.value = withTiming(16, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.slide, { width: W }]}>
      <Animated.View style={[styles.slideInner, contentStyle]}>
        <FloatingIcon icon={slide.icon} color={slide.accentColor} />

        <View style={[styles.tagPill, { borderColor: `${slide.accentColor}50` }]}>
          <Text style={[styles.tagText, { color: slide.accentColor }]}>{slide.tag}</Text>
        </View>

        <Text style={styles.slideTitle}>{slide.title}</Text>

        <Text style={[styles.slideSubtitle, { color: slide.accentColor }]}>
          {slide.subtitle}
        </Text>

        <View style={styles.divider}>
          <LinearGradient
            colors={['transparent', slide.accentColor, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.dividerLine}
          />
        </View>

        <Text style={styles.slideBody}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main walkthrough screen
// ─────────────────────────────────────────────────────────────────────────────
export default function WalkthroughScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Button press animation
  const btnScale = useSharedValue(1);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / W);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [activeIndex]);

  const handleNext = useCallback(async () => {
    // Haptic + button press animation
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnScale.value = withSequence(
      withTiming(0.94, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 300 }),
    );

    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: nextIndex * W, animated: true });
    } else {
      // Mark walkthrough as seen and navigate to welcome
      await AsyncStorage.setItem('walkthrough_seen', 'true');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/welcome');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, router]);

  const handleSkip = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem('walkthrough_seen', 'true');
    router.replace('/welcome');
  }, [router]);

  const isLastSlide = activeIndex === SLIDES.length - 1;
  const slide = SLIDES[activeIndex];

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Dynamic gradient background */}
      <LinearGradient
        colors={slide.gradientColors}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Star field always visible */}
      <StarField count={80} />

      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + 16 }]}
          onPress={() => void handleSkip()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        scrollEnabled
        style={styles.pager}
        contentContainerStyle={{ paddingTop: insets.top + 48 }}
      >
        {SLIDES.map((s, i) => (
          <SlideContent key={i} slide={s} isActive={i === activeIndex} />
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveIndex(i);
                scrollRef.current?.scrollTo({ x: i * W, animated: true });
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View
                style={[
                  styles.dot,
                  i === activeIndex
                    ? [styles.dotActive, { backgroundColor: slide.accentColor, shadowColor: slide.accentColor }]
                    : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        <Animated.View style={[styles.ctaWrapper, btnStyle]}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => void handleNext()}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={
                isLastSlide
                  ? [Colors.celestialGold, Colors.softGold, '#FFA500']
                  : [`${slide.accentColor}EE`, `${slide.accentColor}BB`]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text
                style={[
                  styles.ctaText,
                  { color: isLastSlide ? Colors.deepSpace : '#fff' },
                ]}
              >
                {isLastSlide ? '✨  Begin Your Journey' : 'Next  ›'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Logo wordmark */}
        <Text style={styles.wordmark}>StoryVoice</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },

  skipButton: {
    position:          'absolute',
    right:             Spacing.lg,
    zIndex:            10,
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      Radius.full,
    backgroundColor:   'rgba(255,255,255,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.12)',
  },
  skipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted },

  pager: { flex: 1 },

  slide: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: Spacing.xl,
  },
  slideInner: {
    alignItems: 'center',
    maxWidth:   340,
    width:      '100%',
    gap:        Spacing.md,
  },

  iconWrapper: {
    width:           110,
    height:          110,
    borderRadius:    55,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    marginBottom:    Spacing.sm,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       0,
  },
  slideIcon: { fontSize: 54 },

  tagPill: {
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      Radius.full,
    borderWidth:       1,
    backgroundColor:   'rgba(255,255,255,0.04)',
  },
  tagText: { fontFamily: Fonts.black, fontSize: 10, letterSpacing: 2 },

  slideTitle: {
    fontFamily: Fonts.black,
    fontSize:   Math.min(H * 0.058, 42),
    color:      Colors.moonlightCream,
    textAlign:  'center',
    lineHeight: Math.min(H * 0.068, 50),
    marginTop:  Spacing.xs,
  },
  slideSubtitle: {
    fontFamily: Fonts.bold,
    fontSize:   15,
    textAlign:  'center',
    lineHeight: 22,
  },

  divider:     { width: '100%', alignItems: 'center' },
  dividerLine: { height: 1, width: '60%', opacity: 0.5 },

  slideBody: {
    fontFamily: Fonts.regular,
    fontSize:   15,
    color:      'rgba(245,245,220,0.72)',
    textAlign:  'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.sm,
  },

  // Bottom controls
  bottomControls: {
    paddingHorizontal: Spacing.xl,
    gap:               Spacing.lg,
    alignItems:        'center',
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  dot: {
    borderRadius: 99,
    shadowOffset: { width: 0, height: 0 },
    elevation:    0,
  },
  dotActive: {
    width:        28,
    height:       8,
    shadowRadius: 8,
    shadowOpacity: 0.7,
    elevation:    4,
  },
  dotInactive: {
    width:           8,
    height:          8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  ctaWrapper: { width: '100%' },
  ctaButton:  {
    borderRadius: Radius.full,
    overflow:     'hidden',
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    shadowOpacity: 0.4,
    elevation:    10,
  },
  ctaGradient: {
    paddingVertical:   18,
    paddingHorizontal: Spacing.xl,
    borderRadius:      Radius.full,
    alignItems:        'center',
    justifyContent:    'center',
  },
  ctaText: {
    fontFamily: Fonts.black,
    fontSize:   17,
    letterSpacing: 0.3,
  },

  wordmark: {
    fontFamily: Fonts.black,
    fontSize:   13,
    color:      'rgba(255,255,255,0.18)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
