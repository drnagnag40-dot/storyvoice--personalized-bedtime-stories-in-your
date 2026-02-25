import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
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
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
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

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - Spacing.lg * 2 - 12) / 2;

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
    position:     'absolute',
    width:        160,
    height:       60,
    borderRadius: 30,
    backgroundColor: Colors.celestialGold,
    opacity:         0,
    shadowColor:     Colors.celestialGold,
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    20,
    shadowOpacity:   0.8,
  },
  inner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    paddingVertical:  12,
    paddingHorizontal: 24,
    borderRadius:     Radius.full,
    borderWidth:      1.5,
    borderColor:      'rgba(255,215,0,0.4)',
    overflow:         'hidden',
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
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);
  const pulseAnim = useSharedValue(1);

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
    width:           CARD_WIDTH,
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    alignItems:      'center',
    gap:             6,
    minHeight:       180,
    justifyContent:  'space-between',
  },
  unlockedBadge: {
    position:          'absolute',
    top:               8,
    right:             8,
    backgroundColor:   'rgba(52,211,153,0.2)',
    borderRadius:      Radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       'rgba(52,211,153,0.4)',
  },
  unlockedBadgeText: {
    fontFamily: Fonts.bold,
    fontSize:   10,
    color:      '#34D399',
  },
  cardEmoji: { fontSize: 36, marginTop: 4 },
  cardName:  { fontFamily: Fonts.extraBold, fontSize: 13, color: Colors.moonlightCream, textAlign: 'center' },
  cardDesc:  { fontFamily: Fonts.regular,   fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
  colorDot: {
    width:        16,
    height:       16,
    borderRadius: 8,
    borderWidth:  2,
    borderColor:  'rgba(255,255,255,0.3)',
  },
  buyBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingVertical:  8,
    paddingHorizontal: 16,
    borderRadius:     Radius.full,
    borderWidth:      1,
    borderColor:      'rgba(255,215,0,0.4)',
    backgroundColor:  'rgba(255,215,0,0.1)',
    marginTop:        4,
  },
  buyBtnOwned: {
    borderColor:     'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  buyBtnDisabled: {
    borderColor:     Colors.borderColor,
    backgroundColor: 'transparent',
    opacity:         0.5,
  },
  buyBtnStar:      { fontSize: 14 },
  buyBtnCost:      { fontFamily: Fonts.black, fontSize: 14, color: Colors.celestialGold },
  buyBtnTextOwned: { fontFamily: Fonts.bold,  fontSize: 12, color: '#34D399' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function StardustShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [balance,       setBalance]       = useState(0);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([]);
  const [history,       setHistory]       = useState<StardustTransaction[]>([]);
  const [activeTab,     setActiveTab]     = useState<'shop' | 'history'>('shop');
  const [isLoading,     setIsLoading]     = useState(true);

  // Entrance animations
  const headerAnim = useSharedValue(0);
  const balanceAnim = useSharedValue(0);

  useEffect(() => {
    headerAnim.value = withTiming(1, { duration: 600 });
    balanceAnim.value = withDelay(200, withTiming(1, { duration: 700 }));
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0E24', '#1A1B41', '#2B1A5C']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={40} />

      {/* Gold glow orb */}
      <View style={styles.goldOrb} pointerEvents="none" />

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
          <Text style={styles.balanceHint}>
            Earn by completing stories & reflections
          </Text>
        </Animated.View>

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

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['shop', 'history'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'shop' ? '🏪 Shop' : '📜 History'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'shop' && (
          <>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  scroll:    { paddingHorizontal: Spacing.lg },
  goldOrb:   {
    position:        'absolute',
    top:             -80,
    right:           -80,
    width:           240,
    height:          240,
    borderRadius:    120,
    backgroundColor: Colors.celestialGold,
    opacity:         0.04,
  },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.xl,
  },
  backBtn:  { paddingVertical: 8, minWidth: 60 },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textMuted },
  headerTitle: {
    fontFamily: Fonts.black,
    fontSize:   20,
    color:      Colors.moonlightCream,
    letterSpacing: 0.3,
  },

  balanceSection: {
    alignItems:    'center',
    marginBottom:  Spacing.xl,
    gap:           8,
  },
  balanceHint: {
    fontFamily: Fonts.regular,
    fontSize:   12,
    color:      Colors.textMuted,
    textAlign:  'center',
  },

  earnCard: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.lg,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.2)',
    overflow:        'hidden',
    gap:             Spacing.sm,
  },
  earnTitle: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.moonlightCream },
  earnRows:  { gap: 8 },
  earnRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  earnRowEmoji:  { fontSize: 18, width: 28 },
  earnRowLabel:  { fontFamily: Fonts.medium, fontSize: 13, color: Colors.moonlightCream, flex: 1 },
  earnRowAmount: { fontFamily: Fonts.black,  fontSize: 14, color: Colors.celestialGold },

  tabs: {
    flexDirection:   'row',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    padding:         4,
    marginBottom:    Spacing.xl,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  tab: {
    flex:           1,
    paddingVertical: 10,
    alignItems:     'center',
    borderRadius:   Radius.md,
  },
  tabActive:      { backgroundColor: 'rgba(255,215,0,0.15)' },
  tabText:        { fontFamily: Fonts.bold,  fontSize: 13, color: Colors.textMuted },
  tabTextActive:  { fontFamily: Fonts.black, fontSize: 13, color: Colors.celestialGold },

  sectionTitle:   { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.moonlightCream, marginBottom: 4 },
  sectionSubtitle: { fontFamily: Fonts.regular,  fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.md },

  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
    marginBottom:  Spacing.md,
  },

  historySection: { gap: 0 },
  emptyHistory:   { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyHistoryEmoji: { fontSize: 48 },
  emptyHistoryText:  { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  historyRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
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
