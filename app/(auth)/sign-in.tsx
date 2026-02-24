import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarField from '@/components/StarField';
import { Colors, Fonts } from '@/constants/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signInWithEmail, signInWithGoogle, signInWithApple, isLoading, error } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ error?: string }>();

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    await signInWithEmail(email.trim(), password);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={40} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Link href="/welcome" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </Link>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.moonEmoji}>🌙</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your story journey</Text>
          </View>

          {/* Error message */}
          {(error || params.error) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {params.error ? decodeURIComponent(params.error) : error?.message}
              </Text>
            </View>
          )}

          {/* OAuth buttons */}
          <View style={styles.oauthSection}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={signInWithGoogle}
              disabled={isLoading}
            >
              <Text style={styles.oauthIcon}>G</Text>
              <Text style={styles.oauthText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.oauthButton, styles.appleButton]}
                onPress={signInWithApple}
                disabled={isLoading}
              >
                <Text style={[styles.oauthIcon, { color: '#fff' }]}>🍎</Text>
                <Text style={[styles.oauthText, { color: '#fff' }]}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleEmailSignIn}
                />
                <TouchableOpacity
                  style={styles.showPasswordBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showPasswordText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotLink}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.signInButton, isLoading && styles.buttonDisabled]}
              onPress={handleEmailSignIn}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[Colors.celestialGold, '#E8A800']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.signInButtonText}>
                  {isLoading ? 'Signing in…' : 'Sign In'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Create one</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  flex: { flex: 1 },
  content: { paddingHorizontal: 28, flexGrow: 1 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  header: { alignItems: 'center', marginTop: 16, marginBottom: 32 },
  moonEmoji: { fontSize: 40, marginBottom: 8 },
  title: { fontFamily: Fonts.extraBold, fontSize: 28, color: Colors.moonlightCream, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  errorBanner: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.errorRed,
  },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, textAlign: 'center' },
  oauthSection: { gap: 12, marginBottom: 24 },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  appleButton: { backgroundColor: '#1C1C1E' },
  oauthIcon: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.moonlightCream },
  oauthText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.moonlightCream },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderColor },
  dividerText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted },
  form: { gap: 4 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textLight, marginBottom: 8 },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  showPasswordBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  showPasswordText: { fontSize: 18 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.celestialGold },
  signInButton: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  signInButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  footerLink: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },
});
