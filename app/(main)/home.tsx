import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { getChildren, getParentVoices, getStories } from '@/lib/supabase';
import type { Child, ParentVoice, Story } from '@/lib/supabase';

const THEME_EMOJI: Record<string, string> = {
  adventurous: '🗺️',
  calming:     '🌙',
  funny:       '😄',
  educational: '📚',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [child,   setChild]   = useState<Child | null>(null);
  const [voices,  setVoices]  = useState<ParentVoice[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [, setIsLoading] = useState(true);

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    void loadData();
    headerOpacity.value = withTiming(1, { duration: 600 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        const { children } = await getChildren(user.id);
        if (children && children.length > 0) {
          setChild(children[0]);
        } else {
          // Try local storage fallback
          const local = await AsyncStorage.getItem('pending_child_profile');
          if (local) setChild(JSON.parse(local));
        }
        const { voices: v } = await getParentVoices(user.id);
        if (v) setVoices(v);

        const firstChildId = children?.[0]?.id;
        const { stories: s } = await getStories(user.id, firstChildId);
        if (s) setStories(s);
      }
    } catch {
      // Use local data
      const local = await AsyncStorage.getItem('pending_child_profile');
      if (local) setChild(JSON.parse(local));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([
            'active_child_id',
            'active_voice_id',
            'selected_voice_type',
            'onboarding_complete',
            'pending_child_profile',
          ]);
          await signOut();
        },
      },
    ]);
  };

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#251B5A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={55} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
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
          <TouchableOpacity style={styles.settingsButton} onPress={handleSignOut}>
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
                  onPress={() => router.push('/(onboarding)/child-profile')}
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

          {/* Voice status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recorded Voices 🎙️</Text>
            {voices.length === 0 ? (
              <TouchableOpacity
                style={styles.addVoiceCard}
                onPress={() => router.push('/(onboarding)/voice-selection')}
              >
                <Text style={styles.addVoiceEmoji}>+</Text>
                <Text style={styles.addVoiceText}>Record your first voice</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.voicesRow}>
                {voices.map((voice) => (
                  <TouchableOpacity
                    key={voice.id}
                    style={[styles.voiceChip, voice.is_complete && styles.voiceChipComplete]}
                    onPress={() => router.push('/(onboarding)/voice-studio')}
                  >
                    <Text style={styles.voiceChipEmoji}>
                      {voice.voice_type === 'mom' ? '👩' : voice.voice_type === 'dad' ? '👨' : '🎙️'}
                    </Text>
                    <Text style={styles.voiceChipLabel}>{voice.voice_name}</Text>
                    <Text style={styles.voiceChipStatus}>
                      {voice.is_complete ? '✓' : `${voice.script_paragraphs_recorded}/5`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addVoiceChip}
                  onPress={() => router.push('/(onboarding)/voice-selection')}
                >
                  <Text style={styles.addVoiceChipText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Stories */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{"Tonight's Stories ✨"}</Text>
            </View>

            {/* Create New Story – primary CTA */}
            <TouchableOpacity
              style={styles.createStoryButton}
              onPress={() => router.push('/(main)/create-story')}
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

            {/* Saved stories list */}
            {stories.length > 0 ? (
              <View style={[styles.storiesGrid, { marginTop: 12 }]}>
                {stories.slice(0, 4).map((story) => {
                  const themeKey = story.theme?.toLowerCase() ?? '';
                  const emoji = THEME_EMOJI[themeKey] ?? '📖';
                  return (
                    <View key={story.id} style={styles.storyCard}>
                      <LinearGradient
                        colors={['rgba(107,72,184,0.2)', 'rgba(37,38,85,0.6)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                      />
                      <Text style={styles.storyCardEmoji}>{emoji}</Text>
                      <Text style={styles.storyCardTitle} numberOfLines={2}>
                        {story.title}
                      </Text>
                      {story.content == null && (
                        <View style={styles.generatingRow}>
                          <View style={styles.generatingDot} />
                          <Text style={styles.generatingText}>Generating…</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyStoriesCard}>
                <Text style={styles.emptyStoriesEmoji}>🌙</Text>
                <Text style={styles.emptyStoriesText}>
                  No stories yet — tap above to create your first one!
                </Text>
              </View>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(onboarding)/voice-studio')}
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
              onPress={() => router.push('/(onboarding)/child-profile')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  content: { paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  greeting: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  userName: { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.moonlightCream },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderColor },
  settingsIcon: { fontSize: 20 },
  childCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  childCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  childAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.softPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarEmoji: { fontFamily: Fonts.extraBold, fontSize: 22, color: '#fff' },
  childName: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream },
  childAge: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted },
  editChildButton: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.softPurple,
  },
  editChildText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  interestsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  interestChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.celestialGold },
  moreInterests: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, alignSelf: 'center' },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream, marginBottom: 12 },
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
  addVoiceEmoji: { fontSize: 32, color: Colors.textMuted },
  addVoiceText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textMuted },
  voicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  voiceChipComplete: { borderColor: Colors.successGreen },
  voiceChipEmoji: { fontSize: 20 },
  voiceChipLabel: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textLight },
  voiceChipStatus: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted },
  addVoiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addVoiceChipText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.textMuted },
  // Create Story CTA
  createStoryButton: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    shadowOpacity: 0.35,
    elevation: 8,
  },
  createStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    gap: 12,
  },
  createStoryIcon: { fontSize: 26 },
  createStoryTextGroup: { flex: 1 },
  createStoryLabel: { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.deepSpace },
  createStorySubLabel: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(13,14,36,0.65)', marginTop: 1 },
  createStoryArrow: { fontSize: 26, color: Colors.deepSpace, fontFamily: Fonts.black },

  // Stories list
  storiesGrid: { gap: 12 },
  storyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storyCardEmoji: { fontSize: 32 },
  storyCardTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.moonlightCream, flex: 1 },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  generatingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.celestialGold },
  generatingText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted },

  // Empty state
  emptyStoriesCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginTop: 12,
    gap: 10,
  },
  emptyStoriesEmoji: { fontSize: 40 },
  emptyStoriesText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickAction: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden' },
  quickActionGradient: { paddingVertical: Spacing.lg, alignItems: 'center', gap: 8, borderRadius: Radius.xl },
  quickActionEmoji: { fontSize: 28 },
  quickActionText: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
});
