/**
 * WarpStarField – Animated star background with optional "space travel" warp mode.
 *
 * Normal mode  : gentle twinkling stars (identical feel to StarField.tsx)
 * Warp mode    : stars accelerate into elongated streaks, simulating hyperspace
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface StarData {
  id: number;
  x: number;        // horizontal start position (0 → W)
  startY: number;   // vertical start position (0 → H), randomised per star
  size: number;
  delay: number;    // for normal mode twinkle stagger
  twinkleDuration: number;
  warpDuration: number; // how long each streak cycle takes (ms)
}

// ─────────────────────────────────────────────────────────────────────────────
// Single warp-capable star
// ─────────────────────────────────────────────────────────────────────────────
function WarpStar({
  star,
  accelerating,
}: {
  star: StarData;
  accelerating: boolean;
}) {
  const opacity    = useSharedValue(Math.random() * 0.3 + 0.1);
  const translateY = useSharedValue(0);
  const scaleY     = useSharedValue(1);

  // ── Normal twinkle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!accelerating) {
      cancelAnimation(translateY);
      cancelAnimation(scaleY);

      // Reset to resting state
      translateY.value = withTiming(0, { duration: 300 });
      scaleY.value     = withTiming(1, { duration: 300 });

      // Gentle opacity twinkle
      opacity.value = withDelay(
        star.delay,
        withRepeat(
          withTiming(Math.random() * 0.5 + 0.5, {
            duration: star.twinkleDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      );
    }
  }, [accelerating]);

  // ── Warp acceleration ───────────────────────────────────────────────────
  useEffect(() => {
    if (accelerating) {
      cancelAnimation(opacity);

      const remainingY = H - star.startY; // distance from star's origin to bottom

      // Phase 1: flash bright as warp kicks in
      opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withRepeat(withTiming(0.85, { duration: 80 }), -1, true)
      );

      // Streak: elongate + shoot downward, then instantly snap back to top
      scaleY.value = withDelay(
        star.delay * 0.1, // minimal delay so they don't all move at once
        withRepeat(
          withSequence(
            withTiming(6 + star.size * 3, {
              duration: star.warpDuration * 0.25,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(1, { duration: 50 })
          ),
          -1,
          false
        )
      );

      translateY.value = withDelay(
        star.delay * 0.1,
        withRepeat(
          withSequence(
            withTiming(remainingY + 60, {
              duration: star.warpDuration,
              easing: Easing.in(Easing.quad),
            }),
            withTiming(-(star.startY + 60), { duration: 0 }) // snap back
          ),
          -1,
          false
        )
      );
    }
  }, [accelerating]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scaleY: scaleY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.x,
          top: star.startY,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────
interface WarpStarFieldProps {
  count?: number;
  accelerating?: boolean;
}

export default function WarpStarField({
  count = 80,
  accelerating = false,
}: WarpStarFieldProps) {
  const stars = useMemo<StarData[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * W,
      startY: Math.random() * H,
      size: Math.random() * 2.5 + 0.8,
      delay: Math.random() * 3000,
      twinkleDuration: Math.random() * 2000 + 1500,
      warpDuration: Math.random() * 500 + 400, // 400-900 ms per streak cycle
    })),
    [count]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star) => (
        <WarpStar
          key={star.id}
          star={star}
          accelerating={accelerating}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
