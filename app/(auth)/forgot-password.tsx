import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarField from '@/components/StarField';
import { Colors, Fonts } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const { resetPassword, isLoading, error, pendingPasswordReset } = useAuth();
  const insets = useSafeAreaInsets();

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    await resetPassword(email.trim());
  };

  if (pendingPasswordReset) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.deepSpace, Colors.midnightNavy]} style={StyleSheet.absoluteFill} />
        <StarField count={40} />
        <View style={[styles.successContainer, { paddingTop: insets.top + 60 }]}>
          <Text style={styles.successEmoji}>✉️</Text>
          <Text style={styles.successTitle}>Check your inbox!</Text>
          <Text style={styles.successSubtitle}>
            {"We've sent a password reset link to your email. Follow the instructions to set a new password."}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.backButton}>
              <LinearGradient colors={[Colors.celestialGold, '#E8A800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Back to Sign In</Text>
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
        <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🔑</Text>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>{"Enter your email and we'll send you a reset link"}</Text>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error.message}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <TouchableOpacity
            style={[styles.resetButton, isLoading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={isLoading}
          >
            <LinearGradient colors={[Colors.celestialGold, '#E8A800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
              <Text style={styles.buttonText}>{isLoading ? 'Sending…' : 'Send Reset Link'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28 },
  successContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 8 },
  backLinkText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 36 },
  headerEmoji: { fontSize: 48, marginBottom: 12 },
  title: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  errorBanner: { backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.errorRed },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, textAlign: 'center' },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textLight, marginBottom: 8 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontFamily: Fonts.regular, fontSize: 15, color: Colors.moonlightCream, borderWidth: 1, borderColor: Colors.borderColor },
  resetButton: { borderRadius: 16, overflow: 'hidden' },
  backButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
});
