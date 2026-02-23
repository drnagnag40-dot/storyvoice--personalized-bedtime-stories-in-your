import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarField from '@/components/StarField';
import { Colors, Fonts } from '@/constants/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signUpWithEmail, signInWithGoogle, signInWithApple, isLoading, error, pendingEmailVerification } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    const result = await signUpWithEmail(email.trim(), password);
    if (result?.emailConfirmationRequired) {
      Alert.alert('Check Your Email', `We've sent a verification link to ${result.email}. Please verify to continue.`);
    }
  };

  if (pendingEmailVerification) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.deepSpace, Colors.midnightNavy]} style={StyleSheet.absoluteFill} />
        <StarField count={40} />
        <View style={[styles.verifyContainer, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.verifyEmoji}>📬</Text>
          <Text style={styles.verifyTitle}>Check your email!</Text>
          <Text style={styles.verifySubtitle}>
            {"We've sent a magic link to confirm your account. Once verified, you can sign in."}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.backToSignIn}>
              <LinearGradient colors={[Colors.celestialGold, '#E8A800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                <Text style={styles.signUpButtonText}>Go to Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.deepSpace, Colors.midnightNavy]} style={StyleSheet.absoluteFill} />
      <StarField count={40} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <Text style={styles.moonEmoji}>⭐</Text>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start crafting magical stories for your little one</Text>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error.message}</Text>
            </View>
          )}

          <View style={styles.oauthSection}>
            <TouchableOpacity style={styles.oauthButton} onPress={signInWithGoogle} disabled={isLoading}>
              <Text style={styles.oauthIcon}>G</Text>
              <Text style={styles.oauthText}>Sign up with Google</Text>
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={[styles.oauthButton, styles.appleButton]} onPress={signInWithApple} disabled={isLoading}>
                <Text style={[styles.oauthIcon, { color: '#fff' }]}>🍎</Text>
                <Text style={[styles.oauthText, { color: '#fff' }]}>Sign up with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.dividerLine} />
          </View>

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
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.showPasswordBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.showPasswordText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Repeat your password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>

            <TouchableOpacity
              style={[styles.signUpButton, isLoading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <LinearGradient colors={[Colors.celestialGold, '#E8A800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                <Text style={styles.signUpButtonText}>{isLoading ? 'Creating account…' : 'Create Account'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity><Text style={styles.footerLink}>Sign in</Text></TouchableOpacity>
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
  verifyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  verifyEmoji: { fontSize: 64, marginBottom: 16 },
  verifyTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 12, textAlign: 'center' },
  verifySubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  backToSignIn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  header: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  moonEmoji: { fontSize: 40, marginBottom: 8 },
  title: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  errorBanner: { backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.errorRed },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, textAlign: 'center' },
  oauthSection: { gap: 12, marginBottom: 24 },
  oauthButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBg, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 20, gap: 12, borderWidth: 1, borderColor: Colors.borderColor },
  appleButton: { backgroundColor: '#1C1C1E' },
  oauthIcon: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.moonlightCream },
  oauthText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.moonlightCream },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderColor },
  dividerText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted },
  form: { gap: 4 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textLight, marginBottom: 8 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontFamily: Fonts.regular, fontSize: 15, color: Colors.moonlightCream, borderWidth: 1, borderColor: Colors.borderColor },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  showPasswordBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  showPasswordText: { fontSize: 18 },
  signUpButton: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  signUpButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  footerLink: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },
});
