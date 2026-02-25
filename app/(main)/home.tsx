import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Dimensions,
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
  useAnimatedScrollHandler,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import BreathingGradient from '@/components/BreathingGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import StardustLoader from '@/components/StardustLoader';
import ParentalGate from '@/components/ParentalGate';
import MagicSyncModal, { type MagicSyncState } from '@/components/MagicSyncModal';
import NarratorGallery from '@/components/NarratorGallery';
import CollectionModal from '@/components/CollectionModal';
import StarsPaywall from '@/components/StarsPaywall';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import {
  toggleStoryFavorite,
  upsertUserPreferences,
  isSupabaseAvailable,
} from '@/lib/supabase';
import type { Child, ParentVoice, Story } from '@/lib/supabase';
import { loadHybridData } from '@/lib/syncService';
import {
  detectLocalData,
  migrateLocalDataToCloud,
  type LocalDataSummary,
  type MigrationResult,
} from '@/lib/migrationService';
import { NARRATOR_PERSONALITIES, buildWelcomeGreetingPrompt } from '@/lib/newell';
import { generateText } from '@fastshot/ai';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = Math.min((W - Spacing.lg * 2 - 12) / 2, 180);

const THEME_EMOJI: Record<string, string> = {
  adventurous: '🗺️',
  calming:     '🌙',
  funny:       '😄',
  educational: '📚',
};

const THEME_COLORS: Record<string, string> = {
  adventurous: '#FF8C42',
  calming:     '#7EC8E3',
  funny:       '#FF6B9D',
  educational: '#6BCB77',
};

type BookshelfTab = 'all' | 'favorites';

// ─────────────────────────────────────────────────────────────────────────────
// Story card for horizontal scroll
// ─────────────────────────────────────────────────────────────────────────────
function StoryCard({
  story,
  onPress,
  onToggleFavorite,
}: {
  story: Story;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const themeKey   = story.theme?.toLowerCase() ?? '';
  const emoji      = THEME_EMOJI[themeKey] ?? '📖';
  const accent     = THEME_COLORS[themeKey] ?? Colors.softPurple;
  const heartScale = useSharedValue(1);

  const handleFavorite = () => {
    heartScale.value = withSpring(1.5, { damping: 3, stiffness: 280 }, () => {
      heartScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Haptics.notificationAsync(
      story.is_favorite
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    );
    onToggleFavorite();
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <TouchableOpacity
      style={[styles.storyCard, { width: CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={story.content ? 0.8 : 1}
    >
      {/* Glass blur layer */}
      {Platform.OS !== 'web' && (
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      {/* Glass gradient */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      {/* Accent colour tint */}
      <LinearGradient
        colors={[`${accent}18`, `${accent}05`]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      {/* Top shine edge */}
      <View style={styles.glassTopEdge} />

      {/* Glass sphere emoji badge */}
      <View style={[styles.storyCardEmojiBg, { backgroundColor: `${accent}22`, borderColor: `${accent}35` }]}>
        <Text style={styles.storyCardEmoji}>{emoji}</Text>
        {/* Inner highlight */}
        <View style={styles.storyCardEmojiGlow} />
      </View>
      <Text style={styles.storyCardTitle} numberOfLines={3}>{story.title}</Text>
      {story.content == null ? (
        <View style={styles.generatingRow}>
          <View style={[styles.generatingDot, { backgroundColor: accent }]} />
          <Text style={styles.generatingText}>Generating…</Text>
        </View>
      ) : (
        <Text style={[styles.storyCardPlay, { color: accent }]}>Tap to read ›</Text>
      )}
      {/* Favourite button */}
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={handleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.Text style={[styles.heartIcon, heartStyle]}>
          {story.is_favorite ? '❤️' : '🤍'}
        </Animated.Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bookshelf tab switcher
// ─────────────────────────────────────────────────────────────────────────────
function TabSwitcher({
  activeTab,
  favCount,
  onSwitch,
}: {
  activeTab: BookshelfTab;
  favCount: number;
  onSwitch: (tab: BookshelfTab) => void;
}) {
  const indicatorPos = useSharedValue(activeTab === 'all' ? 0 : 1);

  useEffect(() => {
    indicatorPos.value = withSpring(activeTab === 'all' ? 0 : 1, {
      damping: 18,
      stiffness: 260,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabW = (W - Spacing.lg * 2 - 6) / 2;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          indicatorPos.value,
          [0, 1],
          [3, tabW + 3],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const handlePress = (tab: BookshelfTab) => {
    if (tab === activeTab) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwitch(tab);
  };

  return (
    <View style={styles.tabBar}>
      {Platform.OS !== 'web' && (
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      {/* Glass tab bar background */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
      />
      {/* Sliding indicator (frosted glass pill) */}
      <Animated.View style={[styles.tabIndicator, { width: tabW - 6 }, indicatorStyle]} />

      {/* All Stories tab */}
      <TouchableOpacity
        style={[styles.tabButton, { width: tabW }]}
        onPress={() => handlePress('all')}
        activeOpacity={0.75}
      >
        <Text style={[styles.tabLabel, activeTab === 'all' && styles.tabLabelActive]}>
          ✨ All Stories
        </Text>
      </TouchableOpacity>

      {/* Favorites tab */}
      <TouchableOpacity
        style={[styles.tabButton, { width: tabW }]}
        onPress={() => handlePress('favorites')}
        activeOpacity={0.75}
      >
        <Text style={[styles.tabLabel, activeTab === 'favorites' && styles.tabLabelActive]}>
          ❤️ Favourites{favCount > 0 ? ` (${favCount})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating empty-state for Story Library
// ─────────────────────────────────────────────────────────────────────────────
function EmptyStoryLibrary({ onCreateStory }: { onCreateStory: () => void }) {
  const floatY      = useSharedValue(0);
  const glowPulse   = useSharedValue(0.6);
  const btnScale    = useSharedValue(1);

  useEffect(() => {
    // Gentle float: 8 px up/down, 3-second cycle
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(  0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // Crystal button glow breathing
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(floatY);
      cancelAnimation(glowPulse);
      cancelAnimation(btnScale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowPulse.value * 0.65,
    shadowRadius:  interpolate(glowPulse.value, [0.5, 1], [8, 24], Extrapolation.CLAMP),
  }));

  const btnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handlePressIn = () => {
    btnScale.value = withTiming(0.95, { duration: 100 });
  };
  const handlePressOut = () => {
    btnScale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  return (
    <View style={emptyStyles.wrapper}>
      <Animated.View style={[emptyStyles.floatGroup, floatStyle]}>
        <StardustLoader size={52} color={Colors.celestialGold} />
        <Text style={emptyStyles.title}>Your Story Library</Text>
        <Text style={emptyStyles.subtitle}>
          Each night a new adventure{'\n'}waits to be written just for you ✨
        </Text>
      </Animated.View>

      {/* Crystal "Begin Your First Adventure" button */}
      <Animated.View style={[emptyStyles.crystalBtnWrapper, glowStyle, btnPressStyle]}>
        <TouchableOpacity
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCreateStory();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          {/* Frosted glass base */}
          {Platform.OS !== 'web' && (
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={[Colors.celestialGold, Colors.softGold, '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={emptyStyles.crystalBtnGradient}
          >
            {/* Specular top-left edge */}
            <View style={emptyStyles.crystalBtnEdge} />
            <Text style={emptyStyles.crystalBtnIcon}>🪄</Text>
            <Text style={emptyStyles.crystalBtnLabel}>Begin Your First Adventure</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrapper: {
    alignItems:   'center',
    paddingVertical: Spacing.xl,
    gap:          Spacing.xl,
  },
  floatGroup: {
    alignItems: 'center',
    gap:        Spacing.md,
  },
  title: {
    fontFamily:      Fonts.extraBold,
    fontSize:        20,
    color:           '#FFFFFF',
    textAlign:       'center',
    letterSpacing:   0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset:{ width: 0, height: 1 },
    textShadowRadius:8,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize:   14,
    color:      'rgba(240,235,248,0.60)',
    textAlign:  'center',
    lineHeight: 22,
  },
  crystalBtnWrapper: {
    borderRadius: Radius.full,
    overflow:     'hidden',
    borderWidth:  1.5,
    borderColor:  'rgba(255,215,0,0.55)',
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    elevation:    14,
  },
  crystalBtnGradient: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   18,
    paddingHorizontal: 32,
    gap:               10,
    borderRadius:      Radius.full,
    overflow:          'hidden',
  },
  crystalBtnEdge: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderRadius:    1,
  },
  crystalBtnIcon:  { fontSize: 22 },
  crystalBtnLabel: {
    fontFamily:      Fonts.black,
    fontSize:        16,
    color:           Colors.deepSpace,
    letterSpacing:   0.3,
    textShadowColor: 'rgba(255,255,255,0.25)',
    textShadowOffset:{ width: 0, height: 1 },
    textShadowRadius:3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [child,          setChild]          = useState<Child | null>(null);
  const [voices,         setVoices]         = useState<ParentVoice[]>([]);
  const [stories,        setStories]        = useState<Story[]>([]);
  const [activeVoiceId,  setActiveVoiceId]  = useState<string | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [, setIsLoading]                   = useState(true);
  const [activeTab,      setActiveTab]      = useState<BookshelfTab>('all');

  // Phase 4: Collections & Paywall
  const [showCollections, setShowCollections] = useState(false);
  const [showPaywall,     setShowPaywall]     = useState(false);

  // ── Bookshelf tab content opacity (animated crossfade)
  const tabContentOpacity = useSharedValue(1);

  // Parental Gate
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [gateContext,      setGateContext]       = useState<string | undefined>(undefined);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // ── Magic Sync (migration) state
  const [magicSyncVisible,    setMagicSyncVisible]    = useState(false);
  const [migrationSummary,    setMigrationSummary]    = useState<LocalDataSummary | null>(null);
  const [migrationSyncState,  setMigrationSyncState]  = useState<MagicSyncState>('idle');
  const [migrationResult,     setMigrationResult]     = useState<MigrationResult | null>(null);
  const migrationCheckedRef = useRef(false);

  // ── Welcome Home Greeting state
  const [showGreeting,      setShowGreeting]      = useState(false);
  const [greetingText,      setGreetingText]      = useState('');
  const [greetingNarrator,  setGreetingNarrator]  = useState(NARRATOR_PERSONALITIES[0]);
  const greetingOpacity = useSharedValue(0);
  const greetingScale   = useSharedValue(0.9);

  const requireParentalGate = useCallback((context: string, action: () => void) => {
    pendingActionRef.current = action;
    setGateContext(context);
    setShowParentalGate(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGateSuccess = useCallback(() => {
    setShowParentalGate(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  }, []);

  const handleGateDismiss = useCallback(() => {
    setShowParentalGate(false);
    pendingActionRef.current = null;
  }, []);

  // track whether favorites section was visible last render
  const prevHadFavoritesRef = useRef(false);

  // Entrance animations
  // Entrance animations — opacity + subtle scale gives glass panels a
  // "frosting / crystallising" feel as they materialise over the background
  const headerOpacity  = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const headerScale    = useSharedValue(1.04);
  const contentScale   = useSharedValue(1.03);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const recentStories   = stories.slice(0, 10);
  const favoriteStories = stories.filter((s) => s.is_favorite);

  // ── Animated tab content ─────────────────────────────────────────────────────
  const tabContentStyle = useAnimatedStyle(() => ({ opacity: tabContentOpacity.value }));

  const switchTab = useCallback((tab: BookshelfTab) => {
    LayoutAnimation.configureNext({
      duration: 280,
      create:  { type: 'easeInEaseOut', property: 'opacity' },
      update:  { type: 'spring', springDamping: 0.75 },
      delete:  { type: 'easeInEaseOut', property: 'opacity' },
    });
    // Crossfade content
    tabContentOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) }, () => {
      tabContentOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) });
    });
    setActiveTab(tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedVoiceId = await AsyncStorage.getItem('active_voice_id');
      if (savedVoiceId) setActiveVoiceId(savedVoiceId);

      const data = await loadHybridData(user?.id ?? null);

      if (data.children.length > 0) {
        setChild(data.children[0]);
      }
      if (data.voices.length > 0) {
        setVoices(data.voices);
        if (!savedVoiceId && data.voices[0]) {
          setActiveVoiceId(data.voices[0].id);
          await AsyncStorage.setItem('active_voice_id', data.voices[0].id);
        }
      }
      if (data.stories.length > 0) {
        setStories(data.stories);
      }
      if (data.preferences?.active_voice_id) {
        setActiveVoiceId(data.preferences.active_voice_id);
      }
    } catch {
      try {
        const local = await AsyncStorage.getItem('pending_child_profile');
        if (local) setChild(JSON.parse(local) as Child);
        const localStories = await AsyncStorage.getItem('local_stories');
        if (localStories) {
          const parsed = JSON.parse(localStories) as Story[];
          setStories(parsed.map((s) => ({ ...s, is_favorite: s.is_favorite ?? false })));
        }
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // ── Migration check (runs once after user authenticates) ──────────────────
  const checkForMigration = useCallback(async (uid: string) => {
    if (migrationCheckedRef.current) return;
    migrationCheckedRef.current = true;
    if (!isSupabaseAvailable) return;
    try {
      const summary = await detectLocalData(uid);
      if (summary.hasLocalData) {
        setMigrationSummary(summary);
        setMigrationSyncState('idle');
        setMagicSyncVisible(true);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadData();
    // Opacity + scale fade-in: glass panels crystallise into view
    headerOpacity.value  = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    headerScale.value    = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.05)) });
    contentOpacity.value = withDelay(280, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    contentScale.value   = withDelay(280, withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.05)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  // Run migration check once user is available
  useEffect(() => {
    if (user?.id) {
      void checkForMigration(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Welcome Home Greeting check ───────────────────────────────────────────
  // Triggers after the app hasn't been opened for > 3 hours
  useEffect(() => {
    void checkAndShowGreeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAndShowGreeting = async () => {
    try {
      const lastOpenRaw = await AsyncStorage.getItem('last_app_open');
      const now = Date.now();
      const THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours

      // Save current open time
      await AsyncStorage.setItem('last_app_open', String(now));

      // Only show greeting if it's been > 3 hours since last open
      if (!lastOpenRaw || (now - parseInt(lastOpenRaw, 10)) < THRESHOLD_MS) return;

      // Get selected narrator
      const narratorId = await AsyncStorage.getItem('selected_narrator_id');
      const narrator = NARRATOR_PERSONALITIES.find((n) => n.id === narratorId) ?? NARRATOR_PERSONALITIES[0];
      setGreetingNarrator(narrator);

      // Get child name
      const childRaw = await AsyncStorage.getItem('pending_child_profile');
      const childProfile = childRaw ? JSON.parse(childRaw) as { name?: string } : null;
      const childName = childProfile?.name ?? 'little one';

      // Determine time of day
      const hour = new Date().getHours();
      const timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' =
        hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

      try {
        const prompt = buildWelcomeGreetingPrompt(narrator, childName, timeOfDay);
        const greeting = await generateText({ prompt });
        if (greeting?.trim()) {
          setGreetingText(greeting.trim());
        } else {
          setGreetingText(`Welcome back! ${childName} will love tonight's bedtime story. Shall we create one together?`);
        }
      } catch {
        setGreetingText(`Welcome back! Time for a magical bedtime story. ${narrator.previewText}`);
      }

      setShowGreeting(true);
      greetingOpacity.value = withTiming(1, { duration: 600 });
      greetingScale.value   = withSpring(1, { damping: 14, stiffness: 100 });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[WelcomeGreeting] error:', err);
    }
  };

  // Animate layout when favorites count changes
  useEffect(() => {
    const hasFavs = favoriteStories.length > 0;
    if (hasFavs !== prevHadFavoritesRef.current) {
      LayoutAnimation.configureNext({
        duration: 320,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      prevHadFavoritesRef.current = hasFavs;
    }
  }, [favoriteStories.length]);

  // ── Migration handlers ──────────────────────────────────────────────────────
  const handleMigrationConfirm = useCallback(async () => {
    if (!user?.id || !migrationSummary) return;
    setMigrationSyncState('syncing');
    try {
      const result = await migrateLocalDataToCloud(user.id, migrationSummary);
      setMigrationResult(result);
      setMigrationSyncState(result.success || result.totalMigrated > 0 ? 'success' : 'error');
      // Reload data with fresh cloud records
      if (result.totalMigrated > 0) {
        await loadData();
      }
    } catch {
      setMigrationSyncState('error');
    }
  }, [user?.id, migrationSummary, loadData]);

  const handleMigrationDismiss = useCallback(() => {
    setMagicSyncVisible(false);
    setMigrationSyncState('idle');
    setMigrationResult(null);
  }, []);

  // ── Toggle favourite ──────────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback(async (storyId: string) => {
    const updatedStories = stories.map((s) =>
      s.id === storyId ? { ...s, is_favorite: !s.is_favorite } : s
    );
    setStories(updatedStories);

    await AsyncStorage.setItem('local_stories', JSON.stringify(updatedStories.slice(0, 20)));

    const raw = await AsyncStorage.getItem('current_story');
    if (raw) {
      const current = JSON.parse(raw) as { id?: string };
      if (current.id === storyId) {
        const updated = updatedStories.find((s) => s.id === storyId);
        await AsyncStorage.setItem('current_story', JSON.stringify({ ...current, is_favorite: updated?.is_favorite }));
      }
    }

    if (isSupabaseAvailable && user?.id) {
      const updated = updatedStories.find((s) => s.id === storyId);
      await toggleStoryFavorite(storyId, updated?.is_favorite ?? false);
    }
  }, [stories, user?.id]);

  // ── Open a story on the player ────────────────────────────────────────────────
  const openStory = useCallback(async (story: Story) => {
    if (!story.content) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const imageUrl = story.image_url ?? (story as unknown as { imageUrl?: string }).imageUrl ?? null;
    const createdAt = story.created_at ?? (story as unknown as { createdAt?: string }).createdAt ?? new Date().toISOString();
    await AsyncStorage.setItem('current_story', JSON.stringify({
      id:          story.id,
      title:       story.title,
      content:     story.content,
      imageUrl,
      childName:   child?.name ?? (story as unknown as { childName?: string }).childName ?? 'your child',
      theme:       story.theme ?? '',
      createdAt,
      is_favorite: story.is_favorite,
    }));
    router.push('/(main)/player');
  }, [child?.name, router]);

  // ── Play Series ────────────────────────────────────────────────────────────────
  const handlePlaySeries = useCallback(async (storyIds: string[]) => {
    if (storyIds.length === 0) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Store the full series queue
    await AsyncStorage.setItem('series_queue', JSON.stringify(storyIds));

    // Navigate to the first story
    const firstStory = stories.find((s) => s.id === storyIds[0]);
    if (firstStory) {
      await openStory(firstStory);
    }
  }, [stories, openStory]);

  // ── Voice switching ────────────────────────────────────────────────────────────
  const handleSelectVoice = useCallback(async (voice: ParentVoice) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveVoiceId(voice.id);
    setShowVoiceModal(false);
    await AsyncStorage.setItem('active_voice_id',    voice.id);
    await AsyncStorage.setItem('selected_voice_type', voice.voice_type);
    if (isSupabaseAvailable && user?.id) {
      await upsertUserPreferences(user.id, { active_voice_id: voice.id });
    }
  }, [user?.id]);

  // Scroll parallax tracking
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Parallax style for glass cards (move slightly slower = depth illusion)
  const parallaxCardsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, 400], [0, -10], Extrapolation.CLAMP) }],
  }));

  const headerStyle  = useAnimatedStyle(() => ({
    opacity:   headerOpacity.value,
    transform: [{ scale: headerScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));
  const activeVoice  = voices.find((v) => v.id === activeVoiceId) ?? voices[0] ?? null;

  const greetingStyle = useAnimatedStyle(() => ({
    opacity:   greetingOpacity.value,
    transform: [{ scale: greetingScale.value }],
  }));

  // ── Story section renderer ─────────────────────────────────────────────────────
  const renderStoryList = (data: Story[], emptyMsg?: string) => {
    if (data.length === 0 && !emptyMsg) return null;
    return (
      <>
        {data.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>{emptyMsg}</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StoryCard
                story={item}
                onPress={() => void openStory(item)}
                onToggleFavorite={() => void handleToggleFavorite(item.id)}
              />
            )}
          />
        )}
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Crystal Night breathing gradient */}
      <BreathingGradient />
      <StarField count={55} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View>
            <Text style={styles.greeting}>Good evening 🌙</Text>
            <Text style={styles.userName}>
              {user?.email?.split('@')[0] ?? 'Storyteller'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Pro / Unlock button */}
            <TouchableOpacity
              style={styles.proButton}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowPaywall(true);
              }}
            >
              {Platform.OS !== 'web' && (
                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.08)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
              />
              <Text style={styles.proButtonText}>👑 Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() =>
                requireParentalGate('Settings', () => router.push('/(main)/settings'))
              }
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* Child profile card */}
          {child && (
            <Animated.View style={[styles.childCard, parallaxCardsStyle]}>
              {Platform.OS !== 'web' && (
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              {/* Top highlight edge (glass shine) */}
              <View style={styles.glassTopEdge} />
              <View style={styles.childCardHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarEmoji}>
                    {child.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.childName}>{child.name}</Text>
                  {child.age !== undefined && child.age !== null && (
                    <Text style={styles.childAge}>{child.age} years old</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.editChildButton}
                  onPress={() =>
                    requireParentalGate('Edit Profile', () =>
                      router.push('/(onboarding)/child-profile'),
                    )
                  }
                >
                  <Text style={styles.editChildText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {child.interests && child.interests.length > 0 && (
                <View style={styles.interestsRow}>
                  {child.interests.slice(0, 4).map((interest) => (
                    <View key={interest} style={styles.interestChip}>
                      <Text style={styles.interestChipText}>{interest}</Text>
                    </View>
                  ))}
                  {child.interests.length > 4 && (
                    <Text style={styles.moreInterests}>+{child.interests.length - 4}</Text>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {/* Active Voice Banner */}
          <TouchableOpacity
            style={styles.activVoiceBanner}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowVoiceModal(true);
            }}
            activeOpacity={0.8}
          >
            {Platform.OS !== 'web' && (
              <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.glassTopEdge} />
            <View style={styles.activVoiceBannerLeft}>
              <View style={styles.activeVoiceDot} />
              <View>
                <Text style={styles.activeVoiceLabel}>Now Narrating</Text>
                <Text style={styles.activeVoiceName}>
                  {activeVoice
                    ? `${activeVoice.voice_type === 'mom' ? '👩' : activeVoice.voice_type === 'dad' ? '👨' : '🎙️'} ${activeVoice.voice_name ?? activeVoice.voice_type}`
                    : '🎙️ No voice recorded'}
                </Text>
              </View>
            </View>
            <View style={styles.switchVoiceBtn}>
              <Text style={styles.switchVoiceText}>Switch ›</Text>
            </View>
          </TouchableOpacity>

          {/* Create New Story – primary CTA */}
          <TouchableOpacity
            style={[styles.createStoryButton, { marginBottom: Spacing.xl }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(main)/create-story');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold, '#FFA500']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createStoryGradient}
            >
              <Text style={styles.createStoryIcon}>🪄</Text>
              <View style={styles.createStoryTextGroup}>
                <Text style={styles.createStoryLabel}>Create New Story</Text>
                <Text style={styles.createStorySubLabel}>
                  Personalised for {child?.name ?? 'your child'}
                </Text>
              </View>
              <Text style={styles.createStoryArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Bookshelf section with tab switcher ── */}
          {stories.length > 0 && (
            <View style={styles.bookshelfSection}>
              <Text style={styles.sectionTitle}>📚 My Bookshelf</Text>
              <TabSwitcher
                activeTab={activeTab}
                favCount={favoriteStories.length}
                onSwitch={switchTab}
              />

              <Animated.View style={tabContentStyle}>
                {activeTab === 'all'
                  ? renderStoryList(recentStories)
                  : favoriteStories.length > 0
                    ? renderStoryList(favoriteStories)
                    : (
                      <View style={styles.emptyInline}>
                        <Text style={styles.emptyInlineEmoji}>🤍</Text>
                        <Text style={styles.emptyInlineText}>
                          No favourites yet — tap the heart on any story to save it here.
                        </Text>
                      </View>
                    )
                }
              </Animated.View>
            </View>
          )}

          {/* Empty state when no stories at all */}
          {stories.length === 0 && (
            <EmptyStoryLibrary
              onCreateStory={() => router.push('/(main)/create-story')}
            />
          )}

          {/* ── Collections Section ─────────────────────────────────────────── */}
          <View style={styles.collectionsSection}>
            <View style={styles.collectionsSectionHeader}>
              <Text style={styles.sectionTitle}>🗂️ Collections</Text>
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCollections(true);
                }}
              >
                <Text style={styles.manageBtnText}>Manage ›</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.collectionsCard}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCollections(true);
              }}
              activeOpacity={0.8}
            >
              {Platform.OS !== 'web' && (
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <View style={styles.glassTopEdge} />
              <Text style={styles.collectionsCardEmoji}>📚</Text>
              <View style={styles.collectionsCardText}>
                <Text style={styles.collectionsCardTitle}>Create a Series</Text>
                <Text style={styles.collectionsCardSubtitle}>
                  Group 2–3 stories for a continuous bedtime routine
                </Text>
              </View>
              <Text style={styles.collectionsCardArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ── Narrator Gallery (Bedtime Buddies) ───────────────────────────── */}
          <NarratorGallery childName={child?.name} />

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(onboarding)/voice-studio');
              }}
            >
              <View style={styles.quickActionGlassWrapper}>
                {Platform.OS !== 'web' && (
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(107,72,184,0.5)', 'rgba(107,72,184,0.18)']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>🎙️</Text>
                  <Text style={styles.quickActionText}>Record Voice</Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(onboarding)/child-profile');
              }}
            >
              <View style={styles.quickActionGlassWrapper}>
                {Platform.OS !== 'web' && (
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>✏️</Text>
                  <Text style={styles.quickActionText}>Edit Profile</Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Parental Gate ─────────────────────────────────────────────────────── */}
      <ParentalGate
        visible={showParentalGate}
        context={gateContext}
        onSuccess={handleGateSuccess}
        onDismiss={handleGateDismiss}
      />

      {/* ── Magic Sync Modal ──────────────────────────────────────────────────── */}
      {migrationSummary && (
        <MagicSyncModal
          visible={magicSyncVisible}
          summary={migrationSummary}
          syncState={migrationSyncState}
          migrationResult={migrationResult}
          onConfirm={() => void handleMigrationConfirm()}
          onDismiss={handleMigrationDismiss}
        />
      )}

      {/* ── Collections Modal ──────────────────────────────────────────────── */}
      <CollectionModal
        visible={showCollections}
        onClose={() => setShowCollections(false)}
        allStories={stories.filter((s) => Boolean(s.content))}
        onPlaySeries={(ids) => void handlePlaySeries(ids)}
      />

      {/* ── Stars Paywall ────────────────────────────────────────────────── */}
      <StarsPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* ── Voice Selector Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showVoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowVoiceModal(false)}
        >
          <View style={styles.voiceModal}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(20,8,45,0.95)', 'rgba(14,8,32,0.98)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.glassTopEdge} />
            <TouchableOpacity activeOpacity={1} style={styles.voiceModalBody}>
              <View style={styles.voiceModalHandle} />
              <Text style={styles.voiceModalTitle}>🎙️  Choose Narrator</Text>
              <Text style={styles.voiceModalSubtitle}>
                {"Select which voice will narrate tonight's story"}
              </Text>

              {voices.length === 0 ? (
                <TouchableOpacity
                  style={styles.addVoiceCard}
                  onPress={() => {
                    setShowVoiceModal(false);
                    router.push('/(onboarding)/voice-selection');
                  }}
                >
                  <Text style={styles.addVoiceEmoji}>＋</Text>
                  <Text style={styles.addVoiceText}>Record your first voice</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.voiceList}>
                  {voices.map((voice) => {
                    const isActive = voice.id === activeVoiceId || (!activeVoiceId && voices.indexOf(voice) === 0);
                    return (
                      <TouchableOpacity
                        key={voice.id}
                        style={[styles.voiceOption, isActive && styles.voiceOptionActive]}
                        onPress={() => void handleSelectVoice(voice)}
                        activeOpacity={0.8}
                      >
                        {isActive && (
                          <LinearGradient
                            colors={['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.05)']}
                            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                          />
                        )}
                        <Text style={styles.voiceOptionEmoji}>
                          {voice.voice_type === 'mom' ? '👩' : voice.voice_type === 'dad' ? '👨' : '🎙️'}
                        </Text>
                        <View style={styles.voiceOptionInfo}>
                          <Text style={styles.voiceOptionName}>{voice.voice_name ?? voice.voice_type}</Text>
                          <Text style={styles.voiceOptionStatus}>
                            {voice.is_complete
                              ? '✓ Ready to narrate'
                              : `${voice.script_paragraphs_recorded}/5 paragraphs recorded`}
                          </Text>
                        </View>
                        {isActive && (
                          <View style={styles.activeIndicator}>
                            <Text style={styles.activeIndicatorText}>Active</Text>
                          </View>
                        )}
                        {!isActive && (
                          <Text style={styles.voiceOptionArrow}>›</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.addAnotherVoice}
                    onPress={() => {
                      setShowVoiceModal(false);
                      router.push('/(onboarding)/voice-selection');
                    }}
                  >
                    <Text style={styles.addAnotherVoiceText}>+ Add Another Voice</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.voiceModalClose}
                onPress={() => setShowVoiceModal(false)}
              >
                <Text style={styles.voiceModalCloseText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Welcome Home Greeting ────────────────────────────────────────── */}
      <Modal
        visible={showGreeting}
        transparent
        animationType="none"
        onRequestClose={() => setShowGreeting(false)}
      >
        <TouchableOpacity
          style={styles.greetingOverlay}
          activeOpacity={1}
          onPress={() => setShowGreeting(false)}
        >
          <Animated.View style={[styles.greetingCard, greetingStyle]}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(30,10,62,0.92)', 'rgba(14,8,32,0.97)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            {/* Top highlight edge */}
            <View style={[styles.glassTopEdge, { left: '10%', right: '10%' }]} />
            {/* Gold corner ornaments */}
            <View style={styles.greetingCornerTL} />
            <View style={styles.greetingCornerBR} />

            <Text style={styles.greetingNarratorEmoji}>{greetingNarrator.emoji}</Text>
            <Text style={[styles.greetingNarratorName, { color: greetingNarrator.accentColor }]}>
              {greetingNarrator.name} {greetingNarrator.species}
            </Text>
            <Text style={styles.greetingDivider}>· · ·</Text>
            <Text style={styles.greetingMessage}>{greetingText}</Text>
            <TouchableOpacity
              style={styles.greetingCTA}
              onPress={() => {
                setShowGreeting(false);
                router.push('/(main)/create-story');
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
              />
              <Text style={styles.greetingCTAText}>🪄  Begin Tonight&apos;s Story</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.greetingDismiss}
              onPress={() => setShowGreeting(false)}
            >
              <Text style={styles.greetingDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E0820' },
  content:   { paddingHorizontal: Spacing.lg },

  // Glass utility
  glassTopEdge: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius:    1,
  },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  greeting:     {
    fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(240,235,248,0.60)',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  userName:     {
    fontFamily: Fonts.extraBold, fontSize: 22, color: '#FFFFFF', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proButton: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.35)',
    overflow:          'hidden',
    // Floating glass glow
    shadowColor:       '#FFD700',
    shadowOffset:      { width: 0, height: 0 },
    shadowRadius:      8,
    shadowOpacity:     0.25,
    elevation:         4,
  },
  proButtonText: { fontFamily: Fonts.extraBold, fontSize: 12, color: Colors.celestialGold },
  settingsButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    // Floating
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowOpacity: 0.3,
    elevation: 5,
  },
  settingsIcon: { fontSize: 20 },

  // Collections section
  collectionsSection: { marginBottom: Spacing.xl },
  collectionsSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  manageBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  manageBtnText: { fontFamily: Fonts.bold, fontSize: 12, color: 'rgba(240,235,248,0.65)' },
  collectionsCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden', gap: 12,
    // Glass float
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    shadowOpacity: 0.22,
    elevation: 8,
  },
  collectionsCardEmoji: { fontSize: 28 },
  collectionsCardText:  { flex: 1 },
  collectionsCardTitle: { fontFamily: Fonts.extraBold, fontSize: 15, color: '#FFFFFF' },
  collectionsCardSubtitle: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(240,235,248,0.55)', marginTop: 2 },
  collectionsCardArrow: { fontSize: 22, color: 'rgba(240,235,248,0.45)', fontFamily: Fonts.bold },

  // Child card
  childCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    // Glass float
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    shadowOpacity: 0.28,
    elevation: 10,
  },
  childCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  childAvatar:      {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(107,72,184,0.45)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  childAvatarEmoji: { fontFamily: Fonts.extraBold, fontSize: 22, color: '#fff' },
  childName:        { fontFamily: Fonts.extraBold, fontSize: 18, color: '#FFFFFF', letterSpacing: 0.2 },
  childAge:         { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(240,235,248,0.55)' },
  editChildButton:  {
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  editChildText:  { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  interestsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip:   {
    backgroundColor: 'rgba(255,215,0,0.09)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  interestChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.celestialGold },
  moreInterests:    { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(240,235,248,0.45)', alignSelf: 'center' },

  // Active Voice Banner
  activVoiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    gap: 8,
    // Glass float
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    shadowOpacity: 0.22,
    elevation: 6,
  },
  activVoiceBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  activeVoiceDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.successGreen,
    shadowColor: Colors.successGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, shadowOpacity: 0.9,
  },
  activeVoiceLabel: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(240,235,248,0.55)' },
  activeVoiceName:  { fontFamily: Fonts.extraBold, fontSize: 15, color: '#FFFFFF' },
  switchVoiceBtn:   {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  switchVoiceText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },

  // Create Story CTA — floating gold glow button
  createStoryButton: {
    borderRadius: Radius.full,
    overflow: 'visible',
    // Outer glow
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 24,
    shadowOpacity: 0.55,
    elevation: 14,
    marginBottom: Spacing.sm,
  },
  createStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    gap: 12,
    // Inner top shine edge
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  createStoryIcon:      { fontSize: 26 },
  createStoryTextGroup: { flex: 1 },
  createStoryLabel:     { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.deepSpace },
  createStorySubLabel:  { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(13,14,36,0.65)', marginTop: 1 },
  createStoryArrow:     { fontSize: 26, color: Colors.deepSpace, fontFamily: Fonts.black },

  // Bookshelf section
  bookshelfSection: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontFamily: Fonts.extraBold, fontSize: 18, color: '#FFFFFF', marginBottom: 12, letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.50)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },

  // Tab bar — glass pill
  tabBar: {
    flexDirection:   'row',
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    padding:         3,
    marginBottom:    16,
    position:        'relative',
    height:          46,
    overflow:        'hidden',
    // Float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 4 },
    shadowRadius:    12,
    shadowOpacity:   0.2,
    elevation:       5,
  },
  tabIndicator: {
    position:        'absolute',
    top:             3,
    bottom:          3,
    borderRadius:    Radius.full,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.22)',
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    elevation:       4,
  },
  tabButton: {
    justifyContent: 'center',
    alignItems:     'center',
    borderRadius:   Radius.full,
    height:         40,
  },
  tabLabel: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      'rgba(240,235,248,0.5)',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // Horizontal story list
  horizontalList: { paddingRight: Spacing.lg, gap: 12 },

  // Story card (horizontal) — Crystal Night glass tile
  storyCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'flex-start',
    // Floating glass
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    shadowOpacity: 0.28,
    elevation: 8,
  },
  storyCardEmojiBg: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
    // Glass sphere look
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.4,
  },
  storyCardEmojiGlow: {
    position: 'absolute',
    top: 0, left: '15%', right: '15%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
  },
  storyCardEmoji:  { fontSize: 26 },
  storyCardTitle:  {
    fontFamily: Fonts.bold, fontSize: 13, color: '#FFFFFF', flex: 1, lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  storyCardPlay:   { fontFamily: Fonts.bold, fontSize: 11, marginTop: 6 },
  heartBtn:        { position: 'absolute', top: 8, right: 8, padding: 4 },
  heartIcon:       { fontSize: 18 },
  generatingRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  generatingDot:   { width: 6, height: 6, borderRadius: 3 },
  generatingText:  { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(240,235,248,0.5)' },

  // Empty inline
  emptyInline: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  emptyInlineEmoji: { fontSize: 28 },
  emptyInlineText:  { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(240,235,248,0.55)', textAlign: 'center' },

  // Quick actions
  quickActions:        { flexDirection: 'row', gap: 12, marginTop: Spacing.sm },
  quickAction:         { flex: 1, borderRadius: Radius.xl },
  quickActionGlassWrapper: {
    flex: 1, borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    shadowOpacity: 0.22,
    elevation: 6,
  },
  quickActionGradient: { paddingVertical: Spacing.lg, alignItems: 'center', gap: 8, borderRadius: Radius.xl },
  quickActionEmoji:    { fontSize: 28 },
  quickActionText:     { fontFamily: Fonts.bold, fontSize: 14, color: '#FFFFFF' },

  // Voice Selector Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  voiceModal: {
    width: '100%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.18)',
    // Glass float
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 28,
    shadowOpacity: 0.4,
    elevation: 16,
  },
  voiceModalBody: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  voiceModalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  voiceModalTitle:    { fontFamily: Fonts.extraBold, fontSize: 20, color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.3 },
  voiceModalSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(240,235,248,0.55)', textAlign: 'center', marginBottom: 4 },
  voiceList:          { gap: 10 },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 12,
    overflow: 'hidden',
  },
  voiceOptionActive:  { borderColor: 'rgba(255,215,0,0.45)', backgroundColor: 'rgba(255,215,0,0.07)' },
  voiceOptionEmoji:   { fontSize: 28 },
  voiceOptionInfo:    { flex: 1 },
  voiceOptionName:    { fontFamily: Fonts.extraBold, fontSize: 16, color: '#FFFFFF' },
  voiceOptionStatus:  { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(240,235,248,0.55)', marginTop: 2 },
  voiceOptionArrow:   { fontSize: 20, color: 'rgba(240,235,248,0.35)' },
  activeIndicator: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  activeIndicatorText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.celestialGold },
  addAnotherVoice:     {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addAnotherVoiceText: { fontFamily: Fonts.bold, fontSize: 13, color: 'rgba(240,235,248,0.5)' },
  addVoiceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderStyle: 'dashed',
    gap: 8,
  },
  addVoiceEmoji: { fontSize: 32 },
  addVoiceText:  { fontFamily: Fonts.bold, fontSize: 15, color: 'rgba(240,235,248,0.5)' },
  voiceModalClose: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.28)',
    backgroundColor: 'rgba(255,215,0,0.07)',
  },
  voiceModalCloseText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },

  // ── Welcome Home Greeting
  greetingOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         Spacing.xl,
  },
  greetingCard: {
    width:           '100%',
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.32)',
    padding:         Spacing.xl,
    alignItems:      'center',
    overflow:        'hidden',
    gap:             Spacing.md,
    // Deep gold float
    shadowColor:     Colors.celestialGold,
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.40,
    shadowRadius:    40,
    elevation:       22,
  },
  greetingCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 50, height: 50,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.50)',
  },
  greetingCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 50, height: 50,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.50)',
  },
  greetingNarratorEmoji: { fontSize: 52 },
  greetingNarratorName: {
    fontFamily: Fonts.extraBold,
    fontSize:   16,
    letterSpacing: 0.5,
  },
  greetingDivider: {
    fontFamily: Fonts.medium,
    fontSize:   16,
    color:      'rgba(255,215,0,0.45)',
    letterSpacing: 6,
  },
  greetingMessage: {
    fontFamily: Fonts.medium,
    fontSize:   16,
    color:      '#F0EBF8',
    textAlign:  'center',
    lineHeight: 26,
    fontStyle:  'italic',
  },
  greetingCTA: {
    width:         '100%',
    borderRadius:  Radius.full,
    overflow:      'hidden',
    paddingVertical: 16,
    alignItems:    'center',
    marginTop:     Spacing.sm,
    // Glow float
    shadowColor:   Colors.celestialGold,
    shadowOffset:  { width: 0, height: 6 },
    shadowRadius:  20,
    shadowOpacity: 0.55,
    elevation:     12,
  },
  greetingCTAText: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
    color:      Colors.deepSpace,
  },
  greetingDismiss: {
    paddingVertical: Spacing.sm,
  },
  greetingDismissText: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      'rgba(240,235,248,0.45)',
  },
});
