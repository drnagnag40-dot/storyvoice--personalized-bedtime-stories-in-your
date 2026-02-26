/**
 * The Parent's Observatory
 *
 * A dedicated frosted-glass profile screen for parents to manage their account.
 * Includes a "Child's Cosmic Identity" section where parents can set the child's
 * name and age — persisted in the Supabase `profiles` table and used to
 * personalise AI narrator greetings.
 *
 * Also includes the Dream Guardian Workshop for generating AI portrait avatars.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@fastshot/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useImageGeneration } from '@fastshot/ai';
import StarField from '@/components/StarField';
import { upsertProfile, getProfile } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// ─── Guardian Themes ──────────────────────────────────────────────────────────
interface GuardianTheme {
  id: string;
  label: string;
  emoji: string;
  description: string;
  accentColor: string;
  glowColor: string;
  prompt: (childName: string) => string;
}

const GUARDIAN_THEMES: GuardianTheme[] = [
  {
    id: 'star_knight',
    label: 'Star Knight',
    emoji: '⚔️',
    description: 'Noble protector of the cosmos',
    accentColor: '#7EC8E3',
    glowColor: '#4A9CB5',
    prompt: (name) =>
      `Dreamlike ethereal portrait of a radiant Star Knight guardian spirit, floating in a crystal night sky filled with glowing nebulae. The guardian wears luminous crystalline armour dusted with stardust, wielding a sword of pure moonlight. Magical, ethereal, glowing colors — deep indigo and ice blue tones with golden stardust. Created as the dream guardian for a child named ${name}. Frosted glass watercolour style, soft gossamer light rays, bokeh stars, celestial and otherworldly. Square composition, subject centred, radiant glow aura.`,
  },
  {
    id: 'moon_fairy',
    label: 'Moon Fairy',
    emoji: '🧚',
    description: 'Gentle keeper of moonlit dreams',
    accentColor: '#C9A8FF',
    glowColor: '#8B5CF6',
    prompt: (name) =>
      `Dreamlike ethereal portrait of a radiant Moon Fairy guardian spirit, hovering in a moonlit crystal sky. Translucent iridescent wings glow like moonstone, surrounded by floating silver dust and moonflowers. Magical, ethereal, glowing colors — soft violet, lavender and pearl white tones. Created as the dream guardian for a child named ${name}. Frosted glass watercolour style, luminous light rays, bokeh stars, enchanted and otherworldly. Square composition, subject centred, radiant glow aura.`,
  },
  {
    id: 'galactic_owl',
    label: 'Galactic Owl',
    emoji: '🦉',
    description: 'Ancient wisdom of the stars',
    accentColor: '#FFD700',
    glowColor: '#FFA500',
    prompt: (name) =>
      `Dreamlike ethereal portrait of a magnificent Galactic Owl guardian spirit, perched among swirling galaxies. Feathers shimmer like the Milky Way, eyes glow with the light of distant stars, surrounded by orbiting golden dust motes. Magical, ethereal, glowing colors — deep midnight blue and warm gold tones. Created as the dream guardian for a child named ${name}. Frosted glass watercolour style, celestial bokeh, gossamer cosmic light, ancient and wise energy. Square composition, subject centred, radiant glow aura.`,
  },
  {
    id: 'forest_sprite',
    label: 'Forest Sprite',
    emoji: '🌿',
    description: 'Enchanted guardian of nature',
    accentColor: '#34D399',
    glowColor: '#059669',
    prompt: (name) =>
      `Dreamlike ethereal portrait of a luminous Forest Sprite guardian spirit, emerging from an enchanted moonlit forest. Glowing emerald and jade light radiates from their translucent form, surrounded by fireflies, moonflowers, and crystalline dewdrops. Magical, ethereal, glowing colors — deep forest green, teal and silver tones. Created as the dream guardian for a child named ${name}. Frosted glass watercolour style, gentle bioluminescent light, bokeh forest bokeh, mystical and serene. Square composition, subject centred, radiant glow aura.`,
  },
];

// ─── Observatory input ────────────────────────────────────────────────────────
function ObservatoryInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  editable = true,
}: {
  label: string;
  icon: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const glow = useSharedValue(0);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    shadowRadius: 10 * glow.value,
  }));

  return (
    <View style={obsInputStyles.group}>
      <View style={obsInputStyles.labelRow}>
        <Text style={obsInputStyles.icon}>{icon}</Text>
        <Text style={obsInputStyles.label}>{label}</Text>
      </View>
      <View style={obsInputStyles.wrapper}>
        <Animated.View style={[obsInputStyles.glow, glowStyle]} pointerEvents="none" />
        <View style={[obsInputStyles.container, focused && obsInputStyles.focused, !editable && obsInputStyles.disabled]}>
          <TextInput
            style={obsInputStyles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(153,153,187,0.5)"
            keyboardType={keyboardType ?? 'default'}
            maxLength={maxLength}
            editable={editable}
            onFocus={() => {
              setFocused(true);
              glow.value = withTiming(1, { duration: 250 });
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onBlur={() => {
              setFocused(false);
              glow.value = withTiming(0, { duration: 300 });
            }}
            selectionColor={Colors.celestialGold}
          />
        </View>
      </View>
    </View>
  );
}

const obsInputStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  icon: { fontSize: 14 },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wrapper: { position: 'relative' },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  container: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  focused: {
    borderColor: 'rgba(255,215,0,0.6)',
    backgroundColor: 'rgba(255,215,0,0.025)',
  },
  disabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(61,63,122,0.4)',
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    paddingVertical: 14,
    paddingHorizontal: 16,
    letterSpacing: 0.2,
  },
});

// ─── Glass section card ───────────────────────────────────────────────────────
function GlassSection({
  title,
  icon,
  children,
  accentColor = Colors.softPurple,
  delay = 0,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[sectionStyles.card, style]}>
      {Platform.OS !== 'web' && (
        <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={[`${accentColor}18`, `${accentColor}06`]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      <View style={sectionStyles.topShine} />

      <View style={sectionStyles.titleRow}>
        <Text style={sectionStyles.icon}>{icon}</Text>
        <Text style={[sectionStyles.title, { color: accentColor }]}>{title}</Text>
      </View>
      <View style={sectionStyles.divider} />
      <View style={sectionStyles.content}>{children}</View>
    </Animated.View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.md,
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: Platform.OS === 'web' ? 'rgba(20,10,50,0.9)' : undefined,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 10,
  },
  icon: { fontSize: 18 },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.md,
  },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
});

// ─── Age picker row ───────────────────────────────────────────────────────────
const AGES = Array.from({ length: 14 }, (_, i) => i + 2); // 2..15

function AgePicker({ value, onChange }: { value: number | null; onChange: (age: number) => void }) {
  return (
    <View>
      <View style={ageStyles.labelRow}>
        <Text style={ageStyles.icon}>🎂</Text>
        <Text style={ageStyles.label}>{"Child's Age"}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ageStyles.scroll}>
        {AGES.map((age) => {
          const selected = value === age;
          return (
            <TouchableOpacity
              key={age}
              onPress={() => {
                onChange(age);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[ageStyles.chip, selected && ageStyles.chipSelected]}
              activeOpacity={0.8}
            >
              {selected && (
                <LinearGradient
                  colors={['rgba(255,215,0,0.25)', 'rgba(255,215,0,0.08)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                />
              )}
              <Text style={[ageStyles.chipText, selected && ageStyles.chipTextSelected]}>
                {age}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ageStyles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  icon: { fontSize: 14 },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scroll: { paddingVertical: 2, gap: 8 },
  chip: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(61,63,122,0.8)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  chipSelected: {
    borderColor: 'rgba(255,215,0,0.6)',
  },
  chipText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textMuted,
  },
  chipTextSelected: {
    color: Colors.celestialGold,
  },
});

// ─── Magical Loading Orb ──────────────────────────────────────────────────────
function ManifestingOrb() {
  const orbScale    = useSharedValue(1);
  const orbRotation = useSharedValue(0);
  const glowPulse   = useSharedValue(0.5);
  const particle1Angle = useSharedValue(0);
  const particle2Angle = useSharedValue(120);
  const particle3Angle = useSharedValue(240);
  const particle4Angle = useSharedValue(60);
  const particle5Angle = useSharedValue(180);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Orb breathing
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // Orb swirl
    orbRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
    // Glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // Stardust particles orbiting
    const makeOrbit = (sv: SharedValue<number>, speed: number) => {
      sv.value = withRepeat(
        withTiming(sv.value + 360, { duration: speed, easing: Easing.linear }),
        -1,
        false,
      );
    };
    makeOrbit(particle1Angle, 2200);
    makeOrbit(particle2Angle, 3000);
    makeOrbit(particle3Angle, 2700);
    makeOrbit(particle4Angle, 1800);
    makeOrbit(particle5Angle, 3500);

    // Text fade in
    textOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));

    return () => {
      cancelAnimation(orbScale);
      cancelAnimation(orbRotation);
      cancelAnimation(glowPulse);
      cancelAnimation(particle1Angle);
      cancelAnimation(particle2Angle);
      cancelAnimation(particle3Angle);
      cancelAnimation(particle4Angle);
      cancelAnimation(particle5Angle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const orbInnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbRotation.value}deg` }],
    opacity: interpolate(glowPulse.value, [0.3, 1], [0.6, 1], Extrapolation.CLAMP),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowPulse.value, [0.3, 1], [0.3, 0.9], Extrapolation.CLAMP),
    shadowRadius: interpolate(glowPulse.value, [0.3, 1], [15, 40], Extrapolation.CLAMP),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const makeParticleStyle = (angle: SharedValue<number>, radius: number, size: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const rad = (angle.value * Math.PI) / 180;
      return {
        transform: [
          { translateX: Math.cos(rad) * radius },
          { translateY: Math.sin(rad) * radius },
        ],
        width: size,
        height: size,
        borderRadius: size / 2,
        position: 'absolute',
      };
    });

  const p1Style = makeParticleStyle(particle1Angle, 55, 5);
  const p2Style = makeParticleStyle(particle2Angle, 65, 4);
  const p3Style = makeParticleStyle(particle3Angle, 50, 6);
  const p4Style = makeParticleStyle(particle4Angle, 72, 3);
  const p5Style = makeParticleStyle(particle5Angle, 58, 5);

  return (
    <View style={orbStyles.wrapper}>
      {/* Outer glow halo */}
      <Animated.View style={[orbStyles.glowHalo, glowStyle]} />

      {/* Particles orbit */}
      <View style={orbStyles.particleOrbit}>
        <Animated.View style={[p1Style, { backgroundColor: '#FFD700' }]} />
        <Animated.View style={[p2Style, { backgroundColor: '#C9A8FF' }]} />
        <Animated.View style={[p3Style, { backgroundColor: '#7EC8E3' }]} />
        <Animated.View style={[p4Style, { backgroundColor: '#FFD700', opacity: 0.7 }]} />
        <Animated.View style={[p5Style, { backgroundColor: '#34D399', opacity: 0.8 }]} />
      </View>

      {/* Orb body */}
      <Animated.View style={[orbStyles.orbContainer, orbStyle]}>
        {Platform.OS !== 'web' && (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(201,168,255,0.35)', 'rgba(107,72,184,0.5)', 'rgba(14,8,32,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[orbStyles.orbInner, orbInnerStyle]}>
          <LinearGradient
            colors={['rgba(255,215,0,0.3)', 'rgba(201,168,255,0.2)', 'transparent']}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
        </Animated.View>
        {/* Orb shine */}
        <View style={orbStyles.orbShine} />
        <Text style={orbStyles.orbEmoji}>✨</Text>
      </Animated.View>

      <Animated.View style={[orbStyles.labelWrapper, textStyle]}>
        <Text style={orbStyles.manifestingTitle}>Manifesting your Guardian…</Text>
        <Text style={orbStyles.manifestingSubtitle}>Gathering stardust from the cosmos</Text>
      </Animated.View>
    </View>
  );
}

const orbStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
  },
  glowHalo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
    shadowColor: '#C9A8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    elevation: 0,
  },
  particleOrbit: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: '35%',
  },
  orbContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,255,0.45)',
    shadowColor: '#C9A8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 16,
    backgroundColor: Platform.OS === 'web' ? 'rgba(30,10,60,0.9)' : undefined,
  },
  orbInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  orbShine: {
    position: 'absolute',
    top: 10,
    left: '25%',
    right: '25%',
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  orbEmoji: {
    fontSize: 36,
    textShadowColor: 'rgba(255,215,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  labelWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  manifestingTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.moonlightCream,
    textAlign: 'center',
    textShadowColor: 'rgba(201,168,255,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  manifestingSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

// ─── Guardian Avatar Display ──────────────────────────────────────────────────
function GuardianAvatarDisplay({
  imageUrl,
  theme,
  onCommune,
  onRegenerate,
  isSaving,
}: {
  imageUrl: string;
  theme: GuardianTheme;
  onCommune: () => void;
  onRegenerate: () => void;
  isSaving: boolean;
}) {
  const glowPulse = useSharedValue(0.5);
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const communeBtnScale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 90 });
    opacity.value = withTiming(1, { duration: 700 });
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(glowPulse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowPulse.value, [0.4, 1], [0.35, 0.85], Extrapolation.CLAMP),
    shadowRadius: interpolate(glowPulse.value, [0.4, 1], [16, 38], Extrapolation.CLAMP),
  }));

  const communeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: communeBtnScale.value }],
  }));

  const handleCommunePress = () => {
    communeBtnScale.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCommune();
  };

  return (
    <Animated.View style={[avatarStyles.wrapper, containerStyle]}>
      {/* Radiant golden outer glow */}
      <Animated.View style={[avatarStyles.outerGlow, glowStyle, { shadowColor: theme.accentColor }]} />

      {/* Frosted glass circular frame */}
      <View style={avatarStyles.frameOuter}>
        <LinearGradient
          colors={[`${theme.accentColor}55`, `${theme.accentColor}22`, 'transparent']}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
        {Platform.OS !== 'web' && (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {/* Golden border ring */}
        <View style={[avatarStyles.goldRing, { borderColor: theme.accentColor }]} />
        {/* Inner image circle */}
        <Image
          source={{ uri: imageUrl }}
          style={avatarStyles.image}
          resizeMode="cover"
        />
        {/* Glass top shine */}
        <View style={avatarStyles.frameShine} />
      </View>

      {/* Theme label */}
      <View style={[avatarStyles.themePill, { borderColor: `${theme.accentColor}60` }]}>
        <LinearGradient
          colors={[`${theme.accentColor}20`, `${theme.accentColor}08`]}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
        />
        <Text style={avatarStyles.themeEmoji}>{theme.emoji}</Text>
        <Text style={[avatarStyles.themeLabel, { color: theme.accentColor }]}>{theme.label}</Text>
        <Text style={avatarStyles.guardianTag}>Dream Guardian</Text>
      </View>

      {/* Commune button */}
      <Animated.View style={[avatarStyles.communeWrapper, communeStyle]}>
        <TouchableOpacity
          onPress={handleCommunePress}
          disabled={isSaving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={isSaving
              ? (['#6BCB77', '#4CAF50'] as const)
              : ([Colors.celestialGold, Colors.softGold, '#E8A800'] as const)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={avatarStyles.communeGradient}
          >
            <Text style={avatarStyles.communeText}>
              {isSaving ? '⏳ Bonding with Guardian…' : '🔮 Commune with this Guardian'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Regenerate option */}
      <TouchableOpacity onPress={onRegenerate} style={avatarStyles.regenBtn}>
        <Text style={avatarStyles.regenText}>↺ Summon a different Guardian</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const avatarStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: Spacing.md,
  },
  outerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'transparent',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    top: '5%',
  },
  frameOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'web' ? 'rgba(30,10,60,0.8)' : undefined,
  },
  goldRing: {
    position: 'absolute',
    width: 166,
    height: 166,
    borderRadius: 83,
    borderWidth: 2.5,
    zIndex: 10,
  },
  image: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  frameShine: {
    position: 'absolute',
    top: 10,
    left: '20%',
    right: '20%',
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 11,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeEmoji: { fontSize: 16 },
  themeLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  guardianTag: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  communeWrapper: {
    width: '100%',
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  communeGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  communeText: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    color: Colors.deepSpace,
    letterSpacing: 0.3,
  },
  regenBtn: {
    paddingVertical: 8,
  },
  regenText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textMuted,
  },
});

// ─── Dream Guardian Workshop ──────────────────────────────────────────────────
function DreamGuardianWorkshop({
  childName,
  currentAvatarUrl,
  onAvatarSaved,
}: {
  childName: string;
  currentAvatarUrl: string | null;
  onAvatarSaved: (url: string) => void;
}) {
  const [selectedTheme, setSelectedTheme] = useState<GuardianTheme | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { generateImage, isLoading: isGenerating } = useImageGeneration();

  const handleThemeSelect = (theme: GuardianTheme) => {
    setSelectedTheme(theme);
    setGeneratedImageUrl(null);
    setSaveSuccess(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleGenerate = async () => {
    if (!selectedTheme) return;
    if (!childName.trim()) {
      Alert.alert('Name required', "Please enter your child's name first before summoning their Guardian.");
      return;
    }
    setGeneratedImageUrl(null);
    setSaveSuccess(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await generateImage({
        prompt: selectedTheme.prompt(childName.trim()),
        width: 1024,
        height: 1024,
      });
      if (result?.images?.[0]) {
        setGeneratedImageUrl(result.images[0]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Generation failed', 'The stars could not align. Please try again.');
      }
    } catch {
      Alert.alert('Cosmic disruption', 'Something went wrong while summoning your Guardian. Please try again.');
    }
  };

  const handleCommune = async () => {
    if (!generatedImageUrl) return;
    setIsSaving(true);
    try {
      onAvatarSaved(generatedImageUrl);
      setSaveSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedImageUrl(null);
    void handleGenerate();
  };

  return (
    <View>
      {/* Current guardian preview (if exists) */}
      {currentAvatarUrl && !generatedImageUrl && !isGenerating && (
        <View style={workshopStyles.currentGuardian}>
          <LinearGradient
            colors={['rgba(255,215,0,0.10)', 'rgba(255,215,0,0.03)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
          />
          <Image
            source={{ uri: currentAvatarUrl }}
            style={workshopStyles.currentAvatar}
          />
          <View style={workshopStyles.currentInfo}>
            <Text style={workshopStyles.currentLabel}>Current Guardian</Text>
            <Text style={workshopStyles.currentHint}>Summon a new one below ✨</Text>
          </View>
        </View>
      )}

      {/* Intro */}
      <View style={workshopStyles.introBox}>
        <LinearGradient
          colors={['rgba(107,72,184,0.15)', 'rgba(107,72,184,0.05)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
        />
        <Text style={workshopStyles.introText}>
          {'🔮 Choose a theme below to summon a unique Dream Guardian — a magical AI-generated portrait that watches over your child\'s dreams.'}
        </Text>
      </View>

      {/* Theme selector */}
      <Text style={workshopStyles.sectionLabel}>✦ Choose Your Theme</Text>
      <View style={workshopStyles.themeGrid}>
        {GUARDIAN_THEMES.map((theme) => {
          const isSelected = selectedTheme?.id === theme.id;
          return (
            <TouchableOpacity
              key={theme.id}
              style={[workshopStyles.themeCard, isSelected && workshopStyles.themeCardSelected, { borderColor: isSelected ? `${theme.accentColor}80` : 'rgba(255,255,255,0.1)' }]}
              onPress={() => handleThemeSelect(theme)}
              activeOpacity={0.8}
            >
              {isSelected && (
                <LinearGradient
                  colors={[`${theme.accentColor}22`, `${theme.accentColor}08`]}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                />
              )}
              {Platform.OS !== 'web' && (
                <BlurView intensity={isSelected ? 20 : 14} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <Text style={workshopStyles.themeCardEmoji}>{theme.emoji}</Text>
              <Text style={[workshopStyles.themeCardLabel, isSelected && { color: theme.accentColor }]}>{theme.label}</Text>
              <Text style={workshopStyles.themeCardDesc}>{theme.description}</Text>
              {isSelected && (
                <View style={[workshopStyles.selectedDot, { backgroundColor: theme.accentColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Generate button */}
      {selectedTheme && !isGenerating && !generatedImageUrl && (
        <TouchableOpacity
          style={workshopStyles.summonBtn}
          onPress={() => void handleGenerate()}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[selectedTheme.accentColor, selectedTheme.glowColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={workshopStyles.summonGradient}
          >
            <Text style={workshopStyles.summonBtnIcon}>{selectedTheme.emoji}</Text>
            <Text style={workshopStyles.summonBtnText}>Summon {selectedTheme.label} Guardian</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Magical loading state */}
      {isGenerating && <ManifestingOrb />}

      {/* Success display */}
      {generatedImageUrl && selectedTheme && !isGenerating && (
        <GuardianAvatarDisplay
          imageUrl={generatedImageUrl}
          theme={selectedTheme}
          onCommune={() => void handleCommune()}
          onRegenerate={handleRegenerate}
          isSaving={isSaving || saveSuccess}
        />
      )}

      {saveSuccess && (
        <View style={workshopStyles.saveSuccessBadge}>
          <LinearGradient
            colors={['rgba(107,203,119,0.20)', 'rgba(107,203,119,0.07)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
          />
          <Text style={workshopStyles.saveSuccessText}>
            ✓ Your Dream Guardian has been bonded and saved!
          </Text>
        </View>
      )}
    </View>
  );
}

const workshopStyles = StyleSheet.create({
  currentGuardian: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.20)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  currentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.celestialGold,
  },
  currentInfo: { flex: 1 },
  currentLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.celestialGold,
  },
  currentHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  introBox: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(107,72,184,0.25)',
    marginBottom: 16,
  },
  introText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: 'rgba(232,232,240,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  themeCard: {
    width: (W - 40 - Spacing.md * 2 - 10) / 2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Platform.OS === 'web' ? 'rgba(14,8,32,0.8)' : undefined,
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  themeCardSelected: {
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  themeCardEmoji: { fontSize: 28 },
  themeCardLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    color: Colors.moonlightCream,
    textAlign: 'center',
  },
  themeCardDesc: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  selectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 2,
  },
  summonBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#9B6FDE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  summonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 10,
    borderRadius: Radius.full,
  },
  summonBtnIcon: { fontSize: 18 },
  summonBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    color: Colors.deepSpace,
    letterSpacing: 0.3,
  },
  saveSuccessBadge: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(107,203,119,0.30)',
    marginTop: 8,
    alignItems: 'center',
  },
  saveSuccessText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.successGreen,
    textAlign: 'center',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ObservatoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Entrance animation
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-20);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
    headerY.value = withSpring(0, { damping: 16, stiffness: 180 });

    // Load existing profile
    if (user?.id) {
      void loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setChildName(profile.child_name ?? '');
        setChildAge(profile.child_age ?? null);
        setAvatarUrl(profile.avatar_url ?? null);
      }
    } catch {
      // Non-fatal
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in to save your profile.');
      return;
    }
    if (!childName.trim()) {
      Alert.alert('Missing name', "Please enter your child's name.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await upsertProfile(user.id, {
        email: user.email ?? undefined,
        child_name: childName.trim(),
        child_age: childAge,
        avatar_url: avatarUrl,
      });

      setSaveSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      Alert.alert('Save failed', 'Unable to save your profile. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Cloud Magic?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          },
        },
      ]
    );
  };

  const handleAvatarSaved = async (url: string) => {
    setAvatarUrl(url);
    if (!user?.id) return;
    try {
      await upsertProfile(user.id, {
        email: user.email ?? undefined,
        child_name: childName.trim() || undefined,
        child_age: childAge,
        avatar_url: url,
      });
    } catch {
      // non-fatal, the URL is still stored locally in state
    }
  };

  // Save button animation
  const saveBtnScale = useSharedValue(1);
  const handleSavePress = () => {
    saveBtnScale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 300 })
    );
    void handleSave();
  };

  const saveBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveBtnScale.value }],
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  // Starfield pulse
  const telescopePulse = useSharedValue(1);
  useEffect(() => {
    telescopePulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const telescopeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: telescopePulse.value }],
  }));

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#0E0820', '#180D38', '#2A1155']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      <StarField count={55} />

      {/* Ambient orbs */}
      <View style={styles.orbGold} pointerEvents="none" />
      <View style={styles.orbPurple} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Animated.View style={[styles.header, headerStyle]}>
            <Animated.Text style={[styles.telescopeEmoji, telescopeStyle]}>🔭</Animated.Text>
            <Text style={styles.headerTitle}>{"The Parent's Observatory"}</Text>
            <Text style={styles.headerSubtitle}>Manage your Cloud Magic identity</Text>
            <View style={styles.headerUnderline} />
          </Animated.View>

          {/* ── Account section ── */}
          <GlassSection
            title="Star Account"
            icon="⭐"
            accentColor={Colors.softBlue}
            delay={200}
          >
            <ObservatoryInput
              label="Email"
              icon="📧"
              value={user?.email ?? ''}
              editable={false}
              placeholder="your@email.com"
            />

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255,107,107,0.15)', 'rgba(255,107,107,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
              />
              <View style={styles.signOutBtnShine} />
              <Text style={styles.signOutText}>🚪 Sign Out of Cloud Magic</Text>
            </TouchableOpacity>
          </GlassSection>

          {/* ── Child's Cosmic Identity section ── */}
          <GlassSection
            title="Child's Cosmic Identity"
            icon="🌟"
            accentColor={Colors.celestialGold}
            delay={350}
          >
            {/* Cosmic identity description */}
            <View style={styles.cosmicDesc}>
              <LinearGradient
                colors={['rgba(255,215,0,0.10)', 'rgba(255,215,0,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
              />
              <Text style={styles.cosmicDescText}>
                {"✨ Your child's name and age are woven into the magic — AI narrators will greet them by name and craft stories perfectly suited to their age."}
              </Text>
            </View>

            <ObservatoryInput
              label="Child's Name"
              icon="👦"
              value={childName}
              onChangeText={setChildName}
              placeholder="e.g. Luna, Orion, Sage…"
              maxLength={40}
            />

            <AgePicker value={childAge} onChange={setChildAge} />
          </GlassSection>

          {/* ── Dream Guardian Workshop ── */}
          <GlassSection
            title="Dream Guardian Workshop"
            icon="🔮"
            accentColor="#C9A8FF"
            delay={450}
          >
            <DreamGuardianWorkshop
              childName={childName}
              currentAvatarUrl={avatarUrl}
              onAvatarSaved={handleAvatarSaved}
            />
          </GlassSection>

          {/* ── Personalisation preview ── */}
          {(childName.trim() || childAge) && (
            <GlassSection
              title="Narrator Preview"
              icon="🎙️"
              accentColor={Colors.accentPink}
              delay={550}
            >
              <View style={styles.previewBubble}>
                <LinearGradient
                  colors={['rgba(255,107,157,0.12)', 'rgba(107,72,184,0.08)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                />
                <Text style={styles.previewText}>
                  {`"Good evening${childName.trim() ? `, ${childName.trim()}` : ''}! ${
                    childAge
                      ? `I have a magical story just right for a ${childAge}-year-old explorer like you.`
                      : "I have a magical story waiting just for you."
                  } Are you ready to begin?"`}
                </Text>
              </View>
            </GlassSection>
          )}

          {/* ── Save button ── */}
          <Animated.View style={[styles.saveBtnWrapper, saveBtnStyle]}>
            <TouchableOpacity
              onPress={handleSavePress}
              activeOpacity={0.88}
              disabled={saving}
            >
              <LinearGradient
                colors={
                  saveSuccess
                    ? (['#6BCB77', '#4CAF50'] as const)
                    : ([Colors.celestialGold, Colors.softGold, '#E8A800'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                <Text style={styles.saveText}>
                  {saving ? '⏳ Saving to Stars…' : saveSuccess ? '✓ Saved to the Cosmos!' : '✨ Save Cosmic Identity'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Cloud Magic tips ── */}
          <GlassSection
            title="Cloud Magic Tips"
            icon="💡"
            accentColor={Colors.softPurple}
            delay={650}
          >
            {[
              { icon: '☁️', tip: "Your child's identity syncs across all devices instantly." },
              { icon: '🤖', tip: 'AI narrators use the name and age to personalise every story.' },
              { icon: '🔮', tip: 'Dream Guardian avatars are unique AI portraits generated just for your child.' },
              { icon: '🔐', tip: 'All profile data is encrypted and protected in the cloud vault.' },
            ].map((item, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipIcon}>{item.icon}</Text>
                <Text style={styles.tipText}>{item.tip}</Text>
              </View>
            ))}
          </GlassSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0820' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  orbGold: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -80,
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  orbPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: 60,
    left: -100,
    backgroundColor: 'rgba(107,72,184,0.07)',
  },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },

  // Header
  header: { alignItems: 'center', marginBottom: 24, gap: 6 },
  telescopeEmoji: {
    fontSize: 60,
    textShadowColor: 'rgba(107,72,184,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headerTitle: {
    fontFamily: Fonts.black,
    fontSize: 26,
    color: Colors.moonlightCream,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: Colors.celestialGold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  headerUnderline: {
    width: 60,
    height: 2,
    backgroundColor: Colors.celestialGold,
    borderRadius: 1,
    opacity: 0.6,
    marginTop: 4,
  },

  // Sign out
  signOutBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  signOutBtnShine: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
  },
  signOutText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.errorRed,
    letterSpacing: 0.3,
  },

  // Cosmic description
  cosmicDesc: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
    marginBottom: 16,
  },
  cosmicDescText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  // Narrator preview
  previewBubble: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
  },
  previewText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.moonlightCream,
    lineHeight: 22,
    fontStyle: 'italic',
    opacity: 0.9,
  },

  // Save button
  saveBtnWrapper: {
    marginBottom: 16,
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  saveGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  saveText: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.deepSpace,
    letterSpacing: 0.4,
  },

  // Tips
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tipIcon: { fontSize: 16, marginTop: 1 },
  tipText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
});
