/**
 * Parental Gate — Crystal Night Glassmorphism Edition
 *
 * Math-lock modal with deep glass surfaces, reflective 1px borders,
 * and a glowing gold submit button that floats above the overlay.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

interface ParentalGateProps {
  visible: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
  /** Optional label shown under the title (e.g. "Settings") */
  context?: string;
}

function generatePuzzle(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 20) + 8;
  const b = Math.floor(Math.random() * 20) + 8;
  return { a, b, answer: a + b };
}

export default function ParentalGate({
  visible,
  onSuccess,
  onDismiss,
  context,
}: ParentalGateProps) {
  const [puzzle, setPuzzle]   = useState(generatePuzzle);
  const [input, setInput]     = useState('');
  const [error, setError]     = useState(false);
  const inputRef              = useRef<TextInput>(null);

  // Modal entrance
  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  // Shake on wrong answer
  const shakeX = useSharedValue(0);

  // Subtle sparkle border pulse on lock icon
  const borderGlow = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      setPuzzle(generatePuzzle());
      setInput('');
      setError(false);
      scale.value   = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 220 });

      // Gentle pulse on lock ring
      borderGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );

      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => {
        clearTimeout(t);
        cancelAnimation(borderGlow);
      };
    } else {
      scale.value   = withTiming(0.88, { duration: 180, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 180 });
      cancelAnimation(borderGlow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 55 }),
      withTiming( 10, { duration: 55 }),
      withTiming( -8, { duration: 55 }),
      withTiming(  8, { duration: 55 }),
      withTiming( -4, { duration: 55 }),
      withTiming(  0, { duration: 55 }),
    );
  }, [shakeX]);

  const handleSubmit = useCallback(() => {
    const guess = parseInt(input.trim(), 10);
    if (isNaN(guess) || input.trim() === '') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      triggerShake();
      return;
    }
    if (guess === puzzle.answer) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInput('');
      setError(false);
      onSuccess();
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      triggerShake();
      setPuzzle(generatePuzzle());
      setInput('');
    }
  }, [input, puzzle.answer, onSuccess, triggerShake]);

  const handleDismiss = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setError(false);
    onDismiss();
  }, [onDismiss]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  const lockRingStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,215,0,${borderGlow.value * 0.6})`,
    shadowOpacity: borderGlow.value * 0.55,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop blur */}
        {Platform.OS !== 'web' && (
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        )}

        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        <Animated.View style={[styles.card, cardStyle]}>
          {/* Deep glass background */}
          {Platform.OS !== 'web' ? (
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={['rgba(30,10,60,0.90)', 'rgba(14,8,32,0.95)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          {/* Top highlight edge */}
          <View style={styles.topEdge} />

          <TouchableOpacity
            activeOpacity={1}
            style={styles.cardInner}
            onPress={() => {/* absorb */}}
          >
            {/* Lock ring with animated border glow */}
            <Animated.View style={[styles.lockIconWrapper, lockRingStyle]}>
              {/* Inner gold shimmer */}
              <LinearGradient
                colors={['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
              />
              <Text style={styles.lockIcon}>🔒</Text>
            </Animated.View>

            <Text style={styles.title}>Parent Check</Text>
            <Text style={styles.subtitle}>
              {context
                ? `Quick check before accessing ${context}.`
                : "Quick maths to verify you're an adult."}
            </Text>

            {/* Glass puzzle card */}
            <View style={styles.puzzleCard}>
              <LinearGradient
                colors={['rgba(255,215,0,0.10)', 'rgba(255,215,0,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
              />
              {/* Shine stripe */}
              <View style={styles.puzzleShine} />
              <Text style={styles.puzzleQuestion}>
                What is{' '}
                <Text style={styles.puzzleNumber}>{puzzle.a}</Text>
                {' + '}
                <Text style={styles.puzzleNumber}>{puzzle.b}</Text>
                {' ?'}
              </Text>
            </View>

            {/* Input */}
            <TextInput
              ref={inputRef}
              style={[styles.input, error && styles.inputError]}
              value={input}
              onChangeText={(t) => {
                // Gentle selection haptic on each digit typed
                if (t.length > input.length) void Haptics.selectionAsync();
                setInput(t);
                setError(false);
              }}
              placeholder="Your answer…"
              placeholderTextColor="rgba(153,153,187,0.55)"
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              selectionColor={Colors.celestialGold}
            />

            {error && (
              <Text style={styles.errorText}>Not quite — try again!</Text>
            )}

            {/* Floating gold glow button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.82}
            >
              {/* Outer glow ring */}
              <View style={styles.submitGlowRing} />
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>Confirm ✓</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleDismiss}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.7)',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: Spacing.lg,
  },

  card: {
    width:        '100%',
    maxWidth:     380,
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.16)',
    shadowColor:  '#9B6FDE',
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 50,
    shadowOpacity: 0.45,
    elevation:    24,
  },

  topEdge: {
    position:   'absolute',
    top:        0,
    left:       '15%',
    right:      '15%',
    height:     1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
  },

  cardInner: {
    padding:    Spacing.xl,
    alignItems: 'center',
    gap:        Spacing.md,
  },

  lockIconWrapper: {
    width:           80,
    height:          80,
    borderRadius:    40,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    overflow:        'hidden',
    shadowColor:     Colors.celestialGold,
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    18,
    marginBottom:    Spacing.xs,
  },
  lockIcon: { fontSize: 34 },

  title: {
    fontFamily: Fonts.black,
    fontSize:   22,
    color:      '#FFFFFF',
    textAlign:  'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      'rgba(240,235,248,0.65)',
    textAlign:  'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },

  puzzleCard: {
    width:             '100%',
    borderRadius:      Radius.lg,
    overflow:          'hidden',
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.22)',
    paddingVertical:   Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems:        'center',
    marginVertical:    Spacing.xs,
    backgroundColor:   'rgba(255,215,0,0.04)',
  },
  puzzleShine: {
    position:   'absolute',
    top:        0,
    left:       '20%',
    right:      '20%',
    height:     1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  puzzleQuestion: {
    fontFamily: Fonts.extraBold,
    fontSize:   22,
    color:      '#F0EBF8',
  },
  puzzleNumber: {
    fontFamily: Fonts.black,
    fontSize:   28,
    color:      Colors.celestialGold,
    textShadowColor: 'rgba(255,215,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  input: {
    width:             '100%',
    height:            56,
    borderRadius:      Radius.lg,
    backgroundColor:   'rgba(255,255,255,0.07)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.14)',
    paddingHorizontal: Spacing.lg,
    fontFamily:        Fonts.extraBold,
    fontSize:          26,
    color:             '#FFFFFF',
    textAlign:         'center',
    letterSpacing:     5,
  },
  inputError: {
    borderColor:     Colors.errorRed,
    backgroundColor: 'rgba(255,107,107,0.09)',
  },
  errorText: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      Colors.errorRed,
    textAlign:  'center',
    marginTop:  -Spacing.xs,
  },

  submitButton: {
    width:        '100%',
    borderRadius: Radius.full,
    marginTop:    Spacing.xs,
    // Float shadow
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    shadowOpacity: 0.55,
    elevation:    12,
  },
  submitGlowRing: {
    position:     'absolute',
    top:          -6,
    left:         -6,
    right:        -6,
    bottom:       -6,
    borderRadius: Radius.full + 6,
    borderWidth:  1,
    borderColor:  'rgba(255,215,0,0.25)',
  },
  submitGradient: {
    paddingVertical:  17,
    alignItems:       'center',
    borderRadius:     Radius.full,
  },
  submitText: {
    fontFamily: Fonts.black,
    fontSize:   16,
    color:      Colors.deepSpace,
    letterSpacing: 0.5,
  },

  cancelButton: {
    paddingVertical:   12,
    paddingHorizontal: Spacing.xl,
    marginTop:         -Spacing.xs,
  },
  cancelText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      'rgba(240,235,248,0.45)',
  },
});
