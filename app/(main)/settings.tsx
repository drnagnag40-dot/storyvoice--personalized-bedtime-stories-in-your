import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import * as Linking from 'expo-linking';
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
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { isSupabaseAvailable, deleteAllUserData, upsertUserPreferences } from '@/lib/supabase';
import {
  getSyncState,
  syncFromCloud,
  clearSyncCache,
  type SyncState,
} from '@/lib/syncService';
import {
  isMigrationComplete,
  getMigrationTimestamp,
} from '@/lib/migrationService';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/newell';
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
} from '@/lib/analytics';
import { getCacheMeta, type CacheMeta } from '@/lib/offlineCache';

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

// ─── Sync Status Card ─────────────────────────────────────────────────────────
function SyncStatusCard({
  syncState,
  isSyncing,
  onSyncNow,
  delay,
  migrationComplete,
}: {
  syncState: SyncState;
  isSyncing: boolean;
  onSyncNow: () => void;
  delay: number;
  migrationComplete: boolean;
}) {
  const cardOpacity = useSharedValue(0);
  const cardTransY  = useSharedValue(16);
  const spinValue   = useSharedValue(0);

  useEffect(() => {
    cardOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    cardTransY.value  = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isSyncing) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(spinValue);
      spinValue.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ translateY: cardTransY.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }],
  }));

  const statusColor = isSyncing
    ? Colors.celestialGold
    : syncState.status === 'success'
      ? Colors.successGreen
      : syncState.status === 'error'
        ? Colors.errorRed
        : Colors.textMuted;

  const statusIcon = isSyncing
    ? '🔄'
    : syncState.status === 'success'
      ? '✅'
      : syncState.status === 'error'
        ? '⚠️'
        : '☁️';

  const statusText = isSyncing
    ? 'Syncing to cloud…'
    : migrationComplete && syncState.status === 'success'
      ? '✦ All legacy data protected in the cloud'
      : syncState.status === 'success'
        ? 'Cloud backup up to date'
        : syncState.status === 'error'
          ? 'Last sync had issues'
          : 'Not yet synced';

  return (
    <Animated.View style={[styles.syncCard, cardStyle]}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
      )}

      {/* Corner decorations */}
      <View style={styles.syncCardCornerTL} />
      <View style={styles.syncCardCornerBR} />

      <View style={styles.syncHeader}>
        <Text style={styles.syncCardSectionTitle}>☁️  Cloud Backup</Text>
        {isSupabaseAvailable && (
          <TouchableOpacity
            style={[styles.syncNowBtn, isSyncing && styles.syncNowBtnDisabled]}
            onPress={onSyncNow}
            disabled={isSyncing}
            activeOpacity={0.75}
          >
            <Animated.Text style={[styles.syncNowIcon, isSyncing && spinStyle]}>↻</Animated.Text>
            <Text style={styles.syncNowText}>{isSyncing ? 'Syncing' : 'Sync Now'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.syncRow}>
        <View style={[styles.syncDot, { backgroundColor: statusColor }]} />
        <View style={styles.syncInfo}>
          <Text style={[styles.syncStatusText, { color: statusColor }]}>{statusText}</Text>
          <Text style={styles.syncLastTime}>
            {syncState.lastSyncAt
              ? `Last backup · ${syncState.lastSyncLabel}`
              : isSupabaseAvailable
                ? 'Tap "Sync Now" to back up your stories'
                : 'Connect Supabase to enable cloud backup'}
          </Text>
        </View>
        <Text style={styles.syncStatusIcon}>{statusIcon}</Text>
      </View>

      {/* Data coverage row */}
      <View style={styles.syncCoverageRow}>
        {[
          { icon: '👶', label: 'Profiles' },
          { icon: '🎙️', label: 'Voices' },
          { icon: '📖', label: 'Stories' },
          { icon: '⚙️', label: 'Settings' },
        ].map((item) => (
          <View key={item.label} style={styles.syncCoverageItem}>
            <Text style={styles.syncCoverageIcon}>{item.icon}</Text>
            <Text style={styles.syncCoverageLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Legacy migration badge */}
      {migrationComplete && (
        <View style={styles.migrationBadge}>
          <Text style={styles.migrationBadgeText}>
            ✨ Magic Sync complete — legacy data safely moved to cloud
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDeletingAccount,    setIsDeletingAccount]    = useState(false);
  const [syncState,            setSyncState]            = useState<SyncState>({
    status: 'never',
    lastSyncAt: null,
    lastSyncLabel: 'Never synced',
  });
  const [isSyncing,          setIsSyncing]          = useState(false);
  const [migrationComplete,  setMigrationComplete]  = useState(false);
  const [appLanguage,        setAppLanguage]        = useState<LanguageCode>('en');
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [analyticsVisible,   setAnalyticsVisible]   = useState(false);
  const [analyticsSummary,   setAnalyticsSummary]   = useState<AnalyticsSummary | null>(null);
  const [cacheMeta,          setCacheMeta]          = useState<CacheMeta | null>(null);

  // Interval to refresh the sync label ("5m ago" → "6m ago")
  const labelRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const headerTransY = useSharedValue(-20);
  const profileOpacity = useSharedValue(0);
  const profileTransY = useSharedValue(16);
  const versionOpacity = useSharedValue(0);
  const langFlipAnim   = useSharedValue(0); // 0 → 1 flip
  const langShimmer    = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
    headerTransY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    profileOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));
    profileTransY.value = withDelay(100, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    versionOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notifications preference and sync state
  useEffect(() => {
    void loadSettings();
    // Refresh label every 30 seconds
    labelRefreshRef.current = setInterval(() => {
      void getSyncState().then(setSyncState);
    }, 30_000);
    return () => {
      if (labelRefreshRef.current) clearInterval(labelRefreshRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      const [notifRaw, state] = await Promise.all([
        AsyncStorage.getItem('notifications_enabled'),
        getSyncState(),
      ]);
      if (notifRaw !== null) setNotificationsEnabled(notifRaw === 'true');
      setSyncState(state);

      // Check if migration was completed for this user
      if (user?.id) {
        const migrated = await isMigrationComplete(user.id);
        setMigrationComplete(migrated);
        // Also check for legacy timestamp key as backup
        if (!migrated) {
          const ts = await getMigrationTimestamp();
          if (ts) setMigrationComplete(true);
        }
      }
      const savedLang = await AsyncStorage.getItem('app_language');
      if (savedLang) setAppLanguage(savedLang as LanguageCode);

      // Load offline cache metadata
      const meta = await getCacheMeta();
      setCacheMeta(meta);
    } catch {
      // ignore
    }
  };

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

  const langCardFlipStyle = useAnimatedStyle(() => {
    const rotateY = `${langFlipAnim.value * 90}deg`;
    return {
      transform: [{ perspective: 600 }, { rotateY }],
    };
  });

  const langShimmerStyle = useAnimatedStyle(() => ({
    opacity: langShimmer.value * 0.6,
  }));

  // User display data
  const userEmail = user?.email ?? 'Not signed in';
  const userInitial = userEmail.charAt(0).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Sync Now ──────────────────────────────────────────────────────────────────
  const handleSyncNow = useCallback(async () => {
    if (!user?.id || isSyncing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    try {
      const ok = await syncFromCloud(user.id);
      const fresh = await getSyncState();
      setSyncState(fresh);
      if (ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, isSyncing]);

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
              'notifications_enabled',
            ]);
            await clearSyncCache();
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
                        await deleteAllUserData(user.id);
                      }
                      // Clear all local storage
                      await AsyncStorage.multiRemove([
                        'active_child_id',
                        'active_voice_id',
                        'selected_voice_type',
                        'onboarding_complete',
                        'pending_child_profile',
                        'local_stories',
                        'current_story',
                        'walkthrough_seen',
                        'notifications_enabled',
                      ]);
                      await clearSyncCache();
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

  // ── Notifications toggle ──────────────────────────────────────────────────────
  const handleToggleNotifications = useCallback(async (v: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(v);
    await AsyncStorage.setItem('notifications_enabled', String(v));
    // Sync to cloud preferences
    if (isSupabaseAvailable && user?.id) {
      await upsertUserPreferences(user.id, { notifications_enabled: v });
    }
  }, [user?.id]);

  // ── Language Change ───────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback(async (code: LanguageCode) => {
    if (code === appLanguage) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsChangingLanguage(true);

    // Flip animation: rotate to 90° (edge), change language, rotate back to 0°
    langFlipAnim.value = withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) }, () => {
      // Language has "flipped" — change it at the midpoint
      langFlipAnim.value = withTiming(0, { duration: 280, easing: Easing.inOut(Easing.quad) });
    });

    // Shimmer effect
    langShimmer.value = withSequence(
      withTiming(1, { duration: 350 }),
      withTiming(0, { duration: 500 }),
    );

    // Update state after brief delay for animation
    setTimeout(async () => {
      setAppLanguage(code);
      await AsyncStorage.setItem('app_language', code);
      setIsChangingLanguage(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 280);
  }, [appLanguage, langFlipAnim, langShimmer]);

  // ── Report an Issue ───────────────────────────────────────────────────────────
  const handleReportIssue = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const deviceInfo = `Device: ${Platform.OS} ${Platform.Version}`;
    const appInfo    = 'App: StoryVoice v7.0';
    const body       = encodeURIComponent(
      `Hi StoryVoice Support,\n\nI'd like to report an issue:\n\n[Please describe the problem here]\n\n---\n${appInfo}\n${deviceInfo}`
    );
    const subject = encodeURIComponent('StoryVoice — Issue Report');
    const mailUrl = `mailto:support@storyvoice.app?subject=${subject}&body=${body}`;
    const supported = await Linking.canOpenURL(mailUrl);
    if (supported) {
      await Linking.openURL(mailUrl);
    } else {
      Alert.alert(
        'Email Not Available',
        'Please email us directly at support@storyvoice.app',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // ── View Analytics ────────────────────────────────────────────────────────────
  const handleViewAnalytics = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const [summary, meta] = await Promise.all([
      getAnalyticsSummary(),
      getCacheMeta(),
    ]);
    setAnalyticsSummary(summary);
    setCacheMeta(meta);
    setAnalyticsVisible(true);
  }, []);

  // ── Section configs ───────────────────────────────────────────────────────────
  const appRows: SettingRow[] = [
    {
      icon: '🔔',
      label: 'Story Notifications',
      chevron: false,
      rightElement: (
        <Switch
          value={notificationsEnabled}
          onValueChange={(v) => void handleToggleNotifications(v)}
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

  const familyRows: SettingRow[] = [
    {
      icon: '👨‍👩‍👧‍👦',
      label: 'Family Sharing Hub',
      value: 'Link accounts & share stories',
      chevron: true,
      onPress: () => router.push('/(main)/family-sharing'),
    },
    {
      icon: '📖',
      label: 'Memory Book',
      value: "Milestones & growth themes",
      chevron: true,
      onPress: () => router.push('/(main)/milestone-book'),
    },
    {
      icon: '📓',
      label: 'Bedtime Journal',
      value: "View child's reflection answers",
      chevron: true,
      onPress: () => router.push('/(main)/bedtime-journal'),
    },
    {
      icon: '⭐',
      label: 'Stardust Shop',
      value: 'Unlock magic dust & badges',
      chevron: true,
      onPress: () => router.push('/(main)/stardust-shop'),
    },
  ];

  const supportRows: SettingRow[] = [
    {
      icon:    '📊',
      label:   'Story Analytics',
      value:   'Top narrators & completion rates',
      chevron: true,
      onPress: () => void handleViewAnalytics(),
    },
    {
      icon:    '🐛',
      label:   'Report an Issue',
      value:   'Send a pre-filled email to support',
      chevron: true,
      onPress: () => void handleReportIssue(),
    },
    {
      icon:    '💾',
      label:   'Offline Stories',
      value:   cacheMeta ? `${cacheMeta.total_stories} stories cached locally` : 'Loading…',
      chevron: false,
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

        {/* Sync Status Card */}
        {(isSupabaseAvailable || syncState.lastSyncAt) && (
          <SyncStatusCard
            syncState={syncState}
            isSyncing={isSyncing}
            onSyncNow={() => void handleSyncNow()}
            delay={150}
            migrationComplete={migrationComplete}
          />
        )}

        {/* Language Selector */}
        <Animated.View style={[styles.section, { opacity: 1 }]}>
          <Text style={styles.sectionTitle}>🌍  Story Language</Text>
          <Animated.View style={[styles.langCard, langCardFlipStyle]}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            {/* Shimmer overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.langShimmerOverlay, langShimmerStyle]} />

            <Text style={styles.langCardTitle}>Narration Language</Text>
            <Text style={styles.langCardSubtitle}>Stories & narration will be generated in your chosen language</Text>

            <View style={styles.langOptions}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    appLanguage === lang.code && styles.langOptionSelected,
                  ]}
                  onPress={() => void handleLanguageChange(lang.code as LanguageCode)}
                  disabled={isChangingLanguage}
                  activeOpacity={0.8}
                >
                  {appLanguage === lang.code && (
                    <LinearGradient
                      colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.06)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                    />
                  )}
                  <Text style={styles.langEmoji}>{lang.emoji}</Text>
                  <Text style={[styles.langLabel, appLanguage === lang.code && styles.langLabelSelected]}>
                    {lang.nativeName}
                  </Text>
                  {appLanguage === lang.code && (
                    <Text style={styles.langCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Animated.View>

        {/* App Settings Section */}
        <Section title="App Settings" items={appRows} delay={200} />

        {/* Family & Memories Section */}
        <Section title="✦ Family & Memories" items={familyRows} delay={280} />

        {/* Support & Analytics Section */}
        <Section title="🔍 Support & Analytics" items={supportRows} delay={320} />

        {/* Account Section */}
        <Section title="Account" items={accountRows} delay={380} />

        {/* App version */}
        <Animated.View style={[versionStyle, styles.versionRow]}>
          <Text style={styles.versionText}>StoryVoice · Phase 7 · v7.0</Text>
          <Text style={styles.versionSubText}>Made with 🌙 for sleepy little ones</Text>
        </Animated.View>
      </ScrollView>

      {/* Analytics Modal */}
      <Modal
        visible={analyticsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAnalyticsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.analyticsModal}>
            {Platform.OS === 'ios' && (
              // BlurView not available here without proper import; use solid bg
              null
            )}
            <LinearGradient
              colors={[Colors.deepPurple, Colors.midnightNavy]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            {/* Corner decorations */}
            <View style={styles.analyticsCornerTL} />
            <View style={styles.analyticsCornerBR} />

            {/* Header */}
            <View style={styles.analyticsHeader}>
              <Text style={styles.analyticsTitle}>📊 Story Analytics</Text>
              <TouchableOpacity
                style={styles.analyticsCloseBtn}
                onPress={() => setAnalyticsVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.analyticsCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Sessions */}
              <View style={styles.analyticsStatRow}>
                <Text style={styles.analyticsStatIcon}>🌙</Text>
                <View style={styles.analyticsStatInfo}>
                  <Text style={styles.analyticsStatLabel}>Total App Sessions</Text>
                  <Text style={styles.analyticsStatValue}>{analyticsSummary?.total_sessions ?? 0}</Text>
                </View>
              </View>

              {/* Top Narrator */}
              <View style={styles.analyticsStatRow}>
                <Text style={styles.analyticsStatIcon}>🏆</Text>
                <View style={styles.analyticsStatInfo}>
                  <Text style={styles.analyticsStatLabel}>Favourite Narrator</Text>
                  <Text style={styles.analyticsStatValue}>
                    {analyticsSummary?.top_narrator ?? 'None yet'}
                  </Text>
                </View>
              </View>

              {/* Overall completion */}
              <View style={styles.analyticsStatRow}>
                <Text style={styles.analyticsStatIcon}>📖</Text>
                <View style={styles.analyticsStatInfo}>
                  <Text style={styles.analyticsStatLabel}>Story Completion Rate</Text>
                  <Text style={styles.analyticsStatValue}>
                    {analyticsSummary?.overall_completion_rate ?? 0}%
                  </Text>
                </View>
              </View>

              {/* Narrator breakdown */}
              {analyticsSummary && analyticsSummary.narrator_stats.length > 0 && (
                <View style={styles.analyticsSection}>
                  <Text style={styles.analyticsSectionTitle}>NARRATOR POPULARITY</Text>
                  {analyticsSummary.narrator_stats.slice(0, 5).map((ns) => (
                    <View key={ns.narrator_id} style={styles.narratorStatRow}>
                      <Text style={styles.narratorStatEmoji}>{ns.emoji}</Text>
                      <View style={styles.narratorStatInfo}>
                        <View style={styles.narratorStatLabelRow}>
                          <Text style={styles.narratorStatName}>{ns.name}</Text>
                          <Text style={styles.narratorStatPct}>{ns.percentage}%</Text>
                        </View>
                        <View style={styles.narratorBarTrack}>
                          <View style={[styles.narratorBarFill, { width: `${ns.percentage}%` }]} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Completion by theme */}
              {analyticsSummary && analyticsSummary.story_completion.length > 0 && (
                <View style={styles.analyticsSection}>
                  <Text style={styles.analyticsSectionTitle}>COMPLETION BY THEME</Text>
                  {analyticsSummary.story_completion.slice(0, 4).map((sc) => (
                    <View key={sc.theme} style={styles.themeStatRow}>
                      <View style={styles.themeStatInfo}>
                        <View style={styles.themeStatLabelRow}>
                          <Text style={styles.themeStatName}>{sc.theme}</Text>
                          <Text style={styles.themeStatPct}>{sc.completion_rate}%</Text>
                        </View>
                        <Text style={styles.themeStatSub}>
                          {sc.completed}/{sc.started} completed
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Offline cache */}
              {cacheMeta && (
                <View style={styles.analyticsSection}>
                  <Text style={styles.analyticsSectionTitle}>OFFLINE CACHE</Text>
                  <View style={styles.analyticsStatRow}>
                    <Text style={styles.analyticsStatIcon}>💾</Text>
                    <View style={styles.analyticsStatInfo}>
                      <Text style={styles.analyticsStatLabel}>Stories Cached</Text>
                      <Text style={styles.analyticsStatValue}>
                        {cacheMeta.total_stories} / 20 max
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {analyticsSummary?.narrator_stats.length === 0 && analyticsSummary?.story_completion.length === 0 && (
                <View style={styles.analyticsEmpty}>
                  <Text style={styles.analyticsEmptyEmoji}>🌙</Text>
                  <Text style={styles.analyticsEmptyText}>
                    No data yet — create some stories and your analytics will appear here!
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    position: 'absolute', top: 0, left: 0,
    width: 60, height: 60,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  profileCardCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 60, height: 60,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  profileInner: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, marginBottom: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatarGradient: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  avatarInitial: {
    fontFamily: Fonts.black, fontSize: 28,
    color: Colors.deepSpace, lineHeight: 34,
  },
  onlineIndicator: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.successGreen,
    borderWidth: 2, borderColor: Colors.deepSpace,
  },
  profileInfo: { flex: 1 },
  profileEmailLabel: {
    fontFamily: Fonts.medium, fontSize: 10,
    color: Colors.textMuted, letterSpacing: 1, marginBottom: 4,
  },
  profileEmail: {
    fontFamily: Fonts.bold, fontSize: 15,
    color: Colors.moonlightCream, letterSpacing: 0.2, marginBottom: 8,
  },
  memberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  memberBadgeText: {
    fontFamily: Fonts.medium, fontSize: 11,
    color: Colors.celestialGold, letterSpacing: 0.2,
  },
  profileStarRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginTop: 4,
  },
  profileStar: { fontSize: 16 },

  // Sync Status Card
  syncCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.75)' : 'rgba(26,27,65,0.95)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(107,72,184,0.4)',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: Colors.softPurple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  syncCardCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 50, height: 50,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderColor: 'rgba(107,72,184,0.5)',
  },
  syncCardCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 50, height: 50,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderColor: 'rgba(107,72,184,0.5)',
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  syncCardSectionTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    color: Colors.moonlightCream,
    letterSpacing: 0.2,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(107,72,184,0.6)',
  },
  syncNowBtnDisabled: { opacity: 0.5 },
  syncNowIcon: {
    fontSize: 14, color: Colors.celestialGold,
    fontFamily: Fonts.bold,
  },
  syncNowText: {
    fontFamily: Fonts.bold, fontSize: 12,
    color: Colors.celestialGold,
  },
  syncRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: Spacing.md,
  },
  syncDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4, shadowOpacity: 0.8,
  },
  syncInfo: { flex: 1 },
  syncStatusText: {
    fontFamily: Fonts.bold, fontSize: 13,
    letterSpacing: 0.1,
  },
  syncLastTime: {
    fontFamily: Fonts.regular, fontSize: 11,
    color: Colors.textMuted, marginTop: 2,
  },
  syncStatusIcon: { fontSize: 18 },
  syncCoverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(107,72,184,0.25)',
    paddingTop: 12,
    marginTop: 2,
  },
  syncCoverageItem: { alignItems: 'center', gap: 3 },
  syncCoverageIcon: { fontSize: 16 },
  syncCoverageLabel: {
    fontFamily: Fonts.medium, fontSize: 10,
    color: Colors.textMuted, letterSpacing: 0.2,
  },
  migrationBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    alignItems: 'center',
  },
  migrationBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.celestialGold,
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: Fonts.medium, fontSize: 11,
    color: Colors.textMuted, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    minHeight: 58,
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingRowRight: { marginLeft: Spacing.sm },
  settingIcon: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,215,0,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)',
  },
  settingIconDestructive: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderColor: 'rgba(255,107,107,0.2)',
  },
  settingIconText: { fontSize: 18 },
  settingLabel: {
    fontFamily: Fonts.bold, fontSize: 15,
    color: Colors.moonlightCream, letterSpacing: 0.1,
  },
  settingLabelDestructive: { color: Colors.errorRed },
  settingValue: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: Colors.textMuted, marginTop: 2,
  },
  chevron: {
    fontFamily: Fonts.bold, fontSize: 20,
    color: Colors.textMuted, lineHeight: 24,
  },
  separator: {
    height: 1, backgroundColor: 'rgba(61,63,122,0.5)',
    marginHorizontal: Spacing.md,
  },

  // Version
  versionRow: { alignItems: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.sm },
  versionText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted },
  versionSubText: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(153,153,187,0.5)', marginTop: 4 },

  // Language Selector
  langCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    overflow: 'hidden',
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  langShimmerOverlay: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    pointerEvents: 'none' as const,
  },
  langCardTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    color: Colors.moonlightCream,
  },
  langCardSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  langOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.cardBg,
    overflow: 'hidden',
  },
  langOptionSelected: {
    borderColor: 'rgba(255,215,0,0.5)',
  },
  langEmoji: { fontSize: 18 },
  langLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.textMuted,
  },
  langLabelSelected: {
    color: Colors.celestialGold,
  },
  langCheck: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.celestialGold,
    marginLeft: 2,
  },

  // ── Analytics Modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent:  'flex-end',
  },
  analyticsModal: {
    backgroundColor: Colors.midnightNavy,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding:  Spacing.lg,
    paddingBottom: Spacing.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  analyticsCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 50, height: 50,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  analyticsCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 50, height: 50,
    borderBottomRightRadius: 0,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  analyticsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.lg,
  },
  analyticsTitle: {
    fontFamily: Fonts.black,
    fontSize:   18,
    color:      Colors.moonlightCream,
  },
  analyticsCloseBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  analyticsCloseTxt: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
  },
  analyticsStatRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.sm,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.12)',
  },
  analyticsStatIcon: { fontSize: 22 },
  analyticsStatInfo: { flex: 1 },
  analyticsStatLabel: {
    fontFamily: Fonts.medium,
    fontSize:   11,
    color:      Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  analyticsStatValue: {
    fontFamily: Fonts.extraBold,
    fontSize:   17,
    color:      Colors.celestialGold,
    marginTop:  2,
  },
  analyticsSection: {
    marginTop: Spacing.md,
  },
  analyticsSectionTitle: {
    fontFamily:    Fonts.medium,
    fontSize:      10,
    color:         Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  Spacing.sm,
    marginLeft:    4,
  },
  narratorStatRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    marginBottom:  Spacing.sm,
  },
  narratorStatEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  narratorStatInfo:  { flex: 1 },
  narratorStatLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  narratorStatName: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      Colors.moonlightCream,
  },
  narratorStatPct: {
    fontFamily: Fonts.extraBold,
    fontSize:   13,
    color:      Colors.celestialGold,
  },
  narratorBarTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(61,63,122,0.6)',
    overflow:        'hidden',
  },
  narratorBarFill: {
    height:          '100%',
    backgroundColor: Colors.celestialGold,
    borderRadius:    3,
  },
  themeStatRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius:    Radius.sm,
    padding:         Spacing.sm,
    marginBottom:    Spacing.sm,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  themeStatInfo: { flex: 1 },
  themeStatLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  themeStatName: {
    fontFamily:    Fonts.bold,
    fontSize:      13,
    color:         Colors.moonlightCream,
    textTransform: 'capitalize',
  },
  themeStatPct: {
    fontFamily: Fonts.extraBold,
    fontSize:   13,
    color:      Colors.successGreen,
  },
  themeStatSub: {
    fontFamily: Fonts.regular,
    fontSize:   11,
    color:      Colors.textMuted,
    marginTop:  2,
  },
  analyticsEmpty: {
    alignItems:   'center',
    paddingVertical: Spacing.xl,
    gap:          Spacing.md,
  },
  analyticsEmptyEmoji: { fontSize: 40 },
  analyticsEmptyText: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
});
