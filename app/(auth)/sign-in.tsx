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
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import { Colors, Fonts } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

type Mode = 'signin' | 'signup';

// ─── Glassmorphism Input ─────────────────────────────────────────────────────
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
}>(function GlassInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  rightElement,
}, ref) {
  const [focused, setFocused] = useState(false);
  const glowOpacity = useSharedValue(0);

  const handleFocus = () => {
    setFocused(true);
    glowOpacity.value = withTiming(1, { duration: 250 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setFocused(false);
    glowOpacity.value = withTiming(0, { duration: 200 });
  };

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={inputStyles.group}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={inputStyles.wrapper}>
        {/* Glow ring */}
        <Animated.View
          style={[inputStyles.glowRing, glowStyle]}
          pointerEvents="none"
        />
        <View
          style={[
            inputStyles.container,
            focused && inputStyles.containerFocused,
          ]}
        >
          <TextInput
            ref={ref}
            style={[inputStyles.input, rightElement ? { paddingRight: 48 } : null]}
            placeholder={placeholder}
            placeholderTextColor="rgba(153,153,187,0.6)"
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
          {rightElement && (
            <View style={inputStyles.rightSlot}>{rightElement}</View>
          )}
        </View>
      </View>
    </View>
  );
});

const inputStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  wrapper: { position: 'relative' },
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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    overflow: 'hidden',
  },
  containerFocused: {
    borderColor: 'rgba(255,215,0,0.7)',
    backgroundColor: 'rgba(255,215,0,0.04)',
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    letterSpacing: 0.2,
  },
  rightSlot: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingRight: 14,
  },
});

// ─── Social Button ───────────────────────────────────────────────────────────
function SocialButton({
  provider,
  onPress,
  disabled,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 300 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (provider === 'google') {
    return (
      <Animated.View style={[btnStyle, socialStyles.wrapper]}>
        <TouchableOpacity
          style={socialStyles.googleBtn}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.9}
        >
          {/* Google G logo */}
          <View style={socialStyles.googleIconWrapper}>
            <Text style={socialStyles.googleG}>G</Text>
          </View>
          <Text style={socialStyles.googleText}>Continue with Google</Text>
          <View style={{ width: 32 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[btnStyle, socialStyles.wrapper]}>
      <TouchableOpacity
        style={socialStyles.appleBtn}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.9}
      >
        <View style={socialStyles.appleIconWrapper}>
          <Text style={socialStyles.appleIcon}></Text>
        </View>
        <Text style={socialStyles.appleText}>Continue with Apple</Text>
        <View style={{ width: 32 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const socialStyles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  googleIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: '#fff',
    lineHeight: 20,
  },
  googleText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#1A1B41',
    flex: 1,
    textAlign: 'center',
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  appleIconWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: { fontSize: 22, color: '#fff' },
  appleText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
});

// ─── Error message helpers ────────────────────────────────────────────────────
function getFriendlyErrorMessage(err: unknown): string {
  // Handle plain AuthError objects from @fastshot/auth  { type, message }
  if (err !== null && typeof err === 'object' && !Array.isArray(err)) {
    const obj = err as Record<string, unknown>;
    // NETWORK_ERROR type is a reliable signal
    if (obj['type'] === 'NETWORK_ERROR') {
      return 'Unable to connect. Please check your internet connection and try again.';
    }
    // Extract message string from the object
    if (typeof obj['message'] === 'string') {
      return getFriendlyErrorMessage(obj['message']);
    }
    // Try originalError as fallback
    if (obj['originalError']) {
      return getFriendlyErrorMessage(obj['originalError']);
    }
    return 'Something went wrong. Please try again.';
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');

  if (!raw) return 'Something went wrong. Please try again.';

  const lower = raw.toLowerCase();

  // Network / connectivity errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('no internet') ||
    (lower.includes('network') && lower.includes('error'))
  ) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // Already-registered
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already exists')
  ) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  // Wrong credentials
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  // Unverified email
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Please verify your email address before signing in.';
  }

  // Rate limiting
  if (lower.includes('rate limit') || lower.includes('too many request')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Suppress internal placeholder / supabase endpoint leakage
  if (lower.includes('placeholder.supabase') || lower.includes('placeholder-anon-key')) {
    return 'Authentication service is not configured. Please contact support.';
  }

  // Fall back to the original message if it looks user-readable
  if (raw.length <= 200) return raw;

  return 'Something went wrong. Please try again.';
}

// ─── Main Auth Screen ─────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const insets = useSafeAreaInsets();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    isLoading,
    error,
    pendingEmailVerification,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // Refs for focus management
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Mode switcher animation
  const indicatorX = useSharedValue(0);
  const formOpacity = useSharedValue(1);
  const formTranslateX = useSharedValue(0);

  // Logo float animation
  const moonFloat = useSharedValue(0);
  React.useEffect(() => {
    moonFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
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

  // ── Switch mode with animation ──────────────────────────────────────────────
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLocalError('');

      const HALF_TAB = (W - 56) / 2;
      const newX = next === 'signup' ? HALF_TAB : 0;
      const slideDir = next === 'signup' ? -20 : 20;

      indicatorX.value = withTiming(newX, { duration: 280, easing: Easing.out(Easing.cubic) });

      // Fade + slide out
      formOpacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setMode)(next);
        formTranslateX.value = -slideDir;
        // Fade + slide in
        formOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
        formTranslateX.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
      });
    },
    [mode, indicatorX, formOpacity, formTranslateX]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
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
      setLocalError(getFriendlyErrorMessage(err));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSignUp = async () => {
    setLocalError('');
    if (!email.trim() || !password) {
      setLocalError('Please enter your email and password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await signUpWithEmail(email.trim(), password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setLocalError(getFriendlyErrorMessage(err));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSubmit = () => (mode === 'signin' ? void handleSignIn() : void handleSignUp());

  const rawAuthError = error ? error.message : '';
  const displayError =
    localError ||
    (rawAuthError ? getFriendlyErrorMessage(rawAuthError) : '') ||
    (params.error ? decodeURIComponent(params.error) : '');

  // ── Email verification pending ────────────────────────────────────────────────
  if (pendingEmailVerification) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <StarField count={35} />
        <View style={[styles.verifyContainer, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.verifyEmoji}>📬</Text>
          <Text style={styles.verifyTitle}>Check your email!</Text>
          <Text style={styles.verifySubtitle}>
            {"We've sent a magic link to verify your account. Once confirmed, you can sign in."}
          </Text>
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => switchMode('signin')}
          >
            <LinearGradient
              colors={[Colors.celestialGold, '#E8A800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.primaryButtonText}>Go to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Deep space gradient */}
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Star field */}
      <StarField count={45} />

      {/* Moon glow orb */}
      <View style={styles.moonGlowOrb} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Logo */}
          <Animated.View style={[styles.logoArea, moonStyle]}>
            <Text style={styles.moonEmoji}>🌙</Text>
            <Text style={styles.appTitle}>StoryVoice</Text>
            <View style={styles.titleUnderline} />
            <Text style={styles.tagline}>
              {mode === 'signin'
                ? 'Welcome back, storyteller'
                : 'Begin your story journey'}
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

            {/* Mode tabs */}
            <View style={styles.modeTabs}>
              <View style={styles.modeTabsTrack}>
                {/* Animated indicator */}
                <Animated.View style={[styles.modeIndicator, indicatorStyle]} />
                <TouchableOpacity
                  style={styles.modeTab}
                  onPress={() => switchMode('signin')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modeTab}
                  onPress={() => switchMode('signup')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                    Sign Up
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

            {/* Animated form */}
            <Animated.View style={formStyle}>
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
                onSubmitEditing={
                  mode === 'signup'
                    ? () => confirmRef.current?.focus()
                    : handleSubmit
                }
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
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
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(auth)/forgot-password');
                  }}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Primary CTA */}
              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {isLoading ? (
                    <Text style={styles.primaryButtonText}>
                      {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                    </Text>
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {mode === 'signin' ? '✨ Sign In' : '🌟 Create Account'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider}>
              <LinearGradient
                colors={['transparent', 'rgba(61,63,122,0.8)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
              <Text style={styles.dividerText}>or</Text>
              <LinearGradient
                colors={['transparent', 'rgba(61,63,122,0.8)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
            </View>

            {/* Social buttons */}
            <View style={styles.socialSection}>
              {Platform.OS === 'ios' && (
                <SocialButton
                  provider="apple"
                  onPress={signInWithApple}
                  disabled={isLoading}
                />
              )}
              <SocialButton
                provider="google"
                onPress={signInWithGoogle}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* Mode switch footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity
              onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.footerLink}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const CARD_PADDING = 20;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },

  // Moon glow orb
  moonGlowOrb: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.celestialGold,
    opacity: 0.04,
  },

  // Back button
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },

  // Logo area
  logoArea: { alignItems: 'center', marginBottom: 24, marginTop: 4 },
  moonEmoji: { fontSize: 44, marginBottom: 6 },
  appTitle: {
    fontFamily: Fonts.black,
    fontSize: 30,
    color: Colors.moonlightCream,
    letterSpacing: 1.5,
    textShadowColor: Colors.celestialGold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  titleUnderline: {
    width: 60,
    height: 2,
    backgroundColor: Colors.celestialGold,
    borderRadius: 1,
    marginTop: 6,
    opacity: 0.7,
    marginBottom: 10,
  },
  tagline: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },

  // Glass card
  glassCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    padding: CARD_PADDING,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  // Mode tabs
  modeTabs: { marginBottom: 20 },
  modeTabsTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  modeIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    bottom: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  modeTabText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  modeTabTextActive: {
    color: Colors.celestialGold,
  },

  // Error banner
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

  // Input helpers
  eyeIcon: { fontSize: 18 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 20 },
  forgotText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.celestialGold,
    letterSpacing: 0.2,
  },

  // Primary button
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.deepSpace,
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // Social section
  socialSection: { gap: 0 },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 8,
  },
  footerText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  footerLink: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.celestialGold,
    textDecorationLine: 'underline',
  },

  // Email verification
  verifyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  verifyEmoji: { fontSize: 64, marginBottom: 16 },
  verifyTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: Colors.moonlightCream,
    marginBottom: 12,
    textAlign: 'center',
  },
  verifySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  verifyButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});
