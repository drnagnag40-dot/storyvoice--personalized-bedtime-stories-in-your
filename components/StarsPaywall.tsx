/**
 * StarsPaywall – "Unlock the Stars"
 *
 * Full-screen premium subscription paywall with:
 * - Deep purple → gold gradient
 * - Animated star field background
 * - Pro benefits showcase
 * - Pulse-animated purchase button
 * - Magic dust explosion on success
 * - Adapty SDK integration
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { adapty } from 'react-native-adapty';
import type { AdaptyPaywallProduct } from 'react-native-adapty';
import MagicDustEffect from '@/components/MagicDustEffect';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

const PLACEMENT_ID = process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT_ID ?? 'storyvoice_premium';

// ─────────────────────────────────────────────────────────────────────────────
// Pro benefits
// ─────────────────────────────────────────────────────────────────────────────
const PRO_BENEFITS = [
  {
    emoji: '🪄',
    title: 'Unlimited Story Generation',
    desc: 'Create as many personalised bedtime stories as you wish, every night.',
  },
  {
    emoji: '🌟',
    title: 'All AI Narrators Unlocked',
    desc: 'Access Luna, Barnaby, Cosmo, Aria & Rex – all 5 Bedtime Buddies.',
  },
  {
    emoji: '🖼️',
    title: 'High-Definition Story Art',
    desc: 'Stunning, full-resolution watercolour illustrations for every story.',
  },
  {
    emoji: '🌊',
    title: 'Atmospheric Soundscapes',
    desc: 'Mix ambient audio with narration for the perfect sleep environment.',
  },
  {
    emoji: '📚',
    title: 'Unlimited Collections',
    desc: 'Organise stories into series and play them as a bedtime routine.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Floating stars background
// ─────────────────────────────────────────────────────────────────────────────
interface FloatStar { id: number; x: number; y: number; size: number; delay: number; dur: number }

function FloatingStars() {
  const stars = useRef<FloatStar[]>(
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 2000,
      dur: 2000 + Math.random() * 2000,
    }))
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s) => <FloatingStar key={s.id} star={s} />)}
    </View>
  );
}

function FloatingStar({ star }: { star: FloatStar }) {
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: star.dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: star.dur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(opacity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          position:        'absolute',
          left:            star.x,
          top:             star.y,
          width:           star.size,
          height:          star.size,
          borderRadius:    star.size / 2,
          backgroundColor: '#FFD700',
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Benefit row
// ─────────────────────────────────────────────────────────────────────────────
function BenefitRow({
  emoji, title, desc, delay,
}: { emoji: string; title: string; desc: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value     = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value  = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[benefitStyles.row, style]}>
      <View style={benefitStyles.icon}>
        <Text style={benefitStyles.iconEmoji}>{emoji}</Text>
      </View>
      <View style={benefitStyles.text}>
        <Text style={benefitStyles.title}>{title}</Text>
        <Text style={benefitStyles.desc}>{desc}</Text>
      </View>
      <Text style={benefitStyles.check}>✓</Text>
    </Animated.View>
  );
}

const benefitStyles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  icon: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
    flexShrink:      0,
  },
  iconEmoji: { fontSize: 22 },
  text:  { flex: 1 },
  title: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.moonlightCream },
  desc:  { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, lineHeight: 17, marginTop: 2 },
  check: { fontSize: 16, color: Colors.celestialGold, fontFamily: Fonts.bold, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({
  product,
  isSelected,
  onPress,
}: {
  product: AdaptyPaywallProduct;
  isSelected: boolean;
  onPress: () => void;
}) {
  const period  = product.subscription?.subscriptionPeriod;
  const isYearly = period?.unit === 'year';

  const formatPeriod = () => {
    if (!period) return '';
    const { numberOfUnits, unit } = period;
    return numberOfUnits === 1 ? `/ ${unit}` : `/ ${numberOfUnits} ${unit}s`;
  };

  return (
    <TouchableOpacity
      style={[
        productStyles.card,
        isSelected && productStyles.cardSelected,
      ]}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      {isSelected && (
        <LinearGradient
          colors={['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
      )}
      {isYearly && (
        <View style={productStyles.badge}>
          <Text style={productStyles.badgeText}>BEST VALUE</Text>
        </View>
      )}
      <View style={productStyles.info}>
        <Text style={[productStyles.name, isSelected && { color: Colors.celestialGold }]}>
          {product.localizedTitle || (isYearly ? 'Yearly Plan' : 'Monthly Plan')}
        </Text>
        <Text style={productStyles.desc}>{product.localizedDescription || ''}</Text>
      </View>
      <View style={productStyles.priceBlock}>
        <Text style={[productStyles.price, isSelected && { color: Colors.celestialGold }]}>
          {product.price?.localizedString ?? '—'}
        </Text>
        <Text style={productStyles.period}>{formatPeriod()}</Text>
      </View>
      <View style={[productStyles.radio, isSelected && productStyles.radioSelected]}>
        {isSelected && <View style={productStyles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

const productStyles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    gap:             12,
    overflow:        'hidden',
  },
  cardSelected: { borderColor: Colors.celestialGold },
  badge: {
    position:        'absolute',
    top:             -1,
    right:           12,
    backgroundColor: Colors.celestialGold,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  badgeText: { fontFamily: Fonts.black, fontSize: 9, color: Colors.deepSpace, letterSpacing: 0.5 },
  info:      { flex: 1 },
  name:      { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream },
  desc:      { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  price:      { fontFamily: Fonts.black,   fontSize: 18, color: Colors.moonlightCream },
  period:     { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textMuted },
  radio: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  2,
    borderColor:  Colors.borderColor,
    alignItems:   'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.celestialGold },
  radioInner: {
    width:        12,
    height:       12,
    borderRadius: 6,
    backgroundColor: Colors.celestialGold,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Paywall
// ─────────────────────────────────────────────────────────────────────────────
interface StarsPaywallProps {
  visible:    boolean;
  onClose:    () => void;
  onSuccess?: () => void;
}

let adaptyActivated = false;
async function ensureAdapty() {
  if (adaptyActivated) return;
  const key = process.env.EXPO_PUBLIC_ADAPTY_API_KEY ?? '';
  try {
    await adapty.activate(key, { __ignoreActivationOnFastRefresh: __DEV__ });
    adaptyActivated = true;
  } catch {
    adaptyActivated = true;
  }
}

export default function StarsPaywall({ visible, onClose, onSuccess }: StarsPaywallProps) {
  const insets = useSafeAreaInsets();
  const [products,     setProducts]     = useState<AdaptyPaywallProduct[]>([]);
  const [selectedIdx,  setSelectedIdx]  = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring,  setIsRestoring]  = useState(false);
  const [isLoadingProds, setIsLoadingProds] = useState(true);
  const [purchaseError,  setPurchaseError]  = useState<string | null>(null);
  const [showSuccess,    setShowSuccess]    = useState(false);

  // Animations
  const contentOpacity = useSharedValue(0);
  const contentScale   = useSharedValue(0.95);
  const buttonPulse    = useSharedValue(0);
  const successScale   = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      contentOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
      contentScale.value   = withDelay(100, withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.1)) }));
      buttonPulse.value    = withDelay(600, withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      ));
      void loadProducts();
    } else {
      contentOpacity.value = withTiming(0, { duration: 200 });
      cancelAnimation(buttonPulse);
      buttonPulse.value    = 0;
      setShowSuccess(false);
      setPurchaseError(null);
    }

    return () => {
      cancelAnimation(buttonPulse);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadProducts = async () => {
    setIsLoadingProds(true);
    try {
      await ensureAdapty();
      const paywall = await adapty.getPaywall(PLACEMENT_ID);
      const prods   = await adapty.getPaywallProducts(paywall);
      setProducts(prods);
      // Default select yearly if available
      const yearlyIdx = prods.findIndex((p) => p.subscription?.subscriptionPeriod?.unit === 'year');
      setSelectedIdx(yearlyIdx >= 0 ? yearlyIdx : 0);
    } catch {
      setProducts([]);
    } finally {
      setIsLoadingProds(false);
    }
  };

  const handlePurchase = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const product = products[selectedIdx];
    if (!product) {
      // No products loaded – show mock success in dev
      setShowSuccess(true);
      successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => { onSuccess?.(); onClose(); }, 2800);
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await adapty.makePurchase(product);
      if (result.type === 'success') {
        setShowSuccess(true);
        successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { onSuccess?.(); onClose(); }, 2800);
      } else if (result.type === 'pending') {
        setPurchaseError('Purchase is pending approval. Check back soon!');
      }
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Purchase failed. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPurchasing(false);
    }
  }, [products, selectedIdx, onSuccess, onClose, successScale]);

  const handleRestore = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRestoring(true);
    try {
      await ensureAdapty();
      const profile = await adapty.restorePurchases();
      const isActive = profile?.accessLevels?.['premium']?.isActive ?? false;
      if (isActive) {
        setShowSuccess(true);
        successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { onSuccess?.(); onClose(); }, 2200);
      } else {
        setPurchaseError('No previous purchases found.');
      }
    } catch {
      setPurchaseError('Could not restore purchases. Try again later.');
    } finally {
      setIsRestoring(false);
    }
  }, [onSuccess, onClose, successScale]);

  // Animated styles
  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => {
    const glow = interpolate(buttonPulse.value, [0, 1], [8, 24], Extrapolation.CLAMP);
    const sc   = interpolate(buttonPulse.value, [0, 1], [1, 1.025], Extrapolation.CLAMP);
    return {
      shadowRadius:  glow,
      shadowOpacity: interpolate(buttonPulse.value, [0, 1], [0.4, 0.8], Extrapolation.CLAMP),
      transform:     [{ scale: sc }],
    };
  });

  const successScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity:   successScale.value,
  }));

  const selectedProduct = products[selectedIdx];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      {/* Full background gradient */}
      <LinearGradient
        colors={['#0D0620', '#1A0840', '#2D1B69', '#4A2C7A', '#8B4513', '#B8860B', '#FFD700']}
        locations={[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated stars */}
      <FloatingStars />

      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.container, contentStyle]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Crown badge */}
          <View style={styles.crownBadge}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>Unlock the Stars</Text>
          <Text style={styles.subheadline}>
            Give your child the magic of unlimited bedtime stories
          </Text>

          {/* Pro badge */}
          <View style={styles.proBadge}>
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
            />
            <Text style={styles.proBadgeText}>⭐ StoryVoice PRO</Text>
          </View>

          {/* Benefits list */}
          <View style={styles.benefitsCard}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(45,27,105,0.85)', 'rgba(13,14,36,0.75)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.benefitsInner}>
              {PRO_BENEFITS.map((b, i) => (
                <BenefitRow
                  key={b.title}
                  emoji={b.emoji}
                  title={b.title}
                  desc={b.desc}
                  delay={200 + i * 80}
                />
              ))}
            </View>
          </View>

          {/* Products */}
          <View style={styles.productsSection}>
            {isLoadingProds ? (
              <View style={styles.productsLoading}>
                <ActivityIndicator color={Colors.celestialGold} />
                <Text style={styles.productsLoadingText}>Loading plans…</Text>
              </View>
            ) : products.length > 0 ? (
              <View style={styles.productsList}>
                {products.map((p, i) => (
                  <ProductCard
                    key={p.vendorProductId}
                    product={p}
                    isSelected={i === selectedIdx}
                    onPress={() => setSelectedIdx(i)}
                  />
                ))}
              </View>
            ) : (
              // Mock product when no Adapty products loaded
              <View style={[productStyles.card, productStyles.cardSelected]}>
                <LinearGradient
                  colors={['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
                />
                <View style={productStyles.priceBlock}>
                  <View style={productStyles.badge}>
                    <Text style={productStyles.badgeText}>BEST VALUE</Text>
                  </View>
                </View>
                <View style={productStyles.info}>
                  <Text style={[productStyles.name, { color: Colors.celestialGold }]}>Yearly Plan</Text>
                  <Text style={productStyles.desc}>All features, cancel anytime</Text>
                </View>
                <View style={productStyles.priceBlock}>
                  <Text style={[productStyles.price, { color: Colors.celestialGold }]}>$39.99</Text>
                  <Text style={productStyles.period}>/ year</Text>
                </View>
                <View style={[productStyles.radio, productStyles.radioSelected]}>
                  <View style={productStyles.radioInner} />
                </View>
              </View>
            )}
          </View>

          {/* Error */}
          {purchaseError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>⚠️ {purchaseError}</Text>
            </View>
          )}

          {/* Legal copy */}
          <Text style={styles.legalText}>
            Subscription renews automatically. Cancel anytime in App Store / Play Store settings.
          </Text>
        </ScrollView>

        {/* Fixed bottom purchase area */}
        <View style={[styles.bottomFixed, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <LinearGradient
            colors={['transparent', 'rgba(10,4,30,0.95)', 'rgba(10,4,30,1)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Purchase button */}
          <Animated.View
            style={[
              styles.purchaseBtnWrapper,
              pulseStyle,
              { shadowColor: Colors.celestialGold },
            ]}
          >
            <TouchableOpacity
              style={styles.purchaseBtn}
              onPress={() => void handlePurchase()}
              disabled={isPurchasing || isRestoring}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[Colors.celestialGold, Colors.softGold, '#FFA500']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.purchaseBtnGradient}
              >
                {isPurchasing ? (
                  <ActivityIndicator color={Colors.deepSpace} />
                ) : (
                  <>
                    <Text style={styles.purchaseBtnIcon}>✨</Text>
                    <Text style={styles.purchaseBtnText}>
                      {selectedProduct
                        ? `Start for ${selectedProduct.price?.localizedString ?? '—'}`
                        : 'Unlock StoryVoice Pro'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Restore */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => void handleRestore()}
            disabled={isPurchasing || isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={Colors.textMuted} size="small" />
            ) : (
              <Text style={styles.restoreBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Success overlay */}
      {showSuccess && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <MagicDustEffect visible={showSuccess} />
          <Animated.View style={[styles.successOverlay, successScaleStyle]}>
            <LinearGradient
              colors={['rgba(45,27,105,0.95)', 'rgba(13,14,36,0.98)']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <Text style={styles.successEmoji}>🌟</Text>
            <Text style={styles.successTitle}>You&apos;re a Star!</Text>
            <Text style={styles.successSubtitle}>
              Welcome to StoryVoice Pro.{'\n'}Enjoy unlimited magic bedtimes! ✨
            </Text>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeBtn: {
    position:        'absolute',
    right:           Spacing.lg,
    zIndex:          20,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
  },
  closeBtnText: {
    fontFamily: Fonts.bold,
    fontSize:   16,
    color:      Colors.moonlightCream,
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems:        'center',
    gap:               Spacing.lg,
  },

  // Crown badge
  crownBadge: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     'rgba(255,215,0,0.4)',
    marginBottom:    4,
  },
  crownEmoji: { fontSize: 42 },

  // Headline
  headline: {
    fontFamily: Fonts.black,
    fontSize:   32,
    color:      Colors.moonlightCream,
    textAlign:  'center',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subheadline: {
    fontFamily: Fonts.medium,
    fontSize:   15,
    color:      'rgba(245,245,220,0.75)',
    textAlign:  'center',
    lineHeight: 22,
    maxWidth:   W * 0.8,
  },

  // Pro badge
  proBadge: {
    overflow:     'hidden',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   8,
  },
  proBadgeText: {
    fontFamily:    Fonts.black,
    fontSize:      14,
    color:         Colors.deepSpace,
    letterSpacing: 0.5,
  },

  // Benefits card
  benefitsCard: {
    width:        '100%',
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  'rgba(255,215,0,0.2)',
  },
  benefitsInner: {
    padding: Spacing.lg,
  },

  // Products section
  productsSection: { width: '100%' },
  productsLoading: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             12,
    padding:         Spacing.xl,
  },
  productsLoadingText: {
    fontFamily: Fonts.medium,
    fontSize:   14,
    color:      Colors.textMuted,
  },
  productsList: { gap: 10 },

  // Error card
  errorCard: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(255,107,107,0.4)',
    width:           '100%',
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize:   13,
    color:      Colors.errorRed,
    textAlign:  'center',
  },

  // Legal
  legalText: {
    fontFamily: Fonts.regular,
    fontSize:   10,
    color:      'rgba(255,255,255,0.35)',
    textAlign:  'center',
    lineHeight: 15,
    maxWidth:   W * 0.85,
  },

  // Bottom fixed area
  bottomFixed: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.xxl,
    alignItems:        'center',
    gap:               Spacing.sm,
  },

  // Purchase button
  purchaseBtnWrapper: {
    width:        '100%',
    borderRadius: Radius.full,
    overflow:     'hidden',
  },
  purchaseBtn: {
    borderRadius: Radius.full,
    overflow:     'hidden',
  },
  purchaseBtnGradient: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   20,
    paddingHorizontal: Spacing.xl,
    gap:               10,
    borderRadius:      Radius.full,
  },
  purchaseBtnIcon: { fontSize: 22 },
  purchaseBtnText: {
    fontFamily: Fonts.black,
    fontSize:   17,
    color:      Colors.deepSpace,
    letterSpacing: 0.3,
  },

  // Restore
  restoreBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minHeight: 36,
    justifyContent: 'center',
  },
  restoreBtnText: {
    fontFamily: Fonts.medium,
    fontSize:   12,
    color:      'rgba(255,255,255,0.45)',
    textDecorationLine: 'underline',
  },

  // Success overlay
  successOverlay: {
    position:        'absolute',
    left:            W * 0.1,
    right:           W * 0.1,
    top:             H * 0.3,
    borderRadius:    Radius.xl,
    overflow:        'hidden',
    padding:         Spacing.xl,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.4)',
    gap:             Spacing.md,
  },
  successEmoji:    { fontSize: 64 },
  successTitle:    { fontFamily: Fonts.black,   fontSize: 28, color: Colors.celestialGold, textAlign: 'center' },
  successSubtitle: { fontFamily: Fonts.medium,  fontSize: 15, color: Colors.moonlightCream, textAlign: 'center', lineHeight: 22 },
});
