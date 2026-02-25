import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
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
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import ParentalGate from '@/components/ParentalGate';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
export interface ReflectionAnswer {
  question: string;
  answer:   string;
}

export interface JournalEntry {
  id:          string;
  date:        string;          // ISO string
  storyTitle:  string;
  childName:   string;
  theme?:      string;
  answers:     ReflectionAnswer[];
  parentNotes: string;
}

const JOURNAL_KEY = 'journal_entries';

// ──────────────────────────────────────────────────────────────────────────────
// Entry Card Component
// ──────────────────────────────────────────────────────────────────────────────
function EntryCard({
  entry,
  index,
  onPress,
}: {
  entry: JournalEntry;
  index: number;
  onPress: () => void;
}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value    = withDelay(index * 80, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 80, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const dateObj = new Date(entry.date);
  const dateLabel = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  });

  return (
    <Animated.View style={cardStyle}>
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['rgba(107,72,184,0.15)', 'rgba(107,72,184,0.04)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />

        {/* Date badge */}
        <View style={styles.entryDateBadge}>
          <Text style={styles.entryDateDay}>{dateObj.getDate()}</Text>
          <Text style={styles.entryDateMonth}>
            {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.entryContent}>
          <Text style={styles.entryTitle} numberOfLines={1}>{entry.storyTitle}</Text>
          <Text style={styles.entryMeta}>
            {dateLabel} · {entry.childName}
          </Text>

          {entry.answers.length > 0 && (
            <View style={styles.entryPreview}>
              <Text style={styles.entryPreviewQ} numberOfLines={1}>
                💬 {entry.answers[0].question}
              </Text>
              {entry.answers[0].answer ? (
                <Text style={styles.entryPreviewA} numberOfLines={1}>
                  {entry.answers[0].answer}
                </Text>
              ) : (
                <Text style={styles.entryPreviewEmpty}>No answer recorded yet</Text>
              )}
            </View>
          )}

          {entry.parentNotes ? (
            <View style={styles.parentNotesBadge}>
              <Text style={styles.parentNotesBadgeText}>📝 Parent note added</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.entryChevron}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry Detail Modal
// ──────────────────────────────────────────────────────────────────────────────
function EntryDetailModal({
  entry,
  visible,
  onClose,
  onSaveNotes,
}: {
  entry: JournalEntry | null;
  visible: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(entry?.parentNotes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) setNotes(entry.parentNotes);
  }, [entry]);

  const handleSave = async () => {
    setIsSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSaveNotes(notes);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 300);
  };

  if (!entry) return null;

  const dateLabel = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={detailStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={detailStyles.sheet}>
          <LinearGradient
            colors={[Colors.midnightNavy, Colors.deepSpace]}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Handle */}
          <View style={detailStyles.handle} />

          <ScrollView
            contentContainerStyle={detailStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={detailStyles.header}>
              <View style={detailStyles.headerLeft}>
                <Text style={detailStyles.dateLabel}>{dateLabel}</Text>
                <Text style={detailStyles.storyTitle} numberOfLines={2}>
                  📖 {entry.storyTitle}
                </Text>
                <Text style={detailStyles.childName}>for {entry.childName}</Text>
              </View>
              <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose}>
                <Text style={detailStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Reflection Questions & Answers */}
            {entry.answers.length > 0 && (
              <>
                <Text style={detailStyles.sectionTitle}>🌟 Quiet Time Reflections</Text>
                {entry.answers.map((item, i) => (
                  <View key={i} style={detailStyles.qaCard}>
                    <LinearGradient
                      colors={['rgba(255,215,0,0.07)', 'rgba(255,215,0,0.02)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                    />
                    <Text style={detailStyles.question}>Q: {item.question}</Text>
                    <Text style={detailStyles.answer}>
                      {item.answer || <Text style={detailStyles.noAnswer}>No answer recorded</Text>}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Parent Notes */}
            <Text style={detailStyles.sectionTitle}>📝 Your Notes</Text>
            <Text style={detailStyles.notesHint}>
              Add your own thoughts, observations, or memories about tonight
            </Text>
            <TextInput
              style={detailStyles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={`Write your thoughts about ${entry.childName}'s story tonight…`}
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              selectionColor={Colors.celestialGold}
            />

            {/* Save button */}
            <TouchableOpacity
              style={[detailStyles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={() => void handleSave()}
              disabled={isSaving}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={detailStyles.saveBtnGradient}
              >
                <Text style={detailStyles.saveBtnText}>
                  {isSaving ? '✓ Saved' : '💾 Save Notes'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    maxHeight:    '90%',
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow:     'hidden',
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.borderColor,
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    8,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap:     Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   Spacing.sm,
  },
  headerLeft:  { flex: 1, gap: 4 },
  dateLabel:   { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, letterSpacing: 0.5 },
  storyTitle:  { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream, lineHeight: 24 },
  childName:   { fontFamily: Fonts.medium, fontSize: 13, color: Colors.celestialGold },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      8,
  },
  closeBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },

  sectionTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
    color:      Colors.moonlightCream,
    marginTop:  Spacing.sm,
  },
  notesHint: {
    fontFamily: Fonts.regular,
    fontSize:   12,
    color:      Colors.textMuted,
    marginTop:  -Spacing.sm,
    lineHeight: 18,
  },

  qaCard: {
    borderRadius: Radius.lg,
    borderWidth:  1,
    borderColor:  'rgba(255,215,0,0.2)',
    padding:      Spacing.md,
    gap:          8,
    overflow:     'hidden',
  },
  question: { fontFamily: Fonts.bold,    fontSize: 14, color: Colors.celestialGold, lineHeight: 20 },
  answer:   { fontFamily: Fonts.regular, fontSize: 14, color: Colors.moonlightCream, lineHeight: 22 },
  noAnswer: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' } as const,

  notesInput: {
    backgroundColor: Colors.inputBg,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    padding:         Spacing.md,
    fontFamily:      Fonts.regular,
    fontSize:        14,
    color:           Colors.moonlightCream,
    minHeight:       120,
    lineHeight:      22,
  },

  saveBtn: {
    borderRadius: Radius.full,
    overflow:     'hidden',
    marginTop:    Spacing.sm,
  },
  saveBtnGradient: {
    paddingVertical:  16,
    alignItems:       'center',
    borderRadius:     Radius.full,
  },
  saveBtnText: { fontFamily: Fonts.black, fontSize: 16, color: Colors.deepSpace },
});

// ──────────────────────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────────────────────
export default function BedtimeJournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showGate,      setShowGate]      = useState(true);
  const [gateUnlocked,  setGateUnlocked]  = useState(false);
  const [entries,       setEntries]       = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showDetail,    setShowDetail]    = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);

  // Entrance animations
  const headerAnim  = useSharedValue(0);
  const contentAnim = useSharedValue(0);

  const loadEntries = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(JOURNAL_KEY);
      const data: JournalEntry[] = raw ? JSON.parse(raw) : [];
      // Sort newest first
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGateSuccess = useCallback(() => {
    setShowGate(false);
    setGateUnlocked(true);
    headerAnim.value  = withTiming(1, { duration: 600 });
    contentAnim.value = withDelay(200, withTiming(1, { duration: 700 }));
    void loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEntries]);

  const handleSaveNotes = useCallback(async (notes: string) => {
    if (!selectedEntry) return;
    try {
      const raw = await AsyncStorage.getItem(JOURNAL_KEY);
      const data: JournalEntry[] = raw ? JSON.parse(raw) : [];
      const updated = data.map((e) =>
        e.id === selectedEntry.id ? { ...e, parentNotes: notes } : e
      );
      await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(updated));
      setEntries(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // non-fatal
    }
  }, [selectedEntry]);

  const headerStyle  = useAnimatedStyle(() => ({
    opacity:   headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * -20 }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentAnim.value,
  }));

  // Group entries by month
  const entriesByMonth: Record<string, JournalEntry[]> = {};
  entries.forEach((entry) => {
    const key = new Date(entry.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!entriesByMonth[key]) entriesByMonth[key] = [];
    entriesByMonth[key].push(entry);
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0E24', '#1A1B41', '#2B1A5C']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={30} />

      {/* Parental Gate */}
      <ParentalGate
        visible={showGate && !gateUnlocked}
        onSuccess={handleGateSuccess}
        onDismiss={() => router.back()}
        context="Bedtime Journal"
      />

      {gateUnlocked && (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View style={[styles.header, headerStyle]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>📓 Bedtime Journal</Text>
            <View style={{ width: 60 }} />
          </Animated.View>

          <Animated.View style={contentStyle}>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(107,72,184,0.3)', 'rgba(107,72,184,0.08)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              {Platform.OS === 'ios' && (
                <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <Text style={styles.heroEmoji}>🌙</Text>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>Your Child&apos;s Story</Text>
                <Text style={styles.heroSubtitle}>
                  A private window into their imagination, emotions, and growth — one story at a time.
                </Text>
              </View>
            </View>

            {/* Empty state */}
            {!isLoading && entries.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyTitle}>No entries yet</Text>
                <Text style={styles.emptyText}>
                  After your child answers Quiet Time Reflections in the story player, their answers will appear here as journal entries.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.replace('/(main)/home')}
                >
                  <Text style={styles.emptyBtnText}>Create a Story →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Entries by month */}
            {Object.entries(entriesByMonth).map(([month, monthEntries]) => (
              <View key={month} style={styles.monthGroup}>
                <Text style={styles.monthLabel}>{month}</Text>
                {monthEntries.map((entry, i) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onPress={() => {
                      setSelectedEntry(entry);
                      setShowDetail(true);
                    }}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      )}

      {/* Entry Detail Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onSaveNotes={(notes) => void handleSaveNotes(notes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  scroll:    { paddingHorizontal: Spacing.lg },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.xl,
  },
  backBtn:     { paddingVertical: 8, minWidth: 60 },
  backText:    { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerTitle: {
    fontFamily: Fonts.black,
    fontSize:   20,
    color:      Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  heroCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.lg,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     'rgba(107,72,184,0.4)',
    overflow:        'hidden',
  },
  heroEmoji: { fontSize: 36 },
  heroText:  { flex: 1, gap: 4 },
  heroTitle: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  heroSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   12,
    color:      Colors.textMuted,
    lineHeight: 18,
  },

  emptyState: {
    alignItems:    'center',
    paddingVertical: Spacing.xxl,
    gap:           Spacing.md,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream },
  emptyText:  {
    fontFamily: Fonts.regular,
    fontSize:   14,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 22,
    maxWidth:   300,
  },
  emptyBtn: {
    marginTop:         Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical:   14,
    borderRadius:      Radius.full,
    backgroundColor:   'rgba(255,215,0,0.12)',
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.3)',
  },
  emptyBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   14,
    color:      Colors.celestialGold,
  },

  monthGroup: { marginBottom: Spacing.xl },
  monthLabel: {
    fontFamily:    Fonts.medium,
    fontSize:      11,
    color:         Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  Spacing.sm,
    marginLeft:    4,
  },

  entryCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     'rgba(107,72,184,0.3)',
    overflow:        'hidden',
    gap:             Spacing.md,
  },
  entryDateBadge: {
    width:           48,
    height:          52,
    backgroundColor: 'rgba(107,72,184,0.2)',
    borderRadius:    Radius.sm,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(107,72,184,0.4)',
    flexShrink:      0,
  },
  entryDateDay:   { fontFamily: Fonts.black, fontSize: 20, color: Colors.moonlightCream, lineHeight: 24 },
  entryDateMonth: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  entryContent:   { flex: 1, gap: 4 },
  entryTitle:     { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.moonlightCream },
  entryMeta:      { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  entryPreview:   { marginTop: 4, gap: 2 },
  entryPreviewQ:  { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  entryPreviewA:  { fontFamily: Fonts.regular, fontSize: 12, color: Colors.moonlightCream },
  entryPreviewEmpty: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  parentNotesBadge: {
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius:    Radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.2)',
    marginTop:         4,
  },
  parentNotesBadgeText: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.celestialGold },
  entryChevron: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textMuted },
});
