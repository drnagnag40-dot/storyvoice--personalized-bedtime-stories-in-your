import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import StarField from '@/components/StarField';
import BedroomIllustration from '@/components/BedroomIllustration';
import { Colors, Fonts } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  // Entrance animations
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);
  const illustrationOpacity = useSharedValue(0);
  const illustrationScale = useSharedValue(0.85);
  const taglineOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const ctaScale = useSharedValue(0.9);

  // Floating animation for illustration
  const floatY = useSharedValue(0);

  useEffect(() => {
    // Staggered entrance
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    logoTranslateY.value = withDelay(300, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));

    illustrationOpacity.value = withDelay(600, withTiming(1, { duration: 900 }));
    illustrationScale.value = withDelay(600, withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.2)) }));

    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 700 }));

    ctaOpacity.value = withDelay(1300, withTiming(1, { duration: 700 }));
    ctaScale.value = withDelay(1300, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) }));

    // Gentle float loop
    floatY.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    // All referenced values are stable Reanimated shared value refs – safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const illustrationStyle = useAnimatedStyle(() => ({
    opacity: illustrationOpacity.value,
    transform: [
      { scale: illustrationScale.value },
      { translateY: floatY.value },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ scale: ctaScale.value }],
  }));

  const handleCTA = () => {
    if (isAuthenticated) {
      router.replace('/(onboarding)/child-profile');
    } else {
      router.push('/(auth)/sign-in');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Twinkling star field */}
      <StarField count={90} />

      {/* Moon glow overlay */}
      <View style={styles.moonGlow} />

      {/* Logo + wordmark */}
      <Animated.View style={[styles.logoSection, logoStyle, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.logoEmoji}>🌙</Text>
        <Text style={styles.appName}>StoryVoice</Text>
        <View style={styles.logoUnderline} />
      </Animated.View>

      {/* Bedroom illustration */}
      <Animated.View style={[styles.illustrationContainer, illustrationStyle]}>
        <BedroomIllustration width={W * 0.88} height={H * 0.28} />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, taglineStyle]}>
        <Text style={styles.tagline}>Bedtime stories told in</Text>
        <Text style={styles.taglineHighlight}>your voice. ✨</Text>
        <Text style={styles.subTagline}>
          Personalised, AI-crafted tales read aloud{'\n'}by the voice they love most — yours.
        </Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[styles.ctaContainer, ctaStyle, { paddingBottom: insets.bottom + 32 }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleCTA}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{"Create Your Child's Stories"}</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.signInLink}
        >
          <Text style={styles.signInText}>Already have an account?{' '}
            <Text style={styles.signInTextBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepSpace,
    alignItems: 'center',
  },
  moonGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.celestialGold,
    opacity: 0.05,
  },
  logoSection: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  appName: {
    fontFamily: Fonts.black,
    fontSize: 38,
    color: Colors.moonlightCream,
    letterSpacing: 1.5,
    textShadowColor: Colors.celestialGold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoUnderline: {
    width: 80,
    height: 2,
    backgroundColor: Colors.celestialGold,
    borderRadius: 1,
    marginTop: 8,
    opacity: 0.7,
  },
  illustrationContainer: {
    marginTop: 20,
    zIndex: 5,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  taglineContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 20,
    zIndex: 10,
  },
  tagline: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.moonlightCream,
    textAlign: 'center',
  },
  taglineHighlight: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: Colors.celestialGold,
    textAlign: 'center',
    marginBottom: 12,
  },
  subTagline: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaContainer: {
    width: '100%',
    paddingHorizontal: 28,
    marginTop: 'auto',
    zIndex: 10,
  },
  ctaButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 10,
  },
  ctaText: {
    fontFamily: Fonts.extraBold,
    fontSize: 17,
    color: Colors.deepSpace,
    letterSpacing: 0.3,
  },
  ctaArrow: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.deepSpace,
  },
  signInLink: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
  signInText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  signInTextBold: {
    fontFamily: Fonts.bold,
    color: Colors.celestialGold,
  },
});
