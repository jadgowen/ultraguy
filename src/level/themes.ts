import type { ThemeId } from './Level';

/** Colors for a stage's tileset and background (drawn in textures.ts). */
export interface Theme {
  /** Camera clear color behind everything. */
  sky: string;
  solid: { base: number; light: number; dark: number; accent: number; top?: number; topShade?: number };
  ladder: { rail: number; rung: number };
  spike: { light: number; dark: number };
  ice: { base: number; light: number; dark: number };
  cloud: { base: number; shade: number };
  /** Background layer style and its colors. */
  bg: { style: 'skyline' | 'trees' | 'mountains' | 'clouds'; far: number; near: number; detail: number };
}

export const THEMES: Record<ThemeId, Theme> = {
  foundry: {
    sky: '#141626',
    solid: { base: 0x3e5068, light: 0x6b85a6, dark: 0x232c3c, accent: 0x8aa2c2 },
    ladder: { rail: 0xc9a227, rung: 0xe8c350 },
    spike: { light: 0xd0d8e0, dark: 0x7a8494 },
    ice: { base: 0x9ee0f8, light: 0xe6f8ff, dark: 0x4aa8d8 },
    cloud: { base: 0xffffff, shade: 0xc8d8f0 },
    bg: { style: 'skyline', far: 0x1f2340, near: 0x2c3260, detail: 0x9aa0d0 },
  },
  jungle: {
    sky: '#0e2218',
    solid: { base: 0x5a3e2a, light: 0x7a5a3a, dark: 0x3a2618, accent: 0x8a6a4a, top: 0x4ca04a, topShade: 0x2e7a34 },
    ladder: { rail: 0x2e7a34, rung: 0x6cc04a },
    spike: { light: 0xb08a4a, dark: 0x5a3e1a },
    ice: { base: 0x9ee0f8, light: 0xe6f8ff, dark: 0x4aa8d8 },
    cloud: { base: 0xffffff, shade: 0xc8d8f0 },
    bg: { style: 'trees', far: 0x13301f, near: 0x1b4229, detail: 0x2a5a36 },
  },
  ice: {
    sky: '#0f1a33',
    solid: { base: 0x4a5a7a, light: 0x8aa0c8, dark: 0x2a3450, accent: 0x6a7a9a, top: 0xeef6ff, topShade: 0xb8cce8 },
    ladder: { rail: 0x9ab0c8, rung: 0xd8e6f4 },
    spike: { light: 0xdff4ff, dark: 0x7ab8e0 },
    ice: { base: 0x8ad4f4, light: 0xe6f8ff, dark: 0x3a98d0 },
    cloud: { base: 0xffffff, shade: 0xc8d8f0 },
    bg: { style: 'mountains', far: 0x1c2a4c, near: 0x2a3c66, detail: 0xc8d8f0 },
  },
  sky: {
    sky: '#5a9ee6',
    solid: { base: 0x8a98b8, light: 0xc8d4ec, dark: 0x4a5878, accent: 0xe8eef8 },
    ladder: { rail: 0xc9a227, rung: 0xe8c350 },
    spike: { light: 0xe8eef8, dark: 0x8a98b8 },
    ice: { base: 0x9ee0f8, light: 0xe6f8ff, dark: 0x4aa8d8 },
    cloud: { base: 0xffffff, shade: 0xc4dcf4 },
    bg: { style: 'clouds', far: 0x84bdf2, near: 0xb4d8fa, detail: 0xffffff },
  },
};
