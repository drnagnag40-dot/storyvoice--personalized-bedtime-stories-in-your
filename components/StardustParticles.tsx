/**
 * StardustParticles
 *
 * Renders tiny gold stardust particles that animate around a field
 * when the parent reports "active" (e.g. user is typing in an input).
 * Particles spawn at random positions, drift upward, and fade out.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

const { width: W } = Dimensions.get('window');

const GOLD = '#FFD700';
const GOLD_PALE = '#FFF3A3';

interface ParticleProps {
  index: number;
  containerWidth: number;
  active: boolean;
}

function Particle({ index, containerWidth, active }: ParticleProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0);

  // Deterministic but varied positions based on index
  const startX = ((index * 73 + 17) % 100) / 100; // 0..1 relative
  const size = 2 + ((index * 31) % 4); // 2..5px
  const delay = (index * 140) % 1200;
  const duration = 1400 + ((index * 97) % 800); // 1400..2200ms
  const xDrift = (((index * 53) % 40) - 20); // -20..+20

  useEffect(() => {
    if (active) {
      // Stagger particle spawning
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.8 + ((index % 3) * 0.1), { duration: 200 }),
            withTiming(0, { duration: duration - 200, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 300 }) // pause before repeat
          ),
          -1,
          false
        )
      );

      translateY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(-(20 + ((index * 17) % 25)), { duration, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
        )
      );

      translateX.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(xDrift, { duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
        )
      );

      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 150 }),
            withTiming(0.3, { duration: duration - 150, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(opacity);
      cancelAnimation(translateY);
      cancelAnimation(translateX);
      cancelAnimation(scale);
      opacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const particleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const isGlint = index % 4 === 0;

  return (
    <Animated.View
      style={[
        particleStyles.particle,
        {
          left: startX * (containerWidth - size),
          bottom: 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isGlint ? GOLD_PALE : GOLD,
        },
        particleStyle,
      ]}
    />
  );
}

const particleStyles = StyleSheet.create({
  particle: {
    position: 'absolute',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
});

// ─── Public Component ─────────────────────────────────────────────────────────

interface StardustParticlesProps {
  active: boolean;
  /** Width of the input container; defaults to full width */
  containerWidth?: number;
  /** Number of particles (default 14) */
  count?: number;
}

export default function StardustParticles({
  active,
  containerWidth = W - 40,
  count = 14,
}: StardustParticlesProps) {
  return (
    <View
      style={[styles.container, { width: containerWidth }]}
      pointerEvents="none"
    >
      {Array.from({ length: count }, (_, i) => (
        <Particle
          key={i}
          index={i}
          containerWidth={containerWidth}
          active={active}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 50,
    overflow: 'visible',
  },
});
