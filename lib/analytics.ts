/**
 * Internal Analytics Service — Phase 7
 *
 * Lightweight event tracking stored locally in AsyncStorage.
 * Tracks:
 *   - Narrator popularity (which narrator is selected most)
 *   - Story completion rates (started vs. completed per theme)
 *   - Screen views for key flows
 *
 * Data never leaves the device — it's purely for local product insights
 * and can be exported via the feedback / debug panel in a future phase.
 *
 * Storage keys:
 *   analytics_narrator_counts    → Record<narratorId, number>
 *   analytics_story_events       → StoryEvent[]
 *   analytics_screen_views       → Record<screenName, number>
 *   analytics_session_count      → number
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NarratorId = 'luna' | 'barnaby' | 'cosmo' | 'aria' | 'rex' | string;

export interface StoryEvent {
  story_id: string;
  title: string;
  theme: string;
  narrator_id: NarratorId;
  event: 'started' | 'completed' | 'abandoned';
  timestamp: string;
  /** Seconds spent in the player */
  duration_seconds?: number;
}

export interface NarratorStats {
  narrator_id: string;
  name: string;
  emoji: string;
  total_selected: number;
  percentage: number;
}

export interface StoryCompletionStats {
  theme: string;
  started: number;
  completed: number;
  completion_rate: number; // 0–100
}

export interface AnalyticsSummary {
  narrator_stats: NarratorStats[];
  story_completion: StoryCompletionStats[];
  total_sessions: number;
  top_narrator: string;
  overall_completion_rate: number;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const NARRATOR_COUNTS_KEY = 'analytics_narrator_counts';
const STORY_EVENTS_KEY = 'analytics_story_events';
const SCREEN_VIEWS_KEY = 'analytics_screen_views';
const SESSION_COUNT_KEY = 'analytics_session_count';

const MAX_STORY_EVENTS = 200; // Cap to avoid unbounded growth

// ─── Narrator Map ─────────────────────────────────────────────────────────────

const NARRATOR_META: Record<string, { name: string; emoji: string }> = {
  luna:    { name: 'Luna',    emoji: '🦉' },
  barnaby: { name: 'Barnaby', emoji: '🐻' },
  cosmo:   { name: 'Cosmo',   emoji: '⭐' },
  aria:    { name: 'Aria',    emoji: '🧚' },
  rex:     { name: 'Rex',     emoji: '🐉' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRecord<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function setRecord<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[Analytics] setRecord error:', err);
  }
}

// ─── Public Tracking API ──────────────────────────────────────────────────────

/**
 * Track a narrator selection (called when user picks a narrator on home or create-story).
 */
export async function trackNarratorSelected(narratorId: NarratorId): Promise<void> {
  const counts = await getRecord<Record<string, number>>(NARRATOR_COUNTS_KEY, {});
  counts[narratorId] = (counts[narratorId] ?? 0) + 1;
  await setRecord(NARRATOR_COUNTS_KEY, counts);
}

/**
 * Track a story lifecycle event (started, completed, abandoned).
 */
export async function trackStoryEvent(event: Omit<StoryEvent, 'timestamp'>): Promise<void> {
  const events = await getRecord<StoryEvent[]>(STORY_EVENTS_KEY, []);
  events.unshift({ ...event, timestamp: new Date().toISOString() });

  // Trim to cap
  if (events.length > MAX_STORY_EVENTS) {
    events.splice(MAX_STORY_EVENTS);
  }

  await setRecord(STORY_EVENTS_KEY, events);
}

/**
 * Track a screen view.
 */
export async function trackScreenView(screenName: string): Promise<void> {
  const views = await getRecord<Record<string, number>>(SCREEN_VIEWS_KEY, {});
  views[screenName] = (views[screenName] ?? 0) + 1;
  await setRecord(SCREEN_VIEWS_KEY, views);
}

/**
 * Increment the app session counter (call on app start / foreground).
 */
export async function trackSession(): Promise<void> {
  const count = await getRecord<number>(SESSION_COUNT_KEY, 0);
  await setRecord(SESSION_COUNT_KEY, count + 1);
}

// ─── Analytics Summary ────────────────────────────────────────────────────────

/**
 * Compute an analytics summary for display in the settings debug panel.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const [narratorCounts, storyEvents, sessionCount] = await Promise.all([
    getRecord<Record<string, number>>(NARRATOR_COUNTS_KEY, {}),
    getRecord<StoryEvent[]>(STORY_EVENTS_KEY, []),
    getRecord<number>(SESSION_COUNT_KEY, 0),
  ]);

  // ── Narrator Stats ────────────────────────────────────────────────────────
  const totalSelections = Object.values(narratorCounts).reduce((a, b) => a + b, 0) || 1;
  const narrator_stats: NarratorStats[] = Object.entries(narratorCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, count]) => ({
      narrator_id: id,
      name:  NARRATOR_META[id]?.name  ?? id,
      emoji: NARRATOR_META[id]?.emoji ?? '🎭',
      total_selected: count,
      percentage: Math.round((count / totalSelections) * 100),
    }));

  const top_narrator = narrator_stats.length > 0
    ? `${narrator_stats[0].emoji} ${narrator_stats[0].name} (${narrator_stats[0].percentage}%)`
    : 'None yet';

  // ── Story Completion Stats ────────────────────────────────────────────────
  const themeMap: Record<string, { started: number; completed: number }> = {};
  for (const ev of storyEvents) {
    if (!themeMap[ev.theme]) themeMap[ev.theme] = { started: 0, completed: 0 };
    if (ev.event === 'started')   themeMap[ev.theme].started   += 1;
    if (ev.event === 'completed') themeMap[ev.theme].completed += 1;
  }

  const story_completion: StoryCompletionStats[] = Object.entries(themeMap)
    .sort(([, a], [, b]) => b.started - a.started)
    .map(([theme, { started, completed }]) => ({
      theme,
      started,
      completed,
      completion_rate: started > 0 ? Math.round((completed / started) * 100) : 0,
    }));

  const totalStarted   = storyEvents.filter((e) => e.event === 'started').length;
  const totalCompleted = storyEvents.filter((e) => e.event === 'completed').length;
  const overall_completion_rate = totalStarted > 0
    ? Math.round((totalCompleted / totalStarted) * 100)
    : 0;

  return {
    narrator_stats,
    story_completion,
    total_sessions: sessionCount,
    top_narrator,
    overall_completion_rate,
  };
}

/**
 * Clear all analytics data (e.g. on account deletion or privacy reset).
 */
export async function clearAnalytics(): Promise<void> {
  await AsyncStorage.multiRemove([
    NARRATOR_COUNTS_KEY,
    STORY_EVENTS_KEY,
    SCREEN_VIEWS_KEY,
    SESSION_COUNT_KEY,
  ]);
}

/**
 * Export analytics as a JSON string (for inclusion in a bug report email).
 */
export async function exportAnalyticsJSON(): Promise<string> {
  const summary = await getAnalyticsSummary();
  return JSON.stringify(summary, null, 2);
}
