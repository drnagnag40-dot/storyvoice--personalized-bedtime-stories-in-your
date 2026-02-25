/**
 * Parental Gate
 *
 * A simple, non-intrusive modal that verifies an adult is present
 * by requiring a quick mental-maths answer before granting access
 * to sensitive areas (Settings, Edit Profile, etc.).
 *
 * Usage:
 *   <ParentalGate
 *     visible={showGate}
 *     onSuccess={() => { setShowGate(false); doSensitiveAction(); }}
 *     onDismiss={() => setShowGate(false)}
 *   />
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
  Easing,
} from 'react-native-reanimated';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

interface ParentalGateProps {
  visible: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
  /** Optional label shown under the title (e.g. "Settings") */
  context?: string;
}

// Generate a fresh random addition puzzle
function generatePuzzle(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 20) + 8;   // 8–27
  const b = Math.floor(Math.random() * 20) + 8;   // 8–27
  return { a, b, answer: a + b };
}

export default function ParentalGate({
  visible,
  onSuccess,
  onDismiss,
  context,
}: ParentalGateProps) {
  const [puzzle, setPuzzle]     = useState(generatePuzzle);
  const [input, setInput]       = useState('');
  const [error, setError]       = useState(false);
  const inputRef                = useRef<TextInput>(null);

  // Modal entrance animation
  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  // Shake animation for wrong answers
  const shakeX = useSharedValue(0);

  // Regenerate puzzle and reset state each time the gate opens
  useEffect(() => {
    if (visible) {
      setPuzzle(generatePuzzle());
      setInput('');
      setError(false);
      scale.value   = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 220 });
      // Auto-focus input after animation
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    } else {
      scale.value   = withTiming(0.88, { duration: 180, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 180 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming( 10, { duration: 60 }),
      withTiming( -8, { duration: 60 }),
      withTiming(  8, { duration: 60 }),
      withTiming( -4, { duration: 60 }),
      withTiming(  0, { duration: 60 }),
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
      // Correct!
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInput('');
      setError(false);
      onSuccess();
    } else {
      // Wrong – generate a fresh puzzle so spamming doesn't work
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

  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
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
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        <Animated.View style={[styles.card, cardStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(37,38,85,0.96)', 'rgba(13,14,36,0.98)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          <TouchableOpacity
            activeOpacity={1}
            style={styles.cardInner}
            onPress={() => {/* absorb presses */}}
          >
            {/* Header */}
            <View style={styles.lockIconWrapper}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>

            <Text style={styles.title}>Parent Check</Text>
            <Text style={styles.subtitle}>
              {context
                ? `Just a quick check before accessing ${context}.`
                : 'Quick maths to verify you\'re an adult.'}
            </Text>

            {/* Puzzle */}
            <View style={styles.puzzleCard}>
              <LinearGradient
                colors={['rgba(255,215,0,0.1)', 'rgba(255,215,0,0.04)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
              />
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
              onChangeText={(t) => { setInput(t); setError(false); }}
              placeholder="Your answer…"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              selectionColor={Colors.celestialGold}
            />

            {error && (
              <Text style={styles.errorText}>
                {'Not quite — try again!'}
              </Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Cancel */}
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
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width:        '100%',
    maxWidth:     380,
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.1)',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 40,
    shadowOpacity: 0.6,
    elevation:    20,
  },
  cardInner: {
    padding:    Spacing.xl,
    alignItems: 'center',
    gap:        Spacing.md,
  },

  lockIconWrapper: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
    marginBottom:    Spacing.xs,
  },
  lockIcon: { fontSize: 32 },

  title: {
    fontFamily: Fonts.black,
    fontSize:   22,
    color:      Colors.moonlightCream,
    textAlign:  'center',
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 19,
    paddingHorizontal: Spacing.sm,
  },

  puzzleCard: {
    width:             '100%',
    borderRadius:      Radius.lg,
    overflow:          'hidden',
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.2)',
    paddingVertical:   Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems:        'center',
    marginVertical:    Spacing.xs,
  },
  puzzleQuestion: {
    fontFamily: Fonts.extraBold,
    fontSize:   22,
    color:      Colors.moonlightCream,
  },
  puzzleNumber: {
    fontFamily: Fonts.black,
    fontSize:   26,
    color:      Colors.celestialGold,
  },

  input: {
    width:             '100%',
    height:            56,
    borderRadius:      Radius.lg,
    backgroundColor:   'rgba(255,255,255,0.06)',
    borderWidth:       1,
    borderColor:       Colors.borderColor,
    paddingHorizontal: Spacing.lg,
    fontFamily:        Fonts.extraBold,
    fontSize:          26,
    color:             Colors.moonlightCream,
    textAlign:         'center',
    letterSpacing:     4,
  },
  inputError: {
    borderColor:     Colors.errorRed,
    backgroundColor: 'rgba(255,107,107,0.08)',
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
    overflow:     'hidden',
    marginTop:    Spacing.xs,
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.35,
    elevation:    8,
  },
  submitGradient: {
    paddingVertical:  16,
    alignItems:       'center',
    borderRadius:     Radius.full,
  },
  submitText: {
    fontFamily: Fonts.black,
    fontSize:   16,
    color:      Colors.deepSpace,
  },

  cancelButton: {
    paddingVertical:   12,
    paddingHorizontal: Spacing.xl,
    marginTop:         -Spacing.xs,
  },
  cancelText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
  },
});
