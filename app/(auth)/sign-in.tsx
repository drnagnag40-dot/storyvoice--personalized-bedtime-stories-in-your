/**
 * The Crystal Gate — Sign In / Sign Up
 *
 * Visual enhancements over the original:
 *  • Floating Glass Portal card with thin reflective borders
 *  • Subtle 3D tilt effect driven by pan gesture (react-native-reanimated)
 *  • Stardust particle burst on email input focus / typing
 *  • Nebula zoom transition when switching between Sign-In ↔ Sign-Up modes
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import StardustParticles from '@/components/StardustParticles';
import { Colors, Fonts } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const CARD_WIDTH = W - 40;

type Mode = 'signin' | 'signup';

// ─── Error helpers ────────────────────────────────────────────────────────────
function getFriendlyErrorMessage(err: unknown, context?: 'signin' | 'signup'): string {
  if (err !== null && typeof err === 'object' && !Array.isArray(err)) {
    const obj = err as Record<string, unknown>;
    if (obj['type'] === 'NETWORK_ERROR') {
      return context === 'signup'
        ? 'An internet connection is required to create your account. Please check your connection and try again.'
        : context === 'signin'
        ? 'An internet connection is required to access your account. Please check your connection and try again.'
        : 'Unable to connect. Please check your internet connection and try again.';
    }
    if (typeof obj['message'] === 'string') return getFriendlyErrorMessage(obj['message'], context);
    if (obj['originalError']) return getFriendlyErrorMessage(obj['originalError'], context);
    return 'Something went wrong. Please try again.';
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return 'Something went wrong. Please try again.';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const extracted = (typeof parsed['detail'] === 'string' ? parsed['detail'] : '') || (typeof parsed['message'] === 'string' ? parsed['message'] : '');
      if (extracted) return getFriendlyErrorMessage(extracted, context);
    } catch { /* ignore */ }
  }
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network request failed') || lower.includes('timeout') || lower.includes('no internet') || (lower.includes('network') && lower.includes('error'))) {
    return context === 'signup' ? 'An internet connection is required to create your account.' : context === 'signin' ? 'An internet connection is required to access your account.' : 'Unable to connect. Please check your internet connection.';
  }
  if (lower.includes('tenant not found') || lower.includes('managed supabase backend')) return 'Sign-in is temporarily unavailable. Please try again later.';
  if (lower.includes('user already registered') || lower.includes('already exists')) return 'An account with this email already exists. Try signing in instead.';
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) return 'Incorrect email or password. Please try again.';
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) return 'Please verify your email address before signing in.';
  if (lower.includes('rate limit') || lower.includes('too many request')) return 'Too many attempts. Please wait a moment and try again.';
  if (lower.includes('placeholder.supabase') || lower.includes('placeholder-anon-key')) return 'Authentication service is not configured. Please contact support.';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'Something went wrong. Please try again.';
  return raw.length <= 200 ? raw : 'Something went wrong. Please try again.';
}

// ─── GlassInput ───────────────────────────────────────────────────────────────
const GlassInput = React.forwardRef<TextInput, {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'password' | 'off';
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  rightElement?: React.ReactNode;
  /** Show stardust particles when focused+typing */
  showStardust?: boolean;
  onFocusChange?: (focused: boolean) => void;
}>(function GlassInput(
  { label, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize,
    autoComplete, returnKeyType, onSubmitEditing, rightElement, showStardust, onFocusChange },
  ref
) {
  const [focused, setFocused] = useState(false);
  const glowOpacity = useSharedValue(0);
  const glowRadius = useSharedValue(0);

  const handleFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
    glowOpacity.value = withTiming(1, { duration: 250 });
    glowRadius.value = withSpring(12, { damping: 12, stiffness: 200 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handleBlur = () => {
    setFocused(false);
    onFocusChange?.(false);
    glowOpacity.value = withTiming(0, { duration: 300 });
    glowRadius.value = withTiming(0, { duration: 300 });
  };

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    shadowRadius: glowRadius.value,
  }));

  const particlesActive = showStardust && focused && value.length > 0;

  return (
    <View style={inputStyles.group}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={inputStyles.wrapper}>
        {/* Gold glow ring */}
        <Animated.View style={[inputStyles.glowRing, glowStyle]} pointerEvents="none" />

        <View style={[inputStyles.container, focused && inputStyles.containerFocused]}>
          <TextInput
            ref={ref}
            style={[inputStyles.input, rightElement ? { paddingRight: 48 } : null]}
            placeholder={placeholder}
            placeholderTextColor="rgba(153,153,187,0.55)"
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize ?? 'sentences'}
            autoComplete={autoComplete}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={handleFocus}
            onBlur={handleBlur}
            selectionColor={Colors.celestialGold}
          />
          {rightElement && <View style={inputStyles.rightSlot}>{rightElement}</View>}
        </View>

        {/* Stardust particles */}
        {showStardust && (
          <StardustParticles
            active={!!particlesActive}
            containerWidth={CARD_WIDTH - 40}
            count={16}
          />
        )}
      </View>
    </View>
  );
});

const inputStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: 'rgba(232,232,240,0.65)',
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  wrapper: { position: 'relative' },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    overflow: 'hidden',
  },
  containerFocused: {
    borderColor: 'rgba(255,215,0,0.65)',
    backgroundColor: 'rgba(255,215,0,0.03)',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    letterSpacing: 0.2,
  },
  rightSlot: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingRight: 14 },
});

// ─── Social button ────────────────────────────────────────────────────────────
function SocialButton({ provider, onPress, disabled }: { provider: 'google' | 'apple'; onPress: () => void; disabled?: boolean }) {
  const scale = useSharedValue(1);
  const handlePress = () => {
    scale.value = withSequence(withTiming(0.96, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 300 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (provider === 'google') {
    return (
      <Animated.View style={[btnStyle, socialStyles.wrapper]}>
        <TouchableOpacity style={socialStyles.googleBtn} onPress={handlePress} disabled={disabled} activeOpacity={0.9}>
          <View style={socialStyles.googleIconWrapper}><Text style={socialStyles.googleG}>G</Text></View>
          <Text style={socialStyles.googleText}>Continue with Google</Text>
          <View style={{ width: 32 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[btnStyle, socialStyles.wrapper]}>
      <TouchableOpacity style={socialStyles.appleBtn} onPress={handlePress} disabled={disabled} activeOpacity={0.9}>
        <View style={socialStyles.appleIconWrapper}><Text style={socialStyles.appleIcon}></Text></View>
        <Text style={socialStyles.appleText}>Continue with Apple</Text>
        <View style={{ width: 32 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const socialStyles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  googleIconWrapper: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  googleG: { fontFamily: Fonts.extraBold, fontSize: 16, color: '#fff', lineHeight: 20 },
  googleText: { fontFamily: Fonts.bold, fontSize: 15, color: '#1A1B41', flex: 1, textAlign: 'center' },
  appleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1C1C1E', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  appleIconWrapper: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  appleIcon: { fontSize: 22, color: '#fff' },
  appleText: { fontFamily: Fonts.bold, fontSize: 15, color: '#FFFFFF', flex: 1, textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const insets = useSafeAreaInsets();
  const {
    signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple,
    isLoading, error, pendingEmailVerification,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // ── 3D Tilt (pan gesture) ──────────────────────────────────────────────────
  const tiltX = useSharedValue(0); // rotateX (pitch)
  const tiltY = useSharedValue(0); // rotateY (yaw)
  const cardScale = useSharedValue(1);

  const TILT_MAX = 8; // degrees

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Map touch position within card to tilt angles
      tiltY.value = interpolate(e.x, [0, CARD_WIDTH], [-TILT_MAX, TILT_MAX]);
      tiltX.value = interpolate(e.y, [0, 500], [TILT_MAX, -TILT_MAX]);
    })
    .onEnd(() => {
      tiltX.value = withSpring(0, { damping: 14, stiffness: 160 });
      tiltY.value = withSpring(0, { damping: 14, stiffness: 160 });
    });

  const cardTiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
      { scale: cardScale.value },
    ],
  }));

  // ── Nebula zoom transition ──────────────────────────────────────────────────
  const nebulaScale = useSharedValue(1);
  const nebulaOpacity = useSharedValue(1);
  const formOpacity = useSharedValue(1);
  const formTranslateX = useSharedValue(0);
  const indicatorX = useSharedValue(0);

  // ── Logo float ──────────────────────────────────────────────────────────────
  const moonFloat = useSharedValue(0);
  React.useEffect(() => {
    moonFloat.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moonStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: moonFloat.value }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));
  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateX: formTranslateX.value }],
  }));
  const cardNebulaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nebulaScale.value }],
    opacity: nebulaOpacity.value,
  }));

  // ── Switch mode with nebula zoom ────────────────────────────────────────────
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLocalError('');

      const HALF_TAB = (W - 40 - 8) / 2;
      const newX = next === 'signup' ? HALF_TAB : 0;
      const slideDir = next === 'signup' ? -20 : 20;

      indicatorX.value = withTiming(newX, { duration: 280, easing: Easing.out(Easing.cubic) });

      // Nebula zoom: brief scale-up and brightness flash
      nebulaScale.value = withSequence(
        withTiming(1.04, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
      );
      nebulaOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
      );

      formOpacity.value = withTiming(0, { duration: 140 }, () => {
        runOnJS(setMode)(next);
        formTranslateX.value = -slideDir;
        formOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
        formTranslateX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      });
    },
    [mode, indicatorX, formOpacity, formTranslateX, nebulaScale, nebulaOpacity]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setLocalError('');
    if (!email.trim() || !password) {
      setLocalError('Please enter your email and password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await signInWithEmail(email.trim(), password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setLocalError(getFriendlyErrorMessage(err, 'signin'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSignUp = async () => {
    setLocalError('');
    if (!email.trim() || !password) { setLocalError('Please enter your email and password.'); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (password !== confirmPassword) { setLocalError('Passwords do not match.'); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    try {
      await signUpWithEmail(email.trim(), password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setLocalError(getFriendlyErrorMessage(err, 'signup'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSubmit = () => (mode === 'signin' ? void handleSignIn() : void handleSignUp());

  const rawAuthError = error ? error.message : '';
  const displayError =
    localError ||
    (rawAuthError ? getFriendlyErrorMessage(rawAuthError) : '') ||
    (params.error ? getFriendlyErrorMessage(decodeURIComponent(params.error)) : '');

  // ── Email verification ────────────────────────────────────────────────────
  if (pendingEmailVerification) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0D0E24', '#180D38', '#2D1B69']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <StarField count={35} />
        <View style={[styles.verifyContainer, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.verifyEmoji}>📬</Text>
          <Text style={styles.verifyTitle}>Check your email!</Text>
          <Text style={styles.verifySubtitle}>{"We've sent a magic verification link. Once confirmed, you can sign in."}</Text>
          <TouchableOpacity style={styles.verifyButton} onPress={() => switchMode('signin')}>
            <LinearGradient colors={[Colors.celestialGold, '#E8A800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
              <Text style={styles.primaryButtonText}>Go to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gradient sky */}
      <LinearGradient
        colors={['#0D0E24', '#180D38', '#2D1B69']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      <StarField count={50} />

      {/* Nebula glows */}
      <View style={[styles.nebulaOrb, styles.nebulaGold]} pointerEvents="none" />
      <View style={[styles.nebulaOrb, styles.nebulaPurple]} pointerEvents="none" />
      <View style={[styles.nebulaOrb, styles.nebulaCyan]} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Logo */}
          <Animated.View style={[styles.logoArea, moonStyle]}>
            <Text style={styles.crystalGateEmoji}>🌙</Text>
            <Text style={styles.appTitle}>The Crystal Gate</Text>
            <Text style={styles.appSubtitle}>StoryVoice</Text>
            <View style={styles.titleUnderline} />
            <Text style={styles.tagline}>
              {mode === 'signin' ? 'Welcome back, storyteller ✨' : 'Begin your magical journey 🌟'}
            </Text>
          </Animated.View>

          {/* ── Floating Glass Portal Card ── */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.portalCard, cardTiltStyle, cardNebulaStyle]}>
              {/* Glass blur (iOS/Android) */}
              {Platform.OS !== 'web' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}

              {/* Base gradient fill */}
              <LinearGradient
                colors={['rgba(14,8,36,0.82)', 'rgba(8,4,24,0.90)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              />

              {/* Purple tint overlay */}
              <LinearGradient
                colors={['rgba(107,72,184,0.18)', 'transparent', 'rgba(107,72,184,0.08)']}
                locations={[0, 0.5, 1]}
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              />

              {/* Reflective top shine */}
              <View style={styles.cardTopShine} />

              {/* Corner glints */}
              <View style={styles.cornerGlintTL} />
              <View style={styles.cornerGlintTR} />

              <View style={styles.cardContent}>
                {/* Mode tabs */}
                <View style={styles.modeTabs}>
                  <View style={styles.modeTabsTrack}>
                    <Animated.View style={[styles.modeIndicator, indicatorStyle]} />
                    <TouchableOpacity style={styles.modeTab} onPress={() => switchMode('signin')} activeOpacity={0.8}>
                      <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
                        ✦ Sign In
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modeTab} onPress={() => switchMode('signup')} activeOpacity={0.8}>
                      <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                        ✦ Sign Up
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Error banner */}
                {!!displayError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{displayError}</Text>
                  </View>
                )}

                {/* Form (with nebula zoom applied via parent card scale) */}
                <Animated.View style={formStyle}>
                  {/* Email field with stardust */}
                  <GlassInput
                    label="Email address"
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    showStardust
                  />

                  <GlassInput
                    ref={passwordRef}
                    label="Password"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    returnKeyType={mode === 'signup' ? 'next' : 'done'}
                    onSubmitEditing={mode === 'signup' ? () => confirmRef.current?.focus() : handleSubmit}
                    rightElement={
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    }
                  />

                  {mode === 'signup' && (
                    <GlassInput
                      ref={confirmRef}
                      label="Confirm password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  )}

                  {mode === 'signin' && (
                    <TouchableOpacity
                      style={styles.forgotBtn}
                      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(auth)/forgot-password'); }}
                    >
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  {/* Primary CTA */}
                  <TouchableOpacity style={[styles.primaryBtn, isLoading && styles.btnDisabled]} onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
                    <LinearGradient
                      colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isLoading
                          ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                          : (mode === 'signin' ? '✨ Sign In' : '🌟 Create Account')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Divider */}
                <View style={styles.divider}>
                  <LinearGradient colors={['transparent', 'rgba(61,63,122,0.8)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <LinearGradient colors={['transparent', 'rgba(61,63,122,0.8)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dividerLine} />
                </View>

                {/* Social */}
                <View style={styles.socialSection}>
                  {Platform.OS === 'ios' && <SocialButton provider="apple" onPress={signInWithApple} disabled={isLoading} />}
                  <SocialButton provider="google" onPress={signInWithGoogle} disabled={isLoading} />
                </View>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Footer switcher */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.footerLink}>{mode === 'signin' ? 'Sign Up' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_PAD = 22;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0E24' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },

  // Nebula orbs
  nebulaOrb: { position: 'absolute', borderRadius: 999 },
  nebulaGold: { width: 240, height: 240, top: -80, alignSelf: 'center', backgroundColor: 'rgba(255,215,0,0.05)' },
  nebulaPurple: { width: 280, height: 280, top: H * 0.3, right: -100, backgroundColor: 'rgba(107,72,184,0.07)' },
  nebulaCyan: { width: 200, height: 200, bottom: 80, left: -60, backgroundColor: 'rgba(126,200,227,0.04)' },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
  crystalGateEmoji: { fontSize: 48, marginBottom: 4 },
  appTitle: {
    fontFamily: Fonts.black, fontSize: 28, color: Colors.moonlightCream,
    letterSpacing: 1.2,
    textShadowColor: Colors.celestialGold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  appSubtitle: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  titleUnderline: { width: 56, height: 1.5, backgroundColor: Colors.celestialGold, borderRadius: 1, marginTop: 8, opacity: 0.6, marginBottom: 10 },
  tagline: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, letterSpacing: 0.3 },

  // ── Floating Glass Portal ──
  portalCard: {
    width: CARD_WIDTH,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    shadowColor: Colors.softPurple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 18,
  },

  cardTopShine: {
    position: 'absolute', top: 0, left: '15%', right: '15%',
    height: 1, backgroundColor: 'rgba(255,255,255,0.38)', borderRadius: 1,
  },
  cornerGlintTL: {
    position: 'absolute', top: 0, left: 0,
    width: 40, height: 40, borderTopLeftRadius: 28,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255,215,0,0.35)', borderLeftColor: 'rgba(255,215,0,0.25)',
  },
  cornerGlintTR: {
    position: 'absolute', top: 0, right: 0,
    width: 40, height: 40, borderTopRightRadius: 28,
    borderTopWidth: 1.5, borderRightWidth: 1.5,
    borderTopColor: 'rgba(255,215,0,0.25)', borderRightColor: 'rgba(255,215,0,0.15)',
  },

  cardContent: { padding: CARD_PAD },

  // Mode tabs
  modeTabs: { marginBottom: 20 },
  modeTabsTrack: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14, padding: 4, position: 'relative',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  modeIndicator: {
    position: 'absolute', top: 4, left: 4,
    width: '50%', bottom: 4,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  modeTab: { flex: 1, paddingVertical: 11, alignItems: 'center', zIndex: 1 },
  modeTabText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted, letterSpacing: 0.3 },
  modeTabTextActive: { color: Colors.celestialGold },

  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.10)', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,107,107,0.35)', gap: 8 },
  errorIcon: { fontSize: 14 },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, flex: 1 },

  eyeIcon: { fontSize: 18 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 20 },
  forgotText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.celestialGold, letterSpacing: 0.2 },

  primaryBtn: { borderRadius: 18, overflow: 'hidden', shadowColor: Colors.celestialGold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8, marginTop: 4 },
  btnDisabled: { opacity: 0.55 },
  buttonGradient: { paddingVertical: 17, alignItems: 'center' },
  primaryButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace, letterSpacing: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, letterSpacing: 0.5 },
  socialSection: { gap: 0 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingBottom: 8 },
  footerText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  footerLink: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold, textDecorationLine: 'underline' },

  // Email verification
  verifyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  verifyEmoji: { fontSize: 64, marginBottom: 16 },
  verifyTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 12, textAlign: 'center' },
  verifySubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  verifyButton: { width: '100%', borderRadius: 18, overflow: 'hidden', shadowColor: Colors.celestialGold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
});
