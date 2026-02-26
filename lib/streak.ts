/**
 * Bedtime Streak Tracker
 *
 * Tracks consecutive nights of storytelling.
 * A streak increments when stories are completed on consecutive calendar days.
 * Same-day completions don't change the streak.
 * Missing a day resets the streak to 1.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY    = 'bedtime_streak_count';
const LAST_DATE_KEY = 'bedtime_last_story_date';

/** Returns the current bedtime streak (0 if never completed a story). */
export async function getBedtimeStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Call when a story is completed.
 * Updates last-story date and streak count.
 * Returns the updated streak.
 */
export async function updateBedtimeStreak(): Promise<number> {
  try {
    const today       = new Date().toDateString(); // e.g. "Mon Jun 09 2025"
    const lastDateRaw = await AsyncStorage.getItem(LAST_DATE_KEY);
    const streakRaw   = await AsyncStorage.getItem(STREAK_KEY);
    const current     = streakRaw ? parseInt(streakRaw, 10) : 0;

    if (lastDateRaw) {
      const lastDate  = new Date(lastDateRaw);
      const todayDate = new Date(today);
      const diffDays  = Math.round(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        // Same day — don't change streak, don't update date
        return current;
      } else if (diffDays === 1) {
        // Consecutive night — increment
        const newStreak = current + 1;
        await AsyncStorage.setItem(STREAK_KEY,    String(newStreak));
        await AsyncStorage.setItem(LAST_DATE_KEY, today);
        return newStreak;
      }
      // Missed a day — reset to 1
    }

    // First ever completion OR streak broken
    await AsyncStorage.setItem(STREAK_KEY,    '1');
    await AsyncStorage.setItem(LAST_DATE_KEY, today);
    return 1;
  } catch {
    return 0;
  }
}
