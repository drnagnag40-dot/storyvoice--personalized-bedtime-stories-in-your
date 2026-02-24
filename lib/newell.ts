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
NARRATOR STYLE — WHISPER (Luna the Owl):
- Use minimal words. Each sentence should feel like a secret shared in the dark.
- Favour soft consonants (s, sh, l, m, n) over hard ones.
- Sentences should be short and breathy — never more than 10 words.
- Use ellipses (...) to imply pauses and silence.
- Words like: drift, hush, shimmer, veil, soft, still, feather-light, melt, fade.
- The tone is intimate and magical, like starlight itself is speaking.`.trim();

    case 'wise':
      return `
NARRATOR STYLE — WISE (Barnaby the Bear):
- Speak with the warmth of a grandmother by a fire, unhurried and certain.
- Use philosophical observations about nature, the stars, and the heart.
- Each paragraph should contain one piece of gentle wisdom, like a lesson.
- Use rich, descriptive language — metaphors comparing big things to small comforts.
- Words like: ancient, patient, truth, wonder, roots, sky, gentle, understanding.
- The tone is deep, assured, and tender — like the world itself is reassuring the child.`.trim();

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
- Exactly 5 paragraphs, each 2–4 sentences.
- Use simple, dreamy language a child can easily follow.
- No conflict, no peril, no exciting twists in paragraphs 4–5.
- The overall rhythm should slow progressively like a song fading out.

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
Write a single short paragraph (3–4 sentences) as a preview of your narration style for ${name}.
Style: ${personality.style}.
${buildNarratorStyleGuide(personality.style)}
Keep it magical, soothing, and under 60 words. No story title needed.
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
A soft, dreamlike children's book illustration of a cozy bedroom scene at night.
A sleeping child in a warm bed surrounded by ${interests || 'magical stars and animals'}.
Glowing nightlight, moonlight through curtains, whimsical and warm.
Story title: "${storyTitle}". Watercolour style, pastel colours, gentle and magical.
`.trim();
}
