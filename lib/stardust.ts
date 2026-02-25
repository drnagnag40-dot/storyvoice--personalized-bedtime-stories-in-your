/**
 * Stardust Currency System
 *
 * Stardust is earned by children for completing stories and answering
 * reflection questions. It can be spent in the Stardust Shop.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ──────────────────────────────────────────────────────────
// Keys
// ──────────────────────────────────────────────────────────
const BALANCE_KEY   = 'stardust_balance';
const HISTORY_KEY   = 'stardust_history';
const UNLOCKED_KEY  = 'stardust_unlocked_items';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
export interface StardustTransaction {
  id:      string;
  amount:  number;
  reason:  string;
  date:    string;
  emoji:   string;
}

export interface ShopItem {
  id:          string;
  name:        string;
  emoji:       string;
  description: string;
  cost:        number;
  category:    'particle' | 'badge';
  color?:      string;
}

// ──────────────────────────────────────────────────────────
// Shop Catalogue
// ──────────────────────────────────────────────────────────
export const SHOP_ITEMS: ShopItem[] = [
  // Particle colors
  {
    id:          'particle_moonbeam',
    name:        'Moonbeam Dust',
    emoji:       '🌕',
    description: 'Soft silver-blue particles',
    cost:        50,
    category:    'particle',
    color:       '#A8D8FF',
  },
  {
    id:          'particle_sunset',
    name:        'Sunset Sparks',
    emoji:       '🌅',
    description: 'Warm orange & rose particles',
    cost:        50,
    category:    'particle',
    color:       '#FF8C42',
  },
  {
    id:          'particle_emerald',
    name:        'Emerald Whispers',
    emoji:       '🌿',
    description: 'Forest-green glowing dust',
    cost:        75,
    category:    'particle',
    color:       '#34D399',
  },
  {
    id:          'particle_rainbow',
    name:        'Rainbow Whirl',
    emoji:       '🌈',
    description: 'Every colour of the spectrum',
    cost:        100,
    category:    'particle',
    color:       '#FF69B4',
  },
  {
    id:          'particle_dragon',
    name:        'Dragon Fire',
    emoji:       '🔥',
    description: 'Fierce crimson ember sparks',
    cost:        120,
    category:    'particle',
    color:       '#EF4444',
  },
  // Badges
  {
    id:          'badge_star',
    name:        'Star Explorer',
    emoji:       '⭐',
    description: 'For curious young adventurers',
    cost:        75,
    category:    'badge',
  },
  {
    id:          'badge_moon',
    name:        'Moon Dreamer',
    emoji:       '🌙',
    description: 'For those who love the night sky',
    cost:        75,
    category:    'badge',
  },
  {
    id:          'badge_dragon',
    name:        'Dragon Tamer',
    emoji:       '🐉',
    description: 'For the bravest of storytellers',
    cost:        150,
    category:    'badge',
  },
  {
    id:          'badge_rainbow',
    name:        'Rainbow Guardian',
    emoji:       '🌈',
    description: 'For collectors of every colour',
    cost:        150,
    category:    'badge',
  },
  {
    id:          'badge_fairy',
    name:        'Forest Fairy',
    emoji:       '🧚',
    description: 'For those who hear the trees whisper',
    cost:        100,
    category:    'badge',
  },
];

// ──────────────────────────────────────────────────────────
// Balance Management
// ──────────────────────────────────────────────────────────
export async function getStardustBalance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BALANCE_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addStardust(amount: number, reason: string, emoji = '⭐'): Promise<number> {
  try {
    const current = await getStardustBalance();
    const newBalance = current + amount;
    await AsyncStorage.setItem(BALANCE_KEY, String(newBalance));

    // Record transaction
    const transaction: StardustTransaction = {
      id:     `txn_${Date.now()}`,
      amount,
      reason,
      date:   new Date().toISOString(),
      emoji,
    };
    const historyRaw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: StardustTransaction[] = historyRaw ? JSON.parse(historyRaw) : [];
    const updated = [transaction, ...history].slice(0, 50); // keep last 50
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

    return newBalance;
  } catch {
    return 0;
  }
}

export async function spendStardust(amount: number, reason: string): Promise<{ success: boolean; newBalance: number }> {
  try {
    const current = await getStardustBalance();
    if (current < amount) {
      return { success: false, newBalance: current };
    }
    const newBalance = current - amount;
    await AsyncStorage.setItem(BALANCE_KEY, String(newBalance));

    const transaction: StardustTransaction = {
      id:     `txn_${Date.now()}`,
      amount: -amount,
      reason,
      date:   new Date().toISOString(),
      emoji:  '🛍️',
    };
    const historyRaw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: StardustTransaction[] = historyRaw ? JSON.parse(historyRaw) : [];
    const updated = [transaction, ...history].slice(0, 50);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

    return { success: true, newBalance };
  } catch {
    return { success: false, newBalance: 0 };
  }
}

export async function getStardustHistory(): Promise<StardustTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────
// Unlocked Items
// ──────────────────────────────────────────────────────────
export async function getUnlockedItems(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function unlockItem(itemId: string): Promise<void> {
  try {
    const current = await getUnlockedItems();
    if (!current.includes(itemId)) {
      await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify([...current, itemId]));
    }
  } catch {
    // non-fatal
  }
}

export async function isItemUnlocked(itemId: string): Promise<boolean> {
  const unlocked = await getUnlockedItems();
  return unlocked.includes(itemId);
}

// ──────────────────────────────────────────────────────────
// Story Completion Tracking (for Rate Us)
// ──────────────────────────────────────────────────────────
export async function incrementStoriesCompleted(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem('completed_stories_count');
    const current = raw ? parseInt(raw, 10) : 0;
    const updated = current + 1;
    await AsyncStorage.setItem('completed_stories_count', String(updated));
    return updated;
  } catch {
    return 0;
  }
}

export async function getStoriesCompleted(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem('completed_stories_count');
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}
