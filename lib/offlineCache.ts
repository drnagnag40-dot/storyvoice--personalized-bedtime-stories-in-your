/**
 * Offline Cache Service — Phase 7
 *
 * Caches generated story text and metadata locally using AsyncStorage
 * so children can access their favourite stories without a network connection.
 *
 * Cache keys:
 *   offline_story_<id>          → full story object (text, title, theme, image_url)
 *   offline_story_ids           → JSON array of cached story IDs
 *   offline_cache_meta          → metadata about the cache (size, last updated)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedStory {
  id: string;
  title: string;
  content: string;
  theme: string;
  image_url?: string;
  narrator_id?: string;
  child_name?: string;
  cached_at: string;
  /** Whether the audio has been cached locally */
  audio_cached?: boolean;
}

export interface CacheMeta {
  total_stories: number;
  last_updated: string;
  cache_version: number;
}

const CACHE_VERSION = 1;
const STORY_KEY_PREFIX = 'offline_story_';
const IDS_KEY = 'offline_story_ids';
const META_KEY = 'offline_cache_meta';
const MAX_CACHED_STORIES = 20; // keep the most recent 20 stories

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCachedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveCachedIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

async function updateMeta(totalStories: number): Promise<void> {
  const meta: CacheMeta = {
    total_stories: totalStories,
    last_updated: new Date().toISOString(),
    cache_version: CACHE_VERSION,
  };
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a story to the offline cache.
 * Automatically evicts the oldest entry when MAX_CACHED_STORIES is reached.
 */
export async function cacheStory(story: Omit<CachedStory, 'cached_at'>): Promise<void> {
  try {
    const entry: CachedStory = { ...story, cached_at: new Date().toISOString() };
    await AsyncStorage.setItem(`${STORY_KEY_PREFIX}${story.id}`, JSON.stringify(entry));

    let ids = await getCachedIds();
    // Remove duplicate if already cached
    ids = ids.filter((id) => id !== story.id);
    // Prepend (most recent first)
    ids.unshift(story.id);

    // Evict oldest if over limit
    if (ids.length > MAX_CACHED_STORIES) {
      const evicted = ids.splice(MAX_CACHED_STORIES);
      await Promise.all(evicted.map((id) => AsyncStorage.removeItem(`${STORY_KEY_PREFIX}${id}`)));
    }

    await saveCachedIds(ids);
    await updateMeta(ids.length);
  } catch (err) {
    console.warn('[OfflineCache] cacheStory error:', err);
  }
}

/**
 * Retrieve a single cached story by ID. Returns null if not found.
 */
export async function getCachedStory(storyId: string): Promise<CachedStory | null> {
  try {
    const raw = await AsyncStorage.getItem(`${STORY_KEY_PREFIX}${storyId}`);
    return raw ? (JSON.parse(raw) as CachedStory) : null;
  } catch {
    return null;
  }
}

/**
 * Get all cached stories (most recently cached first).
 */
export async function getAllCachedStories(): Promise<CachedStory[]> {
  try {
    const ids = await getCachedIds();
    const entries = await Promise.all(ids.map((id) => getCachedStory(id)));
    return entries.filter((e): e is CachedStory => e !== null);
  } catch {
    return [];
  }
}

/**
 * Check whether a specific story is cached offline.
 */
export async function isStoryCached(storyId: string): Promise<boolean> {
  const ids = await getCachedIds();
  return ids.includes(storyId);
}

/**
 * Remove a specific story from the cache.
 */
export async function removeCachedStory(storyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${STORY_KEY_PREFIX}${storyId}`);
    const ids = (await getCachedIds()).filter((id) => id !== storyId);
    await saveCachedIds(ids);
    await updateMeta(ids.length);
  } catch (err) {
    console.warn('[OfflineCache] removeCachedStory error:', err);
  }
}

/**
 * Clear the entire offline story cache.
 */
export async function clearStoryCache(): Promise<void> {
  try {
    const ids = await getCachedIds();
    await Promise.all(ids.map((id) => AsyncStorage.removeItem(`${STORY_KEY_PREFIX}${id}`)));
    await AsyncStorage.multiRemove([IDS_KEY, META_KEY]);
  } catch (err) {
    console.warn('[OfflineCache] clearStoryCache error:', err);
  }
}

/**
 * Get cache metadata (count, last updated).
 */
export async function getCacheMeta(): Promise<CacheMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as CacheMeta;
  } catch {
    // fall through
  }
  const ids = await getCachedIds();
  return {
    total_stories: ids.length,
    last_updated: '',
    cache_version: CACHE_VERSION,
  };
}

/**
 * Mark a story's audio as cached (for display purposes).
 * In a full implementation this would pair with expo-file-system
 * to download and store the audio file locally.
 */
export async function markAudioCached(storyId: string): Promise<void> {
  try {
    const story = await getCachedStory(storyId);
    if (story) {
      await AsyncStorage.setItem(
        `${STORY_KEY_PREFIX}${storyId}`,
        JSON.stringify({ ...story, audio_cached: true })
      );
    }
  } catch (err) {
    console.warn('[OfflineCache] markAudioCached error:', err);
  }
}
