import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import AudioWaveform from '@/components/AudioWaveform';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { buildVoiceScript } from '@/lib/newell';
import { updateParentVoice, getParentVoices, isSupabaseAvailable, upsertUserPreferences } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOTAL_PARAGRAPHS = 5;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * VoiceProgressTracker — Phase 7
 *
 * A segmented progress bar that clearly communicates:
 *   • Which phrases have been recorded (✓ gold fill)
 *   • Which phrase is currently active (pulsing gold border)
 *   • Which phrases are still pending (dim outline)
 *   • How many are left to record (status text)
 *   • An overall completion percentage bar
 */
function VoiceProgressTracker({
  current,
  total,
  completed,
}: {
  current: number;
  total: number;
  completed: Set<number>;
}) {
  const recordedCount = completed.size;
  const remaining = total - recordedCount;
  const pct = Math.round((recordedCount / total) * 100);

  // Derive status copy
  const statusCopy = remaining === 0
    ? '🎉 All phrases recorded!'
    : remaining === total
    ? `Record phrase ${current + 1} to begin`
    : `${remaining} phrase${remaining > 1 ? 's' : ''} left to record`;

  return (
    <View style={styles.progressTracker}>
      {/* Segment row */}
      <View style={styles.progressSegments}>
        {Array.from({ length: total }, (_, i) => {
          const isDone    = completed.has(i);
          const isCurrent = i === current;
          return (
            <View
              key={i}
              style={[
                styles.progressSegment,
                isDone    && styles.progressSegmentDone,
                isCurrent && !isDone && styles.progressSegmentActive,
              ]}
            >
              {isDone && (
                <Text style={styles.progressSegmentCheck}>✓</Text>
              )}
              {isCurrent && !isDone && (
                <View style={styles.progressSegmentActiveDot} />
              )}
              {/* Step number label below each segment */}
              <Text style={[
                styles.progressSegmentLabel,
                isDone    && styles.progressSegmentLabelDone,
                isCurrent && !isDone && styles.progressSegmentLabelActive,
              ]}>
                {i + 1}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Overall fill bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
      </View>

      {/* Status text */}
      <View style={styles.progressStatusRow}>
        <Text style={[
          styles.progressStatus,
          remaining === 0 && styles.progressStatusDone,
        ]}>
          {statusCopy}
        </Text>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
    </View>
  );
}

export default function VoiceStudioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [voiceType, setVoiceType] = useState<'mom' | 'dad' | 'custom'>('mom');
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [completedParagraphs, setCompletedParagraphs] = useState<Set<number>>(new Set());
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingUriRef = useRef<string[]>([]);

  // Animations
  const recordButtonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);

  useEffect(() => {
    void loadInitialData();
    void requestPermissions();
    return () => {
      void cleanupRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadInitialData = async () => {
    const vt = (await AsyncStorage.getItem('selected_voice_type')) as 'mom' | 'dad' | 'custom' | null;
    const type = vt ?? 'mom';
    setVoiceType(type);
    setParagraphs(buildVoiceScript(type));
  };

  const requestPermissions = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status !== 'granted') {
      Alert.alert(
        'Microphone Access',
        'StoryVoice needs microphone access to record your voice. Please enable it in Settings.',
        [{ text: 'OK' }]
      );
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  };

  const cleanupRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }
    try {
      await cleanupRecording();
      setRecordingSeconds(0);

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);

      // Pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  }, [hasPermission]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      pulseScale.value = withTiming(1, { duration: 300 });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        recordingUriRef.current[paragraphIndex] = uri;
      }
      recordingRef.current = null;
      setIsRecording(false);
      setCompletedParagraphs((prev) => new Set([...prev, paragraphIndex]));

      // Button bounce
      recordButtonScale.value = withSpring(1.2, {}, () => {
        recordButtonScale.value = withSpring(1);
      });
    } catch {
      setIsRecording(false);
    }
    // pulseScale / recordButtonScale are stable Reanimated shared value refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphIndex]);

  const goToNextParagraph = useCallback(() => {
    if (paragraphIndex < TOTAL_PARAGRAPHS - 1) {
      // Slide out
      cardOpacity.value = withTiming(0, { duration: 200 });
      cardTranslateX.value = withTiming(-40, { duration: 200 }, () => {
        cardTranslateX.value = 40;
        cardOpacity.value = 0;
        setTimeout(() => {
          setParagraphIndex((prev) => prev + 1);
          setRecordingSeconds(0);
          cardOpacity.value = withTiming(1, { duration: 300 });
          cardTranslateX.value = withSpring(0);
        }, 50);
      });
    }
    // cardOpacity / cardTranslateX are stable Reanimated shared value refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphIndex]);

  const goToPrevParagraph = useCallback(() => {
    if (paragraphIndex > 0) {
      cardOpacity.value = withTiming(0, { duration: 200 });
      cardTranslateX.value = withTiming(40, { duration: 200 }, () => {
        cardTranslateX.value = -40;
        cardOpacity.value = 0;
        setTimeout(() => {
          setParagraphIndex((prev) => prev - 1);
          setRecordingSeconds(0);
          cardOpacity.value = withTiming(1, { duration: 300 });
          cardTranslateX.value = withSpring(0);
        }, 50);
      });
    }
    // cardOpacity / cardTranslateX are stable Reanimated shared value refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphIndex]);

  const handleFinish = async () => {
    const allDone = completedParagraphs.size >= TOTAL_PARAGRAPHS;
    if (!allDone) {
      const remaining = TOTAL_PARAGRAPHS - completedParagraphs.size;
      Alert.alert(
        'Almost there!',
        `You have ${remaining} paragraph${remaining > 1 ? 's' : ''} left to record. Would you like to finish the remaining ones?`,
        [
          { text: 'Keep Recording', style: 'cancel' },
          { text: 'Skip & Finish', onPress: () => void saveAndFinish() },
        ]
      );
      return;
    }
    await saveAndFinish();
  };

  const saveAndFinish = async () => {
    setIsSaving(true);
    try {
      const voiceId = await AsyncStorage.getItem('active_voice_id');
      const isComplete = completedParagraphs.size >= TOTAL_PARAGRAPHS;

      if (voiceId && user?.id) {
        // Build recording labels: map each paragraph index to its URI
        const recordingLabels: Record<string, string> = {};
        recordingUriRef.current.forEach((uri, idx) => {
          if (uri) recordingLabels[`paragraph_${idx + 1}`] = uri;
        });

        await updateParentVoice(voiceId, {
          script_paragraphs_recorded: completedParagraphs.size,
          is_complete: isComplete,
          recording_labels: recordingLabels,
          duration_seconds: recordingUriRef.current.reduce(
            (acc, _) => acc + Math.round(recordingSeconds / Math.max(recordingUriRef.current.filter(Boolean).length, 1)),
            0
          ),
        });

        // Refresh voice profiles cache in AsyncStorage
        if (isSupabaseAvailable) {
          const { voices } = await getParentVoices(user.id);
          if (voices) {
            await AsyncStorage.setItem('sync_voice_profiles', JSON.stringify(voices));
          }

          // Sync active voice and narrator type to user_preferences
          await upsertUserPreferences(user.id, {
            active_voice_id: voiceId,
            narrator_type: voiceType,
            last_sync_at: new Date().toISOString(),
          });
        }
      }

      await AsyncStorage.setItem('onboarding_complete', 'true');
      router.replace('/(main)/home');
    } catch {
      await AsyncStorage.setItem('onboarding_complete', 'true');
      router.replace('/(main)/home');
    } finally {
      setIsSaving(false);
    }
  };

  const recordButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordButtonScale.value }],
  }));
  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: isRecording ? 0.4 : 0,
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  const currentParagraph = paragraphs[paragraphIndex] ?? '';
  const isDoneWithCurrent = completedParagraphs.has(paragraphIndex);
  const allRecorded = completedParagraphs.size >= TOTAL_PARAGRAPHS;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#1D1550']}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={35} />

      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 3 of 3</Text>
          </View>
        </View>

        <Text style={styles.title}>Voice Studio 🎙️</Text>
        <Text style={styles.subtitle}>
          {voiceType === 'mom' ? "Mom's" : voiceType === 'dad' ? "Dad's" : 'Custom'} voice — read each paragraph aloud
        </Text>

        {/* Progress */}
        <VoiceProgressTracker
          current={paragraphIndex}
          total={TOTAL_PARAGRAPHS}
          completed={completedParagraphs}
        />

        {/* Script card */}
        <Animated.View style={[styles.scriptCard, cardAnimStyle]}>
          <LinearGradient
            colors={['rgba(74,56,128,0.6)', 'rgba(37,38,85,0.8)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <View style={styles.scriptCardHeader}>
            <View style={[styles.paragraphBadge, isDoneWithCurrent && styles.paragraphBadgeDone]}>
              <Text style={styles.paragraphBadgeText}>
                {isDoneWithCurrent ? '✓ Recorded' : `¶ ${paragraphIndex + 1}`}
              </Text>
            </View>
            {recordingSeconds > 0 && !isRecording && (
              <Text style={styles.durationText}>{formatTime(recordingSeconds)}</Text>
            )}
          </View>
          <Text style={styles.scriptText}>{currentParagraph}</Text>

          {/* Navigation arrows */}
          <View style={styles.navButtons}>
            <TouchableOpacity
              style={[styles.navButton, paragraphIndex === 0 && styles.navButtonDisabled]}
              onPress={goToPrevParagraph}
              disabled={paragraphIndex === 0 || isRecording}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, paragraphIndex === TOTAL_PARAGRAPHS - 1 && styles.navButtonDisabled]}
              onPress={goToNextParagraph}
              disabled={paragraphIndex === TOTAL_PARAGRAPHS - 1 || isRecording}
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Waveform */}
        <View style={styles.waveformSection}>
          <AudioWaveform isRecording={isRecording} color={isRecording ? Colors.celestialGold : Colors.borderColor} />
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>{formatTime(recordingSeconds)}</Text>
            </View>
          )}
        </View>

        {/* Record button */}
        <View style={styles.recordSection}>
          {/* Pulse ring */}
          <Animated.View style={[styles.pulseRing, pulseAnimStyle]} />

          <Animated.View style={recordButtonAnimStyle}>
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={hasPermission === false}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  isRecording
                    ? [Colors.errorRed, '#CC4444']
                    : [Colors.softPurple, Colors.mediumPurple]
                }
                style={styles.recordButtonGradient}
              >
                <Text style={styles.recordButtonIcon}>{isRecording ? '⬛' : '🎙️'}</Text>
                <Text style={styles.recordButtonText}>
                  {isRecording ? 'Stop' : isDoneWithCurrent ? 'Re-record' : 'Record'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {isDoneWithCurrent && !isRecording && paragraphIndex < TOTAL_PARAGRAPHS - 1 && (
            <TouchableOpacity style={styles.nextButton} onPress={goToNextParagraph}>
              <Text style={styles.nextButtonText}>Next paragraph →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tip */}
        {!isRecording && (
          <View style={styles.tipBanner}>
            <Text style={styles.tipEmoji}>💡</Text>
            <Text style={styles.tipText}>
              {hasPermission === false
                ? 'Microphone permission needed. Tap Record to request access.'
                : isDoneWithCurrent
                ? 'Great job! Tap re-record if you want another take, or move to the next paragraph.'
                : 'Find a quiet spot, take a breath, and read in your natural bedtime voice.'}
            </Text>
          </View>
        )}

        {/* Finish button */}
        <TouchableOpacity
          style={[
            styles.finishButton,
            completedParagraphs.size === 0 && styles.finishButtonDisabled,
            allRecorded && styles.finishButtonReady,
          ]}
          onPress={handleFinish}
          disabled={isSaving || completedParagraphs.size === 0}
        >
          <Text style={[styles.finishButtonText, allRecorded && styles.finishButtonTextReady]}>
            {isSaving
              ? 'Saving…'
              : allRecorded
              ? '✨ Finish & Generate Stories!'
              : `Save Progress (${completedParagraphs.size}/${TOTAL_PARAGRAPHS} done)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  backButton: { paddingVertical: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  stepBadge: {
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.softPurple,
  },
  stepText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  title: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.moonlightCream, marginBottom: 4 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, marginBottom: Spacing.md },
  // ── Voice Progress Tracker ──────────────────────────────────────────────────
  progressTracker: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  progressSegments: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(61,63,122,0.4)',
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  progressSegmentDone: {
    backgroundColor: 'rgba(107,203,119,0.15)',
    borderColor: Colors.successGreen,
  },
  progressSegmentActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: Colors.celestialGold,
    borderWidth: 2,
  },
  progressSegmentCheck: {
    fontSize: 14,
    color: Colors.successGreen,
    fontFamily: Fonts.black,
    lineHeight: 16,
  },
  progressSegmentActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.celestialGold,
  },
  progressSegmentLabel: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 13,
  },
  progressSegmentLabelDone: {
    color: Colors.successGreen,
  },
  progressSegmentLabelActive: {
    color: Colors.celestialGold,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(61,63,122,0.5)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.celestialGold,
    borderRadius: 2,
  },
  progressStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressStatus: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  progressStatusDone: {
    color: Colors.successGreen,
    fontFamily: Fonts.bold,
  },
  progressPct: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    color: Colors.celestialGold,
  },
  scriptCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
    minHeight: 160,
  },
  scriptCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  paragraphBadge: {
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.softPurple,
  },
  paragraphBadgeDone: { backgroundColor: 'rgba(107,203,119,0.2)', borderColor: Colors.successGreen },
  paragraphBadgeText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  durationText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted },
  scriptText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.moonlightCream,
    lineHeight: 24,
    flex: 1,
  },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(107,72,184,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  navButtonDisabled: { opacity: 0.3 },
  navButtonText: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textLight, lineHeight: 26 },
  waveformSection: { alignItems: 'center', marginBottom: Spacing.sm },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.errorRed },
  recordingTimer: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream },
  recordSection: { alignItems: 'center', marginBottom: Spacing.md },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.celestialGold,
    top: -10,
  },
  recordButton: { borderRadius: 40, overflow: 'hidden' },
  recordButtonActive: {},
  recordButtonGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recordButtonIcon: { fontSize: 28 },
  recordButtonText: { fontFamily: Fonts.bold, fontSize: 13, color: '#fff' },
  nextButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
  },
  nextButtonText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(37,38,85,0.8)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 10,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  tipEmoji: { fontSize: 18, marginTop: 1 },
  tipText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, flex: 1, lineHeight: 18 },
  finishButton: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
  },
  finishButtonDisabled: { opacity: 0.4 },
  finishButtonReady: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderColor: Colors.celestialGold,
  },
  finishButtonText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textMuted },
  finishButtonTextReady: { color: Colors.celestialGold },
});
