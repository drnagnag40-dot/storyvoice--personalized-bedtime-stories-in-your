/**
 * AmbientMixer – Atmospheric Soundscapes
 *
 * Glassmorphism bottom sheet with:
 * - 4 selectable ambient soundscapes
 * - Volume slider with PanResponder
 * - expo-av audio playback with crossfade
 * - Smooth haptic feedback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  PanResponder,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Soundscape definitions
// Replace AUDIO_URL with actual audio file URLs for production
// ─────────────────────────────────────────────────────────────────────────────
interface Soundscape {
  id:         string;
  label:      string;
  emoji:      string;
  description: string;
  accentColor: string;
  audioUrl:   string | null;
}

const SOUNDSCAPES: Soundscape[] = [
  {
    id:          'rain',
    label:       'Soft Rain',
    emoji:       '🌧️',
    description: 'Gentle droplets on a quiet roof',
    accentColor: '#7EC8E3',
    audioUrl:    null, // Replace with real audio URL
  },
  {
    id:          'ocean',
    label:       'Ocean Waves',
    emoji:       '🌊',
    description: 'Rhythmic tides lulling the shore',
    accentColor: '#3B82F6',
    audioUrl:    null,
  },
  {
    id:          'forest',
    label:       'Forest Crickets',
    emoji:       '🌿',
    description: 'Night chorus in a moonlit grove',
    accentColor: '#6BCB77',
    audioUrl:    null,
  },
  {
    id:          'cosmos',
    label:       'Cosmic White Noise',
    emoji:       '🌌',
    description: 'The hum of a sleeping universe',
    accentColor: '#C9A8FF',
    audioUrl:    null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Animated sound wave bars (visual feedback when playing)
// ─────────────────────────────────────────────────────────────────────────────
function SoundWaveBars({ color, isPlaying }: { color: string; isPlaying: boolean }) {
  const h0 = useSharedValue(4);
  const h1 = useSharedValue(4);
  const h2 = useSharedValue(4);
  const h3 = useSharedValue(4);
  const h4 = useSharedValue(4);

  const s0 = useAnimatedStyle(() => ({ height: h0.value, backgroundColor: color }));
  const s1 = useAnimatedStyle(() => ({ height: h1.value, backgroundColor: color }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value, backgroundColor: color }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value, backgroundColor: color }));
  const s4 = useAnimatedStyle(() => ({ height: h4.value, backgroundColor: color }));

  useEffect(() => {
    const hs = [h0, h1, h2, h3, h4];
    if (isPlaying) {
      hs.forEach((h, i) => {
        h.value = withRepeat(
          withSequence(
            withTiming(4 + Math.random() * 16, { duration: 300 + i * 80, easing: Easing.inOut(Easing.sin) }),
            withTiming(4, { duration: 300 + i * 80, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false
        );
      });
    } else {
      hs.forEach((h) => {
        cancelAnimation(h);
        h.value = withTiming(4, { duration: 300 });
      });
    }
    return () => hs.forEach((h) => cancelAnimation(h));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <View style={waveStyles.container}>
      {[s0, s1, s2, s3, s4].map((style, i) => (
        <Animated.View key={i} style={[waveStyles.bar, style]} />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  bar:       { width: 4, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Volume Slider
// ─────────────────────────────────────────────────────────────────────────────
function VolumeSlider({
  value,
  onChange,
  accentColor,
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
}) {
  const trackWidthRef = useRef(0);
  const fillWidthAnim = useSharedValue(value);

  useEffect(() => {
    fillWidthAnim.value = withTiming(value, { duration: 80 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fillWidthAnim.value)) * 100}%` as `${number}%`,
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const newVal = Math.max(0, Math.min(1, x / trackWidthRef.current));
        onChange(newVal);
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const newVal = Math.max(0, Math.min(1, x / trackWidthRef.current));
        onChange(newVal);
      },
    })
  ).current;

  return (
    <View style={sliderStyles.wrapper}>
      <Text style={sliderStyles.icon}>🔇</Text>
      <View
        {...panResponder.panHandlers}
        style={sliderStyles.track}
        onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
      >
        {/* Track background */}
        <View style={sliderStyles.trackBg} />
        {/* Fill */}
        <Animated.View
          style={[
            sliderStyles.fill,
            { backgroundColor: accentColor },
            fillStyle,
          ]}
        />
        {/* Thumb */}
        <Animated.View
          style={[
            sliderStyles.thumbWrapper,
            fillStyle,
          ]}
        >
          <View style={[sliderStyles.thumb, { borderColor: accentColor, shadowColor: accentColor }]} />
        </Animated.View>
      </View>
      <Text style={sliderStyles.icon}>🔊</Text>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    paddingHorizontal: 4,
  },
  icon: { fontSize: 16 },
  track: {
    flex:   1,
    height: 40,
    justifyContent: 'center',
  },
  trackBg: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fill: {
    position:     'absolute',
    left:         0,
    height:       6,
    borderRadius: 3,
    minWidth:     6,
  },
  thumbWrapper: {
    position: 'absolute',
    left:     0,
    alignItems: 'flex-end',
  },
  thumb: {
    width:         22,
    height:        22,
    borderRadius:  11,
    backgroundColor: Colors.midnightNavy,
    borderWidth:   2,
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  8,
    shadowOpacity: 0.8,
    elevation:     4,
    marginRight:   -11,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main AmbientMixer component
// ─────────────────────────────────────────────────────────────────────────────
interface AmbientMixerProps {
  visible:  boolean;
  onClose:  () => void;
}

export default function AmbientMixer({ visible, onClose }: AmbientMixerProps) {
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [volume,      setVolume]      = useState(0.5);
  const [isLoading,   setIsLoading]   = useState(false);

  // expo-av refs
  const soundRef          = useRef<Audio.Sound | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sheet slide animation
  const slideY = useSharedValue(300);

  useEffect(() => {
    if (visible) {
      slideY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.back(1.2)) });
    } else {
      slideY.value = withTiming(300, { duration: 280, easing: Easing.in(Easing.quad) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  // ── Audio helpers ────────────────────────────────────────────────────────
  const setAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch {
      // ignore on web
    }
  }, []);

  const unloadCurrent = useCallback(async (fadeDuration = 500) => {
    if (!soundRef.current) return;
    const sound = soundRef.current;
    soundRef.current = null;

    try {
      // Fade out before unload
      const steps = 10;
      const stepTime = fadeDuration / steps;
      for (let i = steps; i >= 0; i--) {
        try { await sound.setVolumeAsync((i / steps) * volume); } catch { break; }
        await new Promise((r) => setTimeout(r, stepTime));
      }
      await sound.stopAsync();
      sound.setOnPlaybackStatusUpdate(null);
      await sound.unloadAsync();
    } catch {
      // ignore cleanup errors
    }
  }, [volume]);

  const playSound = useCallback(async (soundscape: Soundscape, fadeIn = true) => {
    if (!soundscape.audioUrl) {
      // No audio URL – just update UI state
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    await setAudioMode();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: soundscape.audioUrl },
        {
          isLooping:   true,
          volume:      fadeIn ? 0 : volume,
          shouldPlay:  true,
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      // Fade in
      if (fadeIn) {
        const steps = 10;
        const stepTime = 600 / steps;
        for (let i = 0; i <= steps; i++) {
          try { await sound.setVolumeAsync((i / steps) * volume); } catch { break; }
          await new Promise((r) => setTimeout(r, stepTime));
        }
      }
    } catch {
      // Audio URL not reachable – still show as "playing" visually
      setIsPlaying(true);
    } finally {
      setIsLoading(false);
    }
  }, [volume, setAudioMode]);

  // ── Select soundscape ────────────────────────────────────────────────────
  const handleSelect = useCallback(async (soundscape: Soundscape) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedId === soundscape.id && isPlaying) {
      // Pause current
      setIsPlaying(false);
      await unloadCurrent(400);
      setSelectedId(null);
      return;
    }

    setSelectedId(soundscape.id);

    // Crossfade: fade out old, fade in new
    if (soundRef.current) {
      await unloadCurrent(400);
    }

    await playSound(soundscape);
  }, [selectedId, isPlaying, unloadCurrent, playSound]);

  // ── Volume change ────────────────────────────────────────────────────────
  const handleVolumeChange = useCallback(async (newVol: number) => {
    setVolume(newVol);
    if (soundRef.current) {
      try { await soundRef.current.setVolumeAsync(newVol); } catch { /* ignore */ }
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Stop all on close ─────────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    // Fade out and stop audio after modal closes
    setTimeout(() => void unloadCurrent(600), 300);
  }, [onClose, unloadCurrent]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    // Capture refs outside cleanup so lint is satisfied
    const timerRef = crossfadeTimerRef;
    const sndRef = soundRef;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void (async () => {
        if (sndRef.current) {
          try {
            sndRef.current.setOnPlaybackStatusUpdate(null);
            await sndRef.current.stopAsync();
            await sndRef.current.unloadAsync();
          } catch { /* ignore */ }
        }
      })();
    };
  }, []);

  const selectedSoundscape = SOUNDSCAPES.find((s) => s.id === selectedId);
  const accentColor = selectedSoundscape?.accentColor ?? Colors.celestialGold;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => void handleClose()}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => void handleClose()}
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={() => { /* prevent close */ }}>
            {Platform.OS !== 'web' ? (
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            ) : null}
            <LinearGradient
              colors={['rgba(37,38,85,0.97)', 'rgba(13,14,36,0.98)']}
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl }]}
            />

            <View style={styles.sheetContent}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>🌊  Sound Waves</Text>
                  <Text style={styles.sheetSubtitle}>
                    {isPlaying && selectedSoundscape
                      ? `Playing: ${selectedSoundscape.label}`
                      : 'Choose an ambient soundscape'}
                  </Text>
                </View>
                {isPlaying && selectedSoundscape && (
                  <SoundWaveBars color={accentColor} isPlaying={isPlaying} />
                )}
              </View>

              {/* Sound options grid */}
              <View style={styles.soundGrid}>
                {SOUNDSCAPES.map((sc) => {
                  const isActive = sc.id === selectedId && isPlaying;
                  return (
                    <TouchableOpacity
                      key={sc.id}
                      style={[
                        styles.soundCard,
                        isActive && { borderColor: sc.accentColor, borderWidth: 2 },
                      ]}
                      onPress={() => void handleSelect(sc)}
                      activeOpacity={0.8}
                    >
                      {isActive && (
                        <LinearGradient
                          colors={[`${sc.accentColor}25`, `${sc.accentColor}08`]}
                          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                        />
                      )}

                      <Text style={styles.soundEmoji}>{sc.emoji}</Text>
                      <Text style={[styles.soundLabel, isActive && { color: sc.accentColor }]}>
                        {sc.label}
                      </Text>
                      <Text style={styles.soundDesc} numberOfLines={2}>
                        {sc.description}
                      </Text>

                      {isActive && (
                        <View style={[styles.playingDot, { backgroundColor: sc.accentColor }]} />
                      )}
                      {isLoading && sc.id === selectedId && (
                        <View style={styles.loadingOverlay}>
                          <Text style={styles.loadingDots}>•••</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Volume Mixer */}
              <View style={styles.volumeSection}>
                <View style={styles.volumeHeader}>
                  <Text style={styles.volumeLabel}>Ambient Volume</Text>
                  <Text style={[styles.volumeValue, { color: accentColor }]}>
                    {Math.round(volume * 100)}%
                  </Text>
                </View>
                <VolumeSlider
                  value={volume}
                  onChange={(v) => void handleVolumeChange(v)}
                  accentColor={accentColor}
                />
                <Text style={styles.volumeHint}>
                  {isPlaying
                    ? 'Mix with narrator voice for the perfect sleep soundscape'
                    : 'Select a sound above to begin mixing'}
                </Text>
              </View>

              {/* Stop / Close */}
              <View style={styles.bottomRow}>
                {isPlaying && (
                  <TouchableOpacity
                    style={styles.stopBtn}
                    onPress={() => void handleSelect(selectedSoundscape!)}
                  >
                    <Text style={styles.stopBtnText}>⏹ Stop Sound</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.doneBtn, !isPlaying && styles.doneBtnFull]}
                  onPress={() => void handleClose()}
                >
                  <LinearGradient
                    colors={[Colors.celestialGold, Colors.softGold]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                  />
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
  },
  sheet: {
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow:             'hidden',
    borderWidth:          1,
    borderBottomWidth:    0,
    borderColor:          'rgba(255,255,255,0.12)',
  },
  sheetContent: {
    padding:       Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap:           Spacing.lg,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.borderColor,
    alignSelf:       'center',
    marginBottom:    4,
  },
  sheetHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: Fonts.extraBold,
    fontSize:   20,
    color:      Colors.moonlightCream,
  },
  sheetSubtitle: {
    fontFamily: Fonts.regular,
    fontSize:   13,
    color:      Colors.textMuted,
    marginTop:  2,
  },

  // Sound grid
  soundGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
  },
  soundCard: {
    width:           (W - Spacing.xl * 2 - 12) / 2,
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    minHeight:       100,
    gap:             4,
  },
  soundEmoji: { fontSize: 28 },
  soundLabel: {
    fontFamily: Fonts.extraBold,
    fontSize:   14,
    color:      Colors.moonlightCream,
  },
  soundDesc: {
    fontFamily: Fonts.regular,
    fontSize:   11,
    color:      Colors.textMuted,
    lineHeight: 15,
  },
  playingDot: {
    position:     'absolute',
    top:          8,
    right:        8,
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,14,36,0.5)',
    borderRadius:    Radius.xl,
    alignItems:      'center',
    justifyContent:  'center',
  },
  loadingDots: {
    fontFamily: Fonts.extraBold,
    fontSize:   18,
    color:      Colors.celestialGold,
    letterSpacing: 4,
  },

  // Volume section
  volumeSection: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    gap:             Spacing.sm,
  },
  volumeHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  volumeLabel: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.moonlightCream,
  },
  volumeValue: {
    fontFamily: Fonts.extraBold,
    fontSize:   14,
  },
  volumeHint: {
    fontFamily: Fonts.regular,
    fontSize:   11,
    color:      Colors.textMuted,
    textAlign:  'center',
    marginTop:  4,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    gap:           12,
  },
  stopBtn: {
    flex:           1,
    paddingVertical: Spacing.md,
    borderRadius:   Radius.full,
    alignItems:     'center',
    borderWidth:    1,
    borderColor:    Colors.borderColor,
  },
  stopBtnText: {
    fontFamily: Fonts.bold,
    fontSize:   14,
    color:      Colors.textMuted,
  },
  doneBtn: {
    flex:            1,
    paddingVertical: Spacing.md,
    borderRadius:    Radius.full,
    alignItems:      'center',
    overflow:        'hidden',
  },
  doneBtnFull: {
    flex: 1,
  },
  doneBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   15,
    color:      Colors.deepSpace,
  },
});
