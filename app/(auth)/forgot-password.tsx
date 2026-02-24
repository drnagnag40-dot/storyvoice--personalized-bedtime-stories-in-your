import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import { Colors, Fonts } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword, isLoading, error, pendingPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [localError, setLocalError] = useState('');

  const glowOpacity = useSharedValue(0);

  // Key icon float animation
  const keyFloat = useSharedValue(0);
  React.useEffect(() => {
    keyFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyFloat.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleFocus = () => {
    setFocused(true);
    glowOpacity.value = withTiming(1, { duration: 250 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setFocused(false);
    glowOpacity.value = withTiming(0, { duration: 200 });
  };

  const handleReset = async () => {
    setLocalError('');
    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await resetPassword(email.trim());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const displayError = localError || (error ? error.message : '');

  // ── Success state ─────────────────────────────────────────────────────────────
  if (pendingPasswordReset) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <StarField count={35} />
        <View style={[styles.successContainer, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <Animated.View style={keyFloatStyle}>
            <Text style={styles.successEmoji}>✉️</Text>
          </Animated.View>
          <Text style={styles.successTitle}>Check your inbox!</Text>
          <Text style={styles.successSubtitle}>
            {"We've sent a password reset link to your email.\nFollow the link to create a new password."}
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace('/(auth)/sign-in');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.primaryButtonText}>← Back to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={35} />

      {/* Moon glow orb */}
      <View style={styles.moonGlowOrb} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Animated.View style={[styles.header, keyFloatStyle]}>
            <Text style={styles.headerEmoji}>🔑</Text>
            <Text style={styles.title}>Reset your password</Text>
            <View style={styles.titleUnderline} />
            <Text style={styles.subtitle}>
              {"Enter your email and we'll send you\na secure reset link"}
            </Text>
          </Animated.View>

          {/* Glass card */}
          <View style={styles.glassCard}>
            {Platform.OS === 'ios' && (
              <BlurView
                intensity={20}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}

            {/* Error */}
            {!!displayError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            {/* Email input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <Animated.View style={[styles.glowRing, glowStyle]} pointerEvents="none" />
                <View style={[styles.inputContainer, focused && styles.inputFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(153,153,187,0.6)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={() => void handleReset()}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    selectionColor={Colors.celestialGold}
                  />
                </View>
              </View>
            </View>

            {/* Send button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
              onPress={() => void handleReset()}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Sending…' : '📨 Send Reset Link'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(auth)/sign-in');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },

  moonGlowOrb: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.celestialGold,
    opacity: 0.04,
  },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },

  header: { alignItems: 'center', marginTop: 8, marginBottom: 28 },
  headerEmoji: { fontSize: 52, marginBottom: 10 },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: Colors.moonlightCream,
    marginBottom: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  titleUnderline: {
    width: 50,
    height: 2,
    backgroundColor: Colors.celestialGold,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.7,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  glassCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    padding: 20,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    gap: 8,
  },
  errorIcon: { fontSize: 14 },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, flex: 1 },

  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: { position: 'relative' },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: 'rgba(255,215,0,0.7)',
    backgroundColor: 'rgba(255,215,0,0.04)',
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    letterSpacing: 0.2,
  },

  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.55 },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.deepSpace,
    letterSpacing: 0.5,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  footerLink: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.celestialGold,
    textDecorationLine: 'underline',
  },

  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successEmoji: { fontSize: 72, marginBottom: 20 },
  successTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 28,
    color: Colors.moonlightCream,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
});
