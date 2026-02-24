/**
 * CollectionModal – Story Collections & Series
 *
 * Allows parents to:
 * - Create named collections (e.g. "Weekend Adventures")
 * - Add stories to collections
 * - Play a 'Series' (chain 2-3 stories as a bedtime routine)
 * - View and manage collections
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import type { Story } from '@/lib/supabase';

const { width: W } = Dimensions.get('window');
const COLLECTIONS_KEY = 'story_collections';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface StoryCollection {
  id:         string;
  name:       string;
  emoji:      string;
  story_ids:  string[];
  created_at: string;
}

const COLLECTION_EMOJIS = ['🌟', '🏰', '🌙', '🦋', '🌊', '🎠', '🌈', '🐉', '🧚', '🦄'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function loadCollections(): Promise<StoryCollection[]> {
  try {
    const raw = await AsyncStorage.getItem(COLLECTIONS_KEY);
    return raw ? (JSON.parse(raw) as StoryCollection[]) : [];
  } catch {
    return [];
  }
}

export async function saveCollections(collections: StoryCollection[]): Promise<void> {
  await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export async function addStoryToCollection(
  collectionId: string,
  storyId: string
): Promise<void> {
  const cols = await loadCollections();
  const updated = cols.map((c) =>
    c.id === collectionId && !c.story_ids.includes(storyId)
      ? { ...c, story_ids: [...c.story_ids, storyId] }
      : c
  );
  await saveCollections(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Collection Sheet
// ─────────────────────────────────────────────────────────────────────────────
function CreateCollectionSheet({
  onSave,
  onCancel,
}: {
  onSave: (name: string, emoji: string) => void;
  onCancel: () => void;
}) {
  const [name,         setName]         = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🌟');
  const slideY = useSharedValue(200);

  useEffect(() => {
    slideY.value = withSpring(0, { damping: 16, stiffness: 200 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const handleSave = () => {
    if (!name.trim()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(name.trim(), selectedEmoji);
  };

  return (
    <Animated.View style={[createStyles.sheet, sheetStyle]}>
      {Platform.OS !== 'web' && (
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={[Colors.midnightNavy, Colors.deepSpace]}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      <View style={createStyles.content}>
        <View style={createStyles.handle} />
        <Text style={createStyles.title}>✨  New Collection</Text>
        <Text style={createStyles.subtitle}>Group stories for the perfect bedtime routine</Text>

        {/* Emoji picker */}
        <Text style={createStyles.label}>Choose an Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={createStyles.emojiRow}>
          {COLLECTION_EMOJIS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[createStyles.emojiBtn, selectedEmoji === e && createStyles.emojiBtnActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedEmoji(e);
              }}
            >
              {selectedEmoji === e && (
                <LinearGradient
                  colors={['rgba(255,215,0,0.3)', 'rgba(255,215,0,0.1)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
                />
              )}
              <Text style={createStyles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Name input */}
        <Text style={createStyles.label}>Collection Name</Text>
        <TextInput
          style={createStyles.input}
          placeholder="e.g. Weekend Adventures"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={32}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        {/* Preview */}
        {name.trim().length > 0 && (
          <View style={createStyles.preview}>
            <Text style={createStyles.previewEmoji}>{selectedEmoji}</Text>
            <Text style={createStyles.previewName}>{name}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={createStyles.actions}>
          <TouchableOpacity style={createStyles.cancelBtn} onPress={onCancel}>
            <Text style={createStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[createStyles.saveBtn, !name.trim() && createStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <LinearGradient
              colors={name.trim() ? [Colors.celestialGold, Colors.softGold] : [Colors.cardBg, Colors.cardBg]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
            />
            <Text style={[createStyles.saveText, !name.trim() && createStyles.saveTextDisabled]}>
              Create Collection
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = StyleSheet.create({
  sheet: {
    borderRadius: Radius.xl,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  Colors.borderColor,
    width:        W - 32,
  },
  content: { padding: Spacing.xl, gap: Spacing.md },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderColor,
    alignSelf: 'center', marginBottom: 4,
  },
  title:    { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream, textAlign: 'center' },
  subtitle: { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted,       textAlign: 'center' },
  label:    { fontFamily: Fonts.bold,      fontSize: 13, color: Colors.textLight },
  emojiRow: { flexGrow: 0 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderColor,
  },
  emojiBtnActive: { borderColor: Colors.celestialGold },
  emojiText:      { fontSize: 26 },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius:    Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical:   14,
    fontFamily:      Fonts.bold,
    fontSize:        16,
    color:           Colors.moonlightCream,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
  },
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  previewEmoji: { fontSize: 28 },
  previewName:  { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream, flex: 1 },
  actions:    { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.full,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.borderColor,
  },
  cancelText:       { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },
  saveBtn:          { flex: 2, paddingVertical: Spacing.md, borderRadius: Radius.full, alignItems: 'center', overflow: 'hidden' },
  saveBtnDisabled:  { opacity: 0.5 },
  saveText:         { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.deepSpace },
  saveTextDisabled: { color: Colors.textMuted },
});

// ─────────────────────────────────────────────────────────────────────────────
// Collection Card
// ─────────────────────────────────────────────────────────────────────────────
function CollectionCard({
  collection,
  allStories,
  onPlay,
  onDelete,
}: {
  collection: StoryCollection;
  allStories: Story[];
  onPlay:     () => void;
  onDelete:   () => void;
}) {
  const stories = allStories.filter((s) => collection.story_ids.includes(s.id)).slice(0, 3);
  const playable = stories.filter((s) => s.content).length;

  return (
    <View style={cardStyles.card}>
      <LinearGradient
        colors={['rgba(74,56,128,0.4)', 'rgba(37,38,85,0.2)']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />

      <View style={cardStyles.header}>
        <View style={cardStyles.iconBadge}>
          <Text style={cardStyles.iconEmoji}>{collection.emoji}</Text>
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{collection.name}</Text>
          <Text style={cardStyles.count}>
            {collection.story_ids.length === 0
              ? 'No stories yet'
              : `${collection.story_ids.length} stor${collection.story_ids.length === 1 ? 'y' : 'ies'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={cardStyles.deleteBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDelete();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={cardStyles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Story preview chips */}
      {stories.length > 0 && (
        <View style={cardStyles.storiesRow}>
          {stories.map((s) => (
            <View key={s.id} style={cardStyles.storyChip}>
              <Text style={cardStyles.storyChipText} numberOfLines={1}>{s.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Play Series button */}
      <TouchableOpacity
        style={[cardStyles.playBtn, playable === 0 && cardStyles.playBtnDisabled]}
        onPress={() => {
          if (playable === 0) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onPlay();
        }}
        disabled={playable === 0}
        activeOpacity={0.8}
      >
        {playable > 0 && (
          <LinearGradient
            colors={[Colors.celestialGold, Colors.softGold]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
          />
        )}
        <Text style={[cardStyles.playBtnIcon]}>▶</Text>
        <Text style={[
          cardStyles.playBtnText,
          playable === 0 && cardStyles.playBtnTextDisabled,
        ]}>
          {playable > 0 ? `Play Series  (${playable} stories)` : 'Add stories to play'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.xl,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.borderColor,
    overflow:        'hidden',
    gap:             Spacing.sm,
  },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  iconEmoji:   { fontSize: 26 },
  info:        { flex: 1 },
  name:        { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.moonlightCream },
  count:       { fontFamily: Fonts.regular,   fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  deleteBtn:   { padding: 4 },
  deleteBtnText: { fontSize: 16, color: Colors.textMuted },
  storiesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  storyChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius:    Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.borderColor,
    maxWidth:    W * 0.55,
  },
  storyChipText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted },
  playBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: Spacing.sm,
    borderRadius:    Radius.full,
    overflow:        'hidden',
    gap:             6,
    borderWidth:     1,
    borderColor:     Colors.celestialGold,
  },
  playBtnDisabled: {
    borderColor: Colors.borderColor,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  playBtnIcon: { fontSize: 14, color: Colors.deepSpace },
  playBtnText: {
    fontFamily: Fonts.extraBold,
    fontSize:   13,
    color:      Colors.deepSpace,
  },
  playBtnTextDisabled: { color: Colors.textMuted },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────
interface CollectionModalProps {
  visible:    boolean;
  onClose:    () => void;
  allStories: Story[];
  /** Called with story IDs in play order */
  onPlaySeries: (storyIds: string[]) => void;
}

export default function CollectionModal({
  visible,
  onClose,
  allStories,
  onPlaySeries,
}: CollectionModalProps) {
  const [collections,   setCollections]   = useState<StoryCollection[]>([]);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showAddStory,  setShowAddStory]  = useState(false);
  const [targetCollId,  setTargetCollId]  = useState<string | null>(null);

  // Sheet slide animation
  const slideY = useSharedValue(500);

  useEffect(() => {
    if (visible) {
      slideY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.back(1.1)) });
      void (async () => {
        const cols = await loadCollections();
        setCollections(cols);
      })();
    } else {
      slideY.value = withTiming(500, { duration: 280, easing: Easing.in(Easing.quad) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const handleCreateCollection = useCallback(async (name: string, emoji: string) => {
    const newCol: StoryCollection = {
      id:         `col_${Date.now()}`,
      name,
      emoji,
      story_ids:  [],
      created_at: new Date().toISOString(),
    };
    const updated = [newCol, ...collections];
    setCollections(updated);
    await saveCollections(updated);
    setShowCreate(false);
  }, [collections]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = collections.filter((c) => c.id !== id);
    setCollections(updated);
    await saveCollections(updated);
  }, [collections]);

  const handleAddStory = useCallback(async (collectionId: string, storyId: string) => {
    const updated = collections.map((c) =>
      c.id === collectionId && !c.story_ids.includes(storyId)
        ? { ...c, story_ids: [...c.story_ids, storyId] }
        : c
    );
    setCollections(updated);
    await saveCollections(updated);
    setShowAddStory(false);
    setTargetCollId(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [collections]);

  const handlePlaySeries = useCallback((collection: StoryCollection) => {
    // Get up to 3 playable story IDs in collection order
    const playable = collection.story_ids
      .map((id) => allStories.find((s) => s.id === id && s.content))
      .filter((s): s is Story => Boolean(s))
      .slice(0, 3)
      .map((s) => s.id);

    if (playable.length > 0) {
      onPlaySeries(playable);
      onClose();
    }
  }, [allStories, onPlaySeries, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {Platform.OS !== 'web' && (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(26,27,65,0.98)', 'rgba(13,14,36,0.99)']}
            style={[StyleSheet.absoluteFill, { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl }]}
          />

          <View style={styles.sheetContent}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>📚  My Collections</Text>
                <Text style={styles.subtitle}>Organise stories into series</Text>
              </View>
              <TouchableOpacity
                style={styles.newBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCreate(true);
                }}
              >
                <LinearGradient
                  colors={[Colors.celestialGold, Colors.softGold]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                />
                <Text style={styles.newBtnText}>+ New</Text>
              </TouchableOpacity>
            </View>

            {/* Collections list */}
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {collections.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📂</Text>
                  <Text style={styles.emptyTitle}>No Collections Yet</Text>
                  <Text style={styles.emptyDesc}>
                    Create a collection to group stories into a perfect bedtime series
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyCreateBtn}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowCreate(true);
                    }}
                  >
                    <LinearGradient
                      colors={[Colors.celestialGold, Colors.softGold]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                    />
                    <Text style={styles.emptyCreateText}>Create First Collection</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.collectionList}>
                  {collections.map((col) => (
                    <View key={col.id}>
                      <CollectionCard
                        collection={col}
                        allStories={allStories}
                        onPlay={() => handlePlaySeries(col)}
                        onDelete={() => void handleDeleteCollection(col.id)}
                      />
                      {/* Add story button */}
                      <TouchableOpacity
                        style={styles.addStoryBtn}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTargetCollId(col.id);
                          setShowAddStory(true);
                        }}
                      >
                        <Text style={styles.addStoryBtnText}>+ Add Story to Collection</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Done button */}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Create Collection overlay */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableOpacity
          style={styles.createOverlay}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <CreateCollectionSheet
            onSave={(name, emoji) => void handleCreateCollection(name, emoji)}
            onCancel={() => setShowCreate(false)}
          />
        </TouchableOpacity>
      </Modal>

      {/* Add Story picker overlay */}
      <Modal
        visible={showAddStory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddStory(false)}
      >
        <TouchableOpacity
          style={styles.createOverlay}
          activeOpacity={1}
          onPress={() => setShowAddStory(false)}
        >
          <View style={styles.storyPicker}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={[Colors.midnightNavy, Colors.deepSpace]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <View style={styles.storyPickerContent}>
              <Text style={styles.storyPickerTitle}>Add a Story</Text>
              <ScrollView style={styles.storyPickerList} showsVerticalScrollIndicator={false}>
                {allStories.filter((s) => s.content).map((story) => {
                  const col = collections.find((c) => c.id === targetCollId);
                  const alreadyAdded = col?.story_ids.includes(story.id);
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.storyPickerItem, alreadyAdded && styles.storyPickerItemAdded]}
                      onPress={() => {
                        if (targetCollId && !alreadyAdded) {
                          void handleAddStory(targetCollId, story.id);
                        }
                      }}
                      disabled={alreadyAdded}
                    >
                      <Text style={styles.storyPickerEmoji}>📖</Text>
                      <Text style={styles.storyPickerName} numberOfLines={1}>{story.title}</Text>
                      <Text style={[styles.storyPickerStatus, alreadyAdded && { color: Colors.celestialGold }]}>
                        {alreadyAdded ? '✓ Added' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={styles.storyPickerClose}
                onPress={() => setShowAddStory(false)}
              >
                <Text style={styles.storyPickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent:  'flex-end',
  },
  sheet: {
    maxHeight:            '90%',
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow:             'hidden',
    borderWidth:          1,
    borderBottomWidth:    0,
    borderColor:          'rgba(255,255,255,0.12)',
  },
  sheetContent: {
    padding:       Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap:           Spacing.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderColor,
    alignSelf: 'center', marginBottom: 4,
  },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.moonlightCream },
  subtitle:   { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  newBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, overflow: 'hidden' },
  newBtnText: { fontFamily: Fonts.extraBold, fontSize: 13, color: Colors.deepSpace },

  list: { maxHeight: 400 },
  collectionList: { gap: 16, paddingBottom: 8 },

  // Empty state
  emptyState: {
    alignItems: 'center', padding: Spacing.xl, gap: Spacing.md,
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl,
    borderWidth: 2, borderColor: Colors.borderColor, borderStyle: 'dashed',
  },
  emptyEmoji:      { fontSize: 44 },
  emptyTitle:      { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream },
  emptyDesc:       { fontFamily: Fonts.regular,   fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyCreateBtn:  { paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: Radius.full, overflow: 'hidden', marginTop: 4 },
  emptyCreateText: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.deepSpace },

  // Add story button
  addStoryBtn: {
    alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.full, marginTop: 6,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderColor,
  },
  addStoryBtnText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.textMuted },

  // Done button
  doneBtn: {
    alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderColor,
    marginTop: 4,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },

  // Create overlay
  createOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },

  // Story picker
  storyPicker: {
    width: W - 32, maxHeight: 480,
    borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderColor,
  },
  storyPickerContent: { padding: Spacing.xl, gap: Spacing.md },
  storyPickerTitle: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.moonlightCream, textAlign: 'center' },
  storyPickerList:  { maxHeight: 300 },
  storyPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borderColor,
  },
  storyPickerItemAdded: { opacity: 0.6 },
  storyPickerEmoji:  { fontSize: 22 },
  storyPickerName:   { fontFamily: Fonts.bold, fontSize: 14, color: Colors.moonlightCream, flex: 1 },
  storyPickerStatus: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.textMuted },
  storyPickerClose: {
    alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderColor,
  },
  storyPickerCloseText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textMuted },
});
