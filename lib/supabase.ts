import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// ──────────────────────────────────────────────────────────
// Safe Supabase initialization
// ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing environment variables: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Supabase features will be unavailable. Please connect Supabase to your project.'
  );
}

// Only create the real client when credentials are available.
// When they're missing we use a placeholder URL so the client can be
// instantiated without throwing – every actual request will still fail
// gracefully because the URL/key are invalid, but the app won't crash
// on startup.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

/** Whether the Supabase client has valid credentials */
export const isSupabaseAvailable = isSupabaseConfigured;

// Only set up auto-refresh when Supabase is properly configured
if (isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  user_id: string;
  name: string;
  birthday: string | null;
  age: number | null;
  interests: string[];
  life_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentVoice {
  id: string;
  user_id: string;
  child_id: string | null;
  voice_type: 'mom' | 'dad' | 'custom';
  voice_name: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  script_paragraphs_recorded: number;
  is_complete: boolean;
  recording_labels: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  child_id: string | null;
  title: string;
  content: string | null;
  image_url: string | null;
  theme: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  active_voice_id: string | null;
  active_child_id: string | null;
  narrator_type: 'mom' | 'dad' | 'custom' | null;
  notifications_enabled: boolean;
  last_sync_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const SUPABASE_NOT_CONFIGURED_ERROR = {
  message: 'Supabase is not configured. Please connect Supabase to your project.',
  details: '',
  hint: 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.',
  code: 'SUPABASE_NOT_CONFIGURED',
  name: 'SupabaseNotConfiguredError',
};

// ──────────────────────────────────────────────────────────
// User Profile
// ──────────────────────────────────────────────────────────
export async function upsertUserProfile(userId: string, email: string, fullName?: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] upsertUserProfile skipped – Supabase not configured.');
    return SUPABASE_NOT_CONFIGURED_ERROR;
  }
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      email,
      full_name: fullName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  return error;
}

// ──────────────────────────────────────────────────────────
// Child Profiles  (table: child_profiles)
// ──────────────────────────────────────────────────────────
export async function createChild(data: Omit<Child, 'id' | 'created_at' | 'updated_at'>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] createChild skipped – Supabase not configured.');
    return { child: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: child, error } = await supabase
    .from('child_profiles')
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { child: child as Child | null, error };
}

export async function updateChild(id: string, data: Partial<Child>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] updateChild skipped – Supabase not configured.');
    return { child: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: child, error } = await supabase
    .from('child_profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { child: child as Child | null, error };
}

export async function getChildren(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getChildren skipped – Supabase not configured.');
    return { children: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { children: data as Child[] | null, error };
}

export async function deleteChild(id: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] deleteChild skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase.from('child_profiles').delete().eq('id', id);
  return { error };
}

// ──────────────────────────────────────────────────────────
// Voice Profiles  (table: voice_profiles)
// ──────────────────────────────────────────────────────────
export async function createParentVoice(data: Omit<ParentVoice, 'id' | 'created_at' | 'updated_at'>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] createParentVoice skipped – Supabase not configured.');
    return { voice: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: voice, error } = await supabase
    .from('voice_profiles')
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { voice: voice as ParentVoice | null, error };
}

export async function updateParentVoice(id: string, data: Partial<ParentVoice>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] updateParentVoice skipped – Supabase not configured.');
    return { voice: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: voice, error } = await supabase
    .from('voice_profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { voice: voice as ParentVoice | null, error };
}

export async function getParentVoices(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getParentVoices skipped – Supabase not configured.');
    return { voices: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { voices: data as ParentVoice[] | null, error };
}

export async function deleteParentVoice(id: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] deleteParentVoice skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase.from('voice_profiles').delete().eq('id', id);
  return { error };
}

// ──────────────────────────────────────────────────────────
// Stories  (table: stories)
// ──────────────────────────────────────────────────────────
export async function createStory(data: Omit<Story, 'id' | 'created_at' | 'updated_at'>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] createStory skipped – Supabase not configured.');
    return { story: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: story, error } = await supabase
    .from('stories')
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { story: story as Story | null, error };
}

export async function getStories(userId: string, childId?: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getStories skipped – Supabase not configured.');
    return { stories: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  let query = supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (childId) {
    query = query.eq('child_id', childId);
  }

  const { data, error } = await query;
  return { stories: data as Story[] | null, error };
}

export async function updateStory(id: string, data: Partial<Omit<Story, 'id' | 'created_at'>>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] updateStory skipped – Supabase not configured.');
    return { story: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: story, error } = await supabase
    .from('stories')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { story: story as Story | null, error };
}

export async function toggleStoryFavorite(id: string, isFavorite: boolean) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] toggleStoryFavorite skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase
    .from('stories')
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function deleteStory(id: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] deleteStory skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase.from('stories').delete().eq('id', id);
  return { error };
}

// ──────────────────────────────────────────────────────────
// User Preferences  (table: user_preferences)
// ──────────────────────────────────────────────────────────
export async function upsertUserPreferences(
  userId: string,
  prefs: Partial<Omit<UserPreferences, 'user_id' | 'updated_at'>>
) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] upsertUserPreferences skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  return { error };
}

export async function getUserPreferences(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getUserPreferences skipped – Supabase not configured.');
    return { preferences: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { preferences: data as UserPreferences | null, error };
}

// ──────────────────────────────────────────────────────────
// Family Sharing  (tables: family_groups, family_members)
// ──────────────────────────────────────────────────────────
export interface FamilyGroup {
  id: string;
  owner_user_id: string;
  invite_code: string;
  group_name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export async function createFamilyGroup(userId: string, groupName: string): Promise<{ group: FamilyGroup | null; error: unknown }> {
  if (!isSupabaseConfigured) {
    return { group: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('family_groups')
    .insert({ owner_user_id: userId, invite_code: inviteCode, group_name: groupName })
    .select()
    .single();
  if (!error && data) {
    // Also add owner as a member
    await supabase.from('family_members').insert({
      group_id: (data as FamilyGroup).id,
      user_id: userId,
      role: 'owner',
    });
  }
  return { group: data as FamilyGroup | null, error };
}

export async function joinFamilyGroup(userId: string, inviteCode: string): Promise<{ group: FamilyGroup | null; error: unknown }> {
  if (!isSupabaseConfigured) {
    return { group: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: group, error: findError } = await supabase
    .from('family_groups')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();
  if (findError || !group) {
    return { group: null, error: findError ?? { message: 'Invite code not found' } };
  }
  const { error: joinError } = await supabase
    .from('family_members')
    .upsert({ group_id: (group as FamilyGroup).id, user_id: userId, role: 'member' }, { onConflict: 'group_id,user_id' });
  return { group: group as FamilyGroup | null, error: joinError };
}

export async function getFamilyGroup(userId: string): Promise<{ group: FamilyGroup | null; members: FamilyMember[] }> {
  if (!isSupabaseConfigured) {
    return { group: null, members: [] };
  }
  const { data: memberRow } = await supabase
    .from('family_members')
    .select('group_id')
    .eq('user_id', userId)
    .single();
  if (!memberRow) return { group: null, members: [] };
  const { data: group } = await supabase
    .from('family_groups')
    .select('*')
    .eq('id', (memberRow as { group_id: string }).group_id)
    .single();
  const { data: members } = await supabase
    .from('family_members')
    .select('*')
    .eq('group_id', (memberRow as { group_id: string }).group_id);
  return { group: group as FamilyGroup | null, members: (members as FamilyMember[]) ?? [] };
}

export async function leaveFamilyGroup(userId: string, groupId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('family_members').delete().eq('user_id', userId).eq('group_id', groupId);
}

// ──────────────────────────────────────────────────────────
// Full user data deletion (for account deletion)
// ──────────────────────────────────────────────────────────
export async function deleteAllUserData(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] deleteAllUserData skipped – Supabase not configured.');
    return { error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  // Delete in order to respect any foreign key constraints
  await supabase.from('user_preferences').delete().eq('user_id', userId);
  await supabase.from('stories').delete().eq('user_id', userId);
  await supabase.from('voice_profiles').delete().eq('user_id', userId);
  await supabase.from('child_profiles').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
  return { error: null };
}
