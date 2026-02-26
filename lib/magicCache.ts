/**
 * Magic Cache
 *
 * Session-scoped AsyncStorage cache for AI-generated text.
 * Prevents redundant AI calls for narrator greetings and
 * narrator 'About Me' previews within a 4-hour window.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// 4 hours – covers a typical bedtime session
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const KEY_PREFIX   = 'magic_cache_';

interface CacheEntry {
  value:     string;
  timestamp: number;
}

/** Retrieve a cached AI response, or null if missing / expired. */
export async function getCached(key: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(KEY_PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

/** Persist an AI response to the cache. */
export async function setCached(key: string, value: string): Promise<void> {
  try {
    const entry: CacheEntry = { value, timestamp: Date.now() };
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    // non-fatal
  }
}

/**
 * Build a canonical cache key for a narrator greeting.
 * Keyed by narrator ID + child name + time-of-day bucket.
 */
export function greetingCacheKey(
  narratorId: string,
  childName:  string,
  timeOfDay:  string,
): string {
  return `greeting_${narratorId}_${childName.toLowerCase().replace(/\s+/g, '_')}_${timeOfDay}`;
}

/**
 * Build a canonical cache key for a narrator preview / About Me.
 * Keyed by narrator ID + optional child name.
 */
export function previewCacheKey(narratorId: string, childName?: string): string {
  const suffix = childName
    ? `_${childName.toLowerCase().replace(/\s+/g, '_')}`
    : '';
  return `preview_${narratorId}${suffix}`;
}
