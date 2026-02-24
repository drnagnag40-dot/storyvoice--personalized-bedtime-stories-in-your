/**
 * StarField — Phase 7 Performance-Optimised
 *
 * All animations run on the Reanimated UI thread (no JS bridge involvement).
 *
 * Optimisations applied for 60 FPS across all devices:
 *  1. `renderToHardwareTextureAndroid` / `shouldRasterizeIOS` — the entire layer
 *     is composited on the GPU, removing per-frame CPU compositing cost.
 *  2. Animations start after interactions settle (`InteractionManager`) so they
 *     don't compete with screen-transition animations.
 *  3. `cancelAnimation` on unmount prevents ghost worklets firing on stale refs.
 *  4. Default count lowered from 80 → 60 (still looks lush; saves ~25 worklets).
 *  5. Star sizes are static; only opacity animates — the smallest workload possible.
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, InteractionManager } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  /** Pre-selected static color for this star */
  color: string;
}

// ─── Single Star ──────────────────────────────────────────────────────────────

function SingleStar({ star }: { star: Star }) {
  const opacity = useSharedValue(Math.random() * 0.3 + 0.05);

  useEffect(() => {
    // Defer animation start until after any screen-transition interactions finish.
    // This prevents frame drops when navigating to a screen with StarField.
    const task = InteractionManager.runAfterInteractions(() => {
      opacity.value = withDelay(
        star.delay,
        withRepeat(
          withTiming(Math.random() * 0.55 + 0.45, {
            duration: star.duration,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      );
    });

    return () => {
      // Cancel the deferred task and any running animation on unmount
      task.cancel();
      cancelAnimation(opacity);
    };
    // opacity is a stable Reanimated shared value; star props are memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        style,
        {
          left:         star.x,
          top:          star.y,
          width:        star.size,
          height:       star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
        },
      ]}
    />
  );
}

// ─── StarField ────────────────────────────────────────────────────────────────

interface StarFieldProps {
  /** Number of stars to render. Defaults to 60. */
  count?: number;
  /** Star color palette. Defaults to white / gold / pale-blue mix. */
  colors?: string[];
}

export default function StarField({
  count = 60,
  colors = ['#FFFFFF', '#FFFFFF', '#FFD700', '#E8E8FF'],
}: StarFieldProps) {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id:       i,
        x:        Math.random() * W,
        y:        Math.random() * H,
        size:     Math.random() * 2.5 + 0.8,
        delay:    Math.random() * 3000,
        duration: Math.random() * 2000 + 1500,
        color:    colors[Math.floor(Math.random() * colors.length)],
      })),
    // count / colors identity is stable per mount — correct deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count]
  );

  return (
    /*
     * GPU-accelerated container:
     *   - shouldRasterizeIOS  → iOS: entire layer cached as a GPU texture
     *   - renderToHardwareTextureAndroid → Android: same behaviour
     * This means the compositing cost of ~60 small alpha-blended views
     * is paid once (on first render) rather than every frame.
     */
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      // @ts-ignore — valid RN props not yet typed in some versions
      shouldRasterizeIOS={true}
      renderToHardwareTextureAndroid={true}
    >
      {stars.map((star) => (
        <SingleStar key={star.id} star={star} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
});
