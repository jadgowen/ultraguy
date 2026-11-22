import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';

/**
 * The finale's painted art, shown at full screen resolution (not the game's
 * 427x240): a layer of web images sitting exactly behind the (transparent)
 * game canvas. The battle draws its windows, sprites and effects on the canvas
 * over it. Positions are given in game units (427x240) and scale with the canvas.
 *
 *   - a backdrop, cross-faded between tiers;
 *   - the boss painting, which hovers gently, flashes when hit, shakes, and
 *     dissolves (bright, blurred, gone) when a tier falls.
 */
export class PaintLayer {
  private root: HTMLDivElement;
  private backs: HTMLImageElement[] = [];
  private boss: HTMLImageElement;
  private bossBox = { x: 0, y: 0, h: 0 };
  private hover = 0;
  private shakeT = 0;
  private shakePx = 0;
  private flashT = 0;
  private dim = 0;
  /** While a fade-in or dissolve runs (ms timestamp), leave the boss's filter to the CSS transition. */
  private fadingUntil = 0;
  private readonly onResize = () => this.fit();

  constructor(private game: Phaser.Game) {
    const parent = game.canvas.parentElement!;
    this.root = document.createElement('div');
    this.root.id = 'paint';
    Object.assign(this.root.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none', zIndex: '0', background: '#000' });
    parent.style.position ||= 'relative';
    parent.insertBefore(this.root, game.canvas);
    game.canvas.style.position = 'relative';
    game.canvas.style.zIndex = '1';
    for (let i = 0; i < 2; i++) {
      const img = document.createElement('img');
      Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover', opacity: '0', transition: 'opacity 1.6s ease' });
      this.root.appendChild(img);
      this.backs.push(img);
    }
    this.boss = document.createElement('img');
    Object.assign(this.boss.style, { position: 'absolute', opacity: '0', transition: 'opacity 1.2s ease, filter 1.2s ease', transformOrigin: '50% 100%' });
    this.root.appendChild(this.boss);
    game.scale.on('resize', this.onResize);
    window.addEventListener('resize', this.onResize);
    this.fit();
  }

  /** Keep the layer exactly over the canvas. */
  private fit(): void {
    const c = this.game.canvas;
    const r = c.getBoundingClientRect();
    const pr = c.parentElement!.getBoundingClientRect();
    Object.assign(this.root.style, { left: `${r.left - pr.left}px`, top: `${r.top - pr.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.placeBoss();
  }

  private get unit(): number {
    return this.game.canvas.getBoundingClientRect().width / VIEW_W;
  }

  /** Cross-fade to a new backdrop. */
  setBackdrop(url: string): void {
    const [a, b] = this.backs;
    const showing = a.style.opacity === '1' ? a : b;
    const next = showing === a ? b : a;
    next.src = url;
    next.style.opacity = '1';
    showing.style.opacity = '0';
    // The new one on top while it fades in.
    this.root.insertBefore(next, this.boss);
  }

  /** The boss painting: centered at x, its bottom at y, h tall (game units). */
  setBoss(url: string, x: number, y: number, h: number): void {
    this.bossBox = { x, y, h };
    this.boss.style.transition = 'none';
    this.boss.style.opacity = '0';
    this.boss.style.filter = 'brightness(4) blur(6px)';
    this.boss.src = url;
    this.placeBoss();
    // Next frame: fade in from a glow.
    this.fadingUntil = performance.now() + 1500;
    requestAnimationFrame(() => {
      this.boss.style.transition = 'opacity 1.4s ease, filter 1.4s ease';
      this.boss.style.opacity = '1';
      this.boss.style.filter = 'none';
    });
  }

  /** The boss falls: it burns bright, blurs and fades away. */
  dissolveBoss(): void {
    this.fadingUntil = Number.POSITIVE_INFINITY; // until the next setBoss
    this.boss.style.transition = 'opacity 2.2s ease, filter 2.2s ease';
    this.boss.style.filter = 'brightness(5) blur(12px) saturate(0)';
    this.boss.style.opacity = '0';
  }

  /** A hit: a white flash on the painting. */
  flashBoss(): void {
    this.flashT = 8;
  }

  shakeBoss(px = 4, steps = 14): void {
    this.shakePx = px;
    this.shakeT = steps;
  }

  /** Darken everything (0..1), e.g. for TRENCH DESCENT's darkness. */
  setDim(v: number): void {
    this.dim = v;
  }

  /** One step: the hover, the shake, the flash. */
  step(): void {
    this.hover++;
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    this.placeBoss();
    for (const id of this.minions.keys()) this.placeMinion(id);
    const dim = this.dim > 0 ? `brightness(${1 - this.dim * 0.85})` : '';
    for (const b of this.backs) b.style.filter = dim;
    if (performance.now() > this.fadingUntil) {
      this.boss.style.transition = 'none';
      this.boss.style.filter = this.flashT > 0 ? `brightness(${1 + this.flashT * 0.35}) ${dim}` : dim || 'none';
    }
  }

  private placeBoss(): void {
    const u = this.unit;
    const { x, y, h } = this.bossBox;
    const sx = this.shakeT > 0 ? (this.shakeT % 2 ? 1 : -1) * this.shakePx : 0;
    const bob = Math.sin(this.hover * 0.035) * 2;
    Object.assign(this.boss.style, {
      height: `${h * u}px`,
      left: `${x * u}px`,
      top: `${(y - h + bob) * u}px`,
      // (The paintings face right; mirrored, they face the party on the right.)
      transform: `translateX(-50%) translateX(${sx * u}px) scaleX(-1)`,
    });
  }

  /** Small painted enemies (Jared's hotdogs): centered at x, feet at y, h tall (game units). */
  private minions = new Map<string, { img: HTMLImageElement; x: number; y: number; h: number }>();

  addMinion(id: string, url: string, x: number, y: number, h: number): void {
    const img = document.createElement('img');
    img.src = url;
    Object.assign(img.style, { position: 'absolute', opacity: '0', filter: 'brightness(4) blur(4px)', transition: 'opacity 0.5s ease, filter 0.5s ease', transformOrigin: '50% 100%' });
    this.root.appendChild(img);
    this.minions.set(id, { img, x, y, h });
    this.placeMinion(id);
    requestAnimationFrame(() => {
      img.style.opacity = '1';
      img.style.filter = 'none';
    });
  }

  removeMinion(id: string): void {
    const m = this.minions.get(id);
    if (!m) return;
    this.minions.delete(id);
    m.img.style.transition = 'opacity 0.6s ease, filter 0.6s ease';
    m.img.style.filter = 'brightness(5) blur(6px)';
    m.img.style.opacity = '0';
    setTimeout(() => m.img.remove(), 700);
  }

  flashMinion(id: string): void {
    const m = this.minions.get(id);
    if (!m) return;
    m.img.style.transition = 'none';
    m.img.style.filter = 'brightness(3)';
    setTimeout(() => (m.img.style.filter = 'none'), 110);
  }

  private placeMinion(id: string): void {
    const m = this.minions.get(id);
    if (!m) return;
    const u = this.unit;
    // A little hop as they wait (each its own rhythm).
    const hop = Math.abs(Math.sin(this.hover * 0.09 + m.x)) * 2;
    Object.assign(m.img.style, { height: `${m.h * u}px`, left: `${m.x * u}px`, top: `${(m.y - m.h - hop) * u}px`, transform: 'translateX(-50%)' });
  }

  show(on: boolean): void {
    this.root.style.display = on ? 'block' : 'none';
  }

  destroy(): void {
    this.game.scale.off('resize', this.onResize);
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    this.game.canvas.style.zIndex = '';
  }
}

/** Where the finale's art lives (relative to the page, so it works under the deploy path). */
export const FINALE_ART = (name: string) => `assets/finale/${name}`;

export const VIEW = { w: VIEW_W, h: VIEW_H };
