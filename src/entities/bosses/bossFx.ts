import Phaser from 'phaser';

/** A point on a boss sprite: an offset from its bottom-center, facing right. */
export type Spot = [number, number];

export interface BossFxFrame {
  /** The sprite's bottom-center in the world, and which way it faces. */
  x: number;
  bottom: number;
  facing: 1 | -1;
  /** The floor under it (for the shadow). */
  floor: number;
  /** A big warm glow (a furnace, a core). */
  core?: Spot;
  coreColor?: number;
  /** A smaller glow (eyes, a visor). */
  eye?: Spot;
  eyeColor?: number;
  /** Hot spots (fists, a cannon) that glow while `heat` is up. */
  hot?: Spot[];
  /** 0..1: how hot it's running (brighter glows, more embers). */
  heat: number;
  /** A muzzle flash this frame: where, and how strong (0..1). */
  muzzle?: Spot | null;
  flash?: number;
  /** Embers drift up off the core. */
  embers?: boolean;
  /** Crackling current between two spots (redrawn jagged every frame; `chance` it shows this frame). */
  arcs?: { a: Spot; b: Spot; chance: number; color?: number }[];
  visible: boolean;
}

const GLOW = 'fx_glow';
const EMBER = 'fx_ember';

function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(GLOW)) {
    const t = scene.textures.createCanvas(GLOW, 64, 64)!;
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    t.refresh();
  }
  if (!scene.textures.exists(EMBER)) {
    const t = scene.textures.createCanvas(EMBER, 2, 2)!;
    const ctx = t.getContext();
    ctx.fillStyle = '#ffe14a';
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#fff4c0';
    ctx.fillRect(0, 0, 1, 1);
    t.refresh();
  }
}

/**
 * The layer of light and life on top of a boss sprite: a soft shadow on the
 * floor (it shrinks as the boss leaves the ground), additive glows on its core
 * and eyes and on anything running hot, a muzzle flash, and embers drifting off
 * it. A boss feeds it one frame at a time (see Anvil for the first user).
 */
export class BossFx {
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly core: Phaser.GameObjects.Image;
  private readonly eye: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image;
  private hot: Phaser.GameObjects.Image[] = [];
  private readonly arcs: Phaser.GameObjects.Graphics;
  private embers: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; max: number }[] = [];
  private t = 0;

  constructor(private scene: Phaser.Scene, depth = 6) {
    makeTextures(scene);
    this.shadow = scene.add.ellipse(0, 0, 30, 5, 0x000000, 0.35).setDepth(depth - 0.2);
    const glow = () => scene.add.image(0, 0, GLOW).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.3).setVisible(false);
    this.core = glow();
    this.eye = glow();
    this.flash = glow();
    this.arcs = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.4);
  }

  update(f: BossFxFrame): void {
    this.t++;
    const at = (s: Spot) => ({ x: f.x + s[0] * f.facing, y: f.bottom + s[1] });
    // Shadow: smaller and fainter the higher it is.
    const air = Math.max(0, f.floor - f.bottom);
    const k = Math.max(0.35, 1 - air / 90);
    this.shadow.setPosition(f.x, f.floor - 1).setScale(k).setAlpha(0.35 * k).setVisible(f.visible);
    // The core breathes and flickers, and blazes as it heats up.
    if (f.core) {
      const p = at(f.core);
      const flick = 0.28 + Math.sin(this.t * 0.35) * 0.05 + Math.random() * 0.05 + f.heat * 0.17;
      this.core.setPosition(p.x, p.y).setTint(f.coreColor ?? 0xff8c28).setAlpha(flick).setScale(0.42 + f.heat * 0.14).setVisible(f.visible);
    } else this.core.setVisible(false);
    if (f.eye) {
      const p = at(f.eye);
      this.eye.setPosition(p.x, p.y).setTint(f.eyeColor ?? 0xffe14a).setAlpha(0.4).setScale(0.2).setVisible(f.visible);
    } else this.eye.setVisible(false);
    // Hot spots glow while the heat lasts.
    const spots = f.heat > 0.15 ? (f.hot ?? []) : [];
    while (this.hot.length < spots.length) this.hot.push(this.scene.add.image(0, 0, GLOW).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.core.depth));
    this.hot.forEach((img, i) => {
      const s = spots[i];
      if (!s || !f.visible) {
        img.setVisible(false);
        return;
      }
      const p = at(s);
      img.setPosition(p.x, p.y).setTint(0xffa040).setAlpha(0.32 * f.heat).setScale(0.24).setVisible(true);
    });
    if (f.muzzle && (f.flash ?? 0) > 0) {
      const p = at(f.muzzle);
      this.flash.setPosition(p.x, p.y).setTint(0xfff0b0).setAlpha(0.9 * f.flash!).setScale(0.5).setVisible(f.visible);
    } else this.flash.setVisible(false);
    // Current: a jagged line, a new shape every frame, with a fainter wider one under it.
    this.arcs.clear();
    if (f.visible) {
      for (const arc of f.arcs ?? []) {
        if (Math.random() > arc.chance) continue;
        const p0 = at(arc.a);
        const p1 = at(arc.b);
        const pts: { x: number; y: number }[] = [p0];
        const n = 5;
        for (let i = 1; i < n; i++) {
          const k = i / n;
          pts.push({ x: p0.x + (p1.x - p0.x) * k + (Math.random() - 0.5) * 6, y: p0.y + (p1.y - p0.y) * k + (Math.random() - 0.5) * 6 });
        }
        pts.push(p1);
        for (const [w, a] of [[3, 0.25], [1, 0.95]] as const) {
          this.arcs.lineStyle(w, arc.color ?? 0x9ee8ff, a);
          this.arcs.beginPath();
          this.arcs.moveTo(pts[0].x, pts[0].y);
          for (const q of pts.slice(1)) this.arcs.lineTo(q.x, q.y);
          this.arcs.strokePath();
        }
      }
    }
    // Embers off the core: a few always, many more when hot.
    if (f.embers && f.core && f.visible && Math.random() < 0.1 + f.heat * 0.4) {
      const p = at(f.core);
      const img = this.scene.add.image(p.x + (Math.random() - 0.5) * 14, p.y, EMBER).setDepth(this.core.depth);
      const life = 30 + Math.floor(Math.random() * 25);
      this.embers.push({ img, vx: (Math.random() - 0.5) * 0.5, vy: -0.4 - Math.random() * 0.7, life, max: life });
    }
    for (const e of this.embers) {
      e.life--;
      e.img.x += e.vx + Math.sin((e.max - e.life) * 0.2) * 0.15;
      e.img.y += e.vy;
      e.img.setAlpha(Math.min(1, (e.life / e.max) * 1.5));
      if (e.life <= 0) e.img.destroy();
    }
    this.embers = this.embers.filter((e) => e.life > 0);
  }

  destroy(): void {
    this.shadow.destroy();
    this.core.destroy();
    this.eye.destroy();
    this.flash.destroy();
    this.arcs.destroy();
    for (const h of this.hot) h.destroy();
    for (const e of this.embers) e.img.destroy();
    this.hot = [];
    this.embers = [];
  }
}
