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
  },
];

// ──────────────────────────────────────────────────────────
// Narrator style prompt modifiers
// ──────────────────────────────────────────────────────────

function buildNarratorStyleGuide(style: NarratorStyle): string {
  switch (style) {
    case 'whisper':
      return `
NARRATOR STYLE — LUNA THE OWL (wise · gentle · soothing):
- Luna is ancient and wise — she has watched over sleeping children for a thousand moonrises.
- Every sentence is a soft gift: short, breathy, never more than 10 words.
- Favour hushed consonants: s, sh, l, m, n. Avoid hard k, t, p sounds.
- Use ellipses (...) as gentle breathing pauses between thoughts.
- Weave in small, tender wisdom — one quiet truth per paragraph, like a feather landing.
- Sensory words: drift, hush, shimmer, veil, moonpool, feather-light, silver, still, melt.
- Tone: intimate and celestial, as if the night sky itself is whispering a lullaby.`.trim();

    case 'wise':
      return `
NARRATOR STYLE — BARNABY THE BEAR (warm · playful · forest-themed):
- Barnaby is a great old bear who lives in a mossy forest and knows its every secret.
- He speaks with earthy warmth — slow and unhurried, like honey dripping from a comb.
- Each paragraph carries one gentle forest-wisdom: lessons from the oak, the stream, the seasons.
- Use playful, affectionate touches — a rumbling chuckle, a fond nickname, a cosy bear metaphor.
- Rich forest imagery: honeycomb, pine needles, mossy logs, autumn leaves, a crackling hearth.
- Words like: roots, warm, patient, sturdy, cosy, amble, honey-golden, wonder, safe, den.
- Tone: like a beloved uncle bear tucking you in — deep, safe, and gently playful.`.trim();

    case 'enthusiastic':
      return `
NARRATOR STYLE — ENTHUSIASTIC (Cosmo the Star):
- Use exclamations and vivid, energetic language — BUT paragraphs 4 and 5 must calm down significantly!
- Paragraphs 1–3: Use lots of energy, bright adjectives, and excitement.
- Paragraphs 4–5: Slowly bring the energy down to a gentle, sleepy warmth. The enthusiasm fades into cozy.
- Use ALL CAPS sparingly for key exciting words in early paragraphs.
- Words like: amazing, wonderful, sparkling, incredible, magical, brilliant, glowing.
- The tone should feel like a best friend who gets really excited, then tucks you in gently.`.trim();

    case 'slow-paced':
      return `
NARRATOR STYLE — SLOW-PACED (Aria the Fairy):
- Write with deeply rhythmic, repetitive phrasing that mirrors breathing.
- Use commas and ellipses (...) frequently to create natural breathing pauses.
- Repeat calming phrases like refrains: "And so... they rested. Yes... they rested."
- Sentences should feel like they are moving in slow motion.
- Use repetition of soothing sounds and words throughout each paragraph.
- Words like: gentle, soft, slow, steady, breathing, resting, peaceful, drifting, floating.
- The tone mimics a lullaby — predictable, repetitive, hypnotically calming.`.trim();

    case 'dramatic':
      return `
NARRATOR STYLE — DRAMATIC (Rex the Dragon):
- Use vivid, epic, cinematic language — but it MUST still be a soothing bedtime story.
- Open with a grand, sweeping sentence that paints a world.
- Paragraphs 1–3: Use bold imagery, strong verbs, and a sense of grand adventure.
- Paragraphs 4–5: The epic world grows quiet and the hero rests. The drama becomes peaceful.
- Use strong, resonant words. Avoid anything scary or threatening.
- Words like: ancient, vast, legendary, golden, mighty, glorious, radiant, majestic.
- The tone is like an epic myth whispered at bedtime — grand but safe and warm.`.trim();

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
Write a warm, deeply soothing 5-paragraph bedtime story for a ${ageText} child named ${child.name}.
${interests}
${lifeNotes}
${theme ? `Story theme: ${theme}.` : ''}
${mood ? `Story mood: ${mood}.` : 'The story should be progressively calming, with each paragraph gentler and quieter than the last.'}

STRUCTURE:
- Paragraphs 1–3: A gentle adventure or exploration, written in soft, unhurried language. Each sentence should feel like a slow exhale.
- Paragraph 4: The world around the characters grows very quiet and still. Sounds fade. The pace slows to almost nothing. Use short, rhythmic sentences that mirror a child's breathing slowing down.
- Paragraph 5 (THE SLEEPY ENDING): This paragraph must be a gentle, rhythmic wind-down. Describe the main character's eyes growing heavy, their breathing slowing to a calm and steady rhythm. Use poetic, repetitive phrasing — soft pillows, warm blankets, the hush of night, fading starlight. The character should drift peacefully to sleep, carried away on a cloud of dreams, as the story whispers to a close. End with one final, tender sentence — very short, very quiet — like a lullaby's last note.

RULES:
- Exactly 5 paragraphs, each 2–4 sentences. Total story: 150–250 words maximum.
- Use simple, dreamy language a child can easily follow.
- No conflict, no peril, no exciting twists in paragraphs 4–5.
- The overall rhythm should slow progressively like a song fading out.
- Be concise. Every word must earn its place.

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
Write ONE short paragraph (2–3 sentences, 35–50 words) greeting ${name} in your unique voice.
${buildNarratorStyleGuide(personality.style)}
Output ONLY the paragraph — no title, no quotation marks, no extra text.
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
  return `
You are ${narratorPersonality.name} ${narratorPersonality.species}, the beloved StoryVoice narrator.
Write a warm, personal welcome greeting for ${childName} who has just opened the app.
Style: ${narratorPersonality.style}
Time of day: ${timeOfDay} (${greeting})

RULES:
- Exactly 2 sentences. Max 40 words total.
- Personal and magical — narrator genuinely missed ${childName}.
- Second sentence: gentle invitation to start a story.
- No title, no formatting — greeting text only.
${buildNarratorStyleGuide(narratorPersonality.style)}
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
${narratorIntro}
${langNote}
Write the FIRST PART of an interactive bedtime adventure for a ${ageText} child named ${child.name}.
${interests}
${lifeNotes}
${theme ? `Story theme: ${theme}.` : ''}

STRUCTURE:
- Write exactly 3 paragraphs. Each paragraph 2-3 sentences.
- The story introduces the setting and main character.
- Paragraph 3 ends at an exciting moment where the character must make a choice.
- After paragraph 3, write exactly this format on a new line:

[CHOICE_POINT]
PATH_A_EMOJI: [single emoji]
PATH_A_LABEL: [short choice label, 4-6 words]
PATH_A_HINT: [one sentence describing this path]
PATH_B_EMOJI: [single emoji]
PATH_B_LABEL: [short choice label, 4-6 words]
PATH_B_HINT: [one sentence describing this path]
[/CHOICE_POINT]

RULES:
- Exactly 3 paragraphs before the choice point. Total story text: 100–140 words.
- Both choices: safe, calming, lead to good outcome.
- Simple, dreamy language. Be concise — every word counts.
- The choice should feel magical and empowering.
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
Translate the following children's bedtime story into ${LANGUAGE_NAMES[targetLanguage]}.
${narratorNote}

RULES:
- Maintain the warm, gentle, soothing tone appropriate for a bedtime story.
- Preserve all paragraph breaks (blank lines between paragraphs).
- Keep the magical, dreamy quality of the language.
- Use child-appropriate vocabulary in ${LANGUAGE_NAMES[targetLanguage]}.
- Do NOT translate any [CHOICE_POINT] markers — leave them exactly as-is.
- Return ONLY the translated text, no explanations.

TEXT TO TRANSLATE:
${content}
`.trim();
}
