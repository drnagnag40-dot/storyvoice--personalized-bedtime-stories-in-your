/**
 * The Parent's Observatory
 *
 * A dedicated frosted-glass profile screen for parents to manage their account.
 * Includes a "Child's Cosmic Identity" section where parents can set the child's
 * name and age — persisted in the Supabase `profiles` table and used to
 * personalise AI narrator greetings.
 */

import React, { useState, useEffect } from 'react';
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
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import { upsertProfile, getProfile } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';


// ─── Observatory input ────────────────────────────────────────────────────────
function ObservatoryInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  editable = true,
}: {
  label: string;
  icon: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const glow = useSharedValue(0);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    shadowRadius: 10 * glow.value,
  }));

  return (
    <View style={obsInputStyles.group}>
      <View style={obsInputStyles.labelRow}>
        <Text style={obsInputStyles.icon}>{icon}</Text>
        <Text style={obsInputStyles.label}>{label}</Text>
      </View>
      <View style={obsInputStyles.wrapper}>
        <Animated.View style={[obsInputStyles.glow, glowStyle]} pointerEvents="none" />
        <View style={[obsInputStyles.container, focused && obsInputStyles.focused, !editable && obsInputStyles.disabled]}>
          <TextInput
            style={obsInputStyles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(153,153,187,0.5)"
            keyboardType={keyboardType ?? 'default'}
            maxLength={maxLength}
            editable={editable}
            onFocus={() => {
              setFocused(true);
              glow.value = withTiming(1, { duration: 250 });
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onBlur={() => {
              setFocused(false);
              glow.value = withTiming(0, { duration: 300 });
            }}
            selectionColor={Colors.celestialGold}
          />
        </View>
      </View>
    </View>
  );
}

const obsInputStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  icon: { fontSize: 14 },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wrapper: { position: 'relative' },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  container: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  focused: {
    borderColor: 'rgba(255,215,0,0.6)',
    backgroundColor: 'rgba(255,215,0,0.025)',
  },
  disabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(61,63,122,0.4)',
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    paddingVertical: 14,
    paddingHorizontal: 16,
    letterSpacing: 0.2,
  },
});

// ─── Glass section card ───────────────────────────────────────────────────────
function GlassSection({
  title,
  icon,
  children,
  accentColor = Colors.softPurple,
  delay = 0,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[sectionStyles.card, style]}>
      {Platform.OS !== 'web' && (
        <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={[`${accentColor}18`, `${accentColor}06`]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      <View style={sectionStyles.topShine} />

      <View style={sectionStyles.titleRow}>
        <Text style={sectionStyles.icon}>{icon}</Text>
        <Text style={[sectionStyles.title, { color: accentColor }]}>{title}</Text>
      </View>
      <View style={sectionStyles.divider} />
      <View style={sectionStyles.content}>{children}</View>
    </Animated.View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.md,
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: Platform.OS === 'web' ? 'rgba(20,10,50,0.9)' : undefined,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 10,
  },
  icon: { fontSize: 18 },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.md,
  },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
});

// ─── Age picker row ───────────────────────────────────────────────────────────
const AGES = Array.from({ length: 14 }, (_, i) => i + 2); // 2..15

function AgePicker({ value, onChange }: { value: number | null; onChange: (age: number) => void }) {
  return (
    <View>
      <View style={ageStyles.labelRow}>
        <Text style={ageStyles.icon}>🎂</Text>
        <Text style={ageStyles.label}>{"Child's Age"}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ageStyles.scroll}>
        {AGES.map((age) => {
          const selected = value === age;
          return (
            <TouchableOpacity
              key={age}
              onPress={() => {
                onChange(age);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[ageStyles.chip, selected && ageStyles.chipSelected]}
              activeOpacity={0.8}
            >
              {selected && (
                <LinearGradient
                  colors={['rgba(255,215,0,0.25)', 'rgba(255,215,0,0.08)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                />
              )}
              <Text style={[ageStyles.chipText, selected && ageStyles.chipTextSelected]}>
                {age}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ageStyles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  icon: { fontSize: 14 },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scroll: { paddingVertical: 2, gap: 8 },
  chip: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  chipSelected: {
    borderColor: 'rgba(255,215,0,0.6)',
  },
  chipText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textMuted,
  },
  chipTextSelected: {
    color: Colors.celestialGold,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ObservatoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Entrance animation
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-20);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
    headerY.value = withSpring(0, { damping: 16, stiffness: 180 });

    // Load existing profile
    if (user?.id) {
      void loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setChildName(profile.child_name ?? '');
        setChildAge(profile.child_age ?? null);
      }
    } catch {
      // Non-fatal
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in to save your profile.');
      return;
    }
    if (!childName.trim()) {
      Alert.alert('Missing name', "Please enter your child's name.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await upsertProfile(user.id, {
        email: user.email ?? undefined,
        child_name: childName.trim(),
        child_age: childAge,
      });

      setSaveSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      Alert.alert('Save failed', 'Unable to save your profile. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Cloud Magic?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          },
        },
      ]
    );
  };

  // Save button animation
  const saveBtnScale = useSharedValue(1);
  const handleSavePress = () => {
    saveBtnScale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 300 })
    );
    void handleSave();
  };

  const saveBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveBtnScale.value }],
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  // Starfield pulse
  const telescopePulse = useSharedValue(1);
  useEffect(() => {
    telescopePulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const telescopeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: telescopePulse.value }],
  }));

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#0E0820', '#180D38', '#2A1155']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      <StarField count={55} />

      {/* Ambient orbs */}
      <View style={styles.orbGold} pointerEvents="none" />
      <View style={styles.orbPurple} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
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

          {/* Header */}
          <Animated.View style={[styles.header, headerStyle]}>
            <Animated.Text style={[styles.telescopeEmoji, telescopeStyle]}>🔭</Animated.Text>
            <Text style={styles.headerTitle}>{"The Parent's Observatory"}</Text>
            <Text style={styles.headerSubtitle}>Manage your Cloud Magic identity</Text>
            <View style={styles.headerUnderline} />
          </Animated.View>

          {/* ── Account section ── */}
          <GlassSection
            title="Star Account"
            icon="⭐"
            accentColor={Colors.softBlue}
            delay={200}
          >
            <ObservatoryInput
              label="Email"
              icon="📧"
              value={user?.email ?? ''}
              editable={false}
              placeholder="your@email.com"
            />

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255,107,107,0.15)', 'rgba(255,107,107,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
              />
              <View style={styles.signOutBtnShine} />
              <Text style={styles.signOutText}>🚪 Sign Out of Cloud Magic</Text>
            </TouchableOpacity>
          </GlassSection>

          {/* ── Child's Cosmic Identity section ── */}
          <GlassSection
            title="Child's Cosmic Identity"
            icon="🌟"
            accentColor={Colors.celestialGold}
            delay={350}
          >
            {/* Cosmic identity description */}
            <View style={styles.cosmicDesc}>
              <LinearGradient
                colors={['rgba(255,215,0,0.10)', 'rgba(255,215,0,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
              />
              <Text style={styles.cosmicDescText}>
                {"✨ Your child's name and age are woven into the magic — AI narrators will greet them by name and craft stories perfectly suited to their age."}
              </Text>
            </View>

            <ObservatoryInput
              label="Child's Name"
              icon="👦"
              value={childName}
              onChangeText={setChildName}
              placeholder="e.g. Luna, Orion, Sage…"
              maxLength={40}
            />

            <AgePicker value={childAge} onChange={setChildAge} />
          </GlassSection>

          {/* ── Personalisation preview ── */}
          {(childName.trim() || childAge) && (
            <GlassSection
              title="Narrator Preview"
              icon="🎙️"
              accentColor={Colors.accentPink}
              delay={450}
            >
              <View style={styles.previewBubble}>
                <LinearGradient
                  colors={['rgba(255,107,157,0.12)', 'rgba(107,72,184,0.08)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                />
                <Text style={styles.previewText}>
                  {`"Good evening${childName.trim() ? `, ${childName.trim()}` : ''}! ${
                    childAge
                      ? `I have a magical story just right for a ${childAge}-year-old explorer like you.`
                      : "I have a magical story waiting just for you."
                  } Are you ready to begin?"`}
                </Text>
              </View>
            </GlassSection>
          )}

          {/* ── Save button ── */}
          <Animated.View style={[styles.saveBtnWrapper, saveBtnStyle]}>
            <TouchableOpacity
              onPress={handleSavePress}
              activeOpacity={0.88}
              disabled={saving}
            >
              <LinearGradient
                colors={
                  saveSuccess
                    ? (['#6BCB77', '#4CAF50'] as const)
                    : ([Colors.celestialGold, Colors.softGold, '#E8A800'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                <Text style={styles.saveText}>
                  {saving ? '⏳ Saving to Stars…' : saveSuccess ? '✓ Saved to the Cosmos!' : '✨ Save Cosmic Identity'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Cloud Magic tips ── */}
          <GlassSection
            title="Cloud Magic Tips"
            icon="💡"
            accentColor={Colors.softPurple}
            delay={550}
          >
            {[
              { icon: '☁️', tip: "Your child's identity syncs across all devices instantly." },
              { icon: '🤖', tip: 'AI narrators use the name and age to personalise every story.' },
              { icon: '🔐', tip: 'All profile data is encrypted and protected in the cloud vault.' },
              { icon: '🌟', tip: 'You can update the name and age anytime from this observatory.' },
            ].map((item, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipIcon}>{item.icon}</Text>
                <Text style={styles.tipText}>{item.tip}</Text>
              </View>
            ))}
          </GlassSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0820' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  orbGold: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -80,
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  orbPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: 60,
    left: -100,
    backgroundColor: 'rgba(107,72,184,0.07)',
  },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },

  // Header
  header: { alignItems: 'center', marginBottom: 24, gap: 6 },
  telescopeEmoji: {
    fontSize: 60,
    textShadowColor: 'rgba(107,72,184,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headerTitle: {
    fontFamily: Fonts.black,
    fontSize: 26,
    color: Colors.moonlightCream,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: Colors.celestialGold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  headerUnderline: {
    width: 60,
    height: 2,
    backgroundColor: Colors.celestialGold,
    borderRadius: 1,
    opacity: 0.6,
    marginTop: 4,
  },

  // Sign out
  signOutBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  signOutBtnShine: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
  },
  signOutText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.errorRed,
    letterSpacing: 0.3,
  },

  // Cosmic description
  cosmicDesc: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
    marginBottom: 16,
  },
  cosmicDescText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  // Narrator preview
  previewBubble: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
  },
  previewText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.moonlightCream,
    lineHeight: 22,
    fontStyle: 'italic',
    opacity: 0.9,
  },

  // Save button
  saveBtnWrapper: {
    marginBottom: 16,
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  saveGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  saveText: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.deepSpace,
    letterSpacing: 0.4,
  },

  // Tips
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tipIcon: { fontSize: 16, marginTop: 1 },
  tipText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
});
