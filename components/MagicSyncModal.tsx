/**
 * MagicSyncModal
 *
 * High-end "Magic Sync" transition modal that appears after a user signs in
 * when locally-stored Safe Mode data is detected. Invites the user to lift
 * their stories, child profile and voice settings to the cloud.
 *
 * States:
 *   idle      → shows summary + CTA
 *   syncing   → animated progress view
 *   success   → celebration with MagicDustEffect
 *   error     → graceful error message
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import MagicDustEffect from './MagicDustEffect';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import type { LocalDataSummary, MigrationResult } from '@/lib/migrationService';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DataBadge({ icon, label, count }: { icon: string; label: string; count: number }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.badge, style]}>
      <Text style={styles.badgeIcon}>{icon}</Text>
      <Text style={styles.badgeCount}>{count}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </Animated.View>
  );
}

function SpinningOrb() {
  const rotation = useSharedValue(0);
  const pulse    = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: pulse.value },
    ],
  }));

  return (
    <Animated.View style={[styles.orb, orbStyle]}>
      <Text style={styles.orbEmoji}>🌌</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export type MagicSyncState = 'idle' | 'syncing' | 'success' | 'error';

interface MagicSyncModalProps {
  visible: boolean;
  summary: LocalDataSummary;
  syncState: MagicSyncState;
  migrationResult?: MigrationResult | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export default function MagicSyncModal({
  visible,
  summary,
  syncState,
  migrationResult,
  onConfirm,
  onDismiss,
}: MagicSyncModalProps) {
  const cardOpacity    = useSharedValue(0);
  const cardTransY     = useSharedValue(60);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonScale    = useSharedValue(1);
  const dustKey        = useRef(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 350 });
      cardTransY.value     = withDelay(100, withSpring(0, { damping: 18, stiffness: 200 }));
      cardOpacity.value    = withDelay(100, withTiming(1, { duration: 350 }));
      contentOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    } else {
      overlayOpacity.value = withTiming(0, { duration: 250 });
      cardOpacity.value    = withTiming(0, { duration: 200 });
      cardTransY.value     = withTiming(60, { duration: 200 });
      contentOpacity.value = withTiming(0, { duration: 150 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (syncState === 'success') {
      dustKey.current++;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (syncState === 'syncing') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [syncState]);

  const overlayStyle  = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const cardStyle     = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ translateY: cardTransY.value }],
  }));
  const contentStyle  = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const btnAnimStyle  = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const handleConfirm = () => {
    buttonScale.value = withSequence(
      withTiming(0.94, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 300 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onConfirm();
  };

  const handleDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  // ── Render content based on state ──────────────────────────────────────
  const renderBody = () => {
    if (syncState === 'syncing') {
      return (
        <View style={styles.syncingBody}>
          <SpinningOrb />
          <Text style={styles.syncingTitle}>Weaving the magic…</Text>
          <Text style={styles.syncingSubtitle}>
            Moving your stories to the cloud ☁️
          </Text>
          <View style={styles.syncingDots}>
            {[0, 1, 2].map((i) => <SyncDot key={i} delay={i * 200} />)}
          </View>
        </View>
      );
    }

    if (syncState === 'success') {
      const total = migrationResult?.totalMigrated ?? 0;
      return (
        <View style={styles.successBody}>
          <Text style={styles.successEmoji}>🌟</Text>
          <Text style={styles.successTitle}>Magic Sync Complete!</Text>
          <Text style={styles.successSubtitle}>
            {total > 0
              ? `${total} item${total !== 1 ? 's' : ''} safely stored in the cloud ✨`
              : 'Your data is now safely stored in the cloud ✨'}
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDismiss} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneButtonGradient}
            >
              <Text style={styles.doneButtonText}>Continue to My Stories ›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    if (syncState === 'error') {
      return (
        <View style={styles.errorBody}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Sync Incomplete</Text>
          <Text style={styles.errorSubtitle}>
            {migrationResult && migrationResult.totalMigrated > 0
              ? `Moved ${migrationResult.totalMigrated} items — a few couldn't be transferred. You can retry from Settings.`
              : 'Unable to reach the cloud right now. Your data is safe locally — try again from Settings.'}
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDismiss} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.cardBg, Colors.inputBg ?? Colors.cardBg]}
              style={styles.doneButtonGradient}
            >
              <Text style={[styles.doneButtonText, { color: Colors.textMuted }]}>
                Maybe Later
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    // ── idle ──────────────────────────────────────────────────────────────
    return (
      <Animated.View style={contentStyle}>
        {/* Icon */}
        <View style={styles.iconRing}>
          <LinearGradient
            colors={[Colors.celestialGold, Colors.softGold]}
            style={styles.iconRingGradient}
          >
            <Text style={styles.iconEmoji}>✨</Text>
          </LinearGradient>
        </View>

        <Text style={styles.title}>Magic Sync</Text>
        <Text style={styles.subtitle}>
          We found creations from before you signed in.{'\n'}
          Move them to the cloud to keep them safe forever.
        </Text>

        {/* Data summary badges */}
        <View style={styles.badgesRow}>
          {summary.childCount > 0 && (
            <DataBadge icon="👶" label="Profile" count={summary.childCount} />
          )}
          {summary.storyCount > 0 && (
            <DataBadge icon="📖" label={summary.storyCount === 1 ? 'Story' : 'Stories'} count={summary.storyCount} />
          )}
          {summary.voiceCount > 0 && (
            <DataBadge icon="🎙️" label={summary.voiceCount === 1 ? 'Voice' : 'Voices'} count={summary.voiceCount} />
          )}
        </View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrapper, btnAnimStyle]}>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.88}>
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold, '#FFA500']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaIcon}>☁️</Text>
              <Text style={styles.ctaLabel}>Move to Cloud</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Dismiss */}
        <TouchableOpacity onPress={handleDismiss} activeOpacity={0.7} style={styles.keepLocalBtn}>
          <Text style={styles.keepLocalText}>Keep local for now</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={syncState === 'idle' ? handleDismiss : undefined}
    >
      {/* Overlay */}
      <Animated.View style={[styles.overlay, overlayStyle]} />

      {/* Particle burst (success) */}
      <MagicDustEffect
        visible={syncState === 'success'}
        originY={H * 0.42}
      />

      {/* Card */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(45,27,105,0.95)', 'rgba(13,14,36,0.98)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Gold corner accents */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />

          {/* Star sprinkles decoration */}
          <View style={styles.decorRow} pointerEvents="none">
            {['✦', '✧', '✦', '✧', '✦'].map((s, i) => (
              <Text key={i} style={[styles.decorStar, { opacity: 0.35 - i * 0.04 }]}>{s}</Text>
            ))}
          </View>

          <View style={styles.cardContent}>
            {renderBody()}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Animated Sync Dot ────────────────────────────────────────────────────────
function SyncDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1,   { duration: 400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.syncDot, style]} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  centeredContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width:        Math.min(W - 48, 400),
    borderRadius: Radius.xl,
    borderWidth:  1,
    borderColor:  'rgba(255,215,0,0.25)',
    overflow:     'hidden',
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation:    20,
  },
  cardContent: {
    padding: Spacing.xl,
  },

  // Gold corner accents
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 56, height: 56,
    borderTopLeftRadius: Radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 56, height: 56,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  decorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  decorStar: {
    fontSize: 14,
    color: Colors.celestialGold,
  },

  // ── Idle state
  iconRing: {
    alignSelf:    'center',
    marginBottom: Spacing.lg,
  },
  iconRingGradient: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowColor:  Colors.celestialGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation:    8,
  },
  iconEmoji: { fontSize: 36 },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize:   26,
    color:      Colors.moonlightCream,
    textAlign:  'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize:   14,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  badgesRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            12,
    marginBottom:   Spacing.xl,
  },
  badge: {
    alignItems:      'center',
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth:        70,
    gap:             4,
  },
  badgeIcon:  { fontSize: 22 },
  badgeCount: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.celestialGold },
  badgeLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted },

  ctaWrapper: { marginBottom: Spacing.md },
  ctaButton: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    paddingVertical: 18,
    borderRadius:   Radius.full,
    shadowColor:    Colors.celestialGold,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.4,
    shadowRadius:   12,
    elevation:      8,
  },
  ctaIcon:  { fontSize: 20 },
  ctaLabel: {
    fontFamily: Fonts.extraBold,
    fontSize:   17,
    color:      Colors.deepSpace,
  },
  keepLocalBtn: {
    alignItems:    'center',
    paddingVertical: Spacing.sm,
  },
  keepLocalText: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      Colors.textMuted,
  },

  // ── Syncing state
  syncingBody: {
    alignItems:     'center',
    paddingVertical: Spacing.md,
  },
  orb: {
    width:  90,
    height: 90,
    borderRadius: 45,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   Spacing.lg,
  },
  orbEmoji:       { fontSize: 52 },
  syncingTitle:   { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.moonlightCream, textAlign: 'center', marginBottom: 8 },
  syncingSubtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xl },
  syncingDots: { flexDirection: 'row', gap: 10 },
  syncDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.celestialGold,
  },

  // ── Success state
  successBody: {
    alignItems:     'center',
    paddingVertical: Spacing.md,
  },
  successEmoji:    { fontSize: 56, marginBottom: Spacing.md },
  successTitle:    { fontFamily: Fonts.extraBold, fontSize: 24, color: Colors.moonlightCream, textAlign: 'center', marginBottom: 8 },
  successSubtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },

  // ── Error state
  errorBody: {
    alignItems:     'center',
    paddingVertical: Spacing.md,
  },
  errorEmoji:    { fontSize: 48, marginBottom: Spacing.md },
  errorTitle:    { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.moonlightCream, textAlign: 'center', marginBottom: 8 },
  errorSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: Spacing.xl },

  // ── Shared done button
  doneButton: {
    width: '100%',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  doneButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
    color:      Colors.deepSpace,
  },
});
