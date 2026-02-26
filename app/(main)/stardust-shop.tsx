import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
  Platform,
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
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import StarfallAnimation from '@/components/StarfallAnimation';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import {
  getStardustBalance,
  getUnlockedItems,
  spendStardust,
  unlockItem,
  getStardustHistory,
  SHOP_ITEMS,
  type ShopItem,
  type StardustTransaction,
} from '@/lib/stardust';
import { useAdapty } from '@/hooks/useAdapty';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - Spacing.lg * 2 - 12) / 2;

// ─── Free tier features ────────────────────────────────────────────────────────
const FREE_FEATURES = [
  { emoji: '📖', label: '3 stories per week' },
  { emoji: '🎙️', label: 'Standard narrators' },
  { emoji: '☁️', label: 'Basic cloud sync' },
];

// ─── Pro tier features ─────────────────────────────────────────────────────────
const PRO_FEATURES = [
  { emoji: '🪄', label: 'Unlimited story generation' },
  { emoji: '🐋', label: 'Exclusive narrators (Seraphina the Star-Whale)' },
  { emoji: '🎭', label: 'All 5 AI narrator personalities' },
  { emoji: '🎨', label: 'High-definition story art' },
  { emoji: '🎵', label: 'Atmospheric soundscapes' },
  { emoji: '📚', label: 'Unlimited Voice Studio storage' },
];

// ─── Shimmer animation ─────────────────────────────────────────────────────────
function ShimmerOverlay() {
  const shimmerX = useSharedValue(-W);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(W * 2, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(-W, { duration: 0 })
      ),
      -1,
      false
    );
    return () => cancelAnimation(shimmerX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <Animated.View style={[shimmerStyles.shimmer, shimmerStyle]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const shimmerStyles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: W,
  },
});

// ─── Star-Seeker Free Card ─────────────────────────────────────────────────────
function FreeCard({ isCurrentPlan }: { isCurrentPlan: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    opacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 160 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[planStyles.cardContainer, cardStyle]}>
      <View style={planStyles.freeCard}>
        {Platform.OS !== 'web' && (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.03)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />
        {/* Glass top shine */}
        <View style={planStyles.cardShine} />

        {/* Badge area */}
        <View style={planStyles.cardHeader}>
          <Text style={planStyles.freeEmoji}>🌙</Text>
          <View>
            <Text style={planStyles.freePlanName}>Star-Seeker</Text>
            <Text style={planStyles.freeTagline}>Your journey begins here.</Text>
          </View>
        </View>

        {/* Price */}
        <View style={planStyles.priceRow}>
          <Text style={planStyles.freePrice}>Free</Text>
          <Text style={planStyles.freePriceSub}>always</Text>
        </View>

        <View style={planStyles.divider} />

        {/* Features */}
        <View style={planStyles.featuresList}>
          {FREE_FEATURES.map((f) => (
            <View key={f.label} style={planStyles.featureRow}>
              <Text style={planStyles.featureEmoji}>{f.emoji}</Text>
              <Text style={planStyles.freeFeatureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Current plan indicator */}
        {isCurrentPlan && (
          <View style={planStyles.currentPlanBadge}>
            <Text style={planStyles.currentPlanText}>✓ Current Plan</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Galaxy-Traveler Pro Card ──────────────────────────────────────────────────
function ProCard({
  isCurrentPlan,
  onUpgrade,
  isLoading,
  productPrice,
}: {
  isCurrentPlan: boolean;
  onUpgrade: () => void;
  isLoading: boolean;
  productPrice: string;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const borderGlow = useSharedValue(0.4);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(380, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(380, withSpring(0, { damping: 14, stiffness: 160 }));

    // Pulsing gold border
    borderGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    // Pulsing upgrade button
    btnScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(borderGlow);
      cancelAnimation(btnScale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,215,0,${borderGlow.value})`,
    shadowOpacity: interpolate(borderGlow.value, [0.35, 1], [0.3, 0.9], Extrapolation.CLAMP),
    shadowRadius: interpolate(borderGlow.value, [0.35, 1], [8, 28], Extrapolation.CLAMP),
  }));

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  return (
    <Animated.View style={[planStyles.cardContainer, cardStyle]}>
      {/* Value badge */}
      <View style={planStyles.valueBadge}>
        <LinearGradient
          colors={['#FFD700', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
        />
        <Text style={planStyles.valueBadgeText}>✦ Most Magical</Text>
      </View>

      <Animated.View style={[planStyles.proCard, borderStyle]}>
        {Platform.OS !== 'web' && (
          <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(255,215,0,0.10)', 'rgba(107,72,184,0.18)', 'rgba(255,215,0,0.04)']}
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
        />

        {/* Shimmer sweep */}
        <ShimmerOverlay />

        {/* Glass top shine */}
        <View style={[planStyles.cardShine, { backgroundColor: 'rgba(255,215,0,0.15)' }]} />

        {/* Card header */}
        <View style={planStyles.cardHeader}>
          <Text style={planStyles.proEmoji}>🌌</Text>
          <View>
            <Text style={planStyles.proPlanName}>Galaxy-Traveler</Text>
            <Text style={planStyles.proTagline}>Unlock the entire universe.</Text>
          </View>
        </View>

        {/* Price */}
        <View style={planStyles.priceRow}>
          <Text style={planStyles.proPrice}>{productPrice}</Text>
          <Text style={planStyles.proPriceSub}>/month</Text>
        </View>

        <View style={[planStyles.divider, { borderColor: 'rgba(255,215,0,0.25)' }]} />

        {/* Features */}
        <View style={planStyles.featuresList}>
          {PRO_FEATURES.map((f) => (
            <View key={f.label} style={planStyles.featureRow}>
              <Text style={planStyles.featureEmoji}>{f.emoji}</Text>
              <Text style={planStyles.proFeatureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Upgrade / Current Plan button */}
        {isCurrentPlan ? (
          <View style={planStyles.currentProBadge}>
            <Text style={planStyles.currentProText}>✦ Galaxy-Traveler Active</Text>
          </View>
        ) : (
          <Animated.View style={[planStyles.upgradeBtnWrapper, btnStyle]}>
            <TouchableOpacity
              style={planStyles.upgradeBtn}
              onPress={onUpgrade}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FFD700', '#FFC857', '#E8A800']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              {isLoading ? (
                <ActivityIndicator color={Colors.deepSpace} size="small" />
              ) : (
                <Text style={planStyles.upgradeBtnText}>✦ Unlock Galaxy-Traveler</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ─── Plan card styles ──────────────────────────────────────────────────────────
const planStyles = StyleSheet.create({
  cardContainer: {
    marginBottom: Spacing.md,
    position: 'relative',
  },
  valueBadge: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  valueBadgeText: {
    fontFamily: Fonts.black,
    fontSize: 11,
    color: Colors.deepSpace,
    letterSpacing: 0.5,
  },
  freeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    padding: Spacing.lg,
    backgroundColor: Platform.OS === 'web' ? 'rgba(14,8,32,0.7)' : undefined,
  },
  proCard: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    overflow: 'hidden',
    padding: Spacing.lg,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    backgroundColor: Platform.OS === 'web' ? 'rgba(14,8,32,0.7)' : undefined,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  freeEmoji: { fontSize: 32 },
  proEmoji: { fontSize: 32 },
  freePlanName: {
    fontFamily: Fonts.black,
    fontSize: 18,
    color: Colors.textLight,
    letterSpacing: 0.3,
  },
  proPlanName: {
    fontFamily: Fonts.black,
    fontSize: 18,
    color: Colors.celestialGold,
    letterSpacing: 0.3,
  },
  freeTagline: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  proTagline: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(255,215,0,0.7)',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: Spacing.md,
  },
  freePrice: {
    fontFamily: Fonts.black,
    fontSize: 28,
    color: Colors.textLight,
  },
  freePriceSub: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  proPrice: {
    fontFamily: Fonts.black,
    fontSize: 28,
    color: Colors.celestialGold,
  },
  proPriceSub: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,215,0,0.6)',
  },
  divider: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.md,
  },
  featuresList: { gap: 10, marginBottom: Spacing.lg },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureEmoji: { fontSize: 15, width: 22 },
  freeFeatureText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textLight,
    flex: 1,
    lineHeight: 20,
  },
  proFeatureText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.crystalCream,
    flex: 1,
    lineHeight: 20,
  },
  currentPlanBadge: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  currentPlanText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.textMuted,
  },
  currentProBadge: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  currentProText: {
    fontFamily: Fonts.black,
    fontSize: 14,
    color: Colors.celestialGold,
  },
  upgradeBtnWrapper: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  upgradeBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeBtnText: {
    fontFamily: Fonts.black,
    fontSize: 15,
    color: Colors.deepSpace,
    letterSpacing: 0.4,
  },
});

// ─── Animated Stardust Counter ────────────────────────────────────────────────
function StardustCounter({ balance }: { balance: number }) {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 200 }),
      withSpring(1, { damping: 8, stiffness: 300 })
    );
    glow.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 600 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle  = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={counter.container}>
      <Animated.View style={[counter.glow, glowStyle]} />
      <Animated.View style={[counter.inner, scaleStyle]}>
        <LinearGradient
          colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.06)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
        />
        <Text style={counter.star}>⭐</Text>
        <Text style={counter.amount}>{balance}</Text>
        <Text style={counter.label}>Stardust</Text>
      </Animated.View>
    </View>
  );
}

const counter = StyleSheet.create({
  container: { alignItems: 'center', position: 'relative' },
  glow: {
    position: 'absolute',
    width: 160,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.celestialGold,
    opacity: 0,
    shadowColor: Colors.celestialGold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 0.8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.4)',
    overflow: 'hidden',
  },
  star:   { fontSize: 22 },
  amount: { fontFamily: Fonts.black, fontSize: 24, color: Colors.celestialGold },
  label:  { fontFamily: Fonts.bold,  fontSize: 13, color: Colors.textMuted },
});

// ─── Shop Item Card ────────────────────────────────────────────────────────────
function ShopItemCard({
  item,
  isUnlocked,
  canAfford,
  onBuy,
  delay,
}: {
  item: ShopItem;
  isUnlocked: boolean;
  canAfford: boolean;
  onBuy: (item: ShopItem) => void;
  delay: number;
}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(24);
  const pulseAnim  = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));

    if (canAfford && !isUnlocked) {
      pulseAnim.value = withDelay(delay + 400, withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false
      ));
    }

    return () => cancelAnimation(pulseAnim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAfford, isUnlocked]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: pulseAnim.value }],
  }));

  return (
    <Animated.View style={[shopStyles.card, cardStyle]}>
      <LinearGradient
        colors={isUnlocked
          ? ['rgba(52,211,153,0.15)', 'rgba(52,211,153,0.05)']
          : canAfford
            ? ['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)']
            : ['rgba(37,38,85,0.8)', 'rgba(37,38,85,0.4)']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />

      {isUnlocked && (
        <View style={shopStyles.unlockedBadge}>
          <Text style={shopStyles.unlockedBadgeText}>✓ Owned</Text>
        </View>
      )}

      <Text style={shopStyles.cardEmoji}>{item.emoji}</Text>
      <Text style={shopStyles.cardName}>{item.name}</Text>
      <Text style={shopStyles.cardDesc} numberOfLines={2}>{item.description}</Text>

      {item.color && !isUnlocked && (
        <View style={[shopStyles.colorDot, { backgroundColor: item.color }]} />
      )}

      <TouchableOpacity
        style={[
          shopStyles.buyBtn,
          isUnlocked && shopStyles.buyBtnOwned,
          !isUnlocked && !canAfford && shopStyles.buyBtnDisabled,
        ]}
        onPress={() => !isUnlocked && onBuy(item)}
        disabled={isUnlocked || !canAfford}
        activeOpacity={0.8}
      >
        {isUnlocked ? (
          <Text style={shopStyles.buyBtnTextOwned}>✨ Unlocked</Text>
        ) : (
          <>
            <Text style={[shopStyles.buyBtnStar, !canAfford && { opacity: 0.5 }]}>⭐</Text>
            <Text style={[shopStyles.buyBtnCost, !canAfford && { opacity: 0.5 }]}>
              {item.cost}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const shopStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 6,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  unlockedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
  },
  unlockedBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: '#34D399',
  },
  cardEmoji: { fontSize: 36, marginTop: 4 },
  cardName:  { fontFamily: Fonts.extraBold, fontSize: 13, color: Colors.moonlightCream, textAlign: 'center' },
  cardDesc:  { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
    marginTop: 4,
  },
  buyBtnOwned: {
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  buyBtnDisabled: {
    borderColor: Colors.borderColor,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  buyBtnStar:      { fontSize: 14 },
  buyBtnCost:      { fontFamily: Fonts.black, fontSize: 14, color: Colors.celestialGold },
  buyBtnTextOwned: { fontFamily: Fonts.bold,  fontSize: 12, color: '#34D399' },
});

// ─── Purchase Error Modal ──────────────────────────────────────────────────────
function PurchaseErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={errorModal.overlay}>
        <View style={errorModal.card}>
          {Platform.OS !== 'web' && (
            <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(255,107,107,0.15)', 'rgba(14,8,32,0.9)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <Text style={errorModal.title}>⚠️ Purchase Failed</Text>
          <Text style={errorModal.message}>{message}</Text>
          <TouchableOpacity style={errorModal.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={errorModal.btnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const errorModal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: Math.min(W - 40, 320),
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontFamily: Fonts.black,
    fontSize: 18,
    color: Colors.errorRed,
  },
  message: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  btnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.errorRed,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function StardustShopScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const {
    isPremium,
    isLoading: adaptyLoading,
    products,
    makePurchase,
    restorePurchases,
    openPaywall,
    purchaseError,
  } = useAdapty();

  const [balance,       setBalance]       = useState(0);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([]);
  const [history,       setHistory]       = useState<StardustTransaction[]>([]);
  const [activeTab,     setActiveTab]     = useState<'plans' | 'shop' | 'history'>('plans');
  const [, setIsLoading]                  = useState(true);
  const [isPurchasing,  setIsPurchasing]  = useState(false);
  const [showStarfall,  setShowStarfall]  = useState(false);
  const [showErrorModal,setShowErrorModal]= useState(false);
  const [errorMessage,  setErrorMessage]  = useState('');

  // Entrance animations
  const headerAnim  = useSharedValue(0);
  const balanceAnim = useSharedValue(0);

  // Breathing background gradient
  const breatheAnim = useSharedValue(0);

  useEffect(() => {
    headerAnim.value  = withTiming(1, { duration: 600 });
    balanceAnim.value = withDelay(200, withTiming(1, { duration: 700 }));
    breatheAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [bal, unlocked, hist] = await Promise.all([
      getStardustBalance(),
      getUnlockedItems(),
      getStardustHistory(),
    ]);
    setBalance(bal);
    setUnlockedItems(unlocked);
    setHistory(hist);
    setIsLoading(false);
  };

  const breatheStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breatheAnim.value, [0, 1], [0, 0.6], Extrapolation.CLAMP),
  }));

  const handleUpgrade = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (products.length === 0) {
      // No products loaded yet — open the default Adapty paywall as fallback
      await openPaywall();
      return;
    }

    setIsPurchasing(true);
    try {
      const product = products[0];
      const success = await makePurchase(product);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowStarfall(true);
        // After starfall (≈2.5s) navigate back home
        setTimeout(() => {
          setShowStarfall(false);
          router.replace('/(main)/home');
        }, 2800);
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const restored = await restorePurchases();
    if (restored) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✨ Restored', 'Galaxy-Traveler subscription restored successfully!');
    } else {
      Alert.alert('No Purchase Found', 'No active subscription was found to restore.');
    }
  };

  const handleBuy = useCallback(async (item: ShopItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Unlock ${item.name}?`,
      `Spend ${item.cost} ⭐ Stardust to unlock "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Unlock for ${item.cost} ⭐`,
          onPress: async () => {
            const result = await spendStardust(item.cost, `Unlocked ${item.name}`);
            if (result.success) {
              await unlockItem(item.id);
              setBalance(result.newBalance);
              setUnlockedItems((prev) => [...prev, item.id]);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('✨ Unlocked!', `${item.emoji} ${item.name} is now yours!`);
            } else {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Not enough Stardust', `You need ${item.cost} ⭐ but only have ${balance} ⭐. Complete more stories to earn more!`);
            }
          },
        },
      ]
    );
  }, [balance]);

  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerAnim.value, transform: [{ translateY: (1 - headerAnim.value) * -20 }] }));
  const balanceStyle = useAnimatedStyle(() => ({ opacity: balanceAnim.value, transform: [{ scale: 0.8 + balanceAnim.value * 0.2 }] }));

  const particleItems = SHOP_ITEMS.filter((i) => i.category === 'particle');
  const badgeItems    = SHOP_ITEMS.filter((i) => i.category === 'badge');

  // Get product price
  const productPrice = products[0]?.price?.localizedString ?? '—';

  // Show purchase error from hook
  useEffect(() => {
    if (purchaseError) {
      setErrorMessage(purchaseError);
      setShowErrorModal(true);
    }
  }, [purchaseError]);

  return (
    <View style={styles.container}>
      {/* Crystal Night background */}
      <LinearGradient
        colors={['#0E0820', '#180D38', '#2A1155']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Breathing overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, breatheStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(61,26,110,0.5)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <StarField count={45} />

      {/* Gold glow orb */}
      <View style={styles.goldOrb} pointerEvents="none" />
      <View style={styles.purpleOrb} pointerEvents="none" />

      {/* Starfall animation layer */}
      <StarfallAnimation visible={showStarfall} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✨ Stardust Shop</Text>
          <View style={{ width: 60 }} />
        </Animated.View>

        {/* Balance */}
        <Animated.View style={[styles.balanceSection, balanceStyle]}>
          <StardustCounter balance={balance} />
          <Text style={styles.balanceHint}>Earn by completing stories & reflections</Text>
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {([
            { id: 'plans',   label: '🌌 Galaxy Plans' },
            { id: 'shop',    label: '✨ Stardust' },
            { id: 'history', label: '📜 History' },
          ] as const).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Galaxy Plans Tab ── */}
        {activeTab === 'plans' && (
          <View style={styles.plansSection}>
            {/* Section headline */}
            <View style={styles.planHeadline}>
              <Text style={styles.planTitle}>Premium Stars</Text>
              <Text style={styles.planSubtitle}>Choose your cosmic journey</Text>
            </View>

            {/* Pro card first (highlighted) */}
            <ProCard
              isCurrentPlan={isPremium}
              onUpgrade={() => void handleUpgrade()}
              isLoading={isPurchasing || adaptyLoading}
              productPrice={productPrice}
            />

            {/* Free card */}
            <FreeCard isCurrentPlan={!isPremium} />

            {/* Restore */}
            <TouchableOpacity style={styles.restoreBtn} onPress={() => void handleRestore()} activeOpacity={0.7}>
              <Text style={styles.restoreBtnText}>Restore Purchases</Text>
            </TouchableOpacity>

            {/* Fine print */}
            <Text style={styles.finePrint}>
              Subscription auto-renews monthly. Cancel anytime in your account settings.
            </Text>
          </View>
        )}

        {/* ── Stardust Shop Tab ── */}
        {activeTab === 'shop' && (
          <>
            {/* How to Earn Card */}
            <View style={styles.earnCard}>
              <LinearGradient
                colors={['rgba(255,215,0,0.08)', 'rgba(255,215,0,0.02)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <Text style={styles.earnTitle}>How to Earn ⭐ Stardust</Text>
              <View style={styles.earnRows}>
                {[
                  { emoji: '📖', label: 'Complete a story', amount: '+10' },
                  { emoji: '🌿', label: 'Answer a reflection', amount: '+5' },
                  { emoji: '🎯', label: 'Interactive adventure', amount: '+15' },
                ].map((row) => (
                  <View key={row.label} style={styles.earnRow}>
                    <Text style={styles.earnRowEmoji}>{row.emoji}</Text>
                    <Text style={styles.earnRowLabel}>{row.label}</Text>
                    <Text style={styles.earnRowAmount}>{row.amount}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Particle Colors */}
            <Text style={styles.sectionTitle}>✨ Magic Dust Colours</Text>
            <Text style={styles.sectionSubtitle}>Customise the sparkles in your stories</Text>
            <View style={styles.grid}>
              {particleItems.map((item, i) => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  isUnlocked={unlockedItems.includes(item.id)}
                  canAfford={balance >= item.cost}
                  onBuy={(it) => void handleBuy(it)}
                  delay={i * 60}
                />
              ))}
            </View>

            {/* Badges */}
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>🏅 Profile Badges</Text>
            <Text style={styles.sectionSubtitle}>Show off your adventures</Text>
            <View style={styles.grid}>
              {badgeItems.map((item, i) => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  isUnlocked={unlockedItems.includes(item.id)}
                  canAfford={balance >= item.cost}
                  onBuy={(it) => void handleBuy(it)}
                  delay={i * 60}
                />
              ))}
            </View>
          </>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <View style={styles.historySection}>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryEmoji}>⭐</Text>
                <Text style={styles.emptyHistoryText}>
                  No Stardust earned yet.{'\n'}Complete a story to start!
                </Text>
              </View>
            ) : (
              history.map((txn, i) => (
                <View
                  key={txn.id}
                  style={[styles.historyRow, i === 0 && { borderTopWidth: 0 }]}
                >
                  <Text style={styles.historyEmoji}>{txn.emoji}</Text>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyReason}>{txn.reason}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[
                    styles.historyAmount,
                    { color: txn.amount > 0 ? Colors.successGreen : Colors.errorRed },
                  ]}>
                    {txn.amount > 0 ? `+${txn.amount}` : txn.amount} ⭐
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Purchase Error Modal */}
      {showErrorModal && (
        <PurchaseErrorModal
          message={errorMessage}
          onClose={() => setShowErrorModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepIndigo },
  scroll: { paddingHorizontal: Spacing.lg },

  goldOrb: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.celestialGold,
    opacity: 0.04,
  },
  purpleOrb: {
    position: 'absolute',
    bottom: 100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.crystalPurple,
    opacity: 0.06,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backBtn:  { paddingVertical: 8, minWidth: 60 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerTitle: {
    fontFamily: Fonts.black,
    fontSize: 20,
    color: Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  balanceSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: 8,
  },
  balanceHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14,8,32,0.6)',
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive:     { backgroundColor: 'rgba(255,215,0,0.15)' },
  tabText:       { fontFamily: Fonts.bold,  fontSize: 11, color: Colors.textMuted },
  tabTextActive: { fontFamily: Fonts.black, fontSize: 11, color: Colors.celestialGold },

  // Plans tab
  plansSection: { gap: 0, paddingTop: Spacing.md },
  planHeadline: { alignItems: 'center', marginBottom: Spacing.xl + 8 },
  planTitle: {
    fontFamily: Fonts.black,
    fontSize: 26,
    color: Colors.celestialGold,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255,215,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  planSubtitle: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  restoreBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  finePrint: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: 'rgba(153,153,187,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },

  // Stardust shop tab
  earnCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  earnTitle:     { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream },
  earnRows:      { gap: 8 },
  earnRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  earnRowEmoji:  { fontSize: 18, width: 28 },
  earnRowLabel:  { fontFamily: Fonts.medium, fontSize: 13, color: Colors.moonlightCream, flex: 1 },
  earnRowAmount: { fontFamily: Fonts.black,  fontSize: 14, color: Colors.celestialGold },

  sectionTitle:    { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.moonlightCream, marginBottom: 4 },
  sectionSubtitle: { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.md },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.md,
  },

  // History tab
  historySection: { gap: 0 },
  emptyHistory:   { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyHistoryEmoji: { fontSize: 48 },
  emptyHistoryText:  { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  historyEmoji:  { fontSize: 22, width: 32 },
  historyInfo:   { flex: 1 },
  historyReason: { fontFamily: Fonts.bold,    fontSize: 14, color: Colors.moonlightCream },
  historyDate:   { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historyAmount: { fontFamily: Fonts.black,   fontSize: 15 },
});
