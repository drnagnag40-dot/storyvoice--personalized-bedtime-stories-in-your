/**
 * BreathingGradient — Crystal Night
 *
 * Slow, calming gradient that breathes between Deep Indigo and Midnight Purple.
 * Two LinearGradients are stacked; their opacity cross-fades on a 6-second cycle
 * creating a living, atmospheric "inhale / exhale" effect.
 *
 * Uses Reanimated UI thread only – zero JS-thread load.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

// ── Gradient stops ────────────────────────────────────────────────────────────
const PHASE_A_COLORS: [string, string, string] = ['#0E0820', '#180D38', '#2A1155'];
const PHASE_B_COLORS: [string, string, string] = ['#180D38', '#2A1155', '#3D1A6E'];

const PHASE_A_LOCS: [number, number, number] = [0, 0.5, 1];
const PHASE_B_LOCS: [number, number, number] = [0, 0.55, 1];

// ── Component ─────────────────────────────────────────────────────────────────
export default function BreathingGradient() {
  // Phase B opacity oscillates 0 → 1 → 0 on a slow cycle.
  // Phase A is always below at full opacity; the cross-fade produces the "breath".
  const phaseBOpacity = useSharedValue(0);

  useEffect(() => {
    phaseBOpacity.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(phaseBOpacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseBStyle = useAnimatedStyle(() => ({
    opacity: phaseBOpacity.value,
  }));

  return (
    <>
      {/* Phase A – always visible base layer */}
      <LinearGradient
        colors={PHASE_A_COLORS}
        locations={PHASE_A_LOCS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Phase B – animates in/out on top */}
      <Animated.View style={[StyleSheet.absoluteFill, phaseBStyle]} pointerEvents="none">
        <LinearGradient
          colors={PHASE_B_COLORS}
          locations={PHASE_B_LOCS}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>
    </>
  );
}
