/**
 * Immersive Story Player
 *
 * Features implemented with memory-leak prevention:
 *  - Safe Mode: reads story entirely from AsyncStorage – never crashes when
 *    Supabase is disconnected.
 *  - Sleep Timer: countdown backed by a useRef<NodeJS.Timeout> interval so the
 *    timer is guaranteed to be cleared on unmount (no ghost intervals).
 *  - Background ambient audio (expo-av): Sound object is properly unloaded and
 *    the playback-status callback is set to null before unload.
 *  - AppState listener: subscription removed in the cleanup return.
 *  - All setTimeout / setInterval refs are stored in useRef to survive re-renders.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  AppState,
  AppStateStatus,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import AmbientMixer from '@/components/AmbientMixer';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { toggleStoryFavorite, isSupabaseAvailable } from '@/lib/supabase';
import { NARRATOR_PERSONALITIES, buildReflectionQuestionsPrompt, buildStoryBranchPrompt, type NarratorPersonality } from '@/lib/newell';
import { generateText } from '@fastshot/ai';
import { addStardust, incrementStoriesCompleted } from '@/lib/stardust';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface CurrentStory {
  id: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  childName: string;
  theme: string;
  createdAt: string;
  is_favorite?: boolean;
  isInteractive?: boolean;
  choiceOptions?: { emoji: string; label: string; value: string }[];
  branchContent?: string | null;
}

interface JournalEntry {
  id: string;
  date: string;
  storyTitle: string;
  childName: string;
  theme?: string;
  answers: { question: string; answer: string }[];
  parentNotes: string;
}

const JOURNAL_KEY = 'journal_entries';

const SLEEP_TIMER_OPTIONS = [
  { label: 'Off',    minutes: 0  },
  { label: '5 min',  minutes: 5  },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr',   minutes: 60 },
];

const THEME_GRADIENT: Record<string, [string, string]> = {
  Adventurous: ['#FF8C42', '#C24000'],
  Calming:     [Colors.softBlue, '#3A8CA8'],
  Funny:       [Colors.accentPink, '#C7005A'],
  Educational: [Colors.successGreen, '#2A7A30'],
};

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Pulsing moon icon – decorative accent
// ─────────────────────────────────────────────────────────────────────────────
function PulsingMoon() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.Text style={[styles.moonAccent, style]}>🌙</Animated.Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [story,            setStory]            = useState<CurrentStory | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [isFavorite,       setIsFavorite]       = useState(false);

  // Heart animation
  const heartScale = useSharedValue(1);

  // Breathing glow for the primary "New Story" button
  // 4-second calming cycle: 2s inhale → 2s exhale
  const breathGlow = useSharedValue(0);

  // Sleep timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [sleepSecondsLeft,  setSleepSecondsLeft]  = useState(0);
  const [showTimerModal,    setShowTimerModal]    = useState(false);
  const [timerActive,       setTimerActive]       = useState(false);

  // Ambient mixer
  const [showAmbientMixer, setShowAmbientMixer] = useState(false);

  // Active narrator
  const [activeNarrator, setActiveNarrator] = useState<NarratorPersonality | null>(null);

  // Reading progress
  const [scrollProgress, setScrollProgress] = useState(0);

  // Quiet Time Reflections
  const [showQuietTimeBtn,   setShowQuietTimeBtn]   = useState(false);
  const [quietTimeActive,    setQuietTimeActive]    = useState(false);
  const [reflectionQuestions, setReflectionQuestions] = useState<string[]>([]);
  const [isLoadingReflections, setIsLoadingReflections] = useState(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Glow-Reflect border animation
  const glowBorderPulse = useSharedValue(0);

  // Interactive Adventure
  const [showChoiceCards, setShowChoiceCards] = useState(false);
  const [isGeneratingBranch, setIsGeneratingBranch] = useState(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number | null>(null);
  const [choiceTimerLeft, setChoiceTimerLeft] = useState(30);
  const choiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Choice zoom animations
  const choiceAScale = useSharedValue(1);
  const choiceAOpacity = useSharedValue(1);
  const choiceBScale = useSharedValue(1);
  const choiceBOpacity = useSharedValue(1);

  // Reflection answers for journal (populated when parent types answers in future phase)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [reflectionAnswers, setReflectionAnswers] = useState<string[]>([]);

  // ── Refs for resources that MUST be cleaned up ────────────────────────────
  // Storing intervals/timeouts in refs ensures they survive re-renders and can
  // be cleared reliably from the cleanup function.
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateSubRef   = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);

  // ── Entrance animations ────────────────────────────────────────────────────
  const headerOpacity  = useSharedValue(0);
  const coverScale     = useSharedValue(0.92);
  const contentOpacity = useSharedValue(0);
  const controlsY      = useSharedValue(40);

  // ── Load story from AsyncStorage (Safe Mode) ───────────────────────────────
  const loadStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const raw = await AsyncStorage.getItem('current_story');
      if (!raw) {
        setError('No story found. Please generate a story first.');
        return;
      }
      const parsed = JSON.parse(raw) as CurrentStory;
      if (!parsed.content || parsed.content.trim().length === 0) {
        setError('Story content is empty. Please generate a new story.');
        return;
      }
      setStory(parsed);
      setIsFavorite(parsed.is_favorite ?? false);

      // Load active narrator
      try {
        const narratorId = await AsyncStorage.getItem('selected_narrator_id');
        if (narratorId) {
          const narrator = NARRATOR_PERSONALITIES.find((n) => n.id === narratorId);
          setActiveNarrator(narrator ?? null);
        }
      } catch {
        // non-fatal
      }
    } catch (e) {
      console.error('[Player] Failed to load story from AsyncStorage:', e);
      setError('Failed to load story. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Start entrance animations once story is loaded ─────────────────────────
  useEffect(() => {
    if (!isLoading && story) {
      headerOpacity.value  = withTiming(1, { duration: 600 });
      coverScale.value     = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.2)) }));
      contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
      controlsY.value      = withDelay(500, withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }));

      // Start breathing glow on the New Story button after controls appear
      // Calming 4-second cycle (2s in / 2s out) — mirrors a restful breathing tempo
      breathGlow.value = withDelay(
        900,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
    }
    return () => cancelAnimation(breathGlow);
    // Reanimated shared values are stable refs – safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, story]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadStory();
  }, [loadStory]);

  // ── AppState listener – pause timer when app backgrounds ──────────────────
  // The subscription is stored in a ref and removed in cleanup to prevent leaks.
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Timer keeps running in background (intentional – this is a bedtime app)
        // but we could pause here if needed.
      }
    };
    appStateSubRef.current = AppState.addEventListener('change', handleAppState);

    return () => {
      // Always remove listener on unmount
      appStateSubRef.current?.remove();
      appStateSubRef.current = null;
    };
  }, []);

  // ── Sleep Timer logic ──────────────────────────────────────────────────────
  // The interval ref pattern guarantees no ghost timers survive unmount.
  const clearSleepTimer = useCallback(() => {
    if (sleepIntervalRef.current !== null) {
      clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = null;
    }
    setTimerActive(false);
    setSleepSecondsLeft(0);
  }, []);

  const startSleepTimer = useCallback((minutes: number) => {
    clearSleepTimer();
    if (minutes === 0) return;

    const totalSeconds = minutes * 60;
    setSleepSecondsLeft(totalSeconds);
    setTimerActive(true);

    sleepIntervalRef.current = setInterval(() => {
      setSleepSecondsLeft((prev) => {
        if (prev <= 1) {
          // Timer expired – clear and notify
          if (sleepIntervalRef.current !== null) {
            clearInterval(sleepIntervalRef.current);
            sleepIntervalRef.current = null;
          }
          setTimerActive(false);
          Alert.alert('Sweet Dreams 🌙', 'Sleep timer has ended. Goodnight!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearSleepTimer]);

  // Cleanup on unmount – clears ANY lingering interval
  useEffect(() => {
    return () => {
      if (sleepIntervalRef.current !== null) {
        clearInterval(sleepIntervalRef.current);
        sleepIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current !== null) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (choiceTimerRef.current !== null) {
        clearInterval(choiceTimerRef.current);
        choiceTimerRef.current = null;
      }
      cancelAnimation(glowBorderPulse);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimerSelect = useCallback((minutes: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSleepTimerMinutes(minutes);
    setShowTimerModal(false);
    startSleepTimer(minutes);
  }, [startSleepTimer]);

  // ── Interactive Adventure – Choice Selection ──────────────────────────────
  const handleChoiceSelect = useCallback(async (choiceIdx: number) => {
    if (!story || selectedChoiceIdx !== null || isGeneratingBranch) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSelectedChoiceIdx(choiceIdx);

    // Clear choice timer
    if (choiceTimerRef.current) {
      clearInterval(choiceTimerRef.current);
      choiceTimerRef.current = null;
    }

    // Zoom animation: selected expands, other fades
    if (choiceIdx === 0) {
      choiceAScale.value = withSpring(1.05, { damping: 8, stiffness: 200 });
      choiceBScale.value = withTiming(0.85, { duration: 400 });
      choiceBOpacity.value = withTiming(0, { duration: 350 });
    } else {
      choiceBScale.value = withSpring(1.05, { damping: 8, stiffness: 200 });
      choiceAScale.value = withTiming(0.85, { duration: 400 });
      choiceAOpacity.value = withTiming(0, { duration: 350 });
    }

    setShowChoiceCards(false);
    setIsGeneratingBranch(true);

    try {
      const chosenOption = story.choiceOptions?.[choiceIdx];
      const narratorId = await AsyncStorage.getItem('selected_narrator_id');
      const narrator = narratorId ? NARRATOR_PERSONALITIES.find((n) => n.id === narratorId) : null;
      const langCode = await AsyncStorage.getItem('app_language') ?? 'en';

      const branchPrompt = buildStoryBranchPrompt(
        story.content,
        chosenOption?.value ?? chosenOption?.label ?? 'continue',
        story.childName,
        narrator ?? undefined,
        langCode !== 'en' ? langCode : undefined
      );

      const branchText = await generateText({ prompt: branchPrompt });
      if (!branchText) throw new Error('Empty branch');

      const updatedStory = { ...story, branchContent: branchText.trim() };
      await AsyncStorage.setItem('current_story', JSON.stringify(updatedStory));

      // Update local_stories
      const localRaw = await AsyncStorage.getItem('local_stories');
      if (localRaw) {
        const local = JSON.parse(localRaw) as CurrentStory[];
        const updated = local.map((s) => s.id === story.id ? updatedStory : s);
        await AsyncStorage.setItem('local_stories', JSON.stringify(updated));
      }

      setStory(updatedStory);

      // Award stardust for interactive adventure completion
      await addStardust(15, 'Completed Interactive Adventure! 🌟', '🎯');
      await incrementStoriesCompleted();

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Player] Branch generation failed:', err);
      // Fallback: show quiet time anyway
    } finally {
      setIsGeneratingBranch(false);
    }
  }, [story, selectedChoiceIdx, isGeneratingBranch, choiceAScale, choiceAOpacity, choiceBScale, choiceBOpacity]);

  // ── Choice timer effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (showChoiceCards) {
      setChoiceTimerLeft(30);
      choiceTimerRef.current = setInterval(() => {
        setChoiceTimerLeft((prev) => {
          if (prev <= 1) {
            if (choiceTimerRef.current) {
              clearInterval(choiceTimerRef.current);
              choiceTimerRef.current = null;
            }
            // Auto-select first choice when timer expires
            void handleChoiceSelect(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (choiceTimerRef.current) {
        clearInterval(choiceTimerRef.current);
        choiceTimerRef.current = null;
      }
    }
    return () => {
      if (choiceTimerRef.current) {
        clearInterval(choiceTimerRef.current);
        choiceTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChoiceCards]);

  // ── Quiet Time Reflections ─────────────────────────────────────────────
  const startHeartbeatHaptics = useCallback(() => {
    if (heartbeatIntervalRef.current !== null) return;
    // Heartbeat pattern: double-pulse every 2.8 seconds (lub-dub)
    let pulsePhase = 0;
    heartbeatIntervalRef.current = setInterval(() => {
      pulsePhase++;
      // Phase 0: first beat (lub)
      if (pulsePhase % 3 === 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 220);
      }
    }, 2800);
  }, []);

  const stopHeartbeatHaptics = useCallback(() => {
    if (heartbeatIntervalRef.current !== null) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleBeginQuietTime = useCallback(async () => {
    if (!story) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQuietTimeActive(true);
    setIsLoadingReflections(true);

    // Start glow border pulsing
    glowBorderPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );

    // Start heartbeat haptics
    startHeartbeatHaptics();

    try {
      // Get child life notes from AsyncStorage
      const childRaw = await AsyncStorage.getItem('pending_child_profile');
      const childProfile = childRaw ? JSON.parse(childRaw) as { life_notes?: string; name?: string } : null;
      const lifeNotes = childProfile?.life_notes ?? null;
      const childName = childProfile?.name ?? story.childName;

      const prompt = buildReflectionQuestionsPrompt(
        story.title,
        story.content,
        childName,
        lifeNotes
      );
      const raw = await generateText({ prompt });
      if (raw) {
        const questions = raw.trim().split('\n').filter((q) => q.trim().length > 0).slice(0, 3);
        setReflectionQuestions(questions);

        // Award stardust for story completion
        if (!story.isInteractive) {
          await addStardust(10, `Completed "${story.title}"`, '📖');
          await incrementStoriesCompleted();
        }

        // Save journal entry
        const journalEntry: JournalEntry = {
          id: `journal_${Date.now()}`,
          date: new Date().toISOString(),
          storyTitle: story.title,
          childName: story.childName,
          theme: story.theme,
          answers: questions.map(q => ({ question: q, answer: '' })),
          parentNotes: '',
        };
        const existingJournalRaw = await AsyncStorage.getItem(JOURNAL_KEY);
        const existingJournal = existingJournalRaw ? JSON.parse(existingJournalRaw) : [];
        await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify([journalEntry, ...existingJournal].slice(0, 100)));
      }
    } catch (err) {
      console.error('[QuietTime] Failed to generate reflections:', err);
      // Fallback questions
      setReflectionQuestions([
        `What was your favourite part of the story?`,
        `How did the story make you feel?`,
        `What did you learn from tonight's story?`,
      ]);
    } finally {
      setIsLoadingReflections(false);
    }
  }, [story, glowBorderPulse, startHeartbeatHaptics]);

  const handleEndQuietTime = useCallback(() => {
    setQuietTimeActive(false);
    setReflectionQuestions([]);
    cancelAnimation(glowBorderPulse);
    glowBorderPulse.value = withTiming(0, { duration: 600 });
    stopHeartbeatHaptics();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [glowBorderPulse, stopHeartbeatHaptics]);

  // ── Favourite toggle ───────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback(async () => {
    if (!story) return;
    const newVal = !isFavorite;
    setIsFavorite(newVal);

    // Bounce animation
    heartScale.value = withSpring(1.4, { damping: 4, stiffness: 300 }, () => {
      heartScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Persist to AsyncStorage
    const raw = await AsyncStorage.getItem('current_story');
    if (raw) {
      const current = JSON.parse(raw) as CurrentStory;
      await AsyncStorage.setItem('current_story', JSON.stringify({ ...current, is_favorite: newVal }));
    }
    // Sync local_stories cache
    const localRaw = await AsyncStorage.getItem('local_stories');
    if (localRaw && story.id) {
      const localStories = (JSON.parse(localRaw) as CurrentStory[]).map((s) =>
        s.id === story.id ? { ...s, is_favorite: newVal } : s
      );
      await AsyncStorage.setItem('local_stories', JSON.stringify(localStories));
    }
    // Sync to Supabase
    if (isSupabaseAvailable && story.id) {
      await toggleStoryFavorite(story.id, newVal);
    }
  }, [story, isFavorite, heartScale]);

  // ── Heart animated style ───────────────────────────────────────────────────
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  // ── Formatted timer display ────────────────────────────────────────────────
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Scroll progress tracking ───────────────────────────────────────────────
  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const totalScrollable = contentSize.height - layoutMeasurement.height;
    if (totalScrollable > 0) {
      const progress = Math.min(contentOffset.y / totalScrollable, 1);
      setScrollProgress(progress);
      // Show Quiet Time button when reader is near the end
      if (progress >= 0.85 && !showQuietTimeBtn && !quietTimeActive) {
        setShowQuietTimeBtn(true);
      }
      // Show choice cards for interactive stories
      if (progress >= 0.85 && story?.isInteractive && !story?.branchContent && !showChoiceCards && !selectedChoiceIdx) {
        setShowChoiceCards(true);
      }
    }
  };

  // ── Animated styles ────────────────────────────────────────────────────────
  const headerStyle   = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const coverStyle    = useAnimatedStyle(() => ({ transform: [{ scale: coverScale.value }] }));
  const contentStyle  = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const controlsStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(controlsY.value, [40, 0], [0, 1]),
    transform: [{ translateY: controlsY.value }],
  }));

  // Breathing glow style for primary CTA button
  const breathGlowStyle = useAnimatedStyle(() => {
    const glowRadius  = interpolate(breathGlow.value, [0, 1], [8, 22], Extrapolation.CLAMP);
    const glowOpacity = interpolate(breathGlow.value, [0, 1], [0.25, 0.65], Extrapolation.CLAMP);
    const scale       = interpolate(breathGlow.value, [0, 1], [1, 1.03], Extrapolation.CLAMP);
    return {
      shadowRadius:  glowRadius,
      shadowOpacity: glowOpacity,
      transform:     [{ scale }],
    };
  });

  const themeGradient = THEME_GRADIENT[story?.theme ?? ''] ?? [Colors.softPurple, Colors.deepPurple];

  // Glow-Reflect border style
  const glowBorderStyle = useAnimatedStyle(() => {
    const borderOpacity = interpolate(glowBorderPulse.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const shadowRadius  = interpolate(glowBorderPulse.value, [0, 1], [0, 32], Extrapolation.CLAMP);
    return {
      borderColor:   `rgba(255,215,0,${borderOpacity * 0.85})`,
      shadowOpacity: interpolate(glowBorderPulse.value, [0, 1], [0, 0.9], Extrapolation.CLAMP),
      shadowRadius,
    };
  });

  // Choice card animated styles
  const choiceAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: choiceAScale.value }],
    opacity: choiceAOpacity.value,
  }));
  const choiceBStyle = useAnimatedStyle(() => ({
    transform: [{ scale: choiceBScale.value }],
    opacity: choiceBOpacity.value,
  }));

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Loading
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.deepSpace, Colors.midnightNavy, '#2B1A5C']}
          style={StyleSheet.absoluteFill}
        />
        <StarField count={40} />
        <View style={styles.centeredState}>
          <Text style={styles.loadingMoon}>🌙</Text>
          <Text style={styles.loadingText}>Opening your story…</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Error / Safe Mode fallback
  // ─────────────────────────────────────────────────────────────────────────
  if (error || !story) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.deepSpace, Colors.midnightNavy, '#2B1A5C']}
          style={StyleSheet.absoluteFill}
        />
        <StarField count={40} />
        <View style={styles.centeredState}>
          <Text style={styles.errorEmoji}>📖</Text>
          <Text style={styles.errorTitle}>Story Not Found</Text>
          <Text style={styles.errorText}>{error ?? 'Please generate a story first.'}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.replace('/(main)/create-story')}
          >
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.errorButtonGradient}
            >
              <Text style={styles.errorButtonText}>Create a Story</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.errorBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBackText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Immersive Player
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Deep space background */}
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#2B1A5C']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={55} />

      {/* Reading progress bar */}
      <View style={[styles.progressBarTrack, { top: insets.top }]}>
        <View style={[styles.progressBarFill, { width: `${scrollProgress * 100}%` as `${number}%` }]} />
      </View>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 12 }, headerStyle]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Bedtime Story</Text>
          <Text style={styles.headerChild}>for {story.childName} ✨</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Favourite button */}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => void handleToggleFavorite()}
          >
            <Animated.Text style={[styles.headerActionIcon, heartStyle]}>
              {isFavorite ? '❤️' : '🤍'}
            </Animated.Text>
          </TouchableOpacity>

          {/* Sleep timer button */}
          <TouchableOpacity
            style={[styles.timerButton, timerActive && styles.timerButtonActive]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTimerModal(true);
            }}
          >
            <Text style={styles.timerIcon}>⏱</Text>
            {timerActive && (
              <Text style={styles.timerCountdown}>{formatTimer(sleepSecondsLeft)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Main scroll content ─────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Cover art / theme visual */}
        <Animated.View style={[styles.coverWrapper, coverStyle]}>
          {story.imageUrl ? (
            <Image
              source={{ uri: story.imageUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={themeGradient as [string, string]}
              style={styles.coverPlaceholder}
            >
              <PulsingMoon />
              <Text style={styles.coverPlaceholderTheme}>{story.theme}</Text>
            </LinearGradient>
          )}
          {/* Gradient fade at bottom of cover */}
          <LinearGradient
            colors={['transparent', Colors.deepSpace]}
            style={styles.coverFade}
          />
        </Animated.View>

        {/* Story title */}
        <Animated.View style={[styles.titleSection, contentStyle]}>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.themeBadge}>
              <Text style={styles.themeBadgeText}>{story.theme}</Text>
            </View>
            {activeNarrator && (
              <View style={[styles.narratorBadge, { borderColor: `${activeNarrator.accentColor}60`, backgroundColor: `${activeNarrator.glowColor}18` }]}>
                <Text style={styles.narratorBadgeEmoji}>{activeNarrator.emoji}</Text>
                <Text style={[styles.narratorBadgeText, { color: activeNarrator.accentColor }]}>
                  {activeNarrator.name}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Glassmorphism story text card ────────────────────────────────── */}
        <Animated.View style={[styles.storyCard, contentStyle]}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(37,38,85,0.7)', 'rgba(13,14,36,0.5)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <View style={styles.storyCardInner}>
            <Text style={styles.storyText}>{story.content}</Text>
          </View>
        </Animated.View>

        {/* ── Interactive Adventure Choice Cards ─────────────────────────── */}
        {story.isInteractive && !story.branchContent && showChoiceCards && (
          <View style={styles.choiceSection}>
            <Text style={styles.choiceSectionTitle}>✨ The Adventure Awaits…</Text>
            <Text style={styles.choiceSectionSubtitle}>What should {story.childName} do?</Text>

            {/* Choice Timer */}
            <View style={styles.choiceTimerRow}>
              <View style={styles.choiceTimerBg}>
                <Text style={styles.choiceTimerText}>{choiceTimerLeft}</Text>
                <Text style={styles.choiceTimerSec}>sec</Text>
              </View>
            </View>

            <View style={styles.choiceCards}>
              {story.choiceOptions?.map((option, idx) => (
                <Animated.View
                  key={idx}
                  style={[styles.choiceCardWrapper, idx === 0 ? choiceAStyle : choiceBStyle]}
                >
                  <TouchableOpacity
                    style={styles.choiceCard}
                    onPress={() => void handleChoiceSelect(idx)}
                    onPressIn={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={idx === 0
                        ? ['rgba(107,72,184,0.4)', 'rgba(107,72,184,0.15)']
                        : ['rgba(255,140,66,0.4)', 'rgba(255,140,66,0.15)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                    />
                    <Text style={styles.choiceCardEmoji}>{option.emoji}</Text>
                    <Text style={styles.choiceCardLabel}>{option.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* Branch generating indicator */}
        {isGeneratingBranch && (
          <View style={styles.branchLoadingSection}>
            <ActivityIndicator color={Colors.celestialGold} />
            <Text style={styles.branchLoadingText}>{"Writing your story's ending\u2026"}</Text>
          </View>
        )}

        {/* Branch content */}
        {story.isInteractive && story.branchContent && (
          <Animated.View style={[styles.storyCard, contentStyle, { marginTop: 0 }]}>
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(107,72,184,0.35)', 'rgba(13,14,36,0.5)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.storyCardInner}>
              <View style={styles.branchHeader}>
                <Text style={styles.branchHeaderEmoji}>🌟</Text>
                <Text style={styles.branchHeaderText}>Your Adventure Continues…</Text>
              </View>
              <Text style={styles.storyText}>{story.branchContent}</Text>
            </View>
          </Animated.View>
        )}

        {/* Decorative end-of-story stars */}
        <Animated.View style={[styles.endOfStory, contentStyle]}>
          <Text style={styles.endStar}>✦</Text>
          <Text style={styles.endText}>The End</Text>
          <Text style={styles.endStar}>✦</Text>
        </Animated.View>

        {/* ── Quiet Time Reflections ───────────────────────────────────── */}
        {showQuietTimeBtn && !quietTimeActive && (
          <Animated.View style={[styles.quietTimeBanner, contentStyle]}>
            <TouchableOpacity
              style={styles.quietTimeBtn}
              onPress={() => void handleBeginQuietTime()}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <Text style={styles.quietTimeBtnEmoji}>🌿</Text>
              <View style={styles.quietTimeBtnText}>
                <Text style={styles.quietTimeBtnTitle}>Begin Quiet Time</Text>
                <Text style={styles.quietTimeBtnSubtitle}>Gentle reflection questions await…</Text>
              </View>
              <Text style={styles.quietTimeBtnChevron}>›</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {quietTimeActive && (
          <View style={styles.quietTimeSection}>
            <LinearGradient
              colors={['rgba(255,215,0,0.06)', 'rgba(26,27,65,0.95)', 'rgba(255,215,0,0.04)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <Text style={styles.quietTimeSectionTitle}>🌟  Quiet Time Reflections</Text>
            <Text style={styles.quietTimeSectionSubtitle}>
              Take a breath together and think about tonight&apos;s story…
            </Text>
            {isLoadingReflections ? (
              <View style={styles.reflectionsLoading}>
                <Text style={styles.reflectionsLoadingEmoji}>✨</Text>
                <Text style={styles.reflectionsLoadingText}>Crafting your reflection questions…</Text>
              </View>
            ) : (
              <>
                {reflectionQuestions.map((question, i) => (
                  <View key={i} style={styles.reflectionQuestion}>
                    <View style={styles.reflectionQuestionNumber}>
                      <Text style={styles.reflectionQuestionNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.reflectionQuestionText}>{question}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.endQuietTimeBtn}
                  onPress={handleEndQuietTime}
                  activeOpacity={0.85}
                >
                  <Text style={styles.endQuietTimeBtnText}>Sweet Dreams 🌙</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Glow-Reflect border overlay (Quiet Time) ───────────────────── */}
      {quietTimeActive && (
        <Animated.View
          style={[styles.glowReflectBorder, glowBorderStyle]}
          pointerEvents="none"
        />
      )}

      {/* ── Glassmorphism bottom controls ──────────────────────────────────── */}
      <Animated.View
        style={[
          styles.controlsBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
          controlsStyle,
        ]}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(13,14,36,0.55)', 'rgba(26,27,65,0.8)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />
        <View style={styles.controlsInner}>
          {/* Back to bookshelf */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace('/(main)/home');
            }}
          >
            <Text style={styles.controlBtnIcon}>🏠</Text>
            <Text style={styles.controlBtnLabel}>Home</Text>
          </TouchableOpacity>

          {/* Create new story — with calming breathing glow */}
          <Animated.View
            style={[
              styles.controlBtnPrimary,
              breathGlowStyle,
              { shadowColor: Colors.celestialGold },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.replace('/(main)/create-story');
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.controlBtnPrimaryGradient}
              >
                <Text style={styles.controlBtnPrimaryIcon}>🪄</Text>
                <Text style={styles.controlBtnPrimaryLabel}>New Story</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Sound Waves / Ambient Mixer */}
          <TouchableOpacity
            style={[styles.controlBtn, showAmbientMixer && styles.controlBtnSoundsActive]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAmbientMixer(true);
            }}
          >
            <Text style={styles.controlBtnIcon}>🌊</Text>
            <Text style={styles.controlBtnLabel}>Sounds</Text>
          </TouchableOpacity>

          {/* Sleep timer toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, timerActive && styles.controlBtnTimerActive]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (timerActive) clearSleepTimer(); else setShowTimerModal(true);
            }}
          >
            <Text style={styles.controlBtnIcon}>{timerActive ? '⏹' : '⏱'}</Text>
            <Text style={styles.controlBtnLabel}>
              {timerActive ? formatTimer(sleepSecondsLeft) : 'Timer'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Ambient Mixer Bottom Sheet ──────────────────────────────────── */}
      <AmbientMixer
        visible={showAmbientMixer}
        onClose={() => setShowAmbientMixer(false)}
      />

      {/* ── Sleep Timer Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showTimerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTimerModal(false)}
        >
          <View style={styles.timerModal}>
            <LinearGradient
              colors={[Colors.midnightNavy, Colors.deepSpace]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {/* prevent close when tapping modal body */}}
              style={styles.timerModalBody}
            >
              <Text style={styles.timerModalTitle}>⏱  Sleep Timer</Text>
              <Text style={styles.timerModalSubtitle}>
                The story will end after the selected time
              </Text>
              <View style={styles.timerOptions}>
                {SLEEP_TIMER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[
                      styles.timerOption,
                      sleepTimerMinutes === opt.minutes && styles.timerOptionSelected,
                    ]}
                    onPress={() => handleTimerSelect(opt.minutes)}
                  >
                    <Text
                      style={[
                        styles.timerOptionText,
                        sleepTimerMinutes === opt.minutes && styles.timerOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.timerModalClose}
                onPress={() => setShowTimerModal(false)}
              >
                <Text style={styles.timerModalCloseText}>Cancel</Text>
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
// Cover height is capped to 40% of screen height so it never clips on small
// devices (iPhone SE: 667px → cap = 267px).
const COVER_MAX_HEIGHT = Math.min(H * 0.40, 300);
// Controls bar height is flexible; we only set a min so it fits on 320px-wide
// screens without clipping the glassmorphism buttons.
const CONTROLS_MIN_HEIGHT = 88;

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.deepSpace },

  // ── Loading / error states
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 16 },
  loadingMoon:   { fontSize: 56 },
  loadingText:   { fontFamily: Fonts.bold,      fontSize: 16, color: Colors.textMuted, textAlign: 'center' },
  errorEmoji:    { fontSize: 56 },
  errorTitle:    { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.moonlightCream, textAlign: 'center' },
  errorText:     { fontFamily: Fonts.regular,   fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  errorButton:   { borderRadius: Radius.full, overflow: 'hidden', marginTop: 8 },
  errorButtonGradient: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: Radius.full },
  errorButtonText:    { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
  errorBackButton:    { marginTop: 8, padding: Spacing.md },
  errorBackText:      { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },

  // ── Progress bar
  progressBarTrack: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex:          10,
  },
  progressBarFill: {
    height:          '100%',
    backgroundColor: Colors.celestialGold,
  },

  // ── Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom:   Spacing.md,
    zIndex:          5,
  },
  backButton: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(37,38,85,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  backIcon:    { fontSize: 28, color: Colors.moonlightCream, lineHeight: 32 },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: Spacing.sm },
  headerLabel:  { fontFamily: Fonts.bold,      fontSize: 13, color: Colors.textMuted },
  headerChild:  { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },

  headerActions: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
  },
  headerActionBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(37,38,85,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  headerActionIcon: { fontSize: 20 },

  timerButton: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          44,
    minWidth:        44,
    paddingHorizontal: 12,
    borderRadius:    22,
    backgroundColor: 'rgba(37,38,85,0.7)',
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    gap:             4,
  },
  timerButtonActive: {
    borderColor:     Colors.celestialGold,
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  timerIcon:      { fontSize: 18 },
  timerCountdown: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.celestialGold },

  // ── Scroll content
  scrollContent: { paddingHorizontal: 0 },

  // Cover art
  coverWrapper: {
    width:    W,
    height:   COVER_MAX_HEIGHT,
    overflow: 'hidden',
  },
  coverImage: {
    width:  '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width:          '100%',
    height:         '100%',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  moonAccent:            { fontSize: 64 },
  coverPlaceholderTheme: { fontFamily: Fonts.extraBold, fontSize: 22, color: '#fff', opacity: 0.85 },
  coverFade: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    height:   80,
  },

  // Title
  titleSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.lg,
    paddingBottom:     Spacing.md,
    gap:               8,
  },
  storyTitle: {
    fontFamily: Fonts.black,
    fontSize:   24,
    color:      Colors.moonlightCream,
    lineHeight: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    alignItems:    'center',
  },
  themeBadge: {
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(255,215,0,0.12)',
    borderRadius:      Radius.full,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.3)',
  },
  themeBadgeText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  narratorBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      Radius.full,
    borderWidth:       1,
  },
  narratorBadgeEmoji: { fontSize: 14 },
  narratorBadgeText:  { fontFamily: Fonts.bold, fontSize: 11 },

  // ── Glassmorphism story card
  storyCard: {
    marginHorizontal: Spacing.lg,
    borderRadius:     Radius.xl,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      'rgba(255,255,255,0.1)',
    // Minimum height prevents the card from being too small on iPhone SE
    minHeight:        120,
  },
  storyCardInner: {
    padding: Spacing.lg,
  },
  storyText: {
    fontFamily: Fonts.regular,
    fontSize:   16,
    color:      Colors.moonlightCream,
    lineHeight: 28,
  },

  // End of story
  endOfStory: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap:            12,
  },
  endStar: { fontSize: 18, color: Colors.celestialGold },
  endText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textMuted },

  // ── Glassmorphism controls bar
  // borderRadius and overflow are set but the bar sits at the bottom edge.
  // paddingBottom uses Math.max(insets.bottom, 12) to handle both notched and
  // flat-bottom devices without overflow clipping.
  controlsBar: {
    position:         'absolute',
    bottom:           0,
    left:             Spacing.md,
    right:            Spacing.md,
    borderRadius:     Radius.xl,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      'rgba(255,255,255,0.12)',
    minHeight:        CONTROLS_MIN_HEIGHT,
    marginBottom:     Spacing.md,
  },
  controlsInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop:     Spacing.md,
    gap:            8,
  },
  controlBtn: {
    alignItems:      'center',
    gap:             4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius:    Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    minWidth:        64,
  },
  controlBtnTimerActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  controlBtnSoundsActive: {
    backgroundColor: 'rgba(126,200,227,0.18)',
    borderColor:     Colors.softBlue,
    borderWidth:     1,
  },
  controlBtnIcon:  { fontSize: 22 },
  controlBtnLabel: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.textMuted },

  controlBtnPrimary: {
    flex:         1,
    borderRadius: Radius.full,
    overflow:     'hidden',
    marginHorizontal: 4,
  },
  controlBtnPrimaryGradient: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  12,
    paddingHorizontal: 16,
    borderRadius:     Radius.full,
    gap:              6,
  },
  controlBtnPrimaryIcon:  { fontSize: 20 },
  controlBtnPrimaryLabel: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.deepSpace },

  // ── Quiet Time Reflections
  quietTimeBanner: {
    paddingHorizontal: Spacing.lg,
    marginBottom:      Spacing.xl,
  },
  quietTimeBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    borderRadius:     Radius.xl,
    borderWidth:      1,
    borderColor:      'rgba(255,215,0,0.35)',
    padding:          Spacing.md,
    overflow:         'hidden',
    gap:              Spacing.md,
  },
  quietTimeBtnEmoji:    { fontSize: 26 },
  quietTimeBtnText:     { flex: 1 },
  quietTimeBtnTitle:    { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.celestialGold },
  quietTimeBtnSubtitle: { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  quietTimeBtnChevron:  { fontFamily: Fonts.bold, fontSize: 22, color: Colors.celestialGold },

  quietTimeSection: {
    marginHorizontal: Spacing.lg,
    marginBottom:     Spacing.xl,
    borderRadius:     Radius.xl,
    borderWidth:      1.5,
    borderColor:      'rgba(255,215,0,0.25)',
    padding:          Spacing.lg,
    overflow:         'hidden',
    gap:              Spacing.md,
  },
  quietTimeSectionTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   17,
    color:      Colors.celestialGold,
    textAlign:  'center',
  },
  quietTimeSectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 20,
  },
  reflectionsLoading: {
    alignItems:  'center',
    gap:         Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  reflectionsLoadingEmoji: { fontSize: 32 },
  reflectionsLoadingText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  reflectionQuestion: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            Spacing.md,
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderRadius:   Radius.md,
    padding:        Spacing.md,
    borderWidth:    1,
    borderColor:    'rgba(255,215,0,0.12)',
  },
  reflectionQuestionNumber: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.3)',
    flexShrink:      0,
  },
  reflectionQuestionNumberText: {
    fontFamily: Fonts.extraBold,
    fontSize:   12,
    color:      Colors.celestialGold,
  },
  reflectionQuestionText: {
    fontFamily: Fonts.medium,
    fontSize:   15,
    color:      Colors.moonlightCream,
    lineHeight: 22,
    flex:       1,
  },
  endQuietTimeBtn: {
    alignSelf:        'center',
    marginTop:        Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical:  12,
    borderRadius:     Radius.full,
    borderWidth:      1,
    borderColor:      'rgba(255,215,0,0.3)',
    backgroundColor:  'rgba(255,215,0,0.08)',
  },
  endQuietTimeBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   14,
    color:      Colors.celestialGold,
  },

  // ── Glow-Reflect border
  glowReflectBorder: {
    position:     'absolute',
    top:          0,
    left:         0,
    right:        0,
    bottom:       0,
    borderWidth:  2.5,
    borderRadius: 0,
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Sleep Timer Modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'flex-end',
    padding:         Spacing.lg,
  },
  timerModal: {
    width:        '100%',
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  Colors.borderColor,
  },
  timerModalBody: {
    padding: Spacing.xl,
    gap:     Spacing.md,
  },
  timerModalTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   20,
    color:      Colors.moonlightCream,
    textAlign:  'center',
  },
  timerModalSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  timerOptions: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  timerOption: {
    paddingHorizontal: 18,
    paddingVertical:   10,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.borderColor,
    backgroundColor:   Colors.cardBg,
  },
  timerOptionSelected: {
    borderColor:     Colors.celestialGold,
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  timerOptionText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
  },
  timerOptionTextSelected: {
    color: Colors.celestialGold,
  },
  timerModalClose: {
    alignItems:    'center',
    paddingVertical: Spacing.md,
    marginTop:     Spacing.sm,
    borderRadius:  Radius.full,
    borderWidth:   1,
    borderColor:   Colors.borderColor,
  },
  timerModalCloseText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
  },

  // ── Interactive Adventure Choice Cards
  choiceSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  choiceSectionTitle: {
    fontFamily: Fonts.black,
    fontSize: 22,
    color: Colors.moonlightCream,
    textAlign: 'center',
  },
  choiceSectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  choiceTimerRow: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  choiceTimerBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Colors.celestialGold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  choiceTimerText: {
    fontFamily: Fonts.black,
    fontSize: 22,
    color: Colors.celestialGold,
  },
  choiceTimerSec: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: -4,
  },
  choiceCards: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  choiceCardWrapper: {
    flex: 1,
  },
  choiceCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 120,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  choiceCardEmoji: {
    fontSize: 36,
  },
  choiceCardLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    color: Colors.moonlightCream,
    textAlign: 'center',
  },
  branchLoadingSection: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  branchLoadingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  branchHeaderEmoji: { fontSize: 20 },
  branchHeaderText: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    color: Colors.celestialGold,
  },
});
