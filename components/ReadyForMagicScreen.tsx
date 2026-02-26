/**
 * ReadyForMagicScreen
 *
 * A friendly, glass-styled overlay shown when the app has not yet been
 * connected to Supabase. Instead of a technical error, the user sees a
 * welcoming "Ready for Magic?" screen that:
 *  - Explains the situation in warm, friendly language
 *  - Lists the benefits of connecting Supabase
 *  - Shows the offline-mode capabilities still available
 *  - Provides a "Continue Offline" option so the app is fully usable
 *
 * This component is non-blocking — the user can always dismiss it and
 * use the full offline experience.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  visible:   boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature row — glass pill item
// ─────────────────────────────────────────────────────────────────────────────
function FeatureRow({
  emoji,
  label,
  description,
  available,
  index,
}: {
  emoji:        string;
  label:        string;
  description:  string;
  available:    boolean;
  index:        number;
}) {
  const opacity    = useSharedValue(0);
  const translateX = useSharedValue(-20);

  useEffect(() => {
    const del = index * 80 + 300;
    opacity.value    = withDelay(del, withTiming(1, { duration: 400 }));
    translateX.value = withDelay(del, withSpring(0, { damping: 14, stiffness: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[featureStyles.row, rowStyle]}>
      <View style={[featureStyles.dot, { backgroundColor: available ? Colors.successGreen : Colors.textMuted }]} />
      <Text style={featureStyles.emoji}>{emoji}</Text>
      <View style={featureStyles.text}>
        <Text style={featureStyles.label}>{label}</Text>
        <Text style={featureStyles.description}>{description}</Text>
      </View>
      <Text style={[featureStyles.status, { color: available ? Colors.successGreen : Colors.textMuted }]}>
        {available ? '✓' : '○'}
      </Text>
    </Animated.View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius:   Radius.lg,
    padding:        12,
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.10)',
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    flexShrink:   0,
  },
  emoji: { fontSize: 20, width: 28, textAlign: 'center' },
  text:  { flex: 1, gap: 2 },
  label: {
    fontFamily: Fonts.bold,
    fontSize:   13,
    color:      Colors.moonlightCream,
  },
  description: {
    fontFamily: Fonts.regular,
    fontSize:   11,
    color:      Colors.textMuted,
    lineHeight: 16,
  },
  status: {
    fontFamily: Fonts.black,
    fontSize:   16,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ReadyForMagicScreen({ visible, onDismiss }: Props) {
  // Entrance animations
  const overlayOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(60);
  const panelOpacity = useSharedValue(0);

  // Wand pulse
  const wandGlow = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value  = withTiming(1, { duration: 300 });
      panelTranslateY.value = withDelay(100, withSpring(0, { damping: 16, stiffness: 180 }));
      panelOpacity.value    = withDelay(100, withTiming(1, { duration: 400 }));

      wandGlow.value = withRepeat(
        withSequence(
          withTiming(1.20, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      );
    } else {
      overlayOpacity.value  = withTiming(0, { duration: 250 });
      panelTranslateY.value = withTiming(40, { duration: 250 });
      panelOpacity.value    = withTiming(0, { duration: 250 });
      cancelAnimation(wandGlow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle   = useAnimatedStyle(() => ({
    opacity:   panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));
  const wandStyle = useAnimatedStyle(() => ({ transform: [{ scale: wandGlow.value }] }));

  const handleDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  // ── Offline features (always available) ──────────────────────────────────
  const offlineFeatures = [
    { emoji: '📖', label: 'Create Stories',          description: 'Full story generation, offline',        available: true },
    { emoji: '🎙️', label: 'Voice Recording',          description: 'Record your voice locally',             available: true },
    { emoji: '⭐',  label: 'Stardust Rewards',        description: 'Earn & spend stardust offline',         available: true },
    { emoji: '📓', label: 'Bedtime Journal',          description: 'Store journal entries on device',       available: true },
  ];

  const cloudFeatures = [
    { emoji: '☁️', label: 'Cloud Sync',              description: 'Access stories across all devices',     available: false },
    { emoji: '👨‍👩‍👧', label: 'Family Sharing',          description: 'Share with family members',            available: false },
    { emoji: '🔐', label: 'Secure Backup',           description: 'Never lose your magical stories',       available: false },
    { emoji: '✨', label: 'AI Account Features',     description: 'Personalised AI across sessions',       available: false },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.root}>
        {/* Dim overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} />

        {/* Panel */}
        <Animated.View style={[styles.panelWrapper, panelStyle]}>
          <View style={styles.panel}>
            {/* Glass blur */}
            {Platform.OS !== 'web' && (
              <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            {/* Deep gradient */}
            <LinearGradient
              colors={['rgba(14,8,48,0.97)', 'rgba(8,4,28,0.99)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />

            {/* Purple tint */}
            <LinearGradient
              colors={['rgba(107,72,184,0.20)', 'transparent', 'rgba(107,72,184,0.10)']}
              locations={[0, 0.5, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />

            {/* Reflective top edge */}
            <View style={styles.shineEdge} />

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <Animated.Text style={[styles.wandEmoji, wandStyle]}>🪄</Animated.Text>
                <Text style={styles.title}>Ready for Magic?</Text>
                <Text style={styles.subtitle}>
                  Connect Supabase to unlock the full StoryVoice experience —
                  or dive in right now with the offline mode.
                </Text>
              </View>

              {/* Offline available — glass card */}
              <View style={styles.sectionCard}>
                {Platform.OS !== 'web' && (
                  <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(107,203,119,0.12)', 'rgba(107,203,119,0.03)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
                <View style={styles.sectionCardShine} />
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: Colors.successGreen }]} />
                  <Text style={[styles.sectionLabel, { color: Colors.successGreen }]}>
                    ✓ Available Now (Offline Mode)
                  </Text>
                </View>
                <View style={styles.featureList}>
                  {offlineFeatures.map((f, i) => (
                    <FeatureRow key={f.label} {...f} index={i} />
                  ))}
                </View>
              </View>

              {/* Cloud features — glass card */}
              <View style={styles.sectionCard}>
                {Platform.OS !== 'web' && (
                  <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(255,215,0,0.10)', 'rgba(255,215,0,0.02)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
                <View style={styles.sectionCardShine} />
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: Colors.celestialGold }]} />
                  <Text style={[styles.sectionLabel, { color: Colors.celestialGold }]}>
                    ✦ Unlocked with Supabase
                  </Text>
                </View>
                <View style={styles.featureList}>
                  {cloudFeatures.map((f, i) => (
                    <FeatureRow key={f.label} {...f} index={i + 4} />
                  ))}
                </View>
              </View>

              {/* Setup hint */}
              <View style={styles.setupHint}>
                <LinearGradient
                  colors={['rgba(107,72,184,0.18)', 'rgba(107,72,184,0.05)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                />
                <View style={styles.setupHintShine} />
                <Text style={styles.setupHintTitle}>🔧 How to connect</Text>
                <Text style={styles.setupHintText}>
                  In the project dashboard, tap <Text style={styles.setupHintBold}>Connect Supabase</Text> — the
                  environment variables will sync automatically and the magic will be fully unlocked!
                </Text>
              </View>

              {/* Dismiss button */}
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleDismiss}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                />
                <View style={styles.dismissBtnShine} />
                <Text style={styles.dismissBtnText}>🌙 Continue in Offline Mode</Text>
              </TouchableOpacity>

              <Text style={styles.footnote}>
                You can connect Supabase anytime from the project settings
              </Text>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  // Panel
  panelWrapper: {
    width:  '100%',
    maxHeight: '90%',
  },
  panel: {
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow:             'hidden',
    borderTopWidth:       1.5,
    borderTopColor:       'rgba(107,72,184,0.55)',
    borderLeftWidth:      1,
    borderRightWidth:     1,
    borderLeftColor:      'rgba(255,255,255,0.12)',
    borderRightColor:     'rgba(255,255,255,0.12)',
    // Float shadow
    shadowColor:    '#6B48B8',
    shadowOffset:   { width: 0, height: -12 },
    shadowRadius:   35,
    shadowOpacity:  0.50,
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
  scrollContent: {
    padding:       Spacing.lg,
    gap:           Spacing.md,
    paddingBottom: 36,
  },

  // Handle
  handle: {
    width:           44,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(107,72,184,0.50)',
    alignSelf:       'center',
    marginBottom:    Spacing.sm,
  },

  // Header
  header: {
    alignItems: 'center',
    gap:        Spacing.sm,
    marginBottom: Spacing.sm,
  },
  wandEmoji: {
    fontSize: 52,
    textShadowColor: 'rgba(107,72,184,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    fontFamily:    Fonts.black,
    fontSize:      26,
    color:         Colors.moonlightCream,
    textAlign:     'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(107,72,184,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize:   14,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 22,
    maxWidth:   W * 0.80,
  },

  // Section cards
  sectionCard: {
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.12)',
    padding:      Spacing.md,
    gap:          Spacing.sm,
    // Float
    shadowColor:   '#9B6FDE',
    shadowOffset:  { width: 0, height: 8 },
    shadowRadius:  20,
    shadowOpacity: 0.25,
    elevation:     8,
  },
  sectionCardShine: {
    position:        'absolute',
    top:             0,
    left:            '15%',
    right:           '15%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius:    1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    marginBottom:  4,
  },
  sectionDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontFamily:    Fonts.extraBold,
    fontSize:      13,
    letterSpacing: 0.3,
  },
  featureList: { gap: 8 },

  // Setup hint
  setupHint: {
    borderRadius: Radius.lg,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  'rgba(107,72,184,0.30)',
    padding:      Spacing.md,
    gap:          Spacing.sm,
  },
  setupHintShine: {
    position:        'absolute',
    top:             0,
    left:            '20%',
    right:           '20%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius:    1,
  },
  setupHintTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   14,
    color:      Colors.moonlightCream,
  },
  setupHintText: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      Colors.textMuted,
    lineHeight: 20,
  },
  setupHintBold: {
    fontFamily: Fonts.bold,
    color:      Colors.softPurple,
  },

  // Dismiss button
  dismissBtn: {
    borderRadius:    Radius.full,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.20)',
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       Spacing.sm,
    // Float
    shadowColor:     '#9B6FDE',
    shadowOffset:    { width: 0, height: 6 },
    shadowRadius:    16,
    shadowOpacity:   0.30,
    elevation:       8,
  },
  dismissBtnShine: {
    position:        'absolute',
    top:             0,
    left:            '25%',
    right:           '25%',
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius:    1,
  },
  dismissBtnText: {
    fontFamily:    Fonts.extraBold,
    fontSize:      16,
    color:         Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  // Footnote
  footnote: {
    fontFamily: Fonts.regular,
    fontSize:   11,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 16,
  },
});
