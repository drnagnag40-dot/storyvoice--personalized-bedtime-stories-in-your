/**
 * Hybrid Sync Service
 *
 * Fetches data from Supabase when authenticated and caches it in AsyncStorage.
 * When offline or Supabase unavailable, serves from the local AsyncStorage cache.
 *
 * Tables synced:
 *   child_profiles, voice_profiles, stories, user_preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getChildren,
  getParentVoices,
  getStories,
  getUserPreferences,
  upsertUserPreferences,
  isSupabaseAvailable,
} from './supabase';
import type { Child, ParentVoice, Story, UserPreferences } from './supabase';

// ─── AsyncStorage Keys ────────────────────────────────────────────────────────
const KEYS = {
  LAST_SYNC_AT:    'sync_last_sync_at',
  SYNC_STATUS:     'sync_status',        // 'success' | 'error' | 'never'
  LOCAL_CHILDREN:  'sync_child_profiles',
  LOCAL_VOICES:    'sync_voice_profiles',
  LOCAL_STORIES:   'local_stories',
  LOCAL_PREFS:     'sync_user_preferences',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export type SyncStatus = 'success' | 'error' | 'never' | 'syncing';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;    // ISO string
  lastSyncLabel: string;        // Human-readable: "Just now", "5 min ago", etc.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10)  return 'Just now';
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// ─── Read sync state from AsyncStorage ────────────────────────────────────────
export async function getSyncState(): Promise<SyncState> {
  try {
    const [lastSyncAt, status] = await Promise.all([
      AsyncStorage.getItem(KEYS.LAST_SYNC_AT),
      AsyncStorage.getItem(KEYS.SYNC_STATUS),
    ]);

    const resolvedStatus: SyncStatus = (status as SyncStatus | null) ?? 'never';

    return {
      status:       resolvedStatus,
      lastSyncAt,
      lastSyncLabel: lastSyncAt
        ? formatRelativeTime(lastSyncAt)
        : 'Never synced',
    };
  } catch {
    return { status: 'never', lastSyncAt: null, lastSyncLabel: 'Never synced' };
  }
}

// ─── Mark a successful sync ───────────────────────────────────────────────────
async function markSynced(): Promise<void> {
  const now = new Date().toISOString();
  await AsyncStorage.multiSet([
    [KEYS.LAST_SYNC_AT, now],
    [KEYS.SYNC_STATUS,  'success'],
  ]);
}

// ─── Mark a failed sync ───────────────────────────────────────────────────────
async function markSyncFailed(): Promise<void> {
  await AsyncStorage.setItem(KEYS.SYNC_STATUS, 'error');
}

// ─── Main sync function ───────────────────────────────────────────────────────
/**
 * Pull fresh data from Supabase and refresh the local AsyncStorage caches.
 * If Supabase is unavailable, returns cached data silently.
 *
 * @returns true if cloud sync succeeded, false if it used local cache
 */
export async function syncFromCloud(userId: string): Promise<boolean> {
  if (!isSupabaseAvailable || !userId) {
    return false;
  }

  let allOk = true;

  try {
    // ── 1. Child profiles ────────────────────────────────────────────────────
    const { children, error: childErr } = await getChildren(userId);
    if (!childErr && children) {
      await AsyncStorage.setItem(KEYS.LOCAL_CHILDREN, JSON.stringify(children));
      // Also keep the legacy pending_child_profile key in sync with first child
      if (children.length > 0) {
        await AsyncStorage.setItem('pending_child_profile', JSON.stringify(children[0]));
        await AsyncStorage.setItem('active_child_id', children[0].id);
      }
    } else if (childErr) {
      allOk = false;
    }

    // ── 2. Voice profiles ────────────────────────────────────────────────────
    const { voices, error: voiceErr } = await getParentVoices(userId);
    if (!voiceErr && voices) {
      await AsyncStorage.setItem(KEYS.LOCAL_VOICES, JSON.stringify(voices));
    } else if (voiceErr) {
      allOk = false;
    }

    // ── 3. Stories ───────────────────────────────────────────────────────────
    const { stories, error: storyErr } = await getStories(userId);
    if (!storyErr && stories) {
      // Store up to 50 most recent stories
      const toCache = stories.slice(0, 50);
      await AsyncStorage.setItem(KEYS.LOCAL_STORIES, JSON.stringify(toCache));
    } else if (storyErr) {
      allOk = false;
    }

    // ── 4. User preferences ──────────────────────────────────────────────────
    const { preferences, error: prefsErr } = await getUserPreferences(userId);
    if (!prefsErr && preferences) {
      await AsyncStorage.setItem(KEYS.LOCAL_PREFS, JSON.stringify(preferences));
      // Keep individual preference keys in sync
      if (preferences.active_voice_id) {
        await AsyncStorage.setItem('active_voice_id', preferences.active_voice_id);
      }
      if (preferences.active_child_id) {
        await AsyncStorage.setItem('active_child_id', preferences.active_child_id);
      }
      if (preferences.narrator_type) {
        await AsyncStorage.setItem('selected_voice_type', preferences.narrator_type);
      }
    } else if (prefsErr) {
      allOk = false;
    }

    if (allOk) {
      await markSynced();
      // Update last_sync_at in cloud preferences too
      await upsertUserPreferences(userId, {
        last_sync_at: new Date().toISOString(),
      });
    } else {
      await markSyncFailed();
    }

    return allOk;
  } catch (err) {
    console.error('[SyncService] syncFromCloud error:', err);
    await markSyncFailed();
    return false;
  }
}

// ─── Get cached child profiles ────────────────────────────────────────────────
export async function getCachedChildren(): Promise<Child[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOCAL_CHILDREN);
    if (raw) return JSON.parse(raw) as Child[];

    // Fall back to legacy key
    const legacy = await AsyncStorage.getItem('pending_child_profile');
    if (legacy) {
      const child = JSON.parse(legacy) as Child;
      return [child];
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Get cached voice profiles ────────────────────────────────────────────────
export async function getCachedVoices(): Promise<ParentVoice[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOCAL_VOICES);
    if (raw) return JSON.parse(raw) as ParentVoice[];
    return [];
  } catch {
    return [];
  }
}

// ─── Get cached stories ───────────────────────────────────────────────────────
export async function getCachedStories(): Promise<Story[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOCAL_STORIES);
    if (raw) {
      const parsed = JSON.parse(raw) as Story[];
      return parsed.map((s) => ({
        ...s,
        is_favorite: s.is_favorite ?? false,
        updated_at: s.updated_at ?? s.created_at,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Get cached user preferences ─────────────────────────────────────────────
export async function getCachedPreferences(): Promise<UserPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOCAL_PREFS);
    if (raw) return JSON.parse(raw) as UserPreferences;
    return null;
  } catch {
    return null;
  }
}

// ─── Hybrid data loader ───────────────────────────────────────────────────────
/**
 * Loads all app data using the hybrid approach:
 *  1. Return cached data immediately (for fast first render)
 *  2. In the background, sync from cloud if authenticated
 */
export interface HybridData {
  children:    Child[];
  voices:      ParentVoice[];
  stories:     Story[];
  preferences: UserPreferences | null;
  fromCache:   boolean;
}

export async function loadHybridData(userId: string | null): Promise<HybridData> {
  // First load from local cache for immediate display
  const [children, voices, stories, preferences] = await Promise.all([
    getCachedChildren(),
    getCachedVoices(),
    getCachedStories(),
    getCachedPreferences(),
  ]);

  if (!userId || !isSupabaseAvailable) {
    return { children, voices, stories, preferences, fromCache: true };
  }

  // Try to get fresh data from cloud
  try {
    const [cloudChildren, cloudVoices, cloudStories, cloudPrefs] = await Promise.all([
      getChildren(userId),
      getParentVoices(userId),
      getStories(userId),
      getUserPreferences(userId),
    ]);

    const freshChildren  = cloudChildren.children   ?? children;
    const freshVoices    = cloudVoices.voices        ?? voices;
    const freshStories   = cloudStories.stories      ?? stories;
    const freshPrefs     = cloudPrefs.preferences    ?? preferences;

    // Update caches with fresh data
    const now = new Date().toISOString();
    const cacheOps: [string, string][] = [
      [KEYS.LAST_SYNC_AT, now],
      [KEYS.SYNC_STATUS,  'success'],
      [KEYS.LOCAL_CHILDREN, JSON.stringify(freshChildren)],
      [KEYS.LOCAL_VOICES,   JSON.stringify(freshVoices)],
      [KEYS.LOCAL_STORIES,  JSON.stringify(freshStories.slice(0, 50))],
    ];

    if (freshPrefs) {
      cacheOps.push([KEYS.LOCAL_PREFS, JSON.stringify(freshPrefs)]);
    }

    if (freshChildren.length > 0) {
      cacheOps.push(['pending_child_profile', JSON.stringify(freshChildren[0])]);
      cacheOps.push(['active_child_id', freshChildren[0].id]);
    }

    await AsyncStorage.multiSet(cacheOps);

    return {
      children:    freshChildren,
      voices:      freshVoices,
      stories:     freshStories,
      preferences: freshPrefs,
      fromCache:   false,
    };
  } catch (err) {
    console.warn('[SyncService] Cloud fetch failed, using cache:', err);
    await markSyncFailed();
    return { children, voices, stories, preferences, fromCache: true };
  }
}

// ─── Clear all local sync caches (call on sign-out) ──────────────────────────
export async function clearSyncCache(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.LAST_SYNC_AT,
    KEYS.SYNC_STATUS,
    KEYS.LOCAL_CHILDREN,
    KEYS.LOCAL_VOICES,
    KEYS.LOCAL_STORIES,
    KEYS.LOCAL_PREFS,
  ]);
}
