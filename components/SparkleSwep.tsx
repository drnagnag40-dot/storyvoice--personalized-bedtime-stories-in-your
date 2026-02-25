/**
 * SparkleSwep Component
 *
 * A sweeping light effect with sparkles that moves across the screen,
 * used during Family Sharing data sync to indicate data transfer.
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
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

interface SparkleSwepProps {
  visible: boolean;
}

function Sparkle({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0);

  useEffect(() => {
    const anim = () => {
      opacity.value = withRepeat(
        withDelay(delay,
          withSequence(
            withTiming(1,   { duration: 300 }),
            withTiming(0.6, { duration: 300 }),
            withTiming(1,   { duration: 300 }),
            withTiming(0,   { duration: 400 }),
          )
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withDelay(delay,
          withSequence(
            withTiming(1,   { duration: 300, easing: Easing.out(Easing.back(2)) }),
            withTiming(0.7, { duration: 600 }),
            withTiming(0,   { duration: 400 }),
          )
        ),
        -1,
        false
      );
    };
    anim();
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.sparkle, { left: x, top: y, width: size, height: size }, style]}>
      <LinearGradient
        colors={[Colors.celestialGold, '#FFF0A0', Colors.celestialGold]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

export default function SparkleSwep({ visible }: SparkleSwepProps) {
  const sweepX     = useSharedValue(-W * 0.5);
  const sweepOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sweepOpacity.value = withTiming(1, { duration: 300 });
      sweepX.value = withRepeat(
        withSequence(
          withTiming(-W * 0.3, { duration: 0 }),
          withTiming(W * 1.3, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
          withTiming(-W * 0.3, { duration: 0 }),
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(sweepX);
      sweepOpacity.value = withTiming(0, { duration: 400 });
    }
    return () => {
      cancelAnimation(sweepX);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sweepStyle = useAnimatedStyle(() => ({
    opacity:   sweepOpacity.value,
    transform: [{ translateX: sweepX.value }],
  }));

  if (!visible) return null;

  // Generate sparkle positions
  const sparkles = [
    { x: W * 0.15, y: H * 0.2, size: 8,  delay: 0    },
    { x: W * 0.4,  y: H * 0.15, size: 6, delay: 200  },
    { x: W * 0.7,  y: H * 0.25, size: 10,delay: 100  },
    { x: W * 0.25, y: H * 0.5,  size: 7, delay: 350  },
    { x: W * 0.55, y: H * 0.45, size: 9, delay: 180  },
    { x: W * 0.8,  y: H * 0.55, size: 6, delay: 280  },
    { x: W * 0.1,  y: H * 0.7,  size: 8, delay: 420  },
    { x: W * 0.45, y: H * 0.72, size: 7, delay: 150  },
    { x: W * 0.75, y: H * 0.8,  size: 10,delay: 320  },
    { x: W * 0.3,  y: H * 0.85, size: 6, delay: 240  },
    { x: W * 0.6,  y: H * 0.35, size: 8, delay: 80   },
    { x: W * 0.9,  y: H * 0.4,  size: 7, delay: 380  },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Main sweeping light beam */}
      <Animated.View style={[styles.sweepBeam, sweepStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,215,0,0.08)', 'rgba(255,215,0,0.16)', 'rgba(255,215,0,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sparkle dots */}
      {sparkles.map((s, i) => (
        <Sparkle key={i} x={s.x} y={s.y} size={s.size} delay={s.delay} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sweepBeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: W * 0.5,
    left: 0,
  },
  sparkle: {
    position: 'absolute',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
