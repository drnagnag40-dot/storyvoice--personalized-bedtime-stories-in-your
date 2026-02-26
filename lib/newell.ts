/**
 * Newell AI Integration for StoryVoice
 *
 * Prepares all AI-powered story and image generation features.
 * Uses the @fastshot/ai package for all AI interactions.
 */

import type { Child } from './supabase';

export interface StoryGenerationInput {
  child: Child;
  voiceType: 'mom' | 'dad' | 'custom';
  theme?: string;
  mood?: string;
  narratorPersonality?: NarratorPersonality;
}

export interface GeneratedStory {
  title: string;
  paragraphs: string[];
  imagePrompt: string;
}

// ──────────────────────────────────────────────────────────
// Narrator Personality System
// ──────────────────────────────────────────────────────────

export type NarratorStyle = 'whisper' | 'wise' | 'enthusiastic' | 'slow-paced' | 'dramatic';

export interface NarratorPersonality {
  id: string;
  name: string;
  species: string;
  emoji: string;
  style: NarratorStyle;
  description: string;
  tagline: string;
  accentColor: string;
  glowColor: string;
  previewText: string;
  isPremium?: boolean;
}

export const NARRATOR_PERSONALITIES: NarratorPersonality[] = [
  {
    id: 'luna',
    name: 'Luna',
    species: 'the Owl',
    emoji: '🦉',
    style: 'whisper',
    description: 'Soft, hushed, and magical',
    tagline: 'Every word a whisper…',
    accentColor: '#C9A8FF',
    glowColor: '#8B5CF6',
    previewText: 'Shhh… let the moonlight carry you gently into dreamland…',
  },
  {
    id: 'barnaby',
    name: 'Barnaby',
    species: 'the Bear',
    emoji: '🐻',
    style: 'wise',
    description: 'Thoughtful, warm & philosophical',
    tagline: 'Ancient wisdom, tender heart',
    accentColor: '#F59E0B',
    glowColor: '#D97706',
    previewText: 'There is a great truth in the quietness of night, little one…',
  },
  {
    id: 'cosmo',
    name: 'Cosmo',
    species: 'the Star',
    emoji: '⭐',
    style: 'enthusiastic',
    description: 'Bright, energetic & joyful',
    tagline: 'Stories that spark and shine!',
    accentColor: '#FFD700',
    glowColor: '#FFA500',
    previewText: 'Oh WOW! Are you ready for the most AMAZING adventure ever?!',
  },
  {
    id: 'aria',
    name: 'Aria',
    species: 'the Fairy',
    emoji: '🧚',
    style: 'slow-paced',
    description: 'Gentle, rhythmic & deeply soothing',
    tagline: 'Drifting… slowly… to sleep',
    accentColor: '#34D399',
    glowColor: '#059669',
    previewText: 'Breathe in… and breathe out… let each word… carry you… to rest…',
    isPremium: true,
  },
  {
    id: 'rex',
    name: 'Rex',
    species: 'the Dragon',
    emoji: '🐉',
    style: 'dramatic',
    description: 'Bold, vivid & epic storytelling',
    tagline: 'LEGENDS are born at bedtime!',
    accentColor: '#F87171',
    glowColor: '#DC2626',
    previewText: 'In the age before memory, when mountains were young and oceans sang…',
    isPremium: true,
  },
  {
    id: 'seraphina',
    name: 'Seraphina',
    species: 'the Star-Whale',
    emoji: '🐋',
    style: 'whisper',
    description: 'Ancient, cosmic & celestially serene',
    tagline: 'Ride the stardust waves to sleep…',
    accentColor: '#A78BFA',
    glowColor: '#7C3AED',
    previewText: 'From the deep oceans of the cosmos, I carry you on gentle starlit currents… to the softest dreams…',
    isPremium: true,
  },
];

// ──────────────────────────────────────────────────────────
// Narrator style prompt modifiers
// ──────────────────────────────────────────────────────────

function buildNarratorStyleGuide(style: NarratorStyle): string {
  switch (style) {
    case 'whisper':
      return `STYLE — LUNA (hushed · celestial · soothing):
Short breathy sentences (≤10 words). Ellipses (...) as breathing pauses.
Hushed sounds: s, sh, l, m. Words: drift, hush, shimmer, silver, still, moonpool.
One quiet wisdom per paragraph. Intimate, as if the night sky whispers.`.trim();

    case 'wise':
      return `STYLE — BARNABY (warm · earthy · forest):
Slow, unhurried voice like honey dripping. One gentle forest-wisdom per paragraph.
Imagery: honeycomb, pine needles, mossy logs, crackling hearth.
Words: roots, cosy, patient, honey-golden, safe, den. Tone: beloved bear uncle.`.trim();

    case 'enthusiastic':
      return `STYLE — COSMO (bright · energetic → calming):
Paragraphs 1–3: vivid exclamations, ALL CAPS sparingly, bright adjectives.
Paragraphs 4–5: energy fades to gentle sleepy warmth.
Words: amazing, sparkling, magical, brilliant. End cosy, not exciting.`.trim();

    case 'slow-paced':
      return `STYLE — ARIA (rhythmic · repetitive · lullaby):
Commas and ellipses (...) create breathing pauses. Slow-motion phrasing.
Repeat calming refrains: "And so… they rested. Yes… they rested."
Words: gentle, soft, steady, drifting, peaceful. Hypnotically calm.`.trim();

    case 'dramatic':
      return `STYLE — REX (epic · cinematic → peaceful):
Paragraphs 1–3: grand sweeping imagery, bold verbs, cinematic scale.
Paragraphs 4–5: epic world quiets, hero rests, drama becomes peaceful.
Words: ancient, legendary, golden, mighty, majestic. Safe, never scary.`.trim();

    default:
      return '';
  }
}

// ──────────────────────────────────────────────────────────
// Story prompt builder – turns child profile into a
// rich, personalised story prompt for Newell AI
// ──────────────────────────────────────────────────────────
export function buildStoryPrompt(input: StoryGenerationInput): string {
  const { child, theme, mood, narratorPersonality } = input;

  const interests =
    child.interests.length > 0
      ? `Their favourite themes are: ${child.interests.join(', ')}.`
      : '';

  const lifeNotes = child.life_notes
    ? `Important things about them today: ${child.life_notes}.`
    : '';

  const ageText = child.age ? `${child.age}-year-old` : 'young';

  const narratorGuide = narratorPersonality
    ? buildNarratorStyleGuide(narratorPersonality.style)
    : '';

  const narratorIntro = narratorPersonality
    ? `You are ${narratorPersonality.name} ${narratorPersonality.species}, narrating in the "${narratorPersonality.style}" style.`
    : '';

  return `
${narratorIntro}
Soothing 5-paragraph bedtime story for ${ageText} ${child.name}.
${interests}${lifeNotes}${theme ? `Theme: ${theme}.` : ''}${mood ? ` Mood: ${mood}.` : ''}

STRUCTURE:
- P1–3: Gentle adventure, soft unhurried language, each sentence a slow exhale.
- P4: World grows quiet and still. Short rhythmic sentences — child's breathing slows.
- P5 (SLEEPY ENDING): Eyes heavy, breathing calm. Poetic, repetitive wind-down — pillows, starlight, drifting to sleep. Final sentence: very short, very tender.

RULES: 5 paragraphs, 2–4 sentences each. 150–250 words. Simple dreamy language. No peril in P4–5. Rhythm slows like a song fading.

${narratorGuide}
`.trim();
}

// ──────────────────────────────────────────────────────────
// Narrator preview prompt – short sample to demonstrate style
// ──────────────────────────────────────────────────────────
export function buildNarratorPreviewPrompt(personality: NarratorPersonality, childName?: string): string {
  const name = childName ?? 'little dreamer';
  return `
You are ${personality.name} ${personality.species}.
${buildNarratorStyleGuide(personality.style)}
Write ONE paragraph (2–3 sentences, 35–50 words) greeting ${name} in your unique voice.
Output ONLY the paragraph — no title, no quotes, no extra text.
`.trim();
}

// ──────────────────────────────────────────────────────────
// Voice recording script – the 5 paragraphs parents record
// ──────────────────────────────────────────────────────────
export function buildVoiceScript(voiceType: 'mom' | 'dad' | 'custom'): string[] {
  const parentTitle = voiceType === 'mom' ? 'Mum' : voiceType === 'dad' ? 'Dad' : 'me';
  return [
    `Hello my darling. It's ${parentTitle} here, and I'm so proud of you today. You worked so hard and played so beautifully. Now it's time to let your little body rest.`,
    `Close your eyes and imagine the softest, fluffiest cloud drifting through a midnight-blue sky filled with glittering stars. That cloud is just for you — perfectly shaped for little dreamers like you.`,
    `On that cloud, all the worries of the day melt away like snowflakes in warm sunshine. You are so loved. You are so safe. There is absolutely nothing to worry about tonight.`,
    `Your breathing is slowing down now, nice and easy. With every gentle breath, you float a little higher into the most magical dreams waiting just for you. Sweet animals, grand adventures, and kind friends are all there.`,
    `I love you more than all the stars in the sky, all the waves in the ocean, and all the grains of sand on every beach in the whole wide world. Sleep tight, my precious one. Goodnight.`,
  ];
}

// ──────────────────────────────────────────────────────────
// Image prompt builder – for the story cover illustration
// ──────────────────────────────────────────────────────────
export function buildImagePrompt(child: Child, storyTitle: string): string {
  const interests = child.interests.slice(0, 2).join(' and ');
  return `
Soft, ethereal, dreamlike children's book illustration. Central subject perfectly centred in frame.
A peaceful sleeping child surrounded by ${interests || 'glowing stars and woodland creatures'}, bathed in moonlight.
Style: luminous watercolour, frosted glass pastels, gossamer light rays, gentle bokeh.
Mood: celestial, hushed, magically soothing. No harsh lines. Title theme: "${storyTitle}".
Square composition, subject centred, generous negative space, dreamy vignette edges.
`.trim();
}

// ──────────────────────────────────────────────────────────
// Story Art Style Themes (for AI Family Portrait transformation)
// ──────────────────────────────────────────────────────────
export interface ArtStyle {
  id: string;
  label: string;
  emoji: string;
  description: string;
  transformPrompt: string;
}

export const STORY_ART_STYLES: ArtStyle[] = [
  {
    id: 'space_captain',
    label: 'Space Captain',
    emoji: '🚀',
    description: 'Galactic hero among the stars',
    transformPrompt: 'Transform this photo into a soft, ethereal, dreamlike children\'s book illustration. The person as a space captain hero, centred in frame, wearing a luminous space suit dusted with golden stars, floating serenely among translucent nebulae. Frosted-glass watercolour style, muted cosmic pastels, gossamer light rays, gentle bokeh background. Face recognisable, expression peaceful and heroic.',
  },
  {
    id: 'brave_knight',
    label: 'Brave Knight',
    emoji: '⚔️',
    description: 'Noble guardian of the realm',
    transformPrompt: 'Transform this photo into a soft, ethereal, dreamlike children\'s book illustration. The person as a gentle knight centred in frame, wearing soft-glow golden armour, in a moonlit enchanted forest. Frosted watercolour style, warm amber and lavender pastels, shimmering fairy-light bokeh, vignette edges. Face recognisable, expression kind and brave.',
  },
  {
    id: 'forest_fairy',
    label: 'Forest Fairy',
    emoji: '🧚',
    description: 'Magical keeper of the woods',
    transformPrompt: 'Transform this photo into a soft, ethereal, dreamlike children\'s book illustration. The person as a radiant forest fairy centred in frame, with translucent wings glowing like moonlight, surrounded by fireflies and moonflowers. Luminous frosted watercolour, soft greens and violet pastels, dreamy bokeh, gossamer light. Face recognisable, serene expression.',
  },
  {
    id: 'ocean_explorer',
    label: 'Ocean Explorer',
    emoji: '🐋',
    description: 'Adventurer of the deep seas',
    transformPrompt: 'Transform this photo into a soft, ethereal, dreamlike children\'s book illustration. The person as an ocean explorer centred in frame, surrounded by gentle glowing jellyfish and coral in a magical underwater world. Frosted watercolour style, deep dreamy blues and teals, bioluminescent bokeh, crystalline light rays. Face recognisable, wonder-filled expression.',
  },
];

// ──────────────────────────────────────────────────────────
// Quiet Time Reflection Questions builder
// ──────────────────────────────────────────────────────────
export function buildReflectionQuestionsPrompt(
  storyTitle: string,
  storyContent: string,
  childName: string,
  lifeNotes?: string | null
): string {
  const lifeContext = lifeNotes
    ? `Things about ${childName} right now: ${lifeNotes}.`
    : '';
  const storyExcerpt = storyContent.slice(0, 300);
  return `
Gentle bedtime companion. 2 reflection questions for ${childName} after "${storyTitle}".
Excerpt: "${storyExcerpt}…"${lifeContext ? ` ${lifeContext}` : ''}

RULES: Tender, open-ended, calming. Use "you". Max 12 words each.
Return ONLY 2 questions, one per line. No numbering, no extra text.
`.trim();
}

// ──────────────────────────────────────────────────────────
// Welcome Home Greeting builder
// ──────────────────────────────────────────────────────────
export function buildWelcomeGreetingPrompt(
  narratorPersonality: NarratorPersonality,
  childName: string,
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
): string {
  const greeting = timeOfDay === 'morning' ? 'Good morning' :
    timeOfDay === 'afternoon' ? 'Good afternoon' :
    timeOfDay === 'evening' ? 'Good evening' : 'Good night';
  const styleHint: Record<NarratorStyle, string> = {
    whisper:       'hushed, celestial, breathy with ellipses',
    wise:          'warm, earthy, gentle forest wisdom',
    enthusiastic:  'bright and joyful but softly welcoming',
    'slow-paced':  'slow rhythmic, calming, with gentle pauses',
    dramatic:      'epic but tender, warm and safe',
  };
  return `
You are ${narratorPersonality.name} ${narratorPersonality.species} (${styleHint[narratorPersonality.style]}).
${greeting}, ${childName} has just opened their bedtime story app.
Write exactly 2 sentences (≤40 words): first warmly greet them as if you missed them; second invite them to start a story tonight.
No title, no formatting — plain greeting text only.
`.trim();
}

// ──────────────────────────────────────────────────────────
// Story Growth Themes extractor
// ──────────────────────────────────────────────────────────
export function buildGrowthThemesPrompt(storyTitles: string[], storyContents: string[]): string {
  const stories = storyTitles.slice(0, 5).map((title, i) =>
    `Story ${i + 1}: "${title}" — ${(storyContents[i] ?? '').slice(0, 150)}...`
  ).join('\n');

  return `
Identify 3 growth themes across these bedtime stories.
${stories}

Return ONLY a JSON array — no other text:
[{"theme":"Name","emoji":"emoji","description":"max 12 words","count":N}]
Themes: Kindness, Bravery, Friendship, Curiosity, Compassion, Creativity, Perseverance, Gratitude, Love, Wonder.
`.trim();
}

// ──────────────────────────────────────────────────────────
// Interactive Adventure Story builder
// Generates 3 paragraphs + a choice point for branching stories
// ──────────────────────────────────────────────────────────
export interface ChoiceOption {
  emoji: string;
  label: string;
  value: string;
}

export function buildInteractiveStoryPrompt(
  input: StoryGenerationInput,
  language?: string
): string {
  const { child, theme, narratorPersonality } = input;
  const interests = child.interests.length > 0
    ? `Their favourite themes are: ${child.interests.join(', ')}.`
    : '';
  const lifeNotes = child.life_notes
    ? `Important things about them today: ${child.life_notes}.`
    : '';
  const ageText = child.age ? `${child.age}-year-old` : 'young';
  const narratorGuide = narratorPersonality ? buildNarratorStyleGuide(narratorPersonality.style) : '';
  const narratorIntro = narratorPersonality
    ? `You are ${narratorPersonality.name} ${narratorPersonality.species}, narrating in the "${narratorPersonality.style}" style.`
    : '';
  const langNote = language && language !== 'en'
    ? `IMPORTANT: Write the entire story in ${LANGUAGE_NAMES[language] ?? language}. The narrator character and their personality must be preserved, but the language must be ${LANGUAGE_NAMES[language] ?? language}.`
    : '';

  return `
${narratorIntro}${langNote ? `\n${langNote}` : ''}
Interactive bedtime adventure, first part, for ${ageText} ${child.name}.
${interests}${lifeNotes}${theme ? `Theme: ${theme}.` : ''}

3 paragraphs (2–3 sentences each, 100–140 words total). P3 ends at a magical choice moment.
After P3, append:

[CHOICE_POINT]
PATH_A_EMOJI: [emoji]
PATH_A_LABEL: [4–6 word label]
PATH_A_HINT: [one calming sentence]
PATH_B_EMOJI: [emoji]
PATH_B_LABEL: [4–6 word label]
PATH_B_HINT: [one calming sentence]
[/CHOICE_POINT]

Both paths: safe, calming, good outcome. Simple dreamy language.
${narratorGuide}
`.trim();
}

// ──────────────────────────────────────────────────────────
// Story Branch continuation builder
// Generates the conclusion after a child makes a choice
// ──────────────────────────────────────────────────────────
export function buildStoryBranchPrompt(
  storyStart: string,
  chosenPath: string,
  childName: string,
  narratorPersonality?: NarratorPersonality,
  language?: string
): string {
  const narratorGuide = narratorPersonality ? buildNarratorStyleGuide(narratorPersonality.style) : '';
  const narratorIntro = narratorPersonality
    ? `You are ${narratorPersonality.name} ${narratorPersonality.species}.`
    : '';
  const langNote = language && language !== 'en'
    ? `IMPORTANT: Write entirely in ${LANGUAGE_NAMES[language] ?? language}.`
    : '';

  // Trim context to only first 400 chars — enough to preserve voice, minimal tokens
  const contextSnippet = storyStart.slice(0, 400);

  return `
${narratorIntro}
${langNote}
Continue this bedtime story for ${childName}. Chosen path: "${chosenPath}".

Story context:
${contextSnippet}…

STRUCTURE — 2 paragraphs, 80–100 words total:
- Para 1 (3 sentences): Adventure continues gently on the chosen path. Calming.
- Para 2 (3 sentences): SLEEPY ENDING — eyes heavy, breathing slow, drift to sleep. Rhythmic, repetitive. End with one very short tender sentence.

RULES: Warm, safe, soothing. Max 50 words per paragraph. No new characters or plot twists.
${narratorGuide}
`.trim();
}

// ──────────────────────────────────────────────────────────
// Language translation builder
// Translates story content while preserving narrator personality
// ──────────────────────────────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', emoji: '🇬🇧', nativeName: 'English' },
  { code: 'es', label: 'Spanish', emoji: '🇪🇸', nativeName: 'Español' },
  { code: 'fr', label: 'French', emoji: '🇫🇷', nativeName: 'Français' },
  { code: 'de', label: 'German', emoji: '🇩🇪', nativeName: 'Deutsch' },
] as const;

export type LanguageCode = 'en' | 'es' | 'fr' | 'de';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
};

export function buildTranslationPrompt(
  content: string,
  targetLanguage: LanguageCode,
  narratorPersonality?: NarratorPersonality
): string {
  const narratorNote = narratorPersonality
    ? `The text was originally narrated by ${narratorPersonality.name} ${narratorPersonality.species} in a "${narratorPersonality.style}" style. Preserve this personality and tone in the translation.`
    : '';

  return `
Translate this children's bedtime story into ${LANGUAGE_NAMES[targetLanguage]}.
${narratorNote}
Rules: warm soothing tone, preserve paragraph breaks, child-appropriate vocabulary, leave [CHOICE_POINT] markers unchanged. Return ONLY the translation.

${content}
`.trim();
}
