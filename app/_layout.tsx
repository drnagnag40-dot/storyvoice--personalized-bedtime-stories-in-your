import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated as RNAnimated, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@fastshot/auth';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getStoriesCompleted } from '@/lib/stardust';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

// ─── Custom Splash Overlay ────────────────────────────────────────────────────
function SplashOverlay({ onComplete }: { onComplete: () => void }) {
  const moonScale    = useRef(new RNAnimated.Value(0)).current;
  const moonOpacity  = useRef(new RNAnimated.Value(0)).current;
  const titleOpacity = useRef(new RNAnimated.Value(0)).current;
  const taglineOpacity = useRef(new RNAnimated.Value(0)).current;
  const starsOpacity = useRef(new RNAnimated.Value(0)).current;
  const overlayOpacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Sequence: moon appears → title → tagline → stars → hold → fade out
    // Animated values are stable refs; onComplete intentionally fires only once on mount
    RNAnimated.sequence([
      // Moon blooms in
      RNAnimated.parallel([
        RNAnimated.spring(moonScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
          stiffness: 100,
        }),
        RNAnimated.timing(moonOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        RNAnimated.timing(starsOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Title slides in
      RNAnimated.timing(titleOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100,
        useNativeDriver: true,
      }),
      // Tagline
      RNAnimated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Hold for 800ms
      RNAnimated.delay(800),
      // Fade out entire overlay
      RNAnimated.timing(overlayOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const STARS = ['✦', '⭐', '🌟', '✦', '⭐', '✦', '🌙', '✦', '⭐', '✦'];

  return (
    <RNAnimated.View
      style={[splashStyles.overlay, { opacity: overlayOpacity }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['#0D0E24', '#1A1B41', '#2D1B69']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated stars */}
      <RNAnimated.View style={[splashStyles.starsRow, { opacity: starsOpacity }]}>
        {STARS.map((star, i) => (
          <Text
            key={i}
            style={[splashStyles.starChar, { opacity: 0.3 + (i % 3) * 0.25, fontSize: 10 + (i % 4) * 4 }]}
          >
            {star}
          </Text>
        ))}
      </RNAnimated.View>

      {/* Moon */}
      <RNAnimated.Text
        style={[
          splashStyles.moon,
          {
            opacity: moonOpacity,
            transform: [{ scale: moonScale }],
          },
        ]}
      >
        🌙
      </RNAnimated.Text>

      {/* App name */}
      <RNAnimated.Text style={[splashStyles.appName, { opacity: titleOpacity }]}>
        StoryVoice
      </RNAnimated.Text>

      {/* Tagline */}
      <RNAnimated.Text style={[splashStyles.tagline, { opacity: taglineOpacity }]}>
        Bedtime magic, in your voice
      </RNAnimated.Text>
    </RNAnimated.View>
  );
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          9999,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             12,
  },
  starsRow: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    flexDirection:  'row',
    flexWrap:       'wrap',
    alignItems:     'center',
    justifyContent: 'space-around',
    padding:        20,
  },
  starChar: {
    color: '#FFD700',
  },
  moon: {
    fontSize:     80,
    marginBottom: 16,
  },
  appName: {
    fontFamily:    'Nunito_900Black',
    fontSize:      38,
    color:         '#F5F5DC',
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily:    'Nunito_600SemiBold',
    fontSize:      16,
    color:         'rgba(245,245,220,0.65)',
    letterSpacing: 0.3,
  },
});

const rateUsStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          1000,
    paddingHorizontal: 32,
  },
  card: {
    width:         '100%',
    borderRadius:  24,
    overflow:      'hidden',
    borderWidth:   1,
    borderColor:   'rgba(255,215,0,0.3)',
    padding:       28,
    alignItems:    'center',
    gap:           12,
    shadowColor:   '#FFD700',
    shadowOffset:  { width: 0, height: 8 },
    shadowRadius:  24,
    shadowOpacity: 0.25,
    elevation:     16,
  },
  emoji:    { fontSize: 48 },
  title:    { fontFamily: 'Nunito_900Black', fontSize: 22, color: '#F5F5DC', textAlign: 'center' },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: 'rgba(153,153,187,1)', textAlign: 'center', lineHeight: 21 },
  rateBtn:  {
    width:           '100%',
    borderRadius:    999,
    overflow:        'hidden',
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       8,
  },
  rateBtnText: { fontFamily: 'Nunito_900Black', fontSize: 16, color: '#0D0E24' },
  dismissBtn:  { paddingVertical: 10, paddingHorizontal: 20 },
  dismissText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: 'rgba(153,153,187,0.7)' },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const [showSplash, setShowSplash] = useState(true);
  const [showRateUs, setShowRateUs] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;
    // Check if we should show rate us prompt
    void checkRateUs();
  }, [fontsLoaded]);

  const checkRateUs = async () => {
    try {
      const alreadyShown = await AsyncStorage.getItem('rate_us_shown');
      if (alreadyShown === 'true') return;
      const count = await getStoriesCompleted();
      if (count >= 5) {
        // Show after a short delay
        setTimeout(() => setShowRateUs(true), 2000);
      }
    } catch {
      // non-fatal
    }
  };

  const handleRateUs = async () => {
    await AsyncStorage.setItem('rate_us_shown', 'true');
    setShowRateUs(false);
    // Open App Store / Play Store
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id000000000'  // placeholder
      : 'https://play.google.com/store/apps';
    void Linking.openURL(url);
  };

  const handleDismissRateUs = async () => {
    await AsyncStorage.setItem('rate_us_shown', 'true');
    setShowRateUs(false);
  };

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider
        supabaseClient={supabase}
        routes={{
          login: '/welcome',
          afterLogin: '/(main)/home',
          protected: ['(main)', '(onboarding)'],
          guest: ['(auth)'],
        }}
      >
        <StatusBar style="light" backgroundColor={Colors.midnightNavy} />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="walkthrough" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(main)" />
          <Stack.Screen name="auth" />
        </Stack>

        {/* Custom Splash */}
        {showSplash && <SplashOverlay onComplete={() => setShowSplash(false)} />}

        {/* Rate Us prompt */}
        {showRateUs && (
          <View style={rateUsStyles.overlay} pointerEvents="box-none">
            <View style={rateUsStyles.card}>
              <LinearGradient
                colors={['rgba(37,38,85,0.98)', 'rgba(13,14,36,0.99)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
              />
              <Text style={rateUsStyles.emoji}>⭐</Text>
              <Text style={rateUsStyles.title}>Enjoying StoryVoice?</Text>
              <Text style={rateUsStyles.subtitle}>
                Your rating helps other families discover bedtime magic! 🌙
              </Text>
              <TouchableOpacity
                style={rateUsStyles.rateBtn}
                onPress={() => void handleRateUs()}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFC857']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                />
                <Text style={rateUsStyles.rateBtnText}>⭐ Rate Us Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={rateUsStyles.dismissBtn}
                onPress={() => void handleDismissRateUs()}
              >
                <Text style={rateUsStyles.dismissText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
