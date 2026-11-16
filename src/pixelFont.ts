import Phaser from 'phaser';

/**
 * The game's font: a 5x7 pixel font on a 6x8 grid, drawn at boot and used
 * through PixelText (a BitmapText that takes the same style options the
 * scenes used with Phaser's Text). It only scales by whole steps, so it stays
 * sharp; lowercase is shown as capitals.
 */

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
  // Arrows for hints (drawn in place of < > ^ v where a string asks for them).
  '^': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '.....'],
};

const CHARS = Object.keys(GLYPHS).join('');
const CELL_W = 6;
const CELL_H = 8;
const PER_ROW = 16;
export const PIXEL_FONT = 'pixel';
/** The registered font's base size (RetroFont uses the cell width); scale = size / BASE. */
const BASE = CELL_W;

/** Draw the glyph sheet and register it as a bitmap font. Call once at boot. */
export function makePixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const rows = Math.ceil(CHARS.length / PER_ROW);
  const tex = scene.textures.createCanvas('pixfont', PER_ROW * CELL_W, rows * CELL_H)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  [...CHARS].forEach((ch, i) => {
    const ox = (i % PER_ROW) * CELL_W;
    const oy = Math.floor(i / PER_ROW) * CELL_H;
    GLYPHS[ch].forEach((row, y) => [...row].forEach((p, x) => p === '#' && ctx.fillRect(ox + x, oy + y, 1, 1)));
  });
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'pixfont',
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: PER_ROW,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 2,
  } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
  scene.cache.bitmapFont.add(PIXEL_FONT, data);
}

export interface PixelTextStyle {
  fontSize?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  fontFamily?: string;
  align?: string;
  // Accepted for compatibility with the old Text styles; the pixel font has no use for them.
  fontStyle?: string;
  backgroundColor?: string;
  padding?: unknown;
  lineSpacing?: number;
}

/** Whole-step scale for a CSS-style size: up to 12px is 1x, 20px 2x, and so on. */
function scaleFor(fontSize: string | number | undefined): number {
  const px = typeof fontSize === 'number' ? fontSize : parseInt(fontSize ?? '8', 10) || 8;
  return px <= 12 ? 1 : px <= 20 ? 2 : px <= 28 ? 3 : 4;
}

const tint = (css: string) => parseInt(css.replace('#', ''), 16);

/** BitmapText with the Text-style API the scenes use. Lowercase shows as capitals. */
export class PixelText extends Phaser.GameObjects.BitmapText {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle = {}) {
    super(scene, x, y, PIXEL_FONT, text.toUpperCase(), BASE * scaleFor(style.fontSize));
    if (style.color) this.setTint(tint(style.color));
    // An outline in the old style becomes a 1px drop shadow (crisper at this size).
    if (style.stroke || style.backgroundColor) this.setDropShadow(1, 1, tint(style.stroke ?? '#000000'), 1);
    if (style.align) this.setAlign(style.align);
    scene.add.existing(this);
  }

  setText(value: string | string[]): this {
    return super.setText(Array.isArray(value) ? value.map((v) => v.toUpperCase()) : String(value).toUpperCase());
  }

  setColor(css: string): this {
    return this.setTint(tint(css));
  }

  setFontSize(size: number | string): this {
    return super.setFontSize(BASE * scaleFor(size));
  }

  setAlign(align: string): this {
    this.align = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    return this;
  }
}

/** Drop-in for scene.add.text(x, y, text, style). */
export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle = {}): PixelText {
  return new PixelText(scene, x, y, text, style);
}
