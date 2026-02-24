/**
 * MagicDustEffect
 *
 * A celebratory particle burst — sparkle emojis and golden dots float upward
 * and fade out over ~2.5 s. Designed to trigger on successful data migration.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

const EMOJIS = ['✨', '⭐', '🌟', '💫', '✦', '•', '✨', '⭐', '💛', '✦'];
const GOLD = '#FFD700';
const SILVER = '#E8E8FF';

interface Particle {
  id: number;
  emoji: string;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

function SingleParticle({
  p,
  onDone,
}: {
  p: Particle;
  onDone?: () => void;
}) {
  const opacity   = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale     = useSharedValue(0.3);

  useEffect(() => {
    // Rise + sparkle in
    opacity.value = withDelay(
      p.delay,
      withSequence(
        withTiming(1,   { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.9, { duration: p.duration * 0.5 }),
        withTiming(0,   { duration: p.duration * 0.5, easing: Easing.in(Easing.quad) })
      )
    );
    translateX.value = withDelay(
      p.delay,
      withTiming(p.driftX, { duration: p.duration + 300, easing: Easing.out(Easing.quad) })
    );
    translateY.value = withDelay(
      p.delay,
      withTiming(p.driftY, {
        duration: p.duration + 300,
        easing: Easing.out(Easing.cubic),
      }, onDone ? () => runOnJS(onDone)() : undefined)
    );
    scale.value = withDelay(
      p.delay,
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(3)) }),
        withTiming(0.8, { duration: p.duration })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.particle, { left: p.startX, top: p.startY }, style]}
    >
      {p.emoji === '•' ? (
        <View style={[styles.dot, { width: p.size, height: p.size, backgroundColor: p.color }]} />
      ) : (
        <Text style={{ fontSize: p.size }}>{p.emoji}</Text>
      )}
    </Animated.View>
  );
}

interface MagicDustEffectProps {
  visible: boolean;
  /** Called when the animation finishes (all particles faded) */
  onFinished?: () => void;
  /** Origin Y position (default: vertical centre) */
  originY?: number;
}

export default function MagicDustEffect({
  visible,
  onFinished,
  originY,
}: MagicDustEffectProps) {
  const centreX = W / 2;
  const centreY = originY ?? H * 0.5;

  const particles = useMemo<Particle[]>(() => {
    if (!visible) return [];
    return Array.from({ length: 34 }, (_, i) => {
      const angle     = (Math.random() * Math.PI * 2);
      const distance  = Math.random() * 160 + 60;
      const emoji     = EMOJIS[i % EMOJIS.length];
      const isGold    = Math.random() > 0.4;
      return {
        id:       i,
        emoji,
        startX:   centreX + (Math.random() - 0.5) * 40,
        startY:   centreY + (Math.random() - 0.5) * 40,
        driftX:   Math.cos(angle) * distance,
        driftY:   Math.sin(angle) * distance - 80,
        size:     emoji === '•' ? Math.random() * 8 + 4 : Math.random() * 14 + 10,
        delay:    Math.random() * 400,
        duration: Math.random() * 900 + 1000,
        color:    isGold ? GOLD : SILVER,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // Auto-call onFinished after the longest possible animation duration
    const maxDelay = 400 + 900 + 1000 + 300 + 500; // generous buffer
    const timer = setTimeout(() => {
      onFinished?.();
    }, maxDelay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <SingleParticle key={p.id} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
  dot: {
    borderRadius: 999,
  },
});
