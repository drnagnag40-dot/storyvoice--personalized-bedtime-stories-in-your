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
Write a warm, soothing 5-paragraph bedtime story for a ${ageText} child named ${child.name}.
${interests}
${lifeNotes}
${theme ? `Story theme: ${theme}.` : ''}
${mood ? `Story mood: ${mood}.` : 'The story should be calming and end with the child falling happily asleep.'}

Format the story in exactly 5 short paragraphs, each 2-3 sentences.
Use simple, vivid language appropriate for a child.
End with the child character drifting off to sleep in a cozy, safe place.
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
