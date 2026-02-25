/**
 * PolaroidReveal Component
 *
 * Displays an AI-transformed family portrait with a vintage Polaroid
 * photo reveal animation — the photo develops from white to full colour
 * with a gentle rotation settle effect.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

interface PolaroidRevealProps {
  imageUri: string | null;
  caption?: string;
  artStyleLabel?: string;
  artStyleEmoji?: string;
  isTransforming?: boolean;
  transformStep?: string;
  width?: number;
}

export default function PolaroidReveal({
  imageUri,
  caption,
  artStyleLabel,
  artStyleEmoji,
  isTransforming = false,
  transformStep = 'Painting your portrait…',
  width = 220,
}: PolaroidRevealProps) {
  const height = width * 1.25;
  const imageHeight = width * 0.9;

  // Animation values
  const revealOpacity   = useSharedValue(0);
  const revealScale     = useSharedValue(0.85);
  const rotation        = useSharedValue(4);
  const developProgress = useSharedValue(0); // 0=white, 1=full colour
  const shimmerX        = useSharedValue(-width);
  const glowPulse       = useSharedValue(0);

  const hasAnimated = useRef(false);

  useEffect(() => {
    if (imageUri && !isTransforming && !hasAnimated.current) {
      hasAnimated.current = true;

      // 1. Card floats in
      revealOpacity.value = withTiming(1, { duration: 600 });
      revealScale.value   = withSpring(1, { damping: 14, stiffness: 120 });

      // 2. Slight tilt then settle to natural -2 deg lean
      rotation.value = withSequence(
        withTiming(4,  { duration: 0 }),
        withDelay(300, withSpring(-2, { damping: 8, stiffness: 80 }))
      );

      // 3. Photo "develops" from white
      developProgress.value = withDelay(500, withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }));

      // 4. Shimmer sweep across the photo once developed
      shimmerX.value = withDelay(1800, withTiming(width + 60, { duration: 800, easing: Easing.out(Easing.quad) }));

      // 5. Initial punchy glow flash, then settle into a soft continuous dreamlike pulse
      glowPulse.value = withDelay(2600,
        withSequence(
          withTiming(1,   { duration: 600, easing: Easing.out(Easing.sin) }),
          withTiming(0.5, { duration: 500, easing: Easing.in(Easing.sin) }),
          withTiming(0.85,{ duration: 400, easing: Easing.out(Easing.sin) }),
          // After the flash, breathe softly and continuously
          withRepeat(
            withSequence(
              withTiming(0.75, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.25, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false
          )
        )
      );
    }

    // Clean up glow animation when image is removed
    return () => {
      if (!imageUri) {
        cancelAnimation(glowPulse);
        glowPulse.value = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri, isTransforming]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   revealOpacity.value,
    transform: [
      { scale:  revealScale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowPulse.value, [0, 1], [0.1, 0.7], Extrapolation.CLAMP),
    shadowRadius:  interpolate(glowPulse.value, [0, 1], [8, 28],    Extrapolation.CLAMP),
  }));

  const developOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(developProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  if (isTransforming) {
    return (
      <View style={[styles.transformingContainer, { width, height }]}>
        <LinearGradient
          colors={['rgba(37,38,85,0.95)', 'rgba(13,14,36,0.9)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        <View style={styles.transformingInner}>
          <ActivityIndicator size="large" color={Colors.celestialGold} />
          <Text style={styles.transformingEmoji}>{artStyleEmoji ?? '🎨'}</Text>
          <Text style={styles.transformingLabel}>{transformStep}</Text>
          <Text style={styles.transformingSubLabel}>AI is painting your portrait…</Text>
        </View>
      </View>
    );
  }

  if (!imageUri) return null;

  return (
    <Animated.View style={[styles.polaroidWrapper, { width, minHeight: height }, cardStyle, glowStyle]}>
      {/* White Polaroid frame */}
      <View style={[styles.polaroidFrame, { width }]}>
        {/* Photo area */}
        <View style={[styles.photoArea, { width: width - 24, height: imageHeight }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.photo}
            resizeMode="cover"
          />
          {/* Photo develop overlay (white fades out) */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.developOverlay, developOverlayStyle]} />
          {/* Shimmer effect */}
          <Animated.View style={[styles.shimmerStripe, shimmerStyle]} />
          {/* Art style badge */}
          {artStyleLabel && (
            <View style={styles.artStyleBadge}>
              <Text style={styles.artStyleBadgeEmoji}>{artStyleEmoji}</Text>
              <Text style={styles.artStyleBadgeText}>{artStyleLabel}</Text>
            </View>
          )}
        </View>

        {/* Polaroid caption area */}
        <View style={styles.captionArea}>
          <Text style={styles.captionText}>{caption ?? 'Our Little Star ✨'}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  polaroidWrapper: {
    alignItems: 'center',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  polaroidFrame: {
    backgroundColor: 'rgba(255, 253, 240, 0.96)',
    borderRadius: 4,
    padding: 12,
    paddingBottom: 20,
    alignItems: 'center',
    // Soft reflective Polaroid border
    borderWidth: 1,
    borderColor: 'rgba(255, 240, 180, 0.85)',
    // Top highlight to reinforce frosted glass feel
    shadowColor: 'rgba(255, 220, 100, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  photoArea: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#E8E4D8',
    // Perfectly centred — resizeMode="cover" on Image handles focal centering
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  developOverlay: {
    backgroundColor: 'rgba(255, 253, 240, 0.97)',
    borderRadius: 2,
  },
  shimmerStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ skewX: '-20deg' }],
  },
  artStyleBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26,27,65,0.85)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  artStyleBadgeEmoji: { fontSize: 12 },
  artStyleBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.celestialGold,
  },
  captionArea: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  captionText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#4A3F2C',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Transforming state
  transformingContainer: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  transformingInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  transformingEmoji: { fontSize: 36 },
  transformingLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.moonlightCream,
    textAlign: 'center',
  },
  transformingSubLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
