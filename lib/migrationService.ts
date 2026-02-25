/**
 * Migration Service
 *
 * Detects locally-stored (Safe Mode) data and migrates it to Supabase
 * when the user is authenticated.
 *
 * Local data types handled:
 *   - Child profile  (pending_child_profile)
 *   - Stories        (local_stories)
 *   - Voice profiles (sync_voice_profiles)
 *
 * Migration is idempotent: the `migration_complete_<userId>` AsyncStorage key
 * prevents re-running after a successful migration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createChild,
  createParentVoice,
  createStory,
  isSupabaseAvailable,
} from './supabase';
import type { Child, ParentVoice, Story } from './supabase';
import { syncFromCloud } from './syncService';

// ─── AsyncStorage Keys ────────────────────────────────────────────────────────
const MIGRATION_KEY_PREFIX   = 'migration_complete_';
const MIGRATION_TS_KEY       = 'migration_completed_at';

/** Returns the per-user migration key so the check is scoped to the account. */
function migrationKey(userId: string) {
  return `${MIGRATION_KEY_PREFIX}${userId}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LocalDataSummary {
  childCount: number;
  storyCount: number;
  voiceCount: number;
  hasLocalData: boolean;
  /** Snapshot of the local children found */
  localChildren: Partial<Child>[];
  /** Snapshot of the local stories found  */
  localStories: Partial<Story>[];
  /** Snapshot of the local voices found   */
  localVoices: Partial<ParentVoice>[];
}

export interface MigrationResult {
  success: boolean;
  migratedChildren: number;
  migratedStories: number;
  migratedVoices: number;
  totalMigrated: number;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isLocalId(id: string | undefined | null): boolean {
  if (!id) return true; // no ID → definitely local
  return id.startsWith('local_') || id.startsWith('tmp_');
}

// ─── Detect local data that needs migrating ───────────────────────────────────
/**
 * Scans AsyncStorage for Safe-Mode data.
 * Returns summary with counts and raw records.
 * Returns { hasLocalData: false } if migration was already done for this user.
 */
export async function detectLocalData(userId: string): Promise<LocalDataSummary> {
  const empty: LocalDataSummary = {
    childCount: 0,
    storyCount: 0,
    voiceCount: 0,
    hasLocalData: false,
    localChildren: [],
    localStories: [],
    localVoices: [],
  };

  // Skip if already migrated for this user
  const alreadyMigrated = await AsyncStorage.getItem(migrationKey(userId));
  if (alreadyMigrated) return empty;

  if (!isSupabaseAvailable) return empty;

  try {
    const [childRaw, storiesRaw, voicesRaw] = await Promise.all([
      AsyncStorage.getItem('pending_child_profile'),
      AsyncStorage.getItem('local_stories'),
      AsyncStorage.getItem('sync_voice_profiles'),
    ]);

    const localChildren: Partial<Child>[] = [];
    const localStories: Partial<Story>[]   = [];
    const localVoices: Partial<ParentVoice>[] = [];

    // ── Child profile ──────────────────────────────────────────────────────
    if (childRaw) {
      const child = JSON.parse(childRaw) as Partial<Child>;
      // Needs migration if: no user_id, wrong user, or a local ID
      if (!child.user_id || child.user_id !== userId || isLocalId(child.id)) {
        localChildren.push(child);
      }
    }

    // ── Stories ───────────────────────────────────────────────────────────
    if (storiesRaw) {
      const stories = JSON.parse(storiesRaw) as Array<Partial<Story> & { imageUrl?: string }>;
      const locals = stories.filter(
        (s) => isLocalId(s.id) || !s.user_id || s.user_id !== userId
      );
      localStories.push(...locals);
    }

    // ── Voice profiles ─────────────────────────────────────────────────────
    if (voicesRaw) {
      const voices = JSON.parse(voicesRaw) as Partial<ParentVoice>[];
      const locals = voices.filter(
        (v) => isLocalId(v.id) || !v.user_id || v.user_id !== userId
      );
      localVoices.push(...locals);
    }

    const hasLocalData =
      localChildren.length > 0 ||
      localStories.length > 0 ||
      localVoices.length > 0;

    return {
      childCount:    localChildren.length,
      storyCount:    localStories.length,
      voiceCount:    localVoices.length,
      hasLocalData,
      localChildren,
      localStories,
      localVoices,
    };
  } catch {
    return empty;
  }
}

// ─── Migrate local data to Supabase ───────────────────────────────────────────
/**
 * Uploads all discovered local records to Supabase.
 * On success, clears the local Safe-Mode cache and marks migration done.
 */
export async function migrateLocalDataToCloud(
  userId: string,
  summary: LocalDataSummary
): Promise<MigrationResult> {
  const errors: string[] = [];
  let migratedChildren = 0;
  let migratedStories  = 0;
  let migratedVoices   = 0;

  if (!isSupabaseAvailable) {
    return {
      success: false,
      migratedChildren: 0,
      migratedStories:  0,
      migratedVoices:   0,
      totalMigrated:    0,
      errors: ['Supabase is not available'],
    };
  }

  // ── 1. Migrate child profile ─────────────────────────────────────────────
  let newChildId: string | null = null;
  for (const localChild of summary.localChildren) {
    try {
      const { child: saved, error } = await createChild({
        user_id:    userId,
        name:       localChild.name ?? 'My Child',
        birthday:   localChild.birthday ?? null,
        age:        localChild.age ?? null,
        interests:  localChild.interests ?? [],
        life_notes: localChild.life_notes ?? null,
      });
      if (error || !saved) {
        errors.push(`Child: ${String(error?.message ?? 'unknown error')}`);
      } else {
        newChildId = saved.id;
        // Update local cache with the real Supabase record
        await AsyncStorage.setItem('pending_child_profile', JSON.stringify(saved));
        await AsyncStorage.setItem('active_child_id', saved.id);
        migratedChildren++;
      }
    } catch (e) {
      errors.push(`Child migration failed: ${String(e)}`);
    }
  }

  // ── 2. Migrate stories ───────────────────────────────────────────────────
  const storiesRaw = await AsyncStorage.getItem('local_stories');
  const allLocalStories: Array<Partial<Story> & { imageUrl?: string; createdAt?: string }> =
    storiesRaw ? JSON.parse(storiesRaw) : [];

  const updatedStories = [...allLocalStories];

  for (const localStory of summary.localStories) {
    try {
      const s = localStory as Partial<Story> & { imageUrl?: string; createdAt?: string };
      const { story: saved, error } = await createStory({
        user_id:     userId,
        child_id:    newChildId ?? s.child_id ?? null,
        title:       s.title ?? 'Untitled Story',
        content:     s.content ?? null,
        image_url:   s.image_url ?? s.imageUrl ?? null,
        theme:       s.theme ?? null,
        is_favorite: s.is_favorite ?? false,
      });
      if (error || !saved) {
        errors.push(`Story "${s.title ?? '?'}": ${String(error?.message ?? 'unknown error')}`);
      } else {
        // Replace local entry in the in-memory copy
        const idx = updatedStories.findIndex((x) => x.id === s.id || x.title === s.title);
        if (idx !== -1) {
          updatedStories[idx] = {
            ...updatedStories[idx],
            id:      saved.id,
            user_id: userId,
          };
        }
        migratedStories++;
      }
    } catch (e) {
      errors.push(`Story migration failed: ${String(e)}`);
    }
  }

  // Persist updated stories list (with real IDs)
  if (migratedStories > 0) {
    await AsyncStorage.setItem('local_stories', JSON.stringify(updatedStories.slice(0, 50)));
  }

  // ── 3. Migrate voice profiles (metadata only – no audio re-upload) ────────
  for (const localVoice of summary.localVoices) {
    try {
      const { voice: saved, error } = await createParentVoice({
        user_id:                    userId,
        child_id:                   newChildId ?? localVoice.child_id ?? null,
        voice_type:                 localVoice.voice_type ?? 'custom',
        voice_name:                 localVoice.voice_name ?? null,
        recording_url:              localVoice.recording_url ?? null,
        duration_seconds:           localVoice.duration_seconds ?? null,
        script_paragraphs_recorded: localVoice.script_paragraphs_recorded ?? 0,
        is_complete:                localVoice.is_complete ?? false,
        recording_labels:           localVoice.recording_labels ?? {},
      });
      if (error || !saved) {
        errors.push(`Voice "${localVoice.voice_name ?? '?'}": ${String(error?.message ?? 'unknown error')}`);
      } else {
        migratedVoices++;
      }
    } catch (e) {
      errors.push(`Voice migration failed: ${String(e)}`);
    }
  }

  const totalMigrated = migratedChildren + migratedStories + migratedVoices;
  const allOk = errors.length === 0;

  if (allOk || totalMigrated > 0) {
    // Mark migration done for this user
    await AsyncStorage.setItem(migrationKey(userId), 'true');
    await AsyncStorage.setItem(MIGRATION_TS_KEY, new Date().toISOString());

    // Refresh all caches from cloud so the bookshelf shows Supabase records
    try {
      await syncFromCloud(userId);
    } catch {
      // non-fatal
    }
  }

  return {
    success: allOk,
    migratedChildren,
    migratedStories,
    migratedVoices,
    totalMigrated,
    errors,
  };
}

// ─── Check if migration has been done ─────────────────────────────────────────
export async function isMigrationComplete(userId: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(migrationKey(userId));
  return val !== null;
}

/** Returns the ISO timestamp of when migration was last completed, or null. */
export async function getMigrationTimestamp(): Promise<string | null> {
  return AsyncStorage.getItem(MIGRATION_TS_KEY);
}
