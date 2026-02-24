import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettingRow {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  chevron?: boolean;
}

// ─── Setting Row Component ─────────────────────────────────────────────────────
function SettingItem({ item }: { item: SettingRow }) {
  const scale = useSharedValue(1);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!item.onPress) return;
    scale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 300 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onPress();
  };

  const content = (
    <Animated.View style={[styles.settingRow, rowStyle]}>
      <View style={styles.settingRowLeft}>
        <View style={[styles.settingIcon, item.destructive && styles.settingIconDestructive]}>
          <Text style={styles.settingIconText}>{item.icon}</Text>
        </View>
        <View>
          <Text style={[styles.settingLabel, item.destructive && styles.settingLabelDestructive]}>
            {item.label}
          </Text>
          {item.value != null && (
            <Text style={styles.settingValue}>{item.value}</Text>
          )}
        </View>
      </View>
      <View style={styles.settingRowRight}>
        {item.rightElement ?? (item.chevron !== false && item.onPress ? (
          <Text style={[styles.chevron, item.destructive && { color: Colors.errorRed }]}>›</Text>
        ) : null)}
      </View>
    </Animated.View>
  );

  if (item.onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, items, delay = 0 }: { title: string; items: SettingRow[]; delay?: number }) {
  const sectionOpacity = useSharedValue(0);
  const sectionTransY = useSharedValue(16);

  useEffect(() => {
    sectionOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    sectionTransY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
    transform: [{ translateY: sectionTransY.value }],
  }));

  return (
    <Animated.View style={[styles.section, sectionStyle]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            <SettingItem item={item} />
            {i < items.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const headerTransY = useSharedValue(-20);
  const profileOpacity = useSharedValue(0);
  const profileTransY = useSharedValue(16);
  const versionOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
    headerTransY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    profileOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));
    profileTransY.value = withDelay(100, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    versionOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTransY.value }],
  }));

  const profileCardStyle = useAnimatedStyle(() => ({
    opacity: profileOpacity.value,
    transform: [{ translateY: profileTransY.value }],
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  // User display data
  const userEmail = user?.email ?? 'Not signed in';
  const userInitial = userEmail.charAt(0).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Sign Out ──────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await AsyncStorage.multiRemove([
              'active_child_id',
              'active_voice_id',
              'selected_voice_type',
              'onboarding_complete',
              'pending_child_profile',
              'local_stories',
              'current_story',
            ]);
            await signOut();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      { cancelable: true }
    );
  }, [signOut]);

  // ── Delete Account ────────────────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete your account and all associated data including stories, voice recordings, and child profiles. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type "DELETE" in the next step to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    try {
                      if (isSupabaseAvailable && user?.id) {
                        // Delete all user data from tables (cascades to children, voices, stories)
                        await supabase.from('user_preferences').delete().eq('user_id', user.id);
                        await supabase.from('stories').delete().eq('user_id', user.id);
                        await supabase.from('parent_voices').delete().eq('user_id', user.id);
                        await supabase.from('children').delete().eq('user_id', user.id);
                        await supabase.from('users').delete().eq('id', user.id);
                      }
                      // Clear local storage
                      await AsyncStorage.multiRemove([
                        'active_child_id',
                        'active_voice_id',
                        'selected_voice_type',
                        'onboarding_complete',
                        'pending_child_profile',
                        'local_stories',
                        'current_story',
                        'walkthrough_seen',
                      ]);
                      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      await signOut();
                    } catch (err) {
                      console.error('Delete account error:', err);
                      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert(
                        'Error',
                        'Could not fully delete your account. Please contact support at help@storyvoice.app'
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ],
      { cancelable: true }
    );
  }, [user?.id, signOut]);

  // ── Section configs ───────────────────────────────────────────────────────────
  const appRows: SettingRow[] = [
    {
      icon: '🔔',
      label: 'Story Notifications',
      chevron: false,
      rightElement: (
        <Switch
          value={notificationsEnabled}
          onValueChange={(v) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNotificationsEnabled(v);
          }}
          trackColor={{ false: Colors.borderColor, true: `${Colors.celestialGold}60` }}
          thumbColor={notificationsEnabled ? Colors.celestialGold : Colors.textMuted}
        />
      ),
    },
    {
      icon: '👶',
      label: 'Child Profile',
      value: "Manage your child's settings",
      chevron: true,
      onPress: () => router.push('/(onboarding)/child-profile'),
    },
    {
      icon: '🎙️',
      label: 'Voice Studio',
      value: 'Record or update your voice',
      chevron: true,
      onPress: () => router.push('/(onboarding)/voice-studio'),
    },
  ];

  const accountRows: SettingRow[] = [
    {
      icon: '🚪',
      label: 'Sign Out',
      chevron: true,
      onPress: handleSignOut,
    },
    {
      icon: '🗑️',
      label: isDeletingAccount ? 'Deleting…' : 'Delete Account',
      destructive: true,
      chevron: true,
      onPress: isDeletingAccount ? undefined : handleDeleteAccount,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, Colors.deepPurple]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={30} />

      {/* Gold glow orb top-right */}
      <View style={styles.glowOrbTopRight} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={headerStyle}>
          <View style={styles.headerRow}>
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
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={{ width: 60 }} />
          </View>
        </Animated.View>

        {/* User Profile Card */}
        <Animated.View style={profileCardStyle}>
          <View style={styles.profileCard}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            {/* Gold corner decorations */}
            <View style={styles.profileCardCornerTL} />
            <View style={styles.profileCardCornerBR} />

            <View style={styles.profileInner}>
              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitial}>{userInitial}</Text>
                </LinearGradient>
                {/* Online indicator */}
                <View style={styles.onlineIndicator} />
              </View>

              {/* Info */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileEmailLabel}>SIGNED IN AS</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {userEmail}
                </Text>
                {memberSince && (
                  <View style={styles.memberBadge}>
                    <Text style={styles.memberBadgeText}>⭐ Member since {memberSince}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Decorative star row */}
            <View style={styles.profileStarRow}>
              {['⭐', '🌙', '✨', '🌟', '⭐'].map((star, i) => (
                <Text key={i} style={[styles.profileStar, { opacity: 0.4 - i * 0.04 }]}>
                  {star}
                </Text>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* App Settings Section */}
        <Section title="App Settings" items={appRows} delay={200} />

        {/* Account Section */}
        <Section title="Account" items={accountRows} delay={350} />

        {/* App version */}
        <Animated.View style={[versionStyle, styles.versionRow]}>
          <Text style={styles.versionText}>StoryVoice · Phase 1 · v1.0</Text>
          <Text style={styles.versionSubText}>Made with 🌙 for sleepy little ones</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  scroll: { paddingHorizontal: Spacing.lg },

  glowOrbTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.celestialGold,
    opacity: 0.04,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: { paddingVertical: 8, minWidth: 60 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 20,
    color: Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  // Profile Card
  profileCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.75)' : 'rgba(26,27,65,0.95)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  profileCardCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  profileCardCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 60,
    height: 60,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarInitial: {
    fontFamily: Fonts.black,
    fontSize: 28,
    color: Colors.deepSpace,
    lineHeight: 34,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.successGreen,
    borderWidth: 2,
    borderColor: Colors.deepSpace,
  },
  profileInfo: { flex: 1 },
  profileEmailLabel: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.moonlightCream,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  memberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  memberBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.celestialGold,
    letterSpacing: 0.2,
  },
  profileStarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  profileStar: { fontSize: 16 },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 58,
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingRowRight: { marginLeft: Spacing.sm },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,215,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  settingIconDestructive: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderColor: 'rgba(255,107,107,0.2)',
  },
  settingIconText: { fontSize: 18 },
  settingLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.moonlightCream,
    letterSpacing: 0.1,
  },
  settingLabelDestructive: { color: Colors.errorRed },
  settingValue: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textMuted,
    lineHeight: 24,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(61,63,122,0.5)',
    marginHorizontal: Spacing.md,
  },

  // Version
  versionRow: { alignItems: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.sm },
  versionText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted },
  versionSubText: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(153,153,187,0.5)', marginTop: 4 },
});
