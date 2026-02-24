import React from 'react';
import Svg, {
  Rect, Circle, Ellipse, Path, Defs, RadialGradient, Stop, LinearGradient,
} from 'react-native-svg';

interface BedroomIllustrationProps {
  width?: number;
  height?: number;
}

export default function BedroomIllustration({ width = 320, height = 240 }: BedroomIllustrationProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 240">
      <Defs>
        <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFDE7" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#FFD700" stopOpacity="0.3" />
        </RadialGradient>
        <LinearGradient id="windowLight" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#1A2A5E" />
          <Stop offset="100%" stopColor="#0D0E24" />
        </LinearGradient>
        <LinearGradient id="bedShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6B48B8" />
          <Stop offset="100%" stopColor="#4A3880" />
        </LinearGradient>
        <RadialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFC857" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Floor */}
      <Rect x="0" y="175" width="320" height="65" fill="#1A1B41" />

      {/* Back wall */}
      <Rect x="0" y="0" width="320" height="180" fill="#14163A" />

      {/* Window */}
      <Rect x="110" y="20" width="100" height="120" rx="8" fill="url(#windowLight)" />
      {/* Window frame */}
      <Rect x="107" y="17" width="106" height="126" rx="10" fill="none" stroke="#3D3F7A" strokeWidth="4" />
      {/* Window cross */}
      <Rect x="107" y="78" width="106" height="3" fill="#3D3F7A" />
      <Rect x="159" y="17" width="3" height="126" fill="#3D3F7A" />

      {/* Moon in window */}
      <Circle cx="160" cy="75" r="30" fill="url(#moonGlow)" />
      <Circle cx="172" cy="65" r="22" fill="#1A2A5E" />

      {/* Stars in window */}
      <Circle cx="125" cy="35" r="1.5" fill="#FFFDE7" opacity="0.8" />
      <Circle cx="145" cy="28" r="1" fill="#FFFDE7" opacity="0.6" />
      <Circle cx="190" cy="40" r="1.5" fill="#FFFDE7" opacity="0.9" />
      <Circle cx="205" cy="30" r="1" fill="#FFFDE7" opacity="0.7" />
      <Circle cx="118" cy="55" r="1" fill="#FFD700" opacity="0.8" />
      <Circle cx="200" cy="55" r="1.5" fill="#FFD700" opacity="0.6" />

      {/* Left curtain */}
      <Path d="M 60 0 Q 110 30 95 90 Q 88 130 100 160 L 60 160 Z" fill="#4A3880" opacity="0.9" />
      <Path d="M 60 0 Q 85 25 80 70 Q 78 110 88 150 L 60 150 Z" fill="#6B48B8" opacity="0.7" />

      {/* Right curtain */}
      <Path d="M 260 0 Q 210 30 225 90 Q 232 130 220 160 L 260 160 Z" fill="#4A3880" opacity="0.9" />
      <Path d="M 260 0 Q 235 25 240 70 Q 242 110 232 150 L 260 150 Z" fill="#6B48B8" opacity="0.7" />

      {/* Curtain tie-backs */}
      <Ellipse cx="100" cy="95" rx="10" ry="6" fill="#FFD700" opacity="0.9" />
      <Ellipse cx="220" cy="95" rx="10" ry="6" fill="#FFD700" opacity="0.9" />

      {/* Bedside table */}
      <Rect x="230" y="148" width="60" height="45" rx="4" fill="#252655" />

      {/* Lamp base */}
      <Rect x="252" y="135" width="16" height="18" rx="2" fill="#3D3F7A" />
      {/* Lamp shade */}
      <Path d="M 245 115 L 275 115 L 268 135 L 252 135 Z" fill="#6B48B8" />
      {/* Lamp glow */}
      <Circle cx="260" cy="128" r="25" fill="url(#lampGlow)" />

      {/* Bed frame */}
      <Rect x="20" y="148" width="220" height="12" rx="6" fill="#3D3F7A" />
      <Rect x="20" y="155" width="220" height="60" rx="4" fill="url(#bedShade)" />

      {/* Pillow */}
      <Ellipse cx="100" cy="156" rx="45" ry="16" fill="#F5F5DC" opacity="0.9" />
      <Ellipse cx="100" cy="154" rx="43" ry="14" fill="#FFFDE7" opacity="0.8" />

      {/* Sleeping child (bump under covers) */}
      <Ellipse cx="130" cy="175" rx="50" ry="18" fill="#6B48B8" opacity="0.8" />

      {/* Blanket detail */}
      <Path d="M 80 170 Q 130 165 180 170" stroke="#FFD700" strokeWidth="1.5" fill="none" opacity="0.5" />
      <Path d="M 82 178 Q 130 173 178 178" stroke="#FFD700" strokeWidth="1.5" fill="none" opacity="0.5" />

      {/* Headboard */}
      <Rect x="15" y="120" width="14" height="45" rx="4" fill="#3D3F7A" />
      <Rect x="211" y="120" width="14" height="45" rx="4" fill="#3D3F7A" />
      <Rect x="12" y="110" width="216" height="16" rx="8" fill="#252655" />

      {/* Stars on floor (reflections) */}
      <Circle cx="50" cy="200" r="1" fill="#FFD700" opacity="0.3" />
      <Circle cx="290" cy="195" r="1" fill="#FFD700" opacity="0.3" />
      <Circle cx="280" cy="210" r="0.8" fill="#FFFDE7" opacity="0.3" />

      {/* Small decorative stars */}
      <Path d="M 30 30 L 33 23 L 36 30 L 43 30 L 37 35 L 39 42 L 33 37 L 27 42 L 29 35 L 23 30 Z" fill="#FFD700" opacity="0.7" />
      <Path d="M 285 50 L 287 44 L 289 50 L 295 50 L 290 54 L 292 60 L 287 56 L 282 60 L 284 54 L 279 50 Z" fill="#FFFDE7" opacity="0.6" />
    </Svg>
  );
}
