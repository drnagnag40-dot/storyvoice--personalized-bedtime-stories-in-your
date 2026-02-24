import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@fastshot/auth';
import StarField from '@/components/StarField';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { createChild, updateChild, getChildren, isSupabaseAvailable, upsertUserPreferences } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTERESTS = [
  { label: '🦁 Animals', value: 'Animals' },
  { label: '🚀 Space', value: 'Space' },
  { label: '✨ Magic', value: 'Magic' },
  { label: '🗡️ Adventure', value: 'Adventure' },
  { label: '🐉 Dragons', value: 'Dragons' },
  { label: '🧚 Fairy Tales', value: 'Fairy Tales' },
  { label: '🏴‍☠️ Pirates', value: 'Pirates' },
  { label: '🔬 Science', value: 'Science' },
  { label: '🦕 Dinosaurs', value: 'Dinosaurs' },
  { label: '🦸 Superheroes', value: 'Superheroes' },
  { label: '🌊 Ocean', value: 'Ocean' },
  { label: '🏔️ Mountains', value: 'Mountains' },
];

function calculateAge(birthday: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export default function ChildProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState<Date>(new Date(new Date().getFullYear() - 5, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [lifeNotes, setLifeNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const age = calculateAge(birthday);

  const toggleInterest = useCallback((value: string) => {
    setSelectedInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', "Please enter your child's name.");
      return;
    }
    if (selectedInterests.length === 0) {
      Alert.alert('Pick Some Interests', 'Select at least one interest to personalise the stories.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in to continue.');
      return;
    }

    setIsSaving(true);
    try {
      const profileData = {
        name: name.trim(),
        birthday: birthday.toISOString().split('T')[0],
        age,
        interests: selectedInterests,
        life_notes: lifeNotes.trim() || null,
      };

      // Check if child already exists in cloud to decide create vs update
      let savedChildId: string | null = null;
      const existingIdRaw = await AsyncStorage.getItem('active_child_id');

      const { child, error } = existingIdRaw
        ? await updateChild(existingIdRaw, profileData)
        : await createChild({ user_id: user.id, ...profileData });

      if (error) {
        // If Supabase not yet connected, store locally and proceed
        await AsyncStorage.setItem('pending_child_profile', JSON.stringify(profileData));
      } else if (child) {
        savedChildId = child.id;
        await AsyncStorage.setItem('active_child_id', child.id);
        await AsyncStorage.setItem('pending_child_profile', JSON.stringify(child));

        // Refresh the child profile cache
        const { children } = await getChildren(user.id);
        if (children) {
          await AsyncStorage.setItem('sync_child_profiles', JSON.stringify(children));
        }

        // Sync active_child_id to user_preferences
        if (isSupabaseAvailable) {
          await upsertUserPreferences(user.id, {
            active_child_id: savedChildId,
          });
        }
      }

      router.push('/(onboarding)/voice-selection');
    } catch {
      // Store locally and proceed even if DB fails
      await AsyncStorage.setItem('pending_child_profile', JSON.stringify({
        name: name.trim(),
        birthday: birthday.toISOString().split('T')[0],
        age,
        interests: selectedInterests,
        life_notes: lifeNotes.trim() || null,
      }));
      router.push('/(onboarding)/voice-selection');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.deepSpace, Colors.midnightNavy, '#251B5A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={45} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>Step 1 of 3</Text>
            </View>
            <Text style={styles.title}>Tell us about{'\n'}your little one ✨</Text>
            <Text style={styles.subtitle}>
              This helps us craft stories that feel like they were written just for them.
            </Text>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{"Child's Name"}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sophie, Jack…"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Birthday */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Birthday</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerButtonText}>
                🎂 {birthday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              {age > 0 && (
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>{age} years old</Text>
                </View>
              )}
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthday}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(new Date().getFullYear() - 15, 0, 1)}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (date) setBirthday(date);
                }}
                style={styles.datePicker}
                themeVariant="dark"
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Interests */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Favourite Themes
              <Text style={styles.sectionNote}> (pick as many as you like)</Text>
            </Text>
            <View style={styles.chipsGrid}>
              {INTERESTS.map((interest) => {
                const selected = selectedInterests.includes(interest.value);
                return (
                  <TouchableOpacity
                    key={interest.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleInterest(interest.value)}
                    activeOpacity={0.7}
                  >
                    {selected && (
                      <LinearGradient
                        colors={['rgba(255,215,0,0.2)', 'rgba(255,200,87,0.1)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                      />
                    )}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {interest.label}
                    </Text>
                    {selected && <Text style={styles.chipCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Life Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Life Notes{' '}
              <Text style={styles.sectionNote}>(optional)</Text>
            </Text>
            <Text style={styles.sectionHint}>
              {"Anything special to weave into tonight's story? A new baby sister, starting school, losing a tooth…"}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. 'She started swimming lessons today and was nervous but so brave!'"
              placeholderTextColor={Colors.textMuted}
              value={lifeNotes}
              onChangeText={setLifeNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.charCount}>{lifeNotes.length}/300</Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.continueButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <LinearGradient
              colors={[Colors.celestialGold, Colors.softGold, '#E8A800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.continueButtonText}>
                {isSaving ? 'Saving…' : "Next: Choose a Voice →"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepSpace },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107,72,184,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.softPurple,
    marginBottom: 16,
  },
  stepText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold, letterSpacing: 0.5 },
  title: { fontFamily: Fonts.extraBold, fontSize: 28, color: Colors.moonlightCream, lineHeight: 36, marginBottom: 10 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  section: { marginBottom: Spacing.xl },
  sectionLabel: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.moonlightCream, marginBottom: 12 },
  sectionNote: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted },
  sectionHint: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 10 },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.moonlightCream,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  textArea: { minHeight: 100, paddingTop: 14 },
  charCount: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 6 },
  datePickerButton: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerButtonText: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.moonlightCream },
  ageBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.celestialGold,
  },
  ageBadgeText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.celestialGold },
  datePicker: { backgroundColor: Colors.inputBg, borderRadius: 14, marginTop: 8 },
  doneButton: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Colors.softPurple, borderRadius: Radius.full },
  doneButtonText: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.inputBg,
    gap: 6,
    overflow: 'hidden',
  },
  chipSelected: { borderColor: Colors.celestialGold },
  chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textMuted },
  chipTextSelected: { color: Colors.celestialGold },
  chipCheck: { fontSize: 12, color: Colors.celestialGold },
  continueButton: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  continueButtonText: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.deepSpace },
});
