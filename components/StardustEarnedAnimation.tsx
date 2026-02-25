/**
 * StardustEarnedAnimation
 *
 * A magical overlay that triggers at the end of a story when Stardust is earned.
 * Features:
 *  - Floating frosted-glass particles that drift upward
 *  - A central Crystal Night glass panel with a glowing reward counter
 *  - Counter animates from 0 → earned amount
 *  - Auto-dismisses after ~3.5 s (or tap to dismiss early)
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  amount: number;
  reason?: string;
  onDone: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single floating glass particle
// ─────────────────────────────────────────────────────────────────────────────
interface ParticleConfig {
  id: number;
  startX: number;    // % of W
  startY: number;    // % of H (starting position from bottom)
  size: number;
  delay: number;
  duration: number;
  driftX: number;    // horizontal drift in px
  color: string;
  shape: 'circle' | 'diamond' | 'star';
}

const PARTICLE_COLORS = [
  'rgba(255,215,0,0.90)',   // gold
  'rgba(255,255,255,0.85)', // white
  'rgba(200,170,255,0.85)', // lavender
  'rgba(255,215,0,0.70)',   // dim gold
  'rgba(255,255,255,0.65)', // dim white
  'rgba(255,190,50,0.80)',  // amber
  'rgba(180,140,255,0.75)', // purple
];

function buildParticles(count: number): ParticleConfig[] {
  const shapes: ParticleConfig['shape'][] = ['circle', 'diamond', 'star'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX:   15 + Math.random() * 70,  // 15–85% of width
    startY:   50 + Math.random() * 30,  // starts 50–80% from top
    size:     6 + Math.random() * 10,
    delay:    Math.random() * 800,
    duration: 1800 + Math.random() * 1200,
    driftX:   (Math.random() - 0.5) * 80,
    color:    PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    shape:    shapes[i % shapes.length],
  }));
}

function GlassParticle({ cfg, trigger }: { cfg: ParticleConfig; trigger: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger) {
      progress.value = 0;
      progress.value = withDelay(
        cfg.delay,
        withTiming(1, { duration: cfg.duration, easing: Easing.out(Easing.quad) })
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const animStyle = useAnimatedStyle(() => {
    const y  = interpolate(progress.value, [0, 1], [0, -(H * 0.5)], Extrapolation.CLAMP);
    const x  = interpolate(progress.value, [0, 1], [0, cfg.driftX], Extrapolation.CLAMP);
    const op = interpolate(progress.value, [0, 0.2, 0.7, 1], [0, 1, 0.8, 0], Extrapolation.CLAMP);
    const sc = interpolate(progress.value, [0, 0.15, 0.85, 1], [0.3, 1.2, 1, 0.6], Extrapolation.CLAMP);
    return {
      opacity:   op,
      transform: [{ translateY: y }, { translateX: x }, { scale: sc }],
    };
  });

  const particleStyle = [
    styles.particle,
    {
      left:   `${cfg.startX}%` as `${number}%`,
      top:    `${cfg.startY}%` as `${number}%`,
      width:  cfg.size,
      height: cfg.size,
      borderRadius: cfg.shape === 'circle' ? cfg.size / 2 : cfg.shape === 'diamond' ? 2 : cfg.size / 2,
      backgroundColor: cfg.color,
      transform: cfg.shape === 'diamond' ? [{ rotate: '45deg' }] : [],
    },
  ];

  return (
    <Animated.View style={[particleStyle, animStyle]}>
      {cfg.shape === 'star' && (
        <Text style={{ fontSize: cfg.size * 1.1, lineHeight: cfg.size * 1.2 }}>✦</Text>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────────────────────────────────────
function GlowCounter({ amount, trigger }: { amount: number; trigger: boolean }) {
  const displayed = useSharedValue(0);

  useEffect(() => {
    if (trigger && amount > 0) {
      displayed.value = 0;
      displayed.value = withDelay(400, withTiming(amount, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, amount]);

  // Since we can't easily use an animated number in JSX, we use a workaround:
  // We drive the display via a JS-thread state update. For a small counter (max ~50),
  // this is acceptable and produces a smooth-enough counting effect.
  const [count, setCount] = React.useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trigger) { setCount(0); return; }
    if (amount <= 0) return;

    let start = 0;
    const step = Math.max(1, Math.ceil(amount / 40));
    const interval = Math.max(20, 1200 / (amount / step));

    const tick = () => {
      start = Math.min(start + step, amount);
      setCount(start);
      if (start < amount) {
        rafRef.current = setTimeout(tick, interval);
      }
    };

    rafRef.current = setTimeout(tick, 450); // 400ms delay + a bit

    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [trigger, amount]);

  return (
    <Text style={styles.counterText}>+{count}</Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function StardustEarnedAnimation({ visible, amount, reason, onDone }: Props) {
  const particles = useMemo(() => buildParticles(16), []);

  // Panel entrance
  const panelScale   = useSharedValue(0.5);
  const panelOpacity = useSharedValue(0);

  // Star glow pulse
  const starGlow = useSharedValue(1);

  // Overlay fade
  const overlayOpacity = useSharedValue(0);

  const dismissed = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;

    panelScale.value   = withTiming(0.8,  { duration: 300, easing: Easing.in(Easing.quad) });
    panelOpacity.value = withTiming(0,    { duration: 300 });
    overlayOpacity.value = withTiming(0,  { duration: 300 });

    setTimeout(() => {
      runOnJS(onDone)();
    }, 320);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);

  useEffect(() => {
    if (visible) {
      dismissed.current = false;

      // Entrance
      panelScale.value   = withDelay(100, withSpring(1, { damping: 12, stiffness: 200 }));
      panelOpacity.value = withDelay(100, withTiming(1, { duration: 350 }));
      overlayOpacity.value = withTiming(1, { duration: 250 });

      // Star glow pulse
      starGlow.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      );

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-dismiss
      autoTimerRef.current = setTimeout(() => {
        dismiss();
      }, 3500);
    } else {
      panelScale.value     = 0.5;
      panelOpacity.value   = 0;
      overlayOpacity.value = 0;
      starGlow.value       = 1;
      dismissed.current    = false;
    }

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      cancelAnimation(starGlow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle   = useAnimatedStyle(() => ({
    opacity:   panelOpacity.value,
    transform: [{ scale: panelScale.value }],
  }));
  const starStyle    = useAnimatedStyle(() => ({ transform: [{ scale: starGlow.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <TouchableOpacity
        style={styles.root}
        activeOpacity={1}
        onPress={dismiss}
      >
        {/* Dim overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} />

        {/* Particle field */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles.map((cfg) => (
            <GlassParticle key={cfg.id} cfg={cfg} trigger={visible} />
          ))}
        </View>

        {/* Central glass panel */}
        <Animated.View style={[styles.panel, panelStyle]}>
          {Platform.OS !== 'web' && (
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          )}

          {/* Deep glass gradient */}
          <LinearGradient
            colors={['rgba(30,10,70,0.90)', 'rgba(14,8,32,0.96)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Gold shimmer tint */}
          <LinearGradient
            colors={['rgba(255,215,0,0.14)', 'rgba(255,215,0,0.02)', 'rgba(255,215,0,0.08)']}
            locations={[0, 0.5, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Reflective top edge */}
          <View style={styles.panelTopEdge} />

          {/* Content */}
          <View style={styles.panelContent}>
            {/* Animated star */}
            <Animated.Text style={[styles.starEmoji, starStyle]}>⭐</Animated.Text>

            <Text style={styles.earnedLabel}>Stardust Earned!</Text>

            {/* Counter */}
            <View style={styles.counterRow}>
              <GlowCounter amount={amount} trigger={visible} />
              <Text style={styles.counterUnit}>⭐</Text>
            </View>

            {reason && (
              <Text style={styles.reasonText} numberOfLines={2}>{reason}</Text>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            <Text style={styles.tapToDismiss}>✨ Tap to continue</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
  },
  overlay: {
    backgroundColor: 'rgba(5,2,18,0.78)',
  },

  // Particles
  particle: {
    position:   'absolute',
    borderWidth: 0,
    // Gold glow via shadow
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 0.9,
    elevation: 4,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Panel
  panel: {
    width:        W * 0.78,
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1.5,
    borderColor:  'rgba(255,215,0,0.38)',
    // Gold float shadow
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 50,
    shadowOpacity: 0.55,
    elevation:    30,
  },
  panelTopEdge: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1.5,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius:    1,
  },
  panelContent: {
    alignItems:    'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap:           Spacing.sm,
  },

  starEmoji: {
    fontSize: 56,
    // Gold text glow
    textShadowColor: 'rgba(255,215,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  earnedLabel: {
    fontFamily:    Fonts.black,
    fontSize:      22,
    color:         Colors.crystalWhite,
    letterSpacing: 0.5,
    textAlign:     'center',
    textShadowColor: 'rgba(255,215,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  counterRow: {
    flexDirection:  'row',
    alignItems:     'baseline',
    gap:            6,
    marginVertical: 4,
  },
  counterText: {
    fontFamily: Fonts.black,
    fontSize:   48,
    color:      Colors.celestialGold,
    lineHeight: 56,
    textShadowColor: 'rgba(255,215,0,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  counterUnit: {
    fontSize:   28,
    lineHeight: 34,
  },
  reasonText: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      'rgba(240,235,248,0.60)',
    textAlign:  'center',
    lineHeight: 20,
    marginTop:  4,
    maxWidth:   220,
  },
  divider: {
    width:           '60%',
    height:          1,
    backgroundColor: 'rgba(255,215,0,0.20)',
    marginVertical:  Spacing.sm,
    borderRadius:    1,
  },
  tapToDismiss: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      'rgba(255,215,0,0.55)',
    letterSpacing: 0.3,
  },
});
