/**
 * WarpStarField – Animated star background with optional "space travel" warp mode.
 *
 * Normal mode  : gentle twinkling stars (identical feel to StarField.tsx)
 * Warp mode    : stars accelerate into elongated streaks, simulating hyperspace
 *
 * Bug fixes applied:
 *  - Cancel ALL running animations (opacity, translateY, scaleY) on every
 *    mode transition to prevent conflicting animation loops that caused jitter.
 *  - Fade stars out briefly before repositioning so abrupt translateY/scaleY
 *    resets are never visible.
 *  - Replaced rapid 80 ms opacity pulse in warp mode with a steady brightness
 *    to eliminate the strobe / flicker artefact.
 *  - Reduced per-star delay coefficient for warp start (0.05× vs 0.1×) so the
 *    hyperspace transition feels instantaneous and wave-like rather than staggered.
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
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scaleY     = useSharedValue(1);

  // ── Normal twinkle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!accelerating) {
      // Cancel any running animations to avoid conflicts
      cancelAnimation(opacity);
      cancelAnimation(translateY);
      cancelAnimation(scaleY);

      // Fade out briefly so the position/scale reset is never visible
      opacity.value = withTiming(0, { duration: 120 });
      translateY.value = withTiming(0, { duration: 200 });
      scaleY.value = withTiming(1, { duration: 200 });

      // After the brief fade-out, start the gentle twinkle
      const twinkleTarget = Math.random() * 0.5 + 0.35;
      opacity.value = withDelay(
        220 + star.delay,
        withRepeat(
          withSequence(
            withTiming(twinkleTarget, {
              duration: star.twinkleDuration,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(twinkleTarget * 0.25, {
              duration: star.twinkleDuration,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          false
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accelerating]);

  // ── Warp acceleration ───────────────────────────────────────────────────
  useEffect(() => {
    if (accelerating) {
      // Cancel any running animations to avoid conflicts
      cancelAnimation(opacity);
      cancelAnimation(translateY);
      cancelAnimation(scaleY);

      // Smooth bright flash — no rapid pulse (eliminates strobe artefact)
      opacity.value = withTiming(0.92, { duration: 180 });

      // Small per-star offset (0.05×) so warp starts as a wave, not a cascade
      const warpOffset = star.delay * 0.05;
      const remainingY = H - star.startY + 60;

      // Elongate then snap on each streak cycle
      scaleY.value = withDelay(
        warpOffset,
        withRepeat(
          withSequence(
            withTiming(6 + star.size * 3, {
              duration: star.warpDuration * 0.3,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(1, { duration: 60 })
          ),
          -1,
          false
        )
      );

      // Shoot downward, then instantly teleport to the top
      translateY.value = withDelay(
        warpOffset,
        withRepeat(
          withSequence(
            withTiming(remainingY, {
              duration: star.warpDuration,
              easing: Easing.in(Easing.quad),
            }),
            withTiming(-(star.startY + 60), { duration: 0 }) // instant snap
          ),
          -1,
          false
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      warpDuration: Math.random() * 500 + 400, // 400–900 ms per streak cycle
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
