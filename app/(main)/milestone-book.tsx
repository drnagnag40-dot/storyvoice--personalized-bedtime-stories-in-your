/**
 * Milestone Memory Book
 *
 * Phase 5 Feature. An illuminated manuscript-styled vertical timeline
 * showcasing 'Firsts' and 'Favorites', plus a parent dashboard showing
 * 'Themes of Growth' extracted from the month's stories using AI.
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
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { buildGrowthThemesPrompt } from '@/lib/newell';
import { generateText } from '@fastshot/ai';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Milestone {
  id:          string;
  type:        'first' | 'favorite' | 'memory';
  emoji:       string;
  title:       string;
  description: string;
  date:        string;
}

interface GrowthTheme {
  theme:       string;
  emoji:       string;
  description: string;
  count:       number;
}

interface LocalStory {
  id:        string;
  title:     string;
  content:   string;
  theme:     string;
  createdAt: string;
}

const MILESTONE_EMOJIS: { type: Milestone['type']; emoji: string; label: string }[] = [
  { type: 'first',    emoji: '⭐', label: 'A First' },
  { type: 'favorite', emoji: '💛', label: 'A Favourite' },
  { type: 'memory',   emoji: '🌟', label: 'A Memory' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Illuminated manuscript decoration ornament
// ─────────────────────────────────────────────────────────────────────────────
function ManuscriptOrnament({ size = 18 }: { size?: number }) {
  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(glow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.Text style={[{ fontSize: size, color: Colors.celestialGold, lineHeight: size + 4 }, style]}>
      ✦
    </Animated.Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Entry
// ─────────────────────────────────────────────────────────────────────────────
function TimelineEntry({ milestone, isLast }: { milestone: Milestone; isLast: boolean }) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 500 });
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const badgeColor = milestone.type === 'first'
    ? Colors.celestialGold
    : milestone.type === 'favorite'
    ? Colors.accentPink
    : Colors.softPurple;

  return (
    <Animated.View style={[styles.timelineEntry, style]}>
      {/* Timeline line */}
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: badgeColor, shadowColor: badgeColor }]}>
          <Text style={styles.timelineDotEmoji}>{milestone.emoji}</Text>
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Entry card */}
      <View style={styles.entryCard}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={[`${badgeColor}10`, 'transparent']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        {/* Manuscript left border */}
        <View style={[styles.entryAccent, { backgroundColor: badgeColor }]} />

        <View style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <View style={[styles.typeBadge, { backgroundColor: `${badgeColor}20`, borderColor: `${badgeColor}40` }]}>
              <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
                {MILESTONE_EMOJIS.find((m) => m.type === milestone.type)?.label ?? milestone.type}
              </Text>
            </View>
            <Text style={styles.entryDate}>
              {new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <Text style={styles.entryTitle}>{milestone.title}</Text>
          {milestone.description.length > 0 && (
            <Text style={styles.entryDescription}>{milestone.description}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Growth Theme card
// ─────────────────────────────────────────────────────────────────────────────
function GrowthThemeCard({ theme, index }: { theme: GrowthTheme; index: number }) {
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(index * 150, withTiming(1, { duration: 500 }));
    transY.value  = withDelay(index * 150, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    return () => { cancelAnimation(opacity); cancelAnimation(transY); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }],
  }));

  const barWidth = Math.min((theme.count / 10) * 100, 100);

  return (
    <Animated.View style={[styles.growthCard, style]}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(255,215,0,0.06)', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
      />
      <Text style={styles.growthEmoji}>{theme.emoji}</Text>
      <View style={styles.growthInfo}>
        <Text style={styles.growthTheme}>{theme.theme}</Text>
        <Text style={styles.growthDesc}>{theme.description}</Text>
        {/* Progress bar */}
        <View style={styles.growthBarTrack}>
          <View style={[styles.growthBarFill, { width: `${barWidth}%` as `${number}%` }]} />
        </View>
      </View>
      <View style={styles.growthCount}>
        <Text style={styles.growthCountNum}>{theme.count}</Text>
        <Text style={styles.growthCountLabel}>stories</Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function MilestoneBookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [milestones,     setMilestones]     = useState<Milestone[]>([]);
  const [growthThemes,   setGrowthThemes]   = useState<GrowthTheme[]>([]);
  const [activeTab,      setActiveTab]      = useState<'timeline' | 'growth'>('timeline');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [isLoadingThemes,   setIsLoadingThemes]   = useState(false);
  const [newMilestone,   setNewMilestone]   = useState<Partial<Milestone>>({
    type: 'first', emoji: '⭐', title: '', description: '',
  });

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Ornamental glow
  const ornamentGlow = useSharedValue(0.6);

  useEffect(() => {
    headerOpacity.value  = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    void loadMilestones();

    ornamentGlow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(ornamentGlow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load growth themes when switching to growth tab
  useEffect(() => {
    if (activeTab === 'growth' && growthThemes.length === 0) {
      void loadGrowthThemes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMilestones = async () => {
    try {
      const raw = await AsyncStorage.getItem(`milestones_${user?.id ?? 'local'}`);
      if (raw) {
        setMilestones(JSON.parse(raw) as Milestone[]);
      } else {
        // Seed with example milestones
        const seeds: Milestone[] = [
          {
            id:          'seed_1',
            type:        'first',
            emoji:       '⭐',
            title:       'First Bedtime Story',
            description: 'The night we discovered the magic of StoryVoice together.',
            date:        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id:          'seed_2',
            type:        'favorite',
            emoji:       '💛',
            title:       'Favourite Narrator Chosen',
            description: "Luna the Owl became our nightly companion.",
            date:        new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
        setMilestones(seeds);
      }
    } catch {
      // non-fatal
    }
  };

  const loadGrowthThemes = async () => {
    setIsLoadingThemes(true);
    try {
      // Get recent stories
      const storiesRaw = await AsyncStorage.getItem('local_stories');
      const stories: LocalStory[] = storiesRaw ? JSON.parse(storiesRaw) : [];
      if (stories.length === 0) {
        // Default themes when no stories
        setGrowthThemes([
          { theme: 'Kindness',     emoji: '💛', description: 'Acts of generosity and care',    count: 0 },
          { theme: 'Bravery',      emoji: '🦁', description: 'Facing fears with courage',      count: 0 },
          { theme: 'Curiosity',    emoji: '🔭', description: 'Wonder and love of learning',    count: 0 },
        ]);
        return;
      }
      const recentStories = stories.slice(0, 8);
      const prompt = buildGrowthThemesPrompt(
        recentStories.map((s) => s.title),
        recentStories.map((s) => s.content ?? '')
      );
      const raw = await generateText({ prompt });
      if (raw) {
        try {
          const jsonStart = raw.indexOf('[');
          const jsonEnd   = raw.lastIndexOf(']') + 1;
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            const themes = JSON.parse(raw.slice(jsonStart, jsonEnd)) as GrowthTheme[];
            setGrowthThemes(themes.slice(0, 3));
            return;
          }
        } catch {
          // fall through to defaults
        }
      }
      setGrowthThemes([
        { theme: 'Kindness',  emoji: '💛', description: 'Acts of generosity and care',  count: recentStories.length },
        { theme: 'Bravery',   emoji: '🦁', description: 'Facing fears with courage',    count: Math.floor(recentStories.length * 0.7) },
        { theme: 'Curiosity', emoji: '🔭', description: 'Wonder and love of learning',  count: Math.floor(recentStories.length * 0.5) },
      ]);
    } catch (err) {
      console.error('[MilestoneBook] loadGrowthThemes error:', err);
    } finally {
      setIsLoadingThemes(false);
    }
  };

  const handleSaveMilestone = useCallback(async () => {
    if (!newMilestone.title?.trim()) {
      Alert.alert('Add a title', 'Please enter a title for this milestone.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const milestone: Milestone = {
      id:          `m_${Date.now()}`,
      type:        newMilestone.type ?? 'memory',
      emoji:       newMilestone.emoji ?? '🌟',
      title:       newMilestone.title.trim(),
      description: newMilestone.description?.trim() ?? '',
      date:        new Date().toISOString(),
    };
    const updated = [milestone, ...milestones];
    setMilestones(updated);
    await AsyncStorage.setItem(`milestones_${user?.id ?? 'local'}`, JSON.stringify(updated));
    setIsAddingMilestone(false);
    setNewMilestone({ type: 'first', emoji: '⭐', title: '', description: '' });
  }, [newMilestone, milestones, user?.id]);

  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const ornamentStyle = useAnimatedStyle(() => ({ opacity: ornamentGlow.value }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0E24', '#1A1B41', '#2A1150']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={40} />

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
          <View style={styles.headerCenter}>
            <Animated.Text style={[styles.headerOrnament, ornamentStyle]}>✦</Animated.Text>
            <Text style={styles.headerTitle}>Memory Book</Text>
            <Animated.Text style={[styles.headerOrnament, ornamentStyle]}>✦</Animated.Text>
          </View>
          <View style={{ width: 60 }} />
        </Animated.View>

        {/* Illuminated manuscript banner */}
        <Animated.View style={[styles.manuscriptBanner, contentStyle]}>
          <LinearGradient
            colors={['rgba(255,215,0,0.12)', 'rgba(107,72,184,0.1)', 'rgba(255,215,0,0.06)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          {/* Corner ornaments */}
          <View style={styles.cornerTL}><Text style={styles.cornerOrnament}>❧</Text></View>
          <View style={styles.cornerBR}><Text style={styles.cornerOrnament}>❧</Text></View>
          <View style={styles.cornerTR}><Text style={styles.cornerOrnamentAlt}>❧</Text></View>
          <View style={styles.cornerBL}><Text style={styles.cornerOrnamentAlt}>❧</Text></View>

          <ManuscriptOrnament size={20} />
          <Text style={styles.manuscriptTitle}>The Illuminated Chronicle</Text>
          <ManuscriptOrnament size={16} />
          <Text style={styles.manuscriptSubtitle}>
            A treasury of firsts, favourites & milestones
          </Text>
          <Text style={styles.manuscriptDate}>
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </Animated.View>

        {/* Tab bar */}
        <Animated.View style={[styles.tabBar, contentStyle]}>
          {(['timeline', 'growth'] as const).map((tab) => (
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
                  colors={['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                />
              )}
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'timeline' ? '📜 Timeline' : '🌱 Growth Themes'}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* ── Timeline Tab ───────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <>
              {/* Add milestone button */}
              <TouchableOpacity
                style={styles.addMilestoneBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsAddingMilestone(!isAddingMilestone);
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.03)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
                <Text style={styles.addMilestoneBtnIcon}>{isAddingMilestone ? '✕' : '+'}</Text>
                <Text style={styles.addMilestoneBtnText}>
                  {isAddingMilestone ? 'Cancel' : 'Record a Milestone'}
                </Text>
              </TouchableOpacity>

              {/* Add milestone form */}
              {isAddingMilestone && (
                <View style={styles.addForm}>
                  {Platform.OS === 'ios' && (
                    <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={styles.addFormTitle}>New Milestone</Text>

                  {/* Type selector */}
                  <View style={styles.typeRow}>
                    {MILESTONE_EMOJIS.map((m) => (
                      <TouchableOpacity
                        key={m.type}
                        style={[styles.typeBtn, newMilestone.type === m.type && styles.typeBtnActive]}
                        onPress={() => setNewMilestone((prev) => ({ ...prev, type: m.type, emoji: m.emoji }))}
                      >
                        {newMilestone.type === m.type && (
                          <LinearGradient
                            colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.05)']}
                            style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
                          />
                        )}
                        <Text style={styles.typeBtnEmoji}>{m.emoji}</Text>
                        <Text style={[styles.typeBtnLabel, newMilestone.type === m.type && { color: Colors.celestialGold }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.formInput}
                    value={newMilestone.title}
                    onChangeText={(v) => setNewMilestone((prev) => ({ ...prev, title: v }))}
                    placeholder="Title (e.g. First full night sleeping)"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={60}
                  />
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={newMilestone.description}
                    onChangeText={(v) => setNewMilestone((prev) => ({ ...prev, description: v }))}
                    placeholder="Add a note… (optional)"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                  />

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => void handleSaveMilestone()}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.celestialGold, Colors.softGold]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={styles.saveBtnText}>Save to Memory Book</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Timeline */}
              {milestones.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📖</Text>
                  <Text style={styles.emptyTitle}>Your chronicle awaits</Text>
                  <Text style={styles.emptyText}>
                    Record milestones, firsts, and favourite moments to fill your Memory Book.
                  </Text>
                </View>
              ) : (
                <View style={styles.timeline}>
                  {milestones.map((m, i) => (
                    <TimelineEntry key={m.id} milestone={m} isLast={i === milestones.length - 1} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* ── Growth Themes Tab ──────────────────────────────────────── */}
          {activeTab === 'growth' && (
            <>
              <View style={styles.growthHeader}>
                <Text style={styles.growthHeaderTitle}>Themes of Growth</Text>
                <Text style={styles.growthHeaderSubtitle}>
                  AI-extracted from this month&apos;s stories — the values your child is absorbing.
                </Text>
              </View>

              {isLoadingThemes ? (
                <View style={styles.loadingState}>
                  <Text style={styles.loadingEmoji}>🌱</Text>
                  <Text style={styles.loadingText}>Analysing your stories for growth themes…</Text>
                </View>
              ) : growthThemes.length > 0 ? (
                <>
                  {growthThemes.map((t, i) => (
                    <GrowthThemeCard key={t.theme} theme={t} index={i} />
                  ))}

                  {/* Insights card */}
                  <View style={styles.insightsCard}>
                    {Platform.OS === 'ios' && (
                      <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
                    )}
                    <LinearGradient
                      colors={['rgba(107,72,184,0.15)', 'transparent']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                    />
                    <Text style={styles.insightsTitle}>💡 Parent Insight</Text>
                    <Text style={styles.insightsText}>
                      These themes reflect the values being gently woven into each bedtime story.
                      The stories you create are shaping how your child sees the world.
                    </Text>
                    <TouchableOpacity
                      style={styles.refreshBtn}
                      onPress={() => { setGrowthThemes([]); void loadGrowthThemes(); }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.refreshBtnText}>↻  Refresh Themes</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyTitle}>No stories yet</Text>
                  <Text style={styles.emptyText}>
                    Create some stories to see the growth themes emerging from your bedtime sessions.
                  </Text>
                  <TouchableOpacity
                    style={styles.createStoryBtn}
                    onPress={() => router.push('/(main)/create-story')}
                  >
                    <Text style={styles.createStoryBtnText}>Create a Story</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  scroll:    { paddingHorizontal: Spacing.lg },

  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.lg,
  },
  backBtn:    { paddingVertical: 8, minWidth: 60 },
  backText:   { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerOrnament: { fontSize: 16, color: Colors.celestialGold },
  headerTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   20,
    color:      Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  // Illuminated manuscript banner
  manuscriptBanner: {
    borderRadius:    Radius.xl,
    borderWidth:     1.5,
    borderColor:     'rgba(255,215,0,0.3)',
    padding:         Spacing.xl,
    marginBottom:    Spacing.lg,
    alignItems:      'center',
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.8)' : 'rgba(26,27,65,0.95)',
    gap:             Spacing.xs,
  },
  cornerTL:   { position: 'absolute', top: 8, left: 10 },
  cornerBR:   { position: 'absolute', bottom: 8, right: 10 },
  cornerTR:   { position: 'absolute', top: 8, right: 10 },
  cornerBL:   { position: 'absolute', bottom: 8, left: 10 },
  cornerOrnament:    { fontSize: 16, color: 'rgba(255,215,0,0.6)' },
  cornerOrnamentAlt: { fontSize: 16, color: 'rgba(255,215,0,0.6)', transform: [{ scaleX: -1 }] },
  manuscriptTitle: {
    fontFamily:    Fonts.black,
    fontSize:      20,
    color:         Colors.celestialGold,
    letterSpacing: 1,
    textAlign:     'center',
  },
  manuscriptSubtitle: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      Colors.textMuted,
    textAlign:  'center',
    fontStyle:  'italic',
    lineHeight: 20,
  },
  manuscriptDate: {
    fontFamily: Fonts.medium,
    fontSize:   11,
    color:      'rgba(255,215,0,0.5)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop:  Spacing.xs,
  },

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
  tabText:       { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted },
  tabTextActive: { color: Colors.celestialGold },

  // Add milestone button
  addMilestoneBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
    paddingVertical: Spacing.md,
    marginBottom:    Spacing.md,
    overflow:        'hidden',
    gap:             Spacing.sm,
  },
  addMilestoneBtnIcon: { fontFamily: Fonts.black, fontSize: 18, color: Colors.celestialGold },
  addMilestoneBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },

  // Add form
  addForm: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.8)' : 'rgba(26,27,65,0.95)',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.2)',
    padding:         Spacing.lg,
    marginBottom:    Spacing.lg,
    overflow:        'hidden',
    gap:             Spacing.md,
  },
  addFormTitle: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 10,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    gap:             4,
  },
  typeBtnActive: { borderColor: Colors.celestialGold },
  typeBtnEmoji:  { fontSize: 20 },
  typeBtnLabel:  { fontFamily: Fonts.bold, fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  formInput: {
    backgroundColor: Colors.inputBg,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    fontFamily:      Fonts.regular,
    fontSize:        14,
    color:           Colors.moonlightCream,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  formTextArea: {
    minHeight:   80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius:  Radius.full,
    overflow:      'hidden',
    paddingVertical: 14,
    alignItems:    'center',
  },
  saveBtnText: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.deepSpace },

  // Timeline
  timeline: { gap: 0 },
  timelineEntry: {
    flexDirection: 'row',
    gap:           Spacing.md,
    marginBottom:  Spacing.sm,
  },
  timelineLeft: {
    alignItems:  'center',
    width:       44,
  },
  timelineDot: {
    width:        44,
    height:       44,
    borderRadius: 22,
    alignItems:   'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation:    6,
  },
  timelineDotEmoji: { fontSize: 18 },
  timelineLine: {
    flex:            1,
    width:           2,
    backgroundColor: 'rgba(255,215,0,0.15)',
    marginTop:       4,
    marginBottom:    -4,
  },
  entryCard: {
    flex:            1,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.12)',
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.9)',
    marginBottom:    Spacing.md,
    flexDirection:   'row',
  },
  entryAccent: { width: 3, borderTopLeftRadius: Radius.lg, borderBottomLeftRadius: Radius.lg },
  entryContent: { flex: 1, padding: Spacing.md, gap: 4 },
  entryHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    borderRadius:    Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth:     1,
  },
  typeBadgeText: { fontFamily: Fonts.bold, fontSize: 10 },
  entryDate: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textMuted },
  entryTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.moonlightCream, lineHeight: 22 },
  entryDescription: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  // Growth themes
  growthHeader: { marginBottom: Spacing.lg },
  growthHeaderTitle: { fontFamily: Fonts.black, fontSize: 20, color: Colors.moonlightCream, marginBottom: 6 },
  growthHeaderSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 20 },

  growthCard: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.15)',
    padding:         Spacing.md,
    marginBottom:    Spacing.md,
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.9)',
    gap:             Spacing.md,
  },
  growthEmoji: { fontSize: 32 },
  growthInfo:  { flex: 1 },
  growthTheme: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  growthDesc:  { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  growthBarTrack: {
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,215,0,0.12)',
    overflow:        'hidden',
  },
  growthBarFill: {
    height:          '100%',
    backgroundColor: Colors.celestialGold,
    borderRadius:    2,
  },
  growthCount: { alignItems: 'center' },
  growthCountNum: { fontFamily: Fonts.black, fontSize: 20, color: Colors.celestialGold },
  growthCountLabel: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textMuted },

  insightsCard: {
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(107,72,184,0.3)',
    padding:         Spacing.lg,
    marginBottom:    Spacing.lg,
    overflow:        'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,14,36,0.7)' : 'rgba(26,27,65,0.9)',
    gap:             Spacing.md,
  },
  insightsTitle: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream },
  insightsText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  refreshBtn: {
    alignSelf:        'flex-start',
    borderRadius:     Radius.full,
    paddingHorizontal: 16,
    paddingVertical:  8,
    borderWidth:      1,
    borderColor:      'rgba(107,72,184,0.4)',
    backgroundColor:  'rgba(107,72,184,0.1)',
  },
  refreshBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.softPurple },

  // Empty / loading states
  emptyState: {
    alignItems:      'center',
    paddingVertical: Spacing.xxl,
    gap:             Spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream, textAlign: 'center' },
  emptyText:  { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  createStoryBtn: {
    marginTop:         Spacing.sm,
    borderRadius:      Radius.full,
    paddingHorizontal: 24,
    paddingVertical:   12,
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.3)',
    backgroundColor:   'rgba(255,215,0,0.08)',
  },
  createStoryBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },

  loadingState: {
    alignItems:      'center',
    paddingVertical: Spacing.xxl,
    gap:             Spacing.md,
  },
  loadingEmoji: { fontSize: 40 },
  loadingText:  { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
