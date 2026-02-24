import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import ParentalGate from '@/components/ParentalGate';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import {
  getChildren,
  getParentVoices,
  getStories,
  toggleStoryFavorite,
  upsertUserPreferences,
  isSupabaseAvailable,
} from '@/lib/supabase';
import type { Child, ParentVoice, Story } from '@/lib/supabase';

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
    heartScale.value = withSpring(1.4, { damping: 4, stiffness: 300 }, () => {
      heartScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      <LinearGradient
        colors={[`${accent}22`, `${accent}08`]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      <View style={styles.storyCardEmojiBg}>
        <Text style={styles.storyCardEmoji}>{emoji}</Text>
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
  const [, setIsLoading] = useState(true);

  // Parental Gate
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [gateContext,      setGateContext]       = useState<string | undefined>(undefined);
  const pendingActionRef = useRef<(() => void) | null>(null);

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
  const headerOpacity  = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // ── Derived data ────────────────────────────────────────────────────────────
  const recentStories   = stories.slice(0, 10);
  const favoriteStories = stories.filter((s) => s.is_favorite);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load active voice from local storage first (fast)
      const savedVoiceId = await AsyncStorage.getItem('active_voice_id');
      if (savedVoiceId) setActiveVoiceId(savedVoiceId);

      if (user?.id) {
        const { children } = await getChildren(user.id);
        if (children && children.length > 0) {
          setChild(children[0]);
        } else {
          const local = await AsyncStorage.getItem('pending_child_profile');
          if (local) setChild(JSON.parse(local) as Child);
        }
        const { voices: v } = await getParentVoices(user.id);
        if (v) setVoices(v);

        const firstChildId = children?.[0]?.id;
        const { stories: s } = await getStories(user.id, firstChildId);
        if (s) {
          setStories(s);
          // Keep local cache in sync
          await AsyncStorage.setItem('local_stories', JSON.stringify(s.slice(0, 20)));
        }
      } else {
        const local = await AsyncStorage.getItem('pending_child_profile');
        if (local) setChild(JSON.parse(local) as Child);
        const localStories = await AsyncStorage.getItem('local_stories');
        if (localStories) {
          const parsed = JSON.parse(localStories) as Story[];
          // Ensure is_favorite defaults to false for legacy records
          setStories(parsed.map((s) => ({ ...s, is_favorite: s.is_favorite ?? false })));
        }
      }
    } catch {
      const local = await AsyncStorage.getItem('pending_child_profile');
      if (local) setChild(JSON.parse(local) as Child);
      const localStories = await AsyncStorage.getItem('local_stories');
      if (localStories) {
        const parsed = JSON.parse(localStories) as Story[];
        setStories(parsed.map((s) => ({ ...s, is_favorite: s.is_favorite ?? false })));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
    headerOpacity.value  = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  // Animate layout when favorites section appears/disappears
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

  // ── Toggle favourite ─────────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback(async (storyId: string) => {
    const updatedStories = stories.map((s) =>
      s.id === storyId ? { ...s, is_favorite: !s.is_favorite } : s
    );
    setStories(updatedStories);

    // Persist locally
    await AsyncStorage.setItem('local_stories', JSON.stringify(updatedStories.slice(0, 20)));

    // Update current_story if it's the same one
    const raw = await AsyncStorage.getItem('current_story');
    if (raw) {
      const current = JSON.parse(raw) as { id?: string };
      if (current.id === storyId) {
        const updated = updatedStories.find((s) => s.id === storyId);
        await AsyncStorage.setItem('current_story', JSON.stringify({ ...current, is_favorite: updated?.is_favorite }));
      }
    }

    // Sync to Supabase
    if (isSupabaseAvailable && user?.id) {
      const updated = updatedStories.find((s) => s.id === storyId);
      await toggleStoryFavorite(storyId, updated?.is_favorite ?? false);
    }
  }, [stories, user?.id]);

  // ── Open a story on the player ───────────────────────────────────────────────
  const openStory = useCallback(async (story: Story) => {
    if (!story.content) return; // still generating
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Handle both Supabase format (image_url) and local cache format (imageUrl)
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

  // ── Voice switching ──────────────────────────────────────────────────────────
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

  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const activeVoice  = voices.find((v) => v.id === activeVoiceId) ?? voices[0] ?? null;

  // ── Render story list section ─────────────────────────────────────────────────
  const renderStorySection = (title: string, data: Story[], emptyMsg?: string) => {
    if (data.length === 0 && !emptyMsg) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
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
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#251B5A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={55} />

      <ScrollView
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
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() =>
              requireParentalGate('Settings', () => router.push('/(main)/settings'))
            }
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* Child profile card */}
          {child && (
            <View style={styles.childCard}>
              <LinearGradient
                colors={['rgba(107,72,184,0.4)', 'rgba(74,56,128,0.2)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
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
            </View>
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
            <LinearGradient
              colors={['rgba(74,56,128,0.6)', 'rgba(37,38,85,0.4)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.activVoiceBannerLeft}>
              <View style={[styles.activeVoiceDot]} />
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

          {/* My Favourites section – only when there are favourites */}
          {favoriteStories.length > 0 &&
            renderStorySection('❤️ My Favourites', favoriteStories)
          }

          {/* Recently Played / All Stories section */}
          {renderStorySection(
            '✨ Recently Created',
            recentStories,
            stories.length === 0 ? 'No stories yet — tap above to create your first one!' : undefined
          )}

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(onboarding)/voice-studio');
              }}
            >
              <LinearGradient
                colors={[Colors.softPurple, Colors.mediumPurple]}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionEmoji}>🎙️</Text>
                <Text style={styles.quickActionText}>Record Voice</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(onboarding)/child-profile');
              }}
            >
              <LinearGradient
                colors={['rgba(74,56,128,0.6)', 'rgba(37,38,85,0.6)']}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionEmoji}>✏️</Text>
                <Text style={styles.quickActionText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Parental Gate ────────────────────────────────────────────────────── */}
      <ParentalGate
        visible={showParentalGate}
        context={gateContext}
        onSuccess={handleGateSuccess}
        onDismiss={handleGateDismiss}
      />

      {/* ── Voice Selector Modal ─────────────────────────────────────────────── */}
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
            <LinearGradient
              colors={[Colors.midnightNavy, Colors.deepSpace]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
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

                  {/* Add another voice */}
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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  content:   { paddingHorizontal: Spacing.lg },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  greeting:     { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  userName:     { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.moonlightCream },
  settingsButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderColor,
  },
  settingsIcon: { fontSize: 20 },

  // Child card
  childCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  childCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  childAvatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  childAvatarEmoji: { fontFamily: Fonts.extraBold, fontSize: 22, color: '#fff' },
  childName:        { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream },
  childAge:         { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted },
  editChildButton:  {
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.softPurple,
  },
  editChildText:  { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  interestsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip:   {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  interestChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.celestialGold },
  moreInterests:    { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, alignSelf: 'center' },

  // Active Voice Banner
  activVoiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
    gap: 8,
  },
  activVoiceBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  activeVoiceDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.successGreen,
    shadowColor: Colors.successGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4, shadowOpacity: 0.8,
  },
  activeVoiceLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  activeVoiceName:  { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream },
  switchVoiceBtn:   {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.softPurple,
  },
  switchVoiceText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },

  // Create Story CTA
  createStoryButton: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14, shadowOpacity: 0.35,
    elevation: 8,
  },
  createStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    gap: 12,
  },
  createStoryIcon:      { fontSize: 26 },
  createStoryTextGroup: { flex: 1 },
  createStoryLabel:     { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.deepSpace },
  createStorySubLabel:  { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(13,14,36,0.65)', marginTop: 1 },
  createStoryArrow:     { fontSize: 26, color: Colors.deepSpace, fontFamily: Fonts.black },

  // Section
  section:      { marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream, marginBottom: 12 },
  horizontalList: { paddingRight: Spacing.lg, gap: 12 },

  // Story card (horizontal)
  storyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'flex-start',
  },
  storyCardEmojiBg: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  storyCardEmoji:  { fontSize: 26 },
  storyCardTitle:  { fontFamily: Fonts.bold, fontSize: 13, color: Colors.moonlightCream, flex: 1, lineHeight: 18 },
  storyCardPlay:   { fontFamily: Fonts.bold, fontSize: 11, marginTop: 6 },
  heartBtn:        { position: 'absolute', top: 8, right: 8, padding: 4 },
  heartIcon:       { fontSize: 18 },
  generatingRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  generatingDot:   { width: 6, height: 6, borderRadius: 3 },
  generatingText:  { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },

  // Empty inline
  emptyInline: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyInlineText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Quick actions
  quickActions:        { flexDirection: 'row', gap: 12 },
  quickAction:         { flex: 1, borderRadius: Radius.xl, overflow: 'hidden' },
  quickActionGradient: { paddingVertical: Spacing.lg, alignItems: 'center', gap: 8, borderRadius: Radius.xl },
  quickActionEmoji:    { fontSize: 28 },
  quickActionText:     { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },

  // Voice Selector Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    borderColor: Colors.borderColor,
  },
  voiceModalBody: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  voiceModalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderColor,
    alignSelf: 'center',
    marginBottom: 4,
  },
  voiceModalTitle:    { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream, textAlign: 'center' },
  voiceModalSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 4 },
  voiceList:          { gap: 10 },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 12,
    overflow: 'hidden',
  },
  voiceOptionActive:  { borderColor: Colors.celestialGold },
  voiceOptionEmoji:   { fontSize: 28 },
  voiceOptionInfo:    { flex: 1 },
  voiceOptionName:    { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  voiceOptionStatus:  { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  voiceOptionArrow:   { fontSize: 20, color: Colors.textMuted },
  activeIndicator: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
  },
  activeIndicatorText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.celestialGold },
  addAnotherVoice:     {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addAnotherVoiceText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted },
  addVoiceCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderColor,
    borderStyle: 'dashed',
    gap: 8,
  },
  addVoiceEmoji: { fontSize: 32 },
  addVoiceText:  { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textMuted },
  voiceModalClose: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  voiceModalCloseText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },
});
