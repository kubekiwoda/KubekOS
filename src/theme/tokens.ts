/**
 * KubekOS Design System — OBSIDIAN AURORA Edition
 * Centralized visual tokens: color palettes, typography scales, elevation & shadow presets,
 * layered glassmorphism surfaces, procedural wallpapers, and spring motion physics.
 */

import type { Transition } from 'framer-motion';
import type {
  AccentColorId,
  AccentColorToken,
  MotionQualityTier,
  WallpaperId,
  WallpaperPreset,
} from '@/types/os';

// ============================================================================
// 1. ACCENT COLOR TOKENS (OBSIDIAN AURORA PALETTE)
// ============================================================================

export const ACCENT_COLORS: Record<AccentColorId, AccentColorToken> = {
  cyan: {
    id: 'cyan',
    label: 'Electric Cyan',
    primaryHex: '#00f0ff',
    ringClass: 'ring-cyan-400/60',
    bgClass: 'bg-cyan-400',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-400/50',
    subtleBgClass: 'bg-cyan-400/15',
  },
  blue: {
    id: 'blue',
    label: 'Hyper Cobalt',
    primaryHex: '#3b82f6',
    ringClass: 'ring-blue-500/60',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/50',
    subtleBgClass: 'bg-blue-500/15',
  },
  indigo: {
    id: 'indigo',
    label: 'Dr460n Indigo',
    primaryHex: '#6366f1',
    ringClass: 'ring-indigo-500/60',
    bgClass: 'bg-indigo-500',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/50',
    subtleBgClass: 'bg-indigo-500/15',
  },
  emerald: {
    id: 'emerald',
    label: 'Aurora Emerald',
    primaryHex: '#10b981',
    ringClass: 'ring-emerald-500/60',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/50',
    subtleBgClass: 'bg-emerald-500/15',
  },
  amber: {
    id: 'amber',
    label: 'Solar Plasma',
    primaryHex: '#f59e0b',
    ringClass: 'ring-amber-500/60',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/50',
    subtleBgClass: 'bg-amber-500/15',
  },
  rose: {
    id: 'rose',
    label: 'Crimson Pulse',
    primaryHex: '#f43f5e',
    ringClass: 'ring-rose-500/60',
    bgClass: 'bg-rose-500',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/50',
    subtleBgClass: 'bg-rose-500/15',
  },
  violet: {
    id: 'violet',
    label: 'Hypr Violet',
    primaryHex: '#a855f7',
    ringClass: 'ring-violet-500/60',
    bgClass: 'bg-violet-500',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-500/50',
    subtleBgClass: 'bg-violet-500/15',
  },
};

// ============================================================================
// 2. OBSIDIAN AURORA WALLPAPER PRESETS
// ============================================================================

export const WALLPAPER_PRESETS: Record<WallpaperId, WallpaperPreset> = {
  'nebula-dark': {
    id: 'nebula-dark',
    name: 'Obsidian Aurora',
    description: 'Deep volcanic obsidian canvas illuminated by electric cyan and midnight violet aurora currents.',
    cssBackground:
      'radial-gradient(circle at 16% 18%, rgba(6, 182, 212, 0.24) 0%, transparent 42%), radial-gradient(circle at 84% 78%, rgba(139, 92, 246, 0.22) 0%, transparent 48%), radial-gradient(circle at 50% 45%, rgba(30, 58, 138, 0.18) 0%, transparent 65%), linear-gradient(145deg, #04060d 0%, #070b18 52%, #03050a 100%)',
    previewAccent: 'cyan',
    recommendedMode: 'dark',
  },
  'arctic-aurora': {
    id: 'arctic-aurora',
    name: 'Dr460n Cyber Horizon',
    description: 'High-contrast gaming-inspired midnight indigo with electric magenta and cyan energy filaments.',
    cssBackground:
      'radial-gradient(ellipse at 20% 15%, rgba(244, 63, 94, 0.20) 0%, transparent 48%), radial-gradient(ellipse at 82% 80%, rgba(6, 182, 212, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.14) 0%, transparent 60%), linear-gradient(160deg, #050511 0%, #0a0c20 55%, #04040c 100%)',
    previewAccent: 'violet',
    recommendedMode: 'dark',
  },
  'obsidian-grid': {
    id: 'obsidian-grid',
    name: 'Hyprland Spatial Matrix',
    description: 'Precision carbon-obsidian architectural surface tuned for tiling and multi-window clarity.',
    cssBackground:
      'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.18) 0%, transparent 55%), radial-gradient(circle at 12% 88%, rgba(99, 102, 241, 0.14) 0%, transparent 45%), linear-gradient(180deg, #070b14 0%, #04060c 100%)',
    previewAccent: 'blue',
    recommendedMode: 'dark',
  },
  'sunset-horizon': {
    id: 'sunset-horizon',
    name: 'Plasma Crimson Dusk',
    description: 'Warm solar amber and crimson atmospheric bloom over deep obsidian glass.',
    cssBackground:
      'radial-gradient(circle at 82% 18%, rgba(244, 63, 94, 0.22) 0%, transparent 46%), radial-gradient(circle at 18% 82%, rgba(245, 158, 11, 0.16) 0%, transparent 50%), linear-gradient(145deg, #0f0718 0%, #060710 100%)',
    previewAccent: 'rose',
    recommendedMode: 'dark',
  },
  'forest-mist': {
    id: 'forest-mist',
    name: 'Zorin Emerald Depth',
    description: 'Refined bioluminescent emerald and deep abyssal teal for calm, focused engineering.',
    cssBackground:
      'radial-gradient(circle at 26% 24%, rgba(16, 185, 129, 0.20) 0%, transparent 50%), radial-gradient(circle at 78% 74%, rgba(6, 182, 212, 0.15) 0%, transparent 50%), linear-gradient(135deg, #040d0e 0%, #07141a 55%, #03070a 100%)',
    previewAccent: 'emerald',
    recommendedMode: 'dark',
  },
  'minimal-slate': {
    id: 'minimal-slate',
    name: 'Zorin Polar Alabaster',
    description: 'Crisp architectural pearl and cool sky-glass reflections for high-ambient workspaces.',
    cssBackground:
      'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.22) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.18) 0%, transparent 50%), linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
    previewAccent: 'blue',
    recommendedMode: 'light',
  },
};

// ============================================================================
// 3. SYSTEM-WIDE DESIGN SYSTEM TOKENS (GLASS, ELEVATION, SPACING, MOTION)
// ============================================================================

export const DESIGN_TOKENS = {
  glass: {
    panel: 'bg-[#070b14]/80 backdrop-blur-2xl border border-white/[0.08]',
    dock: 'bg-[#060a12]/85 backdrop-blur-2xl border border-white/[0.11] shadow-[0_20px_50px_rgba(0,0,0,0.85)]',
    windowFocused:
      'bg-[#080d1a]/92 backdrop-blur-2xl border border-white/[0.14] shadow-[0_28px_70px_-12px_rgba(0,0,0,0.92)]',
    windowUnfocused:
      'bg-[#060913]/82 backdrop-blur-xl border border-white/[0.06] shadow-[0_14px_35px_-10px_rgba(0,0,0,0.65)]',
    popover:
      'bg-[#080c18]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.88)]',
    surfaceSubtle: 'bg-white/[0.03] border border-white/[0.06]',
  },
  radius: {
    window: 'rounded-2xl',
    dock: 'rounded-2xl',
    panel: 'rounded-xl',
    control: 'rounded-lg',
    pill: 'rounded-full',
  },
  iconSize: {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  },
} as const;

export interface MotionPhysicsPreset {
  windowOpenSpring: Transition;
  windowMorphSpring: Transition;
  dockMagnifySpring: Transition;
  menuPopoverSpring: Transition;
  workspaceSlideSpring: Transition;
  enableParallax: boolean;
  enableAmbientGlow: boolean;
  enableDockMagnification: boolean;
}

export function getMotionPreset(
  tier: MotionQualityTier,
  reducedMotionFlag: boolean
): MotionPhysicsPreset {
  if (reducedMotionFlag || tier === 'REDUCED_MOTION') {
    const instant: Transition = { duration: 0.01 };
    return {
      windowOpenSpring: instant,
      windowMorphSpring: instant,
      dockMagnifySpring: instant,
      menuPopoverSpring: instant,
      workspaceSlideSpring: instant,
      enableParallax: false,
      enableAmbientGlow: false,
      enableDockMagnification: false,
    };
  }

  if (tier === 'STANDARD') {
    return {
      windowOpenSpring: { duration: 0.16, ease: 'easeOut' },
      windowMorphSpring: { duration: 0.18, ease: 'easeInOut' },
      dockMagnifySpring: { type: 'spring', stiffness: 360, damping: 28 },
      menuPopoverSpring: { duration: 0.14, ease: 'easeOut' },
      workspaceSlideSpring: { duration: 0.22, ease: 'easeOut' },
      enableParallax: false,
      enableAmbientGlow: true,
      enableDockMagnification: false,
    };
  }

  if (tier === 'ENHANCED') {
    return {
      windowOpenSpring: { type: 'spring', stiffness: 380, damping: 28, mass: 0.85 },
      windowMorphSpring: { type: 'spring', stiffness: 340, damping: 30 },
      dockMagnifySpring: { type: 'spring', stiffness: 420, damping: 24 },
      menuPopoverSpring: { type: 'spring', stiffness: 440, damping: 30 },
      workspaceSlideSpring: { type: 'spring', stiffness: 320, damping: 30 },
      enableParallax: false,
      enableAmbientGlow: true,
      enableDockMagnification: true,
    };
  }

  // EXTREME (Default flagship Obsidian Aurora experience)
  return {
    windowOpenSpring: { type: 'spring', stiffness: 410, damping: 26, mass: 0.8 },
    windowMorphSpring: { type: 'spring', stiffness: 360, damping: 28, mass: 0.85 },
    dockMagnifySpring: { type: 'spring', stiffness: 480, damping: 22, mass: 0.6 },
    menuPopoverSpring: { type: 'spring', stiffness: 460, damping: 27, mass: 0.75 },
    workspaceSlideSpring: { type: 'spring', stiffness: 330, damping: 28, mass: 0.9 },
    enableParallax: true,
    enableAmbientGlow: true,
    enableDockMagnification: true,
  };
}
