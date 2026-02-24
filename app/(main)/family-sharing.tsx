/**
 * Family Sharing Hub
 *
 * Phase 5 Pro Feature. Lets families link accounts via an Invite Code system
 * to share Child Profiles, Voice Studio recordings, and Story Library.
 *
 * Uses Supabase when available, with AsyncStorage fallback for demo mode.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Clipboard,
  Platform,
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
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import SparkleSwep from '@/components/SparkleSwep';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import {
  createFamilyGroup,
  joinFamilyGroup,
  getFamilyGroup,
  leaveFamilyGroup,
  isSupabaseAvailable,
  type FamilyGroup,
  type FamilyMember,
} from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Shared item row
// ─────────────────────────────────────────────────────────────────────────────
function SharedItem({ emoji, label, description }: { emoji: string; label: string; description: string }) {
  return (
    <View style={styles.sharedItem}>
      <View style={styles.sharedItemIcon}>
        <Text style={styles.sharedItemEmoji}>{emoji}</Text>
      </View>
      <View style={styles.sharedItemText}>
        <Text style={styles.sharedItemLabel}>{label}</Text>
        <Text style={styles.sharedItemDesc}>{description}</Text>
      </View>
      <View style={styles.sharedItemCheck}>
        <Text style={styles.sharedItemCheckText}>✓</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function FamilySharingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [familyGroup,  setFamilyGroup]  = useState<FamilyGroup | null>(null);
  const [members,      setMembers]      = useState<FamilyMember[]>([]);
  const [inviteCode,   setInviteCode]   = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [activeTab,    setActiveTab]    = useState<'hub' | 'invite'>('hub');
  const [groupName,    setGroupName]    = useState('Our Family');

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Invite code pulse
  const codePulse = useSharedValue(1);

  // Sync ring
  const syncRing = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value  = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    void loadFamilyGroup();

    // Subtle pulse on invite code
    codePulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(codePulse);
      cancelAnimation(syncRing);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFamilyGroup = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Try Supabase first
      if (isSupabaseAvailable) {
        const { group, members: m } = await getFamilyGroup(user.id);
        if (group) {
          setFamilyGroup(group);
          setMembers(m);
          return;
        }
      }
      // Fallback: check AsyncStorage
      const raw = await AsyncStorage.getItem(`family_group_${user.id}`);
      if (raw) {
        const local = JSON.parse(raw) as { group: FamilyGroup; members: FamilyMember[] };
        setFamilyGroup(local.group);
        setMembers(local.members);
      }
    } catch (err) {
      console.error('[FamilySharing] loadFamilyGroup error:', err);
    }
  }, [user?.id]);

  const handleCreateGroup = useCallback(async () => {
    if (!user?.id || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsLoading(true);
    try {
      let group: FamilyGroup | null = null;
      if (isSupabaseAvailable) {
        const result = await createFamilyGroup(user.id, groupName);
        group = result.group;
      }
      // Local fallback
      if (!group) {
        const localCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        group = {
          id:           `local_${Date.now()}`,
          owner_user_id: user.id,
          invite_code:   localCode,
          group_name:    groupName,
          created_at:    new Date().toISOString(),
        };
        const member: FamilyMember = {
          id:        `m_${Date.now()}`,
          group_id:  group.id,
          user_id:   user.id,
          role:      'owner',
          joined_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem(`family_group_${user.id}`, JSON.stringify({ group, members: [member] }));
        setMembers([member]);
      }
      setFamilyGroup(group);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Trigger sparkle sync
      triggerSparkleSync();
    } catch (err) {
      console.error('[FamilySharing] createGroup error:', err);
      Alert.alert('Error', 'Could not create family group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, groupName, isLoading]);

  const handleJoinGroup = useCallback(async () => {
    if (!user?.id || !inviteCode.trim() || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      if (isSupabaseAvailable) {
        const { group, error } = await joinFamilyGroup(user.id, inviteCode.trim());
        if (group) {
          setFamilyGroup(group);
          void loadFamilyGroup();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          triggerSparkleSync();
          setActiveTab('hub');
          return;
        }
        if (error) {
          Alert.alert('Invalid Code', 'That invite code was not found. Please check and try again.');
          return;
        }
      } else {
        Alert.alert('Not Available', 'Family sharing requires a Supabase connection.');
      }
    } catch (err) {
      console.error('[FamilySharing] joinGroup error:', err);
      Alert.alert('Error', 'Could not join family group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, inviteCode, isLoading, loadFamilyGroup]);

  const handleLeaveGroup = useCallback(() => {
    if (!familyGroup || !user?.id) return;
    Alert.alert(
      'Leave Family Group',
      'Are you sure you want to leave this family group? You will lose shared access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await leaveFamilyGroup(user.id, familyGroup.id);
            await AsyncStorage.removeItem(`family_group_${user.id}`);
            setFamilyGroup(null);
            setMembers([]);
          },
        },
      ]
    );
  }, [familyGroup, user?.id]);

  const handleCopyCode = useCallback(() => {
    if (!familyGroup) return;
    Clipboard.setString(familyGroup.invite_code);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied! 📋', `Invite code "${familyGroup.invite_code}" copied to clipboard.`);
  }, [familyGroup]);

  const triggerSparkleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 3000);
  };

  const handleSyncNow = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerSparkleSync();
  };

  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const codePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: codePulse.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#1F1040']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={35} />
      <SparkleSwep visible={isSyncing} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.headerRow, headerStyle]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Hub</Text>
          <View style={{ width: 60 }} />
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* Hero banner */}
          <View style={styles.heroBanner}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(255,215,0,0.08)', 'rgba(107,72,184,0.12)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.heroCornerTL} />
            <View style={styles.heroCornerBR} />
            <Text style={styles.heroEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.heroTitle}>Family Sharing Hub</Text>
            <Text style={styles.heroSubtitle}>
              Link your family&apos;s accounts and share the magic of StoryVoice together.
            </Text>
            {/* Pro badge */}
            <View style={styles.proBadge}>
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
              />
              <Text style={styles.proBadgeText}>✨ PRO FEATURE</Text>
            </View>
          </View>

          {/* Tab selector */}
          {!familyGroup && (
            <View style={styles.tabBar}>
              {(['hub', 'invite'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab);
                  }}
                >
                  {activeTab === tab && (
                    <LinearGradient
                      colors={['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.05)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                  )}
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'hub' ? '✦ Create Group' : '🔑 Join with Code'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Existing group view ─────────────────────────────────────── */}
          {familyGroup ? (
            <>
              {/* Group card */}
              <View style={styles.groupCard}>
                {Platform.OS === 'ios' && (
                  <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(255,215,0,0.08)', 'rgba(26,27,65,0.6)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
                <View style={styles.groupHeader}>
                  <View>
                    <Text style={styles.groupLabel}>YOUR FAMILY GROUP</Text>
                    <Text style={styles.groupName}>{familyGroup.group_name}</Text>
                  </View>
                  <Text style={styles.groupEmoji}>🌟</Text>
                </View>

                {/* Invite code */}
                <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
                <Animated.View style={[styles.inviteCodeBox, codePulseStyle]}>
                  <LinearGradient
                    colors={['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                  />
                  <Text style={styles.inviteCode}>{familyGroup.invite_code}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Text style={styles.inviteCodeHint}>
                  Share this code with family members so they can join ✨
                </Text>

                {/* Members */}
                <Text style={styles.membersTitle}>Family Members ({members.length})</Text>
                {members.map((m, i) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{i + 1}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberRole}>
                        {m.role === 'owner' ? '👑 Family Admin' : '👤 Family Member'}
                      </Text>
                      <Text style={styles.memberSince}>
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                    {m.user_id === user?.id && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Shared access list */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>✨ Shared Across Family</Text>
                <SharedItem emoji="👶" label="Child Profiles" description="All family members can read stories to any profile" />
                <View style={styles.sharedDivider} />
                <SharedItem emoji="🎙️" label="Voice Studio" description="Each parent's recorded voice is available to all" />
                <View style={styles.sharedDivider} />
                <SharedItem emoji="📖" label="Story Library" description="All created stories are visible to the whole family" />
              </View>

              {/* Sync button */}
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={handleSyncNow}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(107,72,184,0.4)', 'rgba(107,72,184,0.2)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
                <Text style={styles.syncBtnIcon}>{isSyncing ? '✨' : '↻'}</Text>
                <Text style={styles.syncBtnText}>
                  {isSyncing ? 'Syncing to family…' : 'Sync to Family Now'}
                </Text>
              </TouchableOpacity>

              {/* Leave group */}
              <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
                <Text style={styles.leaveBtnText}>Leave Family Group</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {activeTab === 'hub' ? (
                /* ── Create Group ──────────────────────────────────────── */
                <View style={styles.createCard}>
                  {Platform.OS === 'ios' && (
                    <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={styles.createCardTitle}>Start Your Family Group</Text>
                  <Text style={styles.createCardSubtitle}>
                    Create a family group and invite your loved ones to share StoryVoice together.
                  </Text>

                  <Text style={styles.inputLabel}>Group Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="Our Family"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={30}
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                    onPress={() => void handleCreateGroup()}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.celestialGold, Colors.softGold]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={styles.primaryBtnText}>
                      {isLoading ? '✨ Creating…' : '✨ Create Family Group'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── Join Group ────────────────────────────────────────── */
                <View style={styles.createCard}>
                  {Platform.OS === 'ios' && (
                    <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={styles.createCardTitle}>Join a Family Group</Text>
                  <Text style={styles.createCardSubtitle}>
                    Enter the 6-letter invite code shared by a family member.
                  </Text>

                  <Text style={styles.inputLabel}>Invite Code</Text>
                  <TextInput
                    style={[styles.textInput, styles.codeInput]}
                    value={inviteCode}
                    onChangeText={(v) => setInviteCode(v.toUpperCase())}
                    placeholder="ABC123"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, (isLoading || inviteCode.length < 6) && styles.primaryBtnDisabled]}
                    onPress={() => void handleJoinGroup()}
                    disabled={isLoading || inviteCode.length < 6}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.softPurple, Colors.deepPurple]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={[styles.primaryBtnText, { color: '#fff' }]}>
                      {isLoading ? '🔑 Joining…' : '🔑 Join Family Group'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Benefits list */}
              <View style={styles.benefitsCard}>
                <Text style={styles.benefitsTitle}>What&apos;s shared</Text>
                <SharedItem emoji="👶" label="Child Profiles" description="Everyone reads to the same profiles" />
                <View style={styles.sharedDivider} />
                <SharedItem emoji="🎙️" label="Voice Studio" description="Mum, Dad & grandparents all in one place" />
                <View style={styles.sharedDivider} />
                <SharedItem emoji="📖" label="Story Library" description="All bedtime stories shared with the family" />
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  scroll:    { paddingHorizontal: Spacing.lg },

  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.lg,
  },
  backBtn:     { paddingVertical: 8, minWidth: 60 },
  backText:    { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerTitle: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream },

  // Hero banner
  heroBanner: {
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
    padding:         Spacing.xl,
    marginBottom:    Spacing.lg,
    alignItems:      'center',
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.75)' : 'rgba(26,27,65,0.95)',
    gap:             Spacing.sm,
  },
  heroCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 50, height: 50,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  heroCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 50, height: 50,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  heroEmoji:    { fontSize: 48 },
  heroTitle:    { fontFamily: Fonts.black,    fontSize: 22, color: Colors.moonlightCream, textAlign: 'center' },
  heroSubtitle: { fontFamily: Fonts.regular,  fontSize: 13, color: Colors.textMuted,      textAlign: 'center', lineHeight: 20 },
  proBadge: {
    marginTop:       Spacing.sm,
    borderRadius:    Radius.full,
    overflow:        'hidden',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  proBadgeText: { fontFamily: Fonts.black, fontSize: 11, color: Colors.deepSpace, letterSpacing: 0.8 },

  // Tab bar
  tabBar: {
    flexDirection:    'row',
    backgroundColor:  Colors.cardBg,
    borderRadius:     Radius.full,
    padding:          4,
    marginBottom:     Spacing.lg,
    borderWidth:      1,
    borderColor:      Colors.borderColor,
    gap:              4,
  },
  tab: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 10,
    borderRadius:    Radius.full,
    overflow:        'hidden',
  },
  tabActive: {},
  tabText: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      Colors.textMuted,
  },
  tabTextActive: { color: Colors.celestialGold },

  // Group card
  groupCard: {
    borderRadius:    Radius.xl,
    borderWidth:     1.5,
    borderColor:     'rgba(255,215,0,0.3)',
    padding:         Spacing.lg,
    marginBottom:    Spacing.lg,
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.75)' : 'rgba(26,27,65,0.95)',
    gap:             Spacing.sm,
  },
  groupHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  groupLabel: { fontFamily: Fonts.medium, fontSize: 10, color: Colors.textMuted, letterSpacing: 1 },
  groupName:  { fontFamily: Fonts.black,  fontSize: 20, color: Colors.moonlightCream },
  groupEmoji: { fontSize: 32 },

  inviteCodeLabel: { fontFamily: Fonts.medium, fontSize: 10, color: Colors.textMuted, letterSpacing: 1, marginTop: 4 },
  inviteCodeBox: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.35)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    overflow:        'hidden',
  },
  inviteCode: {
    fontFamily:    Fonts.black,
    fontSize:      28,
    color:         Colors.celestialGold,
    letterSpacing: 6,
  },
  copyBtn: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius:    Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.3)',
  },
  copyBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.celestialGold },
  inviteCodeHint: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  membersTitle: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted, marginTop: Spacing.sm },
  memberRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius:    Radius.md,
    padding:         Spacing.sm,
  },
  memberAvatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.softPurple,
    alignItems:      'center',
    justifyContent:  'center',
  },
  memberAvatarText: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  memberInfo: { flex: 1 },
  memberRole: { fontFamily: Fonts.bold,    fontSize: 13, color: Colors.moonlightCream },
  memberSince: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  youBadge: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius:    Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
  },
  youBadgeText: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.celestialGold },

  // Shared items
  sectionCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    padding:         Spacing.lg,
    marginBottom:    Spacing.lg,
    gap:             Spacing.sm,
  },
  sectionCardTitle: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream, marginBottom: 4 },
  sharedItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sharedItemIcon: {
    width:           38,
    height:          38,
    borderRadius:    Radius.sm,
    backgroundColor: 'rgba(255,215,0,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.15)',
  },
  sharedItemEmoji: { fontSize: 18 },
  sharedItemText: { flex: 1 },
  sharedItemLabel: { fontFamily: Fonts.bold,    fontSize: 14, color: Colors.moonlightCream },
  sharedItemDesc:  { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  sharedItemCheck: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: 'rgba(107,203,119,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  sharedItemCheckText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.successGreen },
  sharedDivider: { height: 1, backgroundColor: 'rgba(61,63,122,0.5)' },

  syncBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(107,72,184,0.4)',
    marginBottom:    Spacing.md,
    overflow:        'hidden',
    gap:             Spacing.sm,
  },
  syncBtnIcon: { fontSize: 20, color: Colors.celestialGold },
  syncBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },

  leaveBtn: {
    alignItems:   'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  leaveBtnText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, textDecorationLine: 'underline' },

  // Create / join card
  createCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.75)' : 'rgba(26,27,65,0.95)',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    padding:         Spacing.xl,
    marginBottom:    Spacing.lg,
    overflow:        'hidden',
    gap:             Spacing.md,
  },
  createCardTitle:    { fontFamily: Fonts.black,   fontSize: 18, color: Colors.moonlightCream },
  createCardSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 20 },

  inputLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: -6 },
  textInput: {
    backgroundColor: Colors.inputBg,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    fontFamily:      Fonts.bold,
    fontSize:        16,
    color:           Colors.moonlightCream,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  codeInput: {
    fontSize:      24,
    letterSpacing: 6,
    textAlign:     'center',
    fontFamily:    Fonts.black,
    color:         Colors.celestialGold,
  },

  primaryBtn: {
    borderRadius:  Radius.full,
    overflow:      'hidden',
    paddingVertical: 16,
    alignItems:    'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
    color:      Colors.deepSpace,
  },

  benefitsCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.92)',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    padding:         Spacing.lg,
    marginBottom:    Spacing.lg,
    gap:             Spacing.sm,
  },
  benefitsTitle: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream, marginBottom: 4 },
});
