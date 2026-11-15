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
  electric: { post: number; arc: number; glow: number };
  lava: { base: number; light: number; dark: number };
  conveyor: { belt: number; arrow: number };
  water: { color: number };
  /** Background layer style and its colors. */
  bg: { style: 'skyline' | 'trees' | 'mountains' | 'clouds' | 'circuit' | 'volcano' | 'scrapheap' | 'reef' | 'fortress' | 'city'; far: number; near: number; detail: number };
}

/** Tiles most themes don't restyle. */
const COMMON = {
  ice: { base: 0x9ee0f8, light: 0xe6f8ff, dark: 0x4aa8d8 },
  cloud: { base: 0xffffff, shade: 0xc8d8f0 },
  electric: { post: 0x55607a, arc: 0xfff8a0, glow: 0x8af0ff },
  lava: { base: 0xe8501a, light: 0xffc040, dark: 0x9a2010 },
  conveyor: { belt: 0x3a3a44, arrow: 0xffc040 },
  water: { color: 0x2a78d8 },
};

export const THEMES: Record<ThemeId, Theme> = {
  foundry: {
    ...COMMON,
    sky: '#141626',
    solid: { base: 0x3e5068, light: 0x6b85a6, dark: 0x232c3c, accent: 0x8aa2c2 },
    ladder: { rail: 0xc9a227, rung: 0xe8c350 },
    spike: { light: 0xd0d8e0, dark: 0x7a8494 },
    bg: { style: 'skyline', far: 0x1f2340, near: 0x2c3260, detail: 0x9aa0d0 },
  },
  jungle: {
    ...COMMON,
    sky: '#0e2218',
    solid: { base: 0x5a3e2a, light: 0x7a5a3a, dark: 0x3a2618, accent: 0x8a6a4a, top: 0x4ca04a, topShade: 0x2e7a34 },
    ladder: { rail: 0x2e7a34, rung: 0x6cc04a },
    spike: { light: 0xb08a4a, dark: 0x5a3e1a },
    bg: { style: 'trees', far: 0x13301f, near: 0x1b4229, detail: 0x2a5a36 },
  },
  ice: {
    ...COMMON,
    sky: '#0f1a33',
    solid: { base: 0x4a5a7a, light: 0x8aa0c8, dark: 0x2a3450, accent: 0x6a7a9a, top: 0xeef6ff, topShade: 0xb8cce8 },
    ladder: { rail: 0x9ab0c8, rung: 0xd8e6f4 },
    spike: { light: 0xdff4ff, dark: 0x7ab8e0 },
    ice: { base: 0x8ad4f4, light: 0xe6f8ff, dark: 0x3a98d0 },
    bg: { style: 'mountains', far: 0x1c2a4c, near: 0x2a3c66, detail: 0xc8d8f0 },
  },
  sky: {
    ...COMMON,
    sky: '#5a9ee6',
    solid: { base: 0x8a98b8, light: 0xc8d4ec, dark: 0x4a5878, accent: 0xe8eef8 },
    ladder: { rail: 0xc9a227, rung: 0xe8c350 },
    spike: { light: 0xe8eef8, dark: 0x8a98b8 },
    cloud: { base: 0xffffff, shade: 0xc4dcf4 },
    bg: { style: 'clouds', far: 0x84bdf2, near: 0xb4d8fa, detail: 0xffffff },
  },
  power: {
    ...COMMON,
    sky: '#0a0f1c',
    solid: { base: 0x2e3a4a, light: 0x4e6a7e, dark: 0x161e2a, accent: 0xf8e040 },
    ladder: { rail: 0x8a8fa8, rung: 0xc8ccd8 },
    spike: { light: 0xf8e040, dark: 0x9a8a20 },
    bg: { style: 'circuit', far: 0x121c30, near: 0x1c2c48, detail: 0x3aa8c8 },
  },
  volcano: {
    ...COMMON,
    sky: '#1a0806',
    solid: { base: 0x4a2a24, light: 0x7a4a3a, dark: 0x2a1410, accent: 0xe8501a },
    ladder: { rail: 0x5a5a64, rung: 0x8a8a94 },
    spike: { light: 0xd8c8b8, dark: 0x6a5a4a },
    bg: { style: 'volcano', far: 0x2e100a, near: 0x461a10, detail: 0xff7a2a },
  },
  scrap: {
    ...COMMON,
    sky: '#2a1e18',
    solid: { base: 0x6a5040, light: 0x9a7a5a, dark: 0x3a2a20, accent: 0xc89a5a },
    ladder: { rail: 0x8a8fa8, rung: 0xc8ccd8 },
    spike: { light: 0xc8c0b0, dark: 0x6a6050 },
    bg: { style: 'scrapheap', far: 0x3a2a22, near: 0x4e3a2c, detail: 0x8a6a4a },
  },
  water: {
    ...COMMON,
    sky: '#0a2a44',
    solid: { base: 0x3a6a6a, light: 0x6aa8a0, dark: 0x1a3a40, accent: 0xff8aa8 },
    ladder: { rail: 0xc9a227, rung: 0xe8c350 },
    spike: { light: 0xff8aa8, dark: 0xa84a6a },
    water: { color: 0x2a88e8 },
    bg: { style: 'reef', far: 0x0e3654, near: 0x16466a, detail: 0x3a8ab8 },
  },
  // Intro street: orange, green and white.
  city: {
    ...COMMON,
    sky: '#d8ecf4',
    solid: { base: 0xe8e4dc, light: 0xffffff, dark: 0x9a958c, accent: 0xf07a28, top: 0x2e9a4a, topShade: 0x1e6a34 },
    ladder: { rail: 0xf07a28, rung: 0xffffff },
    spike: { light: 0xffffff, dark: 0x9a958c },
    bg: { style: 'city', far: 0xf4f1ea, near: 0x2e9a4a, detail: 0xf07a28 },
  },
  fortress: {
    ...COMMON,
    sky: '#0c0612',
    solid: { base: 0x3a2a4a, light: 0x6a4a8a, dark: 0x1a1024, accent: 0xff5050 },
    ladder: { rail: 0x8a8fa8, rung: 0xc8ccd8 },
    spike: { light: 0xe8d8f8, dark: 0x7a6a8a },
    bg: { style: 'fortress', far: 0x1a1024, near: 0x261838, detail: 0xff5050 },
  },
};
