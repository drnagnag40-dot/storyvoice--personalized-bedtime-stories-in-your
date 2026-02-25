export const Colors = {
  // ── Legacy palette (kept for backwards compatibility) ──
  midnightNavy: '#1A1B41',
  deepPurple: '#2D1B69',
  deepSpace: '#0D0E24',
  moonlightCream: '#F5F5DC',
  celestialGold: '#FFD700',
  softGold: '#FFC857',
  starWhite: '#FFFDE7',
  softPurple: '#6B48B8',
  mediumPurple: '#4A3880',
  accentPink: '#FF6B9D',
  softBlue: '#7EC8E3',
  errorRed: '#FF6B6B',
  successGreen: '#6BCB77',
  textLight: '#E8E8F0',
  textMuted: '#9999BB',
  cardBg: '#252655',
  inputBg: '#1F2050',
  borderColor: '#3D3F7A',

  // ── Crystal Night palette ──
  deepIndigo: '#0E0820',           // Darkest background
  indigoMid: '#180D38',            // Mid breathing gradient
  midnightPurple: '#2A1155',       // Lighter breathing gradient
  crystalPurple: '#3D1A6E',        // Bright accent purple
  crystalViolet: '#5B2D8A',        // Vivid crystal tone

  // Glass surfaces
  glassWhite: 'rgba(255,255,255,0.07)',      // Base glass panel
  glassWhiteStrong: 'rgba(255,255,255,0.12)', // Elevated glass
  glassDark: 'rgba(14,8,32,0.6)',            // Dark glass (modals)
  glassDarkStrong: 'rgba(14,8,32,0.82)',     // Heavy dark glass overlay
  glassGold: 'rgba(255,215,0,0.08)',         // Gold-tinted glass

  // Reflective borders
  glassBorder: 'rgba(255,255,255,0.14)',     // Standard 1px reflective border
  glassBorderBright: 'rgba(255,255,255,0.25)', // Bright reflective edge
  glassBorderGold: 'rgba(255,215,0,0.22)',   // Gold reflective border

  // Glow colours
  glowGold: '#FFD700',
  glowPurple: '#9B6FDE',
  glowCyan: '#7EC8E3',

  // Typography
  crystalWhite: '#FFFFFF',
  crystalCream: '#F0EBF8',
  celestialGoldText: '#FFD700',
} as const;

export const Fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
} as const;

// ── Crystal Night gradient presets ──
export const Gradients = {
  breatheA: ['#0E0820', '#180D38', '#2A1155'] as [string, string, string],
  breatheB: ['#180D38', '#2A1155', '#3D1A6E'] as [string, string, string],
  glass: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)'] as [string, string],
  glassDark: ['rgba(14,8,32,0.75)', 'rgba(14,8,32,0.55)'] as [string, string],
  goldGlow: ['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)'] as [string, string],
  goldButton: ['#FFD700', '#FFC857', '#FFA500'] as [string, string, string],
  purpleGlow: ['rgba(107,72,184,0.45)', 'rgba(107,72,184,0.15)'] as [string, string],
} as const;
