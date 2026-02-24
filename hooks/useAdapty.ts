import { useState, useEffect, useCallback } from 'react';
import { adapty } from 'react-native-adapty';
import type { AdaptyProfile, AdaptyPaywall, AdaptyPaywallProduct } from 'react-native-adapty';

const ADAPTY_API_KEY = process.env.EXPO_PUBLIC_ADAPTY_API_KEY ?? '';
const PLACEMENT_ID = process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT_ID ?? 'storyvoice_premium';

let adaptyActivated = false;

async function ensureAdaptyActivated() {
  if (adaptyActivated) return;
  try {
    await adapty.activate(ADAPTY_API_KEY, {
      __ignoreActivationOnFastRefresh: __DEV__,
    });
    adaptyActivated = true;
  } catch (e) {
    // Already activated or mock mode
    adaptyActivated = true;
  }
}

export interface UseAdaptyReturn {
  isPremium: boolean;
  isLoading: boolean;
  profile: AdaptyProfile | null;
  paywall: AdaptyPaywall | null;
  products: AdaptyPaywallProduct[];
  makePurchase: (product: AdaptyPaywallProduct) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  openPaywall: () => Promise<void>;
  closePaywall: () => void;
  paywallVisible: boolean;
  purchaseError: string | null;
}

export function useAdapty(): UseAdaptyReturn {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<AdaptyProfile | null>(null);
  const [paywall, setPaywall] = useState<AdaptyPaywall | null>(null);
  const [products, setProducts] = useState<AdaptyPaywallProduct[]>([]);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      await ensureAdaptyActivated();
      const p = await adapty.getProfile();
      setProfile(p);
      setIsPremium(p?.accessLevels?.['premium']?.isActive ?? false);
    } catch {
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  };

  const openPaywall = useCallback(async () => {
    try {
      await ensureAdaptyActivated();
      const pw = await adapty.getPaywall(PLACEMENT_ID);
      const prods = await adapty.getPaywallProducts(pw);
      setPaywall(pw);
      setProducts(prods);
      setPaywallVisible(true);
    } catch {
      setPaywallVisible(true);
    }
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPurchaseError(null);
  }, []);

  const makePurchase = useCallback(async (product: AdaptyPaywallProduct): Promise<boolean> => {
    try {
      setPurchaseError(null);
      const result = await adapty.makePurchase(product);
      if (result.type === 'success') {
        setProfile(result.profile);
        setIsPremium(result.profile?.accessLevels?.['premium']?.isActive ?? false);
        setPaywallVisible(false);
        return true;
      }
      if (result.type === 'pending') {
        setPurchaseError('Purchase is pending approval.');
      }
      return false;
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Purchase failed. Please try again.');
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const restored = await adapty.restorePurchases();
      const active = restored?.accessLevels?.['premium']?.isActive ?? false;
      setIsPremium(active);
      if (restored) setProfile(restored);
      return active;
    } catch {
      return false;
    }
  }, []);

  return {
    isPremium,
    isLoading,
    profile,
    paywall,
    products,
    makePurchase,
    restorePurchases,
    openPaywall,
    closePaywall,
    paywallVisible,
    purchaseError,
  };
}
