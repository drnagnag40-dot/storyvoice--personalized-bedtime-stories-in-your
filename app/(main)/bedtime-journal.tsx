/**
 * Bedtime Journal — Crystal Night Diary Edition
 *
 * A magical parent-only journal accessible behind the Crystal Parental Gate.
 * Features frosted-glass "pages" that float in the celestial background,
 * displaying AI-generated Quiet Time Reflections from each completed story.
 *
 * Design: digital diary aesthetic — ink-gold accents, floating glass pages,
 * constellation dividers, and a deep crystal-night atmosphere.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
  Dimensions,
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
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StarField from '@/components/StarField';
import ParentalGate from '@/components/ParentalGate';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
export interface ReflectionAnswer {
  question: string;
  answer:   string;
}

export interface JournalEntry {
  id:          string;
  date:        string;
  storyTitle:  string;
  childName:   string;
  theme?:      string;
  answers:     ReflectionAnswer[];
  parentNotes: string;
}

const JOURNAL_KEY = 'journal_entries';

// Theme colour map for page tints
const THEME_TINTS: Record<string, string> = {
  Adventurous: '#FF8C42',
  Calming:     '#7EC8E3',
  Funny:       '#FF6B9D',
  Educational: '#6BCB77',
  default:     '#9B6FDE',
};

function getThemeTint(theme?: string) {
  return THEME_TINTS[theme ?? ''] ?? THEME_TINTS.default;
}

// ──────────────────────────────────────────────────────────────────────────────
// Twinkling constellation dot — decorative separator element
// ──────────────────────────────────────────────────────────────────────────────
function ConstellationDot({ delay = 0 }: { delay?: number }) {
  const op = useSharedValue(0.3);
  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(op);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[dotStyles.dot, style]} />;
}
const dotStyles = StyleSheet.create({
  dot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.celestialGold,
    shadowColor:     Colors.celestialGold,
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    4,
    shadowOpacity:   0.8,
    elevation:       3,
  },
});

function ConstellationDivider() {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <ConstellationDot delay={0} />
      <View style={dividerStyles.lineShort} />
      <ConstellationDot delay={300} />
      <View style={dividerStyles.lineShort} />
      <ConstellationDot delay={600} />
      <View style={dividerStyles.line} />
    </View>
  );
}
const dividerStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  line:      { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.18)', borderRadius: 1 },
  lineShort: { width: 12, height: 1, backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 1 },
});

// ──────────────────────────────────────────────────────────────────────────────
// Diary Page Card (Entry)
// ──────────────────────────────────────────────────────────────────────────────
function DiaryPageCard({
  entry,
  index,
  onPress,
}: {
  entry:   JournalEntry;
  index:   number;
  onPress: () => void;
}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(28);
  const rotate     = useSharedValue(index % 2 === 0 ? -0.8 : 0.8); // subtle page tilt

  useEffect(() => {
    const del = index * 90;
    opacity.value    = withDelay(del, withTiming(1,   { duration: 500 }));
    translateY.value = withDelay(del, withTiming(0,   { duration: 500, easing: Easing.out(Easing.back(1.1)) }));
    rotate.value     = withDelay(del, withSpring(0,   { damping: 14, stiffness: 120 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  const dateObj   = new Date(entry.date);
  const dayNum    = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearNum   = dateObj.getFullYear();
  const weekday   = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const tint      = getThemeTint(entry.theme);

  return (
    <Animated.View style={[pageStyles.wrapper, cardStyle]}>
      <TouchableOpacity
        style={pageStyles.page}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.88}
      >
        {/* Blur layer */}
        {Platform.OS !== 'web' && (
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        )}

        {/* Base glass */}
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />

        {/* Theme colour tint */}
        <LinearGradient
          colors={[`${tint}22`, `${tint}06`]}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />

        {/* Shine edge */}
        <View style={pageStyles.shineEdge} />

        {/* Left binding strip */}
        <LinearGradient
          colors={[`${tint}60`, `${tint}20`, `${tint}60`]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={pageStyles.binding}
        />

        {/* Content */}
        <View style={pageStyles.content}>
          {/* Date area */}
          <View style={pageStyles.dateArea}>
            <Text style={pageStyles.weekday}>{weekday}</Text>
            <Text style={pageStyles.dayNum}>{dayNum}</Text>
            <Text style={pageStyles.monthYear}>{monthName} {yearNum}</Text>
          </View>

          {/* Vertical rule */}
          <View style={pageStyles.verticalRule} />

          {/* Main text */}
          <View style={pageStyles.textArea}>
            <Text style={pageStyles.storyTitle} numberOfLines={1}>📖 {entry.storyTitle}</Text>
            <Text style={pageStyles.childLabel}>for {entry.childName}</Text>

            {entry.answers.length > 0 && (
              <View style={pageStyles.previewBlock}>
                <Text style={pageStyles.previewQ} numberOfLines={2}>
                  💬 {entry.answers[0].question}
                </Text>
                {entry.answers[0].answer ? (
                  <Text style={pageStyles.previewA} numberOfLines={1}>
                    ↳ {entry.answers[0].answer}
                  </Text>
                ) : (
                  <Text style={pageStyles.previewEmpty}>
                    ↳ tap to add your answer…
                  </Text>
                )}
              </View>
            )}

            <View style={pageStyles.footerRow}>
              {entry.parentNotes ? (
                <View style={pageStyles.notesBadge}>
                  <Text style={pageStyles.notesBadgeText}>📝 Note added</Text>
                </View>
              ) : null}
              {entry.answers.length > 0 && (
                <Text style={pageStyles.questionCount}>
                  {entry.answers.length} question{entry.answers.length !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>

          <Text style={pageStyles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const pageStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    // Float shadow
    shadowColor:    '#9B6FDE',
    shadowOffset:   { width: 2, height: 8 },
    shadowRadius:   20,
    shadowOpacity:  0.35,
    elevation:      10,
  },
  page: {
    flexDirection:  'row',
    alignItems:     'stretch',
    borderRadius:   Radius.xl,
    overflow:       'hidden',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.16)',
    minHeight:      110,
  },
  shineEdge: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius:    1,
  },
  // Left binding strip
  binding: {
    width:            6,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
    flexShrink: 0,
  },
  content: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    Spacing.md,
    paddingRight:   Spacing.sm,
    paddingVertical: Spacing.md,
    gap:             Spacing.md,
  },
  dateArea: {
    alignItems:  'center',
    width:       52,
    flexShrink:  0,
    gap:         2,
  },
  weekday: {
    fontFamily:    Fonts.medium,
    fontSize:      9,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNum: {
    fontFamily: Fonts.black,
    fontSize:   28,
    color:      Colors.moonlightCream,
    lineHeight: 32,
  },
  monthYear: {
    fontFamily: Fonts.medium,
    fontSize:   9,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  verticalRule: {
    width:           1,
    alignSelf:       'stretch',
    backgroundColor: 'rgba(255,215,0,0.18)',
    borderRadius:    1,
  },
  textArea:    { flex: 1, gap: 4 },
  storyTitle:  { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.moonlightCream, lineHeight: 20 },
  childLabel:  { fontFamily: Fonts.regular, fontSize: 11, color: Colors.celestialGold, marginTop: -2 },
  previewBlock: { gap: 2, marginTop: 4 },
  previewQ:    { fontFamily: Fonts.bold, fontSize: 12, color: 'rgba(240,235,248,0.75)', lineHeight: 17 },
  previewA:    { fontFamily: Fonts.regular, fontSize: 11, color: Colors.moonlightCream, lineHeight: 16 },
  previewEmpty: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  footerRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  notesBadge: {
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(255,215,0,0.08)',
    borderRadius:      Radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.22)',
  },
  notesBadgeText:  { fontFamily: Fonts.bold, fontSize: 9, color: Colors.celestialGold },
  questionCount:   { fontFamily: Fonts.medium, fontSize: 10, color: Colors.textMuted },
  chevron:         { fontFamily: Fonts.bold, fontSize: 24, color: 'rgba(255,215,0,0.45)', marginLeft: 4 },
});

// ──────────────────────────────────────────────────────────────────────────────
// Entry Detail Modal — full diary page view
// ──────────────────────────────────────────────────────────────────────────────
function EntryDetailModal({
  entry,
  visible,
  onClose,
  onSaveNotes,
}: {
  entry:       JournalEntry | null;
  visible:     boolean;
  onClose:     () => void;
  onSaveNotes: (notes: string) => void;
}) {
  const [notes,    setNotes]    = useState(entry?.parentNotes ?? '');
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

  const dateObj  = new Date(entry.date);
  const dayNum   = dateObj.getDate();
  const monthFull = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekday  = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const tint     = getThemeTint(entry.theme);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={modalStyles.sheet}>
          {/* Blur */}
          {Platform.OS !== 'web' && (
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          )}

          {/* Deep glass gradient */}
          <LinearGradient
            colors={['rgba(20,8,48,0.96)', 'rgba(10,4,28,0.98)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Theme tint */}
          <LinearGradient
            colors={[`${tint}18`, 'transparent']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />

          {/* Reflective top edge */}
          <View style={modalStyles.shineEdge} />

          {/* Handle */}
          <View style={modalStyles.handle} />

          <ScrollView
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Page header with binding strip */}
            <View style={[modalStyles.pageHeader, { borderLeftColor: `${tint}90` }]}>
              <View style={modalStyles.pageDate}>
                <Text style={modalStyles.pageWeekday}>{weekday}</Text>
                <Text style={modalStyles.pageDayNum}>{dayNum}</Text>
                <Text style={modalStyles.pageMonthYear}>{monthFull}</Text>
              </View>

              <View style={modalStyles.pageHeaderRight}>
                <Text style={modalStyles.pageStoryTitle} numberOfLines={2}>
                  📖 {entry.storyTitle}
                </Text>
                <Text style={modalStyles.pageChildName}>for {entry.childName}</Text>
              </View>

              <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
                <Text style={modalStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ConstellationDivider />

            {/* Quiet Time Reflections section */}
            {entry.answers.length > 0 && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionHeader}>🌟 Quiet Time Reflections</Text>
                <Text style={modalStyles.sectionSubtitle}>
                  {'AI-generated discussion questions from tonight\'s story'}
                </Text>

                {entry.answers.map((item, i) => (
                  <View key={i} style={modalStyles.qaCard}>
                    {/* Card glass */}
                    {Platform.OS !== 'web' && (
                      <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                    )}
                    <LinearGradient
                      colors={['rgba(255,215,0,0.08)', 'rgba(255,215,0,0.02)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                    />
                    <View style={modalStyles.qaCardShine} />

                    <View style={modalStyles.qaNumber}>
                      <Text style={modalStyles.qaNumberText}>{i + 1}</Text>
                    </View>

                    <View style={modalStyles.qaBody}>
                      <Text style={modalStyles.qaQuestion}>{item.question}</Text>
                      {item.answer ? (
                        <View style={modalStyles.qaAnswerRow}>
                          <Text style={modalStyles.qaAnswerArrow}>↳</Text>
                          <Text style={modalStyles.qaAnswer}>{item.answer}</Text>
                        </View>
                      ) : (
                        <Text style={modalStyles.qaNoAnswer}>No answer recorded yet</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <ConstellationDivider />

            {/* Parent notes section */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionHeader}>✍️ Your Notes</Text>
              <Text style={modalStyles.sectionSubtitle}>
                Private thoughts, observations, or memories about tonight
              </Text>

              <TextInput
                style={modalStyles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={`Write your thoughts about ${entry.childName}'s story tonight…`}
                placeholderTextColor="rgba(153,153,187,0.55)"
                multiline
                textAlignVertical="top"
                selectionColor={Colors.celestialGold}
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[modalStyles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={() => void handleSave()}
              disabled={isSaving}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold, '#FFA500']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={modalStyles.saveBtnGradient}
              >
                <Text style={modalStyles.saveBtnText}>
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight:            '92%',
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow:             'hidden',
    borderTopWidth:       1.5,
    borderTopColor:       'rgba(255,215,0,0.28)',
    borderLeftWidth:      1,
    borderRightWidth:     1,
    borderLeftColor:      'rgba(255,255,255,0.12)',
    borderRightColor:     'rgba(255,255,255,0.12)',
    // Float shadow
    shadowColor:    Colors.celestialGold,
    shadowOffset:   { width: 0, height: -10 },
    shadowRadius:   35,
    shadowOpacity:  0.30,
    elevation:      24,
  },
  shineEdge: {
    position:        'absolute',
    top:             0,
    left:            '20%',
    right:           '20%',
    height:          1.5,
    backgroundColor: 'rgba(255,255,255,0.40)',
    borderRadius:    1,
  },
  handle: {
    width:           44,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,215,0,0.30)',
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    8,
  },
  scrollContent: {
    padding:       Spacing.lg,
    gap:           Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // Page header
  pageHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            Spacing.md,
    paddingLeft:    Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.celestialGold,
    borderRadius:   2,
    marginBottom:   4,
  },
  pageDate: {
    alignItems: 'center',
    width:      52,
    gap:        2,
    flexShrink: 0,
  },
  pageWeekday: {
    fontFamily:    Fonts.medium,
    fontSize:      9,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageDayNum: {
    fontFamily: Fonts.black,
    fontSize:   32,
    color:      Colors.celestialGold,
    lineHeight: 36,
    textShadowColor: 'rgba(255,215,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  pageMonthYear: {
    fontFamily: Fonts.medium,
    fontSize:   9,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  pageHeaderRight:  { flex: 1, gap: 4 },
  pageStoryTitle:   { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.moonlightCream, lineHeight: 24 },
  pageChildName:    { fontFamily: Fonts.medium, fontSize: 13, color: Colors.celestialGold },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    marginLeft:      4,
  },
  closeBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textMuted },

  // Sections
  section: { gap: Spacing.sm },
  sectionHeader: {
    fontFamily:    Fonts.extraBold,
    fontSize:      16,
    color:         Colors.moonlightCream,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   12,
    color:      Colors.textMuted,
    lineHeight: 18,
    marginTop:  -Spacing.sm + 2,
  },

  // Q&A cards
  qaCard: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            Spacing.sm,
    borderRadius:   Radius.lg,
    borderWidth:    1,
    borderColor:    'rgba(255,215,0,0.22)',
    padding:        Spacing.md,
    overflow:       'hidden',
  },
  qaCardShine: {
    position:        'absolute',
    top:             0,
    left:            '10%',
    right:           '10%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius:    1,
  },
  qaNumber: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,215,0,0.14)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.35)',
    flexShrink:      0,
    marginTop:       1,
  },
  qaNumberText: { fontFamily: Fonts.extraBold, fontSize: 12, color: Colors.celestialGold },
  qaBody:       { flex: 1, gap: 6 },
  qaQuestion:   { fontFamily: Fonts.bold, fontSize: 14, color: Colors.celestialGold, lineHeight: 20 },
  qaAnswerRow:  { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  qaAnswerArrow: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted, marginTop: 1 },
  qaAnswer:     { fontFamily: Fonts.regular, fontSize: 13, color: Colors.moonlightCream, lineHeight: 20, flex: 1 },
  qaNoAnswer:   { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },

  // Notes input
  notesInput: {
    backgroundColor: 'rgba(30,12,60,0.60)',
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.18)',
    padding:         Spacing.md,
    fontFamily:      Fonts.regular,
    fontSize:        14,
    color:           Colors.moonlightCream,
    minHeight:       130,
    lineHeight:      22,
  },

  // Save button
  saveBtn: {
    borderRadius: Radius.full,
    overflow:     'hidden',
    marginTop:    Spacing.sm,
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    shadowOpacity: 0.45,
    elevation:    10,
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

  // Ambient moon glow
  const moonGlow = useSharedValue(1);

  useEffect(() => {
    moonGlow.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.94, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(moonGlow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moonStyle = useAnimatedStyle(() => ({ transform: [{ scale: moonGlow.value }] }));

  const loadEntries = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(JOURNAL_KEY);
      const data: JournalEntry[] = raw ? JSON.parse(raw) : [];
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
    headerAnim.value  = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
    contentAnim.value = withDelay(250, withTiming(1, { duration: 800 }));
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEntries]);

  const handleSaveNotes = useCallback(async (notes: string) => {
    if (!selectedEntry) return;
    try {
      const raw     = await AsyncStorage.getItem(JOURNAL_KEY);
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
    transform: [{ translateY: (1 - headerAnim.value) * -24 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentAnim.value }));

  // Group entries by month
  const entriesByMonth: Record<string, JournalEntry[]> = {};
  entries.forEach((entry) => {
    const key = new Date(entry.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!entriesByMonth[key]) entriesByMonth[key] = [];
    entriesByMonth[key].push(entry);
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Crystal Night backdrop */}
      <LinearGradient
        colors={['#050210', '#0D0820', '#160A35', '#200D45']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={40} />

      {/* Soft nebula glow blobs */}
      <View style={[styles.nebula, styles.nebulaLeft]}  pointerEvents="none" />
      <View style={[styles.nebula, styles.nebulaRight]} pointerEvents="none" />

      {/* ── Parental Gate ────────────────────────────────────────────────────── */}
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
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ───────────────────────────────────────────────────────── */}
          <Animated.View style={[styles.header, headerStyle]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Animated.Text style={[styles.headerMoon, moonStyle]}>🌙</Animated.Text>
              <Text style={styles.headerTitle}>Bedtime Journal</Text>
            </View>

            <View style={{ width: 60 }} />
          </Animated.View>

          <Animated.View style={contentStyle}>
            {/* ── Hero "book" card ──────────────────────────────────────────── */}
            <View style={styles.heroCard}>
              {Platform.OS !== 'web' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(107,72,184,0.28)', 'rgba(107,72,184,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              {/* Gold tint overlay */}
              <LinearGradient
                colors={['rgba(255,215,0,0.06)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <View style={styles.heroShine} />

              {/* Binding strip */}
              <LinearGradient
                colors={['rgba(255,215,0,0.6)', 'rgba(255,215,0,0.2)', 'rgba(255,215,0,0.6)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.heroBinding}
              />

              <View style={styles.heroInner}>
                <Text style={styles.heroEmoji}>📓</Text>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroTitle}>{"Parent's Private Journal"}</Text>
                  <Text style={styles.heroSubtitle}>
                    {"Your child's AI-generated reflection questions — one floating page per story. Protected by the Crystal Gate, just for you."}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Stats row ─────────────────────────────────────────────────── */}
            {entries.length > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>{entries.length}</Text>
                  <Text style={styles.statLabel}>stories</Text>
                </View>
                <View style={styles.statDot} />
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>
                    {entries.reduce((acc, e) => acc + e.answers.filter(a => a.answer).length, 0)}
                  </Text>
                  <Text style={styles.statLabel}>reflections</Text>
                </View>
                <View style={styles.statDot} />
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>
                    {entries.filter(e => e.parentNotes).length}
                  </Text>
                  <Text style={styles.statLabel}>notes</Text>
                </View>
              </View>
            )}

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {!isLoading && entries.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyGlassPanel}>
                  {Platform.OS !== 'web' && (
                    <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                  )}
                  <LinearGradient
                    colors={['rgba(107,72,184,0.15)', 'rgba(107,72,184,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                  />
                  <View style={styles.emptyShine} />

                  <Text style={styles.emptyEmoji}>📖</Text>
                  <Text style={styles.emptyTitle}>No diary entries yet</Text>
                  <Text style={styles.emptyText}>
                    {'When your child finishes a story and you tap "Begin Quiet Time", AI-generated reflection questions will appear here as floating journal pages.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => router.replace('/(main)/home')}
                  >
                    <LinearGradient
                      colors={['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.05)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={styles.emptyBtnText}>✨ Create a Story →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Entries by month ──────────────────────────────────────────── */}
            {Object.entries(entriesByMonth).map(([month, monthEntries]) => (
              <View key={month} style={styles.monthGroup}>
                {/* Month header */}
                <View style={styles.monthHeaderRow}>
                  <View style={styles.monthLine} />
                  <View style={styles.monthLabelWrap}>
                    <Text style={styles.monthLabel}>{month}</Text>
                  </View>
                  <View style={styles.monthLine} />
                </View>

                {monthEntries.map((entry, i) => (
                  <DiaryPageCard
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

            {/* Bottom decoration */}
            {entries.length > 0 && (
              <View style={styles.bottomDecor}>
                <ConstellationDivider />
                <Text style={styles.bottomText}>✦ End of journal ✦</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {/* ── Entry Detail Modal ───────────────────────────────────────────────── */}
      <EntryDetailModal
        entry={selectedEntry}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onSaveNotes={(notes) => void handleSaveNotes(notes)}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050210' },
  scroll:    { paddingHorizontal: Spacing.lg },

  // Nebula background blobs
  nebula: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.18,
  },
  nebulaLeft: {
    width:  W * 0.7,
    height: W * 0.7,
    top:    '10%',
    left:   -W * 0.25,
    backgroundColor: '#4A2090',
  },
  nebulaRight: {
    width:  W * 0.6,
    height: W * 0.6,
    top:    '45%',
    right:  -W * 0.2,
    backgroundColor: '#1A4080',
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.xl,
  },
  backBtn:  { paddingVertical: 8, minWidth: 60 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerCenter: {
    alignItems: 'center',
    gap:        4,
  },
  headerMoon: {
    fontSize: 28,
    textShadowColor: 'rgba(255,215,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  headerTitle: {
    fontFamily:    Fonts.black,
    fontSize:      19,
    color:         Colors.moonlightCream,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Hero card
  heroCard: {
    flexDirection: 'row',
    alignItems:    'stretch',
    borderRadius:  Radius.xl,
    overflow:      'hidden',
    borderWidth:   1,
    borderColor:   'rgba(255,215,0,0.28)',
    marginBottom:  Spacing.lg,
    // Float
    shadowColor:   '#9B6FDE',
    shadowOffset:  { width: 0, height: 10 },
    shadowRadius:  28,
    shadowOpacity: 0.35,
    elevation:     14,
    minHeight:     100,
  },
  heroShine: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius:    1,
  },
  heroBinding: {
    width:                5,
    borderTopLeftRadius:  Radius.xl,
    borderBottomLeftRadius: Radius.xl,
    flexShrink:           0,
  },
  heroInner: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.md,
    padding:       Spacing.lg,
  },
  heroEmoji:     { fontSize: 40 },
  heroTextBlock: { flex: 1, gap: 6 },
  heroTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   16,
    color:      Colors.moonlightCream,
  },
  heroSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   12,
    color:      Colors.textMuted,
    lineHeight: 18,
  },

  // Stats row
  statsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.md,
    marginBottom:   Spacing.lg,
  },
  statChip: { alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: Fonts.black,
    fontSize:   22,
    color:      Colors.celestialGold,
    textShadowColor: 'rgba(255,215,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  statLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted },
  statDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,215,0,0.28)',
    marginTop:       -8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop:  Spacing.xl,
  },
  emptyGlassPanel: {
    width:         '100%',
    borderRadius:  Radius.xl,
    overflow:      'hidden',
    borderWidth:   1,
    borderColor:   'rgba(107,72,184,0.35)',
    padding:       Spacing.xl,
    alignItems:    'center',
    gap:           Spacing.md,
    // Float
    shadowColor:   '#6B48B8',
    shadowOffset:  { width: 0, height: 10 },
    shadowRadius:  24,
    shadowOpacity: 0.30,
    elevation:     10,
  },
  emptyShine: {
    position:        'absolute',
    top:             0,
    left:            '20%',
    right:           '20%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius:    1,
  },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   20,
    color:      Colors.moonlightCream,
    textAlign:  'center',
  },
  emptyText: {
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
    borderWidth:       1,
    borderColor:       'rgba(255,215,0,0.35)',
    overflow:          'hidden',
  },
  emptyBtnText: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.celestialGold },

  // Month groups
  monthGroup: { marginBottom: Spacing.xl },
  monthHeaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
    marginBottom:   Spacing.md,
  },
  monthLine: {
    flex:            1,
    height:          1,
    backgroundColor: 'rgba(255,215,0,0.14)',
    borderRadius:    1,
  },
  monthLabelWrap: {
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderRadius:    Radius.full,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.20)',
  },
  monthLabel: {
    fontFamily:    Fonts.bold,
    fontSize:      11,
    color:         Colors.celestialGold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Bottom decoration
  bottomDecor: {
    alignItems: 'center',
    gap:        Spacing.md,
    paddingTop: Spacing.lg,
    marginTop:  Spacing.sm,
  },
  bottomText: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      'rgba(255,215,0,0.35)',
    letterSpacing: 1,
  },
});
