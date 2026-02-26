/**
 * StardustLoader – Pulsing Glowing Glass Orb
 *
 * Replaces default ActivityIndicator with a Crystal Night themed
 * breathing orb with orbiting stardust particles. Breathes in sync
 * with the BreathingGradient background cycle.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface StardustLoaderProps {
  size?: number;
  color?: string;
  /** Extra label shown below the orb (e.g. "Opening your story…") */
  label?: string;
}

export default function StardustLoader({
  size = 52,
  color = Colors.celestialGold,
}: StardustLoaderProps) {
  // Core orb breathing – mirrors the 6-second BreathingGradient cycle
  const breathScale   = useSharedValue(1);
  const glowOpacity   = useSharedValue(0.45);

  // Three orbiting stardust particles at 0°, 120°, 240°
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);

  // Specular shimmer sweep
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // ── Breathing orb ───────────────────────────────────────────────────────
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.90, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1,    { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // ── Orbiting stardust (staggered start) ─────────────────────────────────
    p0.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1, false);
    p1.value = withDelay(730, withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false));
    p2.value = withDelay(1460, withRepeat(withTiming(1, { duration: 1900, easing: Easing.linear }), -1, false));

    // ── Shimmer sweep ────────────────────────────────────────────────────────
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 0 }),
        withDelay(1800, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(breathScale);
      cancelAnimation(glowOpacity);
      cancelAnimation(p0);
      cancelAnimation(p1);
      cancelAnimation(p2);
      cancelAnimation(shimmer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(breathScale.value, [0.9, 1.16], [1, 1.3], Extrapolation.CLAMP) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-size * 0.4, size * 0.4], Extrapolation.CLAMP) }],
  }));

  // Particle animated styles — called directly to comply with Rules of Hooks
  const particle0Style = useAnimatedStyle(() => {
    const angle = p0.value * Math.PI * 2;
    const r = size * 0.82;
    return {
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }],
      opacity: interpolate(Math.sin(p0.value * Math.PI * 2 + Math.PI / 2), [-1, 0, 1], [0.25, 0.65, 1], Extrapolation.CLAMP),
    };
  });

  const particle1Style = useAnimatedStyle(() => {
    const angle = p1.value * Math.PI * 2 + (Math.PI * 2) / 3;
    const r = size * 0.72;
    return {
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }],
      opacity: interpolate(Math.sin(p1.value * Math.PI * 2 + (Math.PI * 2) / 3 + Math.PI / 2), [-1, 0, 1], [0.25, 0.65, 1], Extrapolation.CLAMP),
    };
  });

  const particle2Style = useAnimatedStyle(() => {
    const angle = p2.value * Math.PI * 2 + (Math.PI * 4) / 3;
    const r = size * 0.90;
    return {
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }],
      opacity: interpolate(Math.sin(p2.value * Math.PI * 2 + (Math.PI * 4) / 3 + Math.PI / 2), [-1, 0, 1], [0.25, 0.65, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={[styles.container, { width: size * 2.6, height: size * 2.6 }]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.outerGlow,
          {
            width:        size * 1.9,
            height:       size * 1.9,
            borderRadius: size * 0.95,
            borderColor:  `${color}50`,
            shadowColor:  color,
          },
          outerGlowStyle,
        ]}
      />

      {/* Glass orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            backgroundColor: `${color}1A`,
            borderColor:     `${color}55`,
            shadowColor:     color,
          },
          orbStyle,
        ]}
      >
        {/* Specular shimmer bar */}
        <Animated.View
          style={[
            styles.shimmerBar,
            { top: size * 0.18, height: size * 0.18, borderRadius: size * 0.1 },
            shimmerStyle,
          ]}
        />
        {/* Static top-left highlight */}
        <View
          style={[
            styles.specular,
            { top: size * 0.12, left: size * 0.18, width: size * 0.28, height: size * 0.13, borderRadius: size * 0.07 },
          ]}
        />
      </Animated.View>

      {/* Orbiting stardust particles */}
      {[particle0Style, particle1Style, particle2Style].map((pStyle, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: color,
              shadowColor:     color,
              width:           i === 1 ? 4 : 5,
              height:          i === 1 ? 4 : 5,
              borderRadius:    i === 1 ? 2 : 2.5,
            },
            pStyle,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position:      'absolute',
    borderWidth:   1,
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  24,
    shadowOpacity: 0.5,
    elevation:     6,
  },
  orb: {
    borderWidth:   1.5,
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  24,
    shadowOpacity: 0.85,
    elevation:     14,
    alignItems:    'center',
    justifyContent: 'center',
    overflow:      'hidden',
  },
  shimmerBar: {
    position:        'absolute',
    left:            0,
    right:           0,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  specular: {
    position:        'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  particle: {
    position:      'absolute',
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  6,
    shadowOpacity: 1,
    elevation:     4,
  },
});
