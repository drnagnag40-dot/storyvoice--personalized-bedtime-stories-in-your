import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { useAdapty } from '@/hooks/useAdapty';
import { createParentVoice } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type VoiceType = 'mom' | 'dad';

interface VoiceCardProps {
  type: VoiceType;
  label: string;
  emoji: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
}

function VoiceCard({ type, label, emoji, description, isSelected, onPress }: VoiceCardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[styles.voiceCard, isSelected && styles.voiceCardSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {isSelected && (
          <LinearGradient
            colors={['rgba(255,215,0,0.12)', 'rgba(255,200,87,0.06)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
        )}
        <View style={[styles.cardIconCircle, type === 'mom' ? styles.momCircle : styles.dadCircle]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>{label}</Text>
          <Text style={styles.cardDescription}>{description}</Text>
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓ Selected</Text>
            </View>
          )}
        </View>
        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PaywallModal({
  visible,
  onClose,
  products,
  onPurchase,
  isPurchasing,
  error,
  onRestore,
}: {
  visible: boolean;
  onClose: () => void;
  products: ReturnType<typeof useAdapty>['products'];
  onPurchase: (product: ReturnType<typeof useAdapty>['products'][number]) => void;
  isPurchasing: boolean;
  error: string | null;
  onRestore: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.paywallContainer}>
          <LinearGradient
            colors={[Colors.deepPurple, Colors.midnightNavy]}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <StarField count={20} />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.paywallEmoji}>⭐</Text>
          <Text style={styles.paywallTitle}>Unlock Premium Voices</Text>
          <Text style={styles.paywallSubtitle}>
            Add custom voices for grandparents, aunties, uncles — anyone your child loves.
          </Text>

          <View style={styles.paywallFeatures}>
            {[
              '🎙️ Unlimited custom voices',
              '🌙 Ad-free experience',
              '📚 Unlimited story generation',
              '🎨 Premium story themes',
            ].map((feat) => (
              <View key={feat} style={styles.featureRow}>
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>

          {error && (
            <View style={styles.paywallError}>
              <Text style={styles.paywallErrorText}>{error}</Text>
            </View>
          )}

          {products.length === 0 ? (
            <ActivityIndicator color={Colors.celestialGold} style={{ marginVertical: 20 }} />
          ) : (
            products.map((product) => (
              <TouchableOpacity
                key={product.vendorProductId}
                style={[styles.purchaseButton, isPurchasing && styles.buttonDisabled]}
                onPress={() => onPurchase(product)}
                disabled={isPurchasing}
              >
                <LinearGradient
                  colors={[Colors.celestialGold, '#E8A800']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.purchaseGradient}
                >
                  {isPurchasing ? (
                    <ActivityIndicator color={Colors.deepSpace} />
                  ) : (
                    <>
                      <Text style={styles.purchaseButtonText}>{product.localizedTitle}</Text>
                      <Text style={styles.purchasePriceText}>
                        {product.price?.localizedString}
                        {product.subscription?.subscriptionPeriod
                          ? ` / ${product.subscription.subscriptionPeriod.unit}`
                          : ''}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.restoreLink} onPress={onRestore}>
            <Text style={styles.restoreLinkText}>Restore purchases</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function VoiceSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPremium, products, openPaywall, closePaywall, paywallVisible, makePurchase, restorePurchases, purchaseError } = useAdapty();

  const [selectedVoice, setSelectedVoice] = useState<VoiceType | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  const handleContinue = async () => {
    if (!selectedVoice) {
      Alert.alert('Choose a Voice', 'Please select Mom\'s or Dad\'s voice to continue.');
      return;
    }

    setIsContinuing(true);
    try {
      const childId = await AsyncStorage.getItem('active_child_id');
      if (user?.id) {
        const { voice } = await createParentVoice({
          user_id: user.id,
          child_id: childId,
          voice_type: selectedVoice,
          voice_name: selectedVoice === 'mom' ? "Mom's Voice" : "Dad's Voice",
          recording_url: null,
          duration_seconds: null,
          script_paragraphs_recorded: 0,
          is_complete: false,
        });
        if (voice) {
          await AsyncStorage.setItem('active_voice_id', voice.id);
        }
      }
      await AsyncStorage.setItem('selected_voice_type', selectedVoice);
      router.push('/(onboarding)/voice-studio');
    } catch {
      await AsyncStorage.setItem('selected_voice_type', selectedVoice);
      router.push('/(onboarding)/voice-studio');
    } finally {
      setIsContinuing(false);
    }
  };

  const handleAddCustom = async () => {
    if (isPremium) {
      Alert.alert('Custom Voice', 'Custom voice feature coming soon!');
      return;
    }
    await openPaywall();
  };

  const handlePurchase = async (product: (typeof products)[number]) => {
    setIsPurchasing(true);
    await makePurchase(product);
    setIsPurchasing(false);
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      Alert.alert('Restored!', 'Your premium subscription has been restored.');
      closePaywall();
    } else {
      Alert.alert('No Purchase Found', 'No active subscription was found to restore.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#251B5A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={45} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 2 of 3</Text>
          </View>
          <Text style={styles.title}>Choose whose{'\n'}voice reads the story 🎙️</Text>
          <Text style={styles.subtitle}>
            Your child will hear their favourite bedtime story read in a voice they know and love.
          </Text>
        </View>

        {/* Voice Cards */}
        <View style={styles.cardsContainer}>
          <VoiceCard
            type="mom"
            label="Mom's Voice"
            emoji="👩"
            description="Warm, comforting stories read by Mum. The voice that makes everything feel safe."
            isSelected={selectedVoice === 'mom'}
            onPress={() => setSelectedVoice('mom')}
          />
          <VoiceCard
            type="dad"
            label="Dad's Voice"
            emoji="👨"
            description="Adventure-filled tales told by Dad. The voice that brings stories to life."
            isSelected={selectedVoice === 'dad'}
            onPress={() => setSelectedVoice('dad')}
          />

          {/* Add Custom Voice (Premium gated) */}
          <TouchableOpacity
            style={styles.addCustomCard}
            onPress={handleAddCustom}
            activeOpacity={0.75}
          >
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>{isPremium ? '✨ Premium' : '🔒 Premium'}</Text>
            </View>
            <View style={styles.addCustomCircle}>
              <Text style={styles.addCustomIcon}>+</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.addCustomLabel}>Add Custom Voice</Text>
              <Text style={styles.addCustomDescription}>
                Grandma, Grandpa, or any loved one — add as many voices as you like.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoEmoji}>💡</Text>
          <Text style={styles.infoText}>
            {"You'll record 5 short paragraphs. The whole process takes about 3 minutes."}
          </Text>
        </View>

        {/* Continue CTA */}
        <TouchableOpacity
          style={[styles.continueButton, (!selectedVoice || isContinuing) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedVoice || isContinuing}
        >
          <LinearGradient
            colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.continueButtonText}>
              {isContinuing ? 'Setting up…' : 'Record My Voice →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Adapty Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={closePaywall}
        products={products}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        error={purchaseError}
        onRestore={handleRestore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  content: { paddingHorizontal: Spacing.lg },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  header: { marginBottom: Spacing.xl },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.softPurple,
    marginBottom: 16,
  },
  stepText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold, letterSpacing: 0.5 },
  title: { fontFamily: Fonts.extraBold, fontSize: 28, color: Colors.moonlightCream, lineHeight: 36, marginBottom: 10 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  cardsContainer: { gap: Spacing.md, marginBottom: Spacing.lg },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.borderColor,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  voiceCardSelected: { borderColor: Colors.celestialGold },
  cardIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  momCircle: { backgroundColor: 'rgba(255,107,157,0.2)', borderWidth: 2, borderColor: 'rgba(255,107,157,0.4)' },
  dadCircle: { backgroundColor: 'rgba(126,200,227,0.2)', borderWidth: 2, borderColor: 'rgba(126,200,227,0.4)' },
  cardEmoji: { fontSize: 34 },
  cardContent: { flex: 1 },
  cardLabel: { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.textLight, marginBottom: 4 },
  cardLabelSelected: { color: Colors.celestialGold },
  cardDescription: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  selectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
  },
  selectedBadgeText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.celestialGold },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioCircleSelected: { borderColor: Colors.celestialGold },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.celestialGold },
  addCustomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.borderColor,
    borderStyle: 'dashed',
    gap: Spacing.md,
    position: 'relative',
    opacity: 0.8,
  },
  lockBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(107,72,184,0.4)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.softPurple,
  },
  lockBadgeText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.celestialGold },
  addCustomCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,72,184,0.2)',
    borderWidth: 2,
    borderColor: Colors.softPurple,
    borderStyle: 'dashed',
    flexShrink: 0,
  },
  addCustomIcon: { fontSize: 32, color: Colors.softPurple },
  addCustomLabel: { fontFamily: Fonts.extraBold, fontSize: 17, color: Colors.textMuted, marginBottom: 4 },
  addCustomDescription: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107,72,184,0.2)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 12,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.softPurple,
  },
  infoEmoji: { fontSize: 20 },
  infoText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textLight, flex: 1, lineHeight: 18 },
  continueButton: { borderRadius: 18, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.5 },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  continueButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
  // Paywall modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  paywallContainer: {
    backgroundColor: Colors.midnightNavy,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 48,
    overflow: 'hidden',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textLight },
  paywallEmoji: { fontSize: 48, marginBottom: 12 },
  paywallTitle: { fontFamily: Fonts.extraBold, fontSize: 24, color: Colors.moonlightCream, marginBottom: 8, textAlign: 'center' },
  paywallSubtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  paywallFeatures: { width: '100%', gap: 8, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textLight },
  paywallError: { backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.errorRed, width: '100%' },
  paywallErrorText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.errorRed, textAlign: 'center' },
  purchaseButton: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  purchaseGradient: { paddingVertical: 16, alignItems: 'center', gap: 4 },
  purchaseButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
  purchasePriceText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.deepSpace, opacity: 0.7 },
  restoreLink: { paddingVertical: 12 },
  restoreLinkText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted },
});
