/**
 * StarfallAnimation
 *
 * Fullscreen golden star shower effect triggered on premium upgrade success.
 * Renders 24 stars that cascade from top to bottom with staggered delays,
 * random horizontal positions, rotations, and sizes.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const STAR_COUNT = 28;

interface StarData {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  emoji: string;
  rotation: number;
}

function generateStars(): StarData[] {
  const emojis = ['⭐', '✨', '💫', '🌟', '⭐', '✨'];
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * (W - 40) + 10,
    delay: Math.random() * 1400,
    duration: 1000 + Math.random() * 800,
    size: 18 + Math.random() * 22,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    rotation: Math.random() * 360,
  }));
}

const STARS = generateStars();

function FallingStar({ star }: { star: StarData }) {
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(star.rotation);

  useEffect(() => {
    translateY.value = withDelay(
      star.delay,
      withTiming(H + 80, {
        duration: star.duration,
        easing: Easing.in(Easing.quad),
      })
    );
    opacity.value = withDelay(
      star.delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: star.duration - 400 }),
        withTiming(0, { duration: 200 })
      )
    );
    rotate.value = withDelay(
      star.delay,
      withTiming(star.rotation + 360, {
        duration: star.duration,
        easing: Easing.linear,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        styles.star,
        { left: star.x, fontSize: star.size },
        animStyle,
      ]}
    >
      {star.emoji}
    </Animated.Text>
  );
}

interface StarfallAnimationProps {
  visible: boolean;
}

export default function StarfallAnimation({ visible }: StarfallAnimationProps) {
  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {STARS.map((star) => (
        <FallingStar key={star.id} star={star} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  star: {
    position: 'absolute',
    top: 0,
  },
});
