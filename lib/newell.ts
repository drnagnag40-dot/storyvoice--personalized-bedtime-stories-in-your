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
}

export interface GeneratedStory {
  title: string;
  paragraphs: string[];
  imagePrompt: string;
}

// ──────────────────────────────────────────────────────────
// Story prompt builder – turns child profile into a
// rich, personalised story prompt for Newell AI
// ──────────────────────────────────────────────────────────
export function buildStoryPrompt(input: StoryGenerationInput): string {
  const { child, theme, mood } = input;

  const interests =
    child.interests.length > 0
      ? `Their favourite themes are: ${child.interests.join(', ')}.`
      : '';

  const lifeNotes = child.life_notes
    ? `Important things about them today: ${child.life_notes}.`
    : '';

  const ageText = child.age ? `${child.age}-year-old` : 'young';

  return `
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
