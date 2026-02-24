/**
 * ChoiceTimer – Circular progress bar countdown
 *
 * Shows a gentle pulsating circular timer around choice buttons,
 * encouraging calm decision-making.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';

interface ChoiceTimerProps {
  duration: number;       // Total seconds
  timeLeft: number;       // Current seconds remaining
  onExpire?: () => void;  // Called when timer reaches 0
  size?: number;          // Diameter in px
  color?: string;         // Arc colour
}

export default function ChoiceTimer({
  duration,
  timeLeft,
  size = 72,
  color = Colors.celestialGold,
}: ChoiceTimerProps) {
  const progress = timeLeft / duration; // 1.0 → 0.0

  // Pulsating glow
  const pulseAnim = useSharedValue(0);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulseAnim);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity:      interpolate(pulseAnim.value, [0, 1], [0.3, 0.8], Extrapolation.CLAMP),
    shadowRadius: interpolate(pulseAnim.value, [0, 1], [4, 14], Extrapolation.CLAMP),
  }));

  // Use two rotated half-circles to fake a circular progress arc
  // Full circle = progress 1.0, empty = 0.0
  const borderWidth = Math.max(3, size * 0.07);
  const halfSize = size / 2;

  // Right half: rotates 0→180 for first 50%
  const rightDeg = progress > 0.5
    ? 180
    : progress * 360;

  // Left half: hidden until 50%, then rotates 0→180
  const leftDeg = progress > 0.5
    ? (progress - 0.5) * 360
    : 0;

  // Color shifts red as time runs out
  const urgencyColor = timeLeft <= 5
    ? Colors.errorRed
    : timeLeft <= 10
      ? '#FF8C42'
      : color;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          glowStyle,
          {
            width:        size + 8,
            height:       size + 8,
            borderRadius: (size + 8) / 2,
            borderWidth:  borderWidth,
            borderColor:  urgencyColor,
            shadowColor:  urgencyColor,
            top:          -4,
            left:         -4,
          },
        ]}
      />

      {/* Background track */}
      <View
        style={[
          styles.track,
          {
            width:        size,
            height:       size,
            borderRadius: halfSize,
            borderWidth,
            borderColor:  'rgba(255,255,255,0.1)',
          },
        ]}
      />

      {/* Clip right half */}
      <View
        style={[
          styles.halfClipRight,
          { width: halfSize, height: size, right: 0 },
        ]}
      >
        <View
          style={[
            styles.halfFill,
            {
              width:  size,
              height: size,
              borderRadius: halfSize,
              borderWidth,
              borderColor: urgencyColor,
              transform: [{ rotate: `${rightDeg}deg` }],
              marginLeft: -halfSize,
            },
          ]}
        />
      </View>

      {/* Clip left half */}
      <View
        style={[
          styles.halfClipLeft,
          { width: halfSize, height: size, left: 0 },
        ]}
      >
        <View
          style={[
            styles.halfFill,
            {
              width:  size,
              height: size,
              borderRadius: halfSize,
              borderWidth,
              borderColor: urgencyColor,
              transform: [{ rotate: `${leftDeg}deg` }],
            },
          ]}
        />
      </View>

      {/* Center: time remaining */}
      <View style={styles.center}>
        <Text style={[styles.timeText, { color: urgencyColor, fontSize: size * 0.28 }]}>
          {timeLeft}
        </Text>
        <Text style={[styles.secLabel, { fontSize: size * 0.14 }]}>sec</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:    'relative',
    alignItems:  'center',
    justifyContent: 'center',
  },
  glowRing: {
    position:  'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    elevation: 4,
  },
  track: {
    position: 'absolute',
  },
  halfClipRight: {
    position: 'absolute',
    overflow: 'hidden',
  },
  halfClipLeft: {
    position: 'absolute',
    overflow: 'hidden',
  },
  halfFill: {
    position: 'absolute',
  },
  center: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: Fonts.black,
    lineHeight: undefined,
  },
  secLabel: {
    fontFamily: Fonts.bold,
    color:      Colors.textMuted,
    marginTop:  -2,
  },
});
