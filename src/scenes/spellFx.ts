import Phaser from 'phaser';

/**
 * UltraGuy's weapons as spells in the finale, drawn like a 16-bit JRPG's magic:
 * big, bright, over the target, a different show for each weapon. Each is
 * drawn fresh every frame from its progress `k` (0 to 1) into an additive
 * graphics layer (light), plus a normal one for solid things (rocks, vines).
 * The hit lands at HIT_AT.
 */

export interface SpellTarget {
  x: number;
  y: number;
}

/** When in the spell (0..1) the damage lands. */
export const HIT_AT = 0.62;
/** How long a spell runs (steps), after the cast. */
export const SPELL_FRAMES = 84;

type G = Phaser.GameObjects.Graphics;

/** A tiny repeatable random for each target and particle. */
const rnd = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const ease = (v: number) => 1 - (1 - Math.min(1, Math.max(0, v))) ** 3;
const flashAt = (k: number, at = HIT_AT) => Math.max(0, 1 - Math.abs(k - at) * 12);

/** Draw spell `fx` (a weapon's, or an enemy attack's) at progress k over the targets. */
export function drawSpell(add: G, solid: G, fx: string, k: number, targets: SpellTarget[], frame: number): void {
  // Screen-wide spells are drawn once, around the first target.
  if (WIDE[fx]) return void WIDE[fx](add, solid, targets, k, frame);
  targets.forEach((t, i) => {
    // Hit-all spells land on each target a beat apart.
    const kk = Math.min(1, Math.max(0, k * (1 + targets.length * 0.08) - i * 0.08));
    SPELLS[fx]?.(add, solid, t, kk, i, frame);
  });
}

type Drawer = (a: G, s: G, t: SpellTarget, k: number, i: number, f: number) => void;

const SPELLS: Record<string, Drawer> = {
  // Ice spikes close in from all sides and lock into a crystal, then it shatters.
  frost(a, _s, t, k, i) {
    const close = ease(k / HIT_AT);
    for (let n = 0; n < 12; n++) {
      const ang = (n / 12) * Math.PI * 2 + i;
      if (k < HIT_AT) {
        const r = 90 * (1 - close) + 12;
        const x = t.x + Math.cos(ang) * r, y = t.y + Math.sin(ang) * r * 0.8;
        const tip = { x: t.x + Math.cos(ang) * (r - 24), y: t.y + Math.sin(ang) * (r - 24) * 0.8 };
        const side = 6;
        a.fillStyle(0x9ae8ff, 0.85).fillTriangle(x + Math.sin(ang) * side, y - Math.cos(ang) * side, x - Math.sin(ang) * side, y + Math.cos(ang) * side, tip.x, tip.y);
        a.fillStyle(0xffffff, 0.9).fillTriangle(x, y, tip.x, tip.y, x + Math.sin(ang) * 1.5, y - Math.cos(ang) * 1.5);
      } else {
        // Shards flying out.
        const d = ease((k - HIT_AT) / (1 - HIT_AT)) * 90;
        const x = t.x + Math.cos(ang + 0.3) * d, y = t.y + Math.sin(ang + 0.3) * d * 0.8;
        a.fillStyle(0xc8f0ff, 1 - (k - HIT_AT) / (1 - HIT_AT)).fillTriangle(x - 5, y, x + 5, y, x, y - 12);
      }
    }
    // The crystal at the moment of the hit.
    const c = flashAt(k, HIT_AT - 0.04);
    if (c > 0) a.fillStyle(0xe6f8ff, c).fillPoints([{ x: t.x, y: t.y - 48 }, { x: t.x + 30, y: t.y }, { x: t.x, y: t.y + 42 }, { x: t.x - 30, y: t.y }], true);
    // Snow drifting through it all.
    for (let n = 0; n < 24; n++) a.fillStyle(0xffffff, 0.7).fillRect(t.x - 70 + rnd(n, i) * 140, t.y - 70 + ((rnd(i, n) * 140 + k * 90) % 140), 2, 2);
    hitFlash(a, t, k, 0x9ae8ff);
  },

  // A pillar of fire erupts from the ground under it: licking tongues of flame
  // around a hot core, embers streaming up, then it billows out.
  flame(a, _s, t, k, i, f) {
    const grow = ease(k / 0.45);
    const fade = k > 0.82 ? (1 - k) / 0.18 : 1;
    const base = t.y + 44;
    const height = 150 * grow;
    // Tongues: tall teardrops, licking upward and swaying.
    for (let n = 0; n < 16; n++) {
      const off = (rnd(n, i) - 0.5) * 44;
      const h = height * (0.45 + rnd(i, n) * 0.55);
      const sway = Math.sin(f * 0.3 + n * 1.7) * 8;
      const w = 7 + rnd(n, 7) * 7;
      const col = n % 3 === 0 ? 0xd83a1a : n % 3 === 1 ? 0xff7a2a : 0xffb030;
      a.fillStyle(col, 0.42 * fade).fillTriangle(t.x + off - w, base, t.x + off + w, base, t.x + off * 0.5 + sway, base - h);
    }
    // The core: a narrower bright column.
    a.fillStyle(0xffe14a, 0.35 * fade).fillTriangle(t.x - 12, base, t.x + 12, base, t.x + Math.sin(f * 0.4) * 4, base - height * 0.9);
    a.fillStyle(0xfff4c0, 0.4 * fade).fillTriangle(t.x - 5, base, t.x + 5, base, t.x, base - height * 0.6);
    a.fillStyle(0xff7a2a, 0.3 * fade).fillEllipse(t.x, base, 70 * grow, 16);
    for (let n = 0; n < 26; n++) {
      const e = (k * 1.8 + rnd(n, i)) % 1;
      a.fillStyle(n % 2 ? 0xffd060 : 0xff7a2a, (1 - e) * fade).fillRect(t.x + (rnd(n, 9) - 0.5) * 90 + Math.sin(e * 6 + n) * 6, base - e * 170, 2, 3);
    }
    hitFlash(a, t, k, 0xff7a2a, 1.2);
  },

  // Lightning strikes down out of the sky: three jagged bolts, then a crackling burst.
  spark(a, _s, t, k, _i, f) {
    if (k > 0.25 && k < 0.95 && f % 4 < 3) {
      for (let b = 0; b < 3; b++) {
        if (k < 0.25 + b * 0.12) continue;
        let x = t.x + (b - 1) * 14, y = 0;
        const pts: { x: number; y: number }[] = [{ x, y }];
        while (y < t.y) {
          y += 12 + rnd(b, y + f) * 10;
          x += (rnd(y, b + f) - 0.5) * 22;
          pts.push({ x: Phaser.Math.Linear(x, t.x, y / t.y * 0.6), y: Math.min(y, t.y) });
        }
        a.lineStyle(10, 0x5a78ff, 0.3).strokePoints(pts);
        a.lineStyle(5, 0x9ab8ff, 0.7).strokePoints(pts);
        a.lineStyle(2, 0xffffff, 1).strokePoints(pts);
        // A fork or two off the bolt.
        for (let fk = 2; fk < pts.length - 1; fk += 3) {
          const p0 = pts[fk];
          const p1 = { x: p0.x + (rnd(fk, f + b) - 0.5) * 40, y: p0.y + 14 + rnd(b, fk) * 12 };
          a.lineStyle(2, 0xc8d8ff, 0.8).lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
        a.fillStyle(0xc8d8ff, 0.5).fillCircle(t.x, t.y, 26);
      }
    }
    // Arcs crawling over it.
    if (k > HIT_AT - 0.05) for (let n = 0; n < 6; n++) {
      const ang = rnd(n, f) * Math.PI * 2, r = 16 + rnd(f, n) * 20;
      a.lineStyle(2, 0xfff4a0, 0.9).lineBetween(t.x, t.y, t.x + Math.cos(ang) * r, t.y + Math.sin(ang) * r);
    }
    hitFlash(a, t, k, 0xf8e040, 1.4);
  },

  // The ground splits and boulders erupt up through it.
  quake(a, s, t, k, i) {
    const ground = t.y + 34;
    const crack = ease(k / 0.4);
    for (let c = 0; c < 6; c++) {
      const dir = c % 2 ? 1 : -1;
      const len = 30 + c * 8;
      let x = t.x, y = ground;
      for (let n = 0; n < 5; n++) {
        const nx = x + dir * (len / 5) * crack, ny = y + (rnd(c, n) - 0.5) * 6;
        a.lineStyle(2, 0xff9a40, 0.8).lineBetween(x, y, nx, ny);
        x = nx;
        y = ny;
      }
    }
    if (k > 0.35) {
      const up = ease((k - 0.35) / 0.3);
      for (let n = 0; n < 9; n++) {
        const bx = t.x + (n - 4) * 11 + (rnd(n, i) - 0.5) * 6;
        const h = (26 + rnd(i, n) * 40) * up * (k > 0.85 ? (1 - k) / 0.15 : 1);
        s.fillStyle(0x8a7a68, 1).fillTriangle(bx - 7, ground, bx + 7, ground, bx + (rnd(n, 5) - 0.5) * 6, ground - h);
        s.fillStyle(0xc8b8a0, 1).fillTriangle(bx - 7, ground, bx - 2, ground, bx + (rnd(n, 5) - 0.5) * 6, ground - h);
        a.fillStyle(0xff9a40, 0.5).fillRect(bx - 1, ground - h * 0.4, 2, h * 0.4);
      }
      for (let n = 0; n < 14; n++) {
        const e = ease((k - 0.35) / 0.65);
        s.fillStyle(0x8a7a68, 1 - e).fillRect(t.x + (rnd(n, 3) - 0.5) * 100 * e, ground - 80 * e * rnd(3, n), 3, 3);
      }
    }
    hitFlash(a, t, k, 0xc8a070);
  },

  // Thorny vines spiral up from the ground and wrap it, then thorns burst out.
  thorn(a, s, t, k, i) {
    const grow = ease(k / HIT_AT);
    for (let v = 0; v < 4; v++) {
      const pts: { x: number; y: number }[] = [];
      for (let n = 0; n <= 30 * grow; n++) {
        const u = n / 30;
        const ang = u * Math.PI * 4 + v * (Math.PI / 2) + i;
        pts.push({ x: t.x + Math.cos(ang) * (26 - u * 10), y: t.y + 40 - u * 80 + Math.sin(ang) * 6 });
      }
      if (pts.length > 1) {
        s.lineStyle(4, 0x2e6a2a, 1).strokePoints(pts);
        s.lineStyle(2, 0x6cc04a, 1).strokePoints(pts);
        pts.forEach((p, n) => n % 4 === 2 && s.fillStyle(0xe8d8a0, 1).fillTriangle(p.x - 2, p.y, p.x + 2, p.y, p.x, p.y - 5));
      }
    }
    if (k > HIT_AT) {
      const e = ease((k - HIT_AT) / (1 - HIT_AT));
      for (let n = 0; n < 16; n++) {
        const ang = (n / 16) * Math.PI * 2;
        const r = e * 60;
        a.fillStyle(0xc8ffa0, 1 - e).fillTriangle(t.x + Math.cos(ang) * r, t.y + Math.sin(ang) * r, t.x + Math.cos(ang + 0.1) * (r - 10), t.y + Math.sin(ang + 0.1) * (r - 10), t.x + Math.cos(ang - 0.1) * (r - 10), t.y + Math.sin(ang - 0.1) * (r - 10));
      }
    }
    hitFlash(a, t, k, 0x6cc04a);
  },

  // A tornado spins up over it, debris flying round, then blows apart.
  cyclone(a, _s, t, k, i, f) {
    const up = ease(k / 0.4);
    const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
    for (let n = 0; n < 14; n++) {
      const u = n / 14;
      const y = t.y + 40 - u * 110 * up;
      const rx = 8 + u * 34;
      const spin = f * 0.4 + n;
      a.lineStyle(2, 0xd8ffe0, 0.5 * fade).strokeEllipse(t.x + Math.sin(spin) * 4, y, rx * 2, rx * 0.5);
    }
    for (let n = 0; n < 16; n++) {
      const ang = f * 0.25 + n;
      const u = rnd(n, i);
      const y = t.y + 40 - u * 110 * up;
      const r = 8 + u * 34;
      a.fillStyle(n % 2 ? 0xffffff : 0xa8e070, fade).fillRect(t.x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.25, 3, 3);
    }
    hitFlash(a, t, k, 0xd8ffe0);
  },

  // A flurry of blade slashes across it, each a bright streak with sparks.
  saw(a, _s, t, k, i) {
    for (let n = 0; n < 7; n++) {
      const start = 0.08 + n * 0.075;
      const p = (k - start) / 0.14;
      if (p < 0 || p > 2) continue;
      const ang = -0.9 + n * 0.45 + rnd(n, i) * 0.3;
      const len = 120;
      const head = ease(Math.min(1, p));
      const x0 = t.x - Math.cos(ang) * len / 2, y0 = t.y - Math.sin(ang) * len / 2;
      const x1 = x0 + Math.cos(ang) * len * head, y1 = y0 + Math.sin(ang) * len * head;
      const fade = p > 1 ? 2 - p : 1;
      a.lineStyle(14, 0x8a9ab8, 0.25 * fade).lineBetween(x0, y0, x1, y1);
      a.lineStyle(6, 0xc8ccd8, 0.6 * fade).lineBetween(x0, y0, x1, y1);
      a.lineStyle(2, 0xffffff, fade).lineBetween(x0, y0, x1, y1);
      if (p < 1) for (let s = 0; s < 4; s++) a.fillStyle(0xfff4a0, 1).fillRect(x1 + (rnd(s, n) - 0.5) * 10, y1 + (rnd(n, s) - 0.5) * 10, 2, 2);
    }
    hitFlash(a, t, k, 0xffffff);
  },

  // Bubbles swarm in and swell, then burst in a splash.
  bubble(a, _s, t, k, i) {
    const close = ease(k / HIT_AT);
    for (let n = 0; n < 14; n++) {
      const ang = (n / 14) * Math.PI * 2 + i + k * 2;
      if (k < HIT_AT) {
        const r = 80 * (1 - close) + 12;
        const size = 4 + close * 8 * rnd(n, i) + 2;
        const x = t.x + Math.cos(ang) * r, y = t.y + Math.sin(ang) * r * 0.8;
        a.lineStyle(2, 0x9ad8ff, 0.9).strokeCircle(x, y, size);
        a.fillStyle(0xffffff, 0.9).fillRect(x - size * 0.5, y - size * 0.5, 2, 2);
      } else {
        const e = ease((k - HIT_AT) / (1 - HIT_AT));
        a.fillStyle(0x6ab8e8, 1 - e).fillCircle(t.x + Math.cos(ang) * e * 70, t.y + Math.sin(ang) * e * 50 - e * 10, 3);
      }
    }
    const c = flashAt(k, HIT_AT - 0.03);
    if (c > 0) a.lineStyle(3, 0xc8f0ff, c).strokeCircle(t.x, t.y, 28);
    hitFlash(a, t, k, 0x6ab8e8);
  },
};

const ENEMY_SPELLS: Record<string, Drawer> = {
  // Magnetic field lines bending in around it, red and silver, tightening.
  magnet(a, _s, t, k, i, f) {
    const pull = ease(k / HIT_AT);
    for (let n = 0; n < 8; n++) {
      const side = n % 2 ? 1 : -1;
      const r = 70 - pull * 46 + n * 3;
      a.lineStyle(2, n % 4 < 2 ? 0xe83a3a : 0xc8ccd8, 0.8).beginPath();
      for (let u = 0; u <= 20; u++) {
        const ang = Math.PI * (u / 20) - Math.PI / 2;
        const x = t.x + side * Math.cos(ang) * r * 0.6, y = t.y + Math.sin(ang) * r;
        u === 0 ? a.moveTo(x, y) : a.lineTo(x, y);
      }
      a.strokePath();
    }
    for (let n = 0; n < 14; n++) {
      const e = (k * 2 + rnd(n, i)) % 1;
      const ang = rnd(i, n) * Math.PI * 2;
      a.fillStyle(0xc8ccd8, 1 - e).fillRect(t.x + Math.cos(ang) * 80 * (1 - e), t.y + Math.sin(ang) * 60 * (1 - e), 3, 2);
    }
    if (k > HIT_AT) a.fillStyle(0xe83a3a, 0.3 * (1 - k) / (1 - HIT_AT)).fillCircle(t.x, t.y, 28 + f % 4);
    hitFlash(a, t, k, 0xe83a3a);
  },
  // Ketchup and mustard rain down in globs and splat.
  splat(a, _s, t, k, i) {
    for (let n = 0; n < 18; n++) {
      const start = rnd(n, i) * 0.5;
      const p = (k - start) / 0.25;
      if (p < 0) continue;
      const col = n % 2 ? 0xd8281a : 0xf8d020;
      const x = t.x + (rnd(i, n) - 0.5) * 70;
      if (p < 1) a.fillStyle(col, 1).fillCircle(x, t.y - 90 + p * 90, 4);
      else {
        const e = Math.min(1, (p - 1) * 2);
        a.fillStyle(col, 1 - e * 0.6).fillEllipse(x, t.y + 4, 10 + e * 12, 5 + e * 3);
        for (let d = 0; d < 4; d++) a.fillStyle(col, 1 - e).fillRect(x + (d - 1.5) * 6 * e * 2, t.y - e * 10 * rnd(d, n), 2, 2);
      }
    }
    hitFlash(a, t, k, 0xf8d020);
  },
  // Green relish: goo bubbles up around it and drips.
  relish(a, _s, t, k, i) {
    for (let n = 0; n < 16; n++) {
      const e = (k * 1.4 + rnd(n, i)) % 1;
      const x = t.x + (rnd(n, 3) - 0.5) * 50;
      a.fillStyle(n % 3 ? 0x6cc04a : 0xa8e070, (1 - e) * 0.9).fillCircle(x, t.y + 20 - e * 50, 3 + rnd(i, n) * 4);
    }
    a.fillStyle(0x3a8a2e, 0.4 * Math.min(1, k * 3)).fillEllipse(t.x, t.y + 22, 60, 12);
    hitFlash(a, t, k, 0x6cc04a);
  },
  // Hotdogs streak across at it, one after another.
  rush(a, _s, t, k, _i) {
    for (let n = 0; n < 5; n++) {
      const p = (k - n * 0.1) / 0.3;
      if (p < 0 || p > 1.4) continue;
      const x = Phaser.Math.Linear(60, t.x, Math.min(1, p)), y = t.y - 10 + (n - 2) * 8;
      a.fillStyle(0xf0c880, 0.9).fillEllipse(x, y, 22, 8);
      a.fillStyle(0xc84a3a, 1).fillEllipse(x, y, 18, 4);
      a.lineStyle(2, 0xffffff, 0.5 * (1 - p)).lineBetween(x - 40, y, x - 12, y);
    }
    hitFlash(a, t, k, 0xe86a50);
  },
  // A ball bounces in a zigzag between the walls and into it.
  ball(a, _s, t, k, _i, f) {
    const pts: { x: number; y: number }[] = [];
    for (let u = 0; u <= 30; u++) {
      const p = Math.min(k / HIT_AT, 1) * (u / 30);
      const x = Phaser.Math.Linear(40, t.x, p);
      const y = t.y - 60 + Math.abs(((p * 3) % 2) - 1) * 80;
      pts.push({ x, y });
    }
    a.lineStyle(2, 0xf28c28, 0.6).strokePoints(pts);
    const head = pts[pts.length - 1];
    a.fillStyle(0xffffff, 1).fillCircle(head.x, head.y, 4);
    for (let n = 0; n < 6; n++) a.fillStyle([0xd83a3a, 0xf28c28, 0xf8e040, 0x6cc04a, 0x4a8ae8, 0x8c4ad8][n], 0.8).fillRect(20 + n * 14, 30 + (f % 2), 12, 5);
    hitFlash(a, t, k, 0xf28c28);
  },
  // A slapshot: the puck streaks in with ice spray.
  puck(a, _s, t, k) {
    const p = ease(k / HIT_AT);
    const x = Phaser.Math.Linear(70, t.x, p), y = Phaser.Math.Linear(t.y + 30, t.y, p);
    if (k < HIT_AT) {
      a.lineStyle(6, 0x9ee8ff, 0.3).lineBetween(70, t.y + 30, x, y);
      a.fillStyle(0x1a1428, 1).fillEllipse(x, y, 12, 6);
      a.fillStyle(0x9ee8ff, 1).fillEllipse(x, y - 1, 12, 2);
    }
    for (let n = 0; n < 12; n++) a.fillStyle(0xe6f8ff, 0.7).fillRect(x - n * 6, y + (rnd(n, 1) - 0.5) * 8, 2, 2);
    hitFlash(a, t, k, 0x9ee8ff);
  },
  // A sparkle of gold: Coach Jared in your corner.
  blessing(a, _s, t, k, i) {
    for (let n = 0; n < 20; n++) {
      const e = (k * 1.5 + rnd(n, i)) % 1;
      const ang = rnd(i, n) * Math.PI * 2;
      a.fillStyle(n % 2 ? 0xffe14a : 0xffffff, 1 - e).fillRect(t.x + Math.cos(ang) * (10 + e * 30), t.y + 20 - e * 60, 2, 2);
    }
    a.lineStyle(2, 0xffe14a, 0.6).strokeEllipse(t.x, t.y + 22, 40 + Math.sin(k * 10) * 4, 10);
  },
  // A bomb's fuse fizzing as it lands on you.
  fuse(a, _s, t, k, _i, f) {
    const y = Phaser.Math.Linear(t.y - 80, t.y - 10, ease(k / HIT_AT));
    a.fillStyle(0x3a3a48, 1).fillCircle(t.x, y, 8);
    a.fillStyle(0x8a8fa8, 1).fillCircle(t.x - 3, y - 3, 2);
    for (let n = 0; n < 6; n++) a.fillStyle(n % 2 ? 0xffe14a : 0xff7a2a, 1).fillRect(t.x + 6 + (rnd(n, f) - 0.5) * 8, y - 10 + (rnd(f, n) - 0.5) * 8, 2, 2);
    if (k > HIT_AT) a.lineStyle(2, 0xff7a2a, 1 - k).strokeCircle(t.x, t.y - 10, (k - HIT_AT) * 80);
  },
  // A frag: a crosshair locks on, then a blast.
  crosshair(a, _s, t, k) {
    const lock = ease(k / HIT_AT);
    const r = 60 - lock * 44;
    a.lineStyle(2, 0xd83a4a, 0.9).strokeCircle(t.x, t.y, r);
    a.lineBetween(t.x - r - 8, t.y, t.x - r + 6, t.y).lineBetween(t.x + r - 6, t.y, t.x + r + 8, t.y);
    a.lineBetween(t.x, t.y - r - 8, t.x, t.y - r + 6).lineBetween(t.x, t.y + r - 6, t.x, t.y + r + 8);
    hitFlash(a, t, k, 0xff5050, 1.3);
  },
};
Object.assign(SPELLS, ENEMY_SPELLS);

/** Spells that fill the screen (they ignore where the targets are, mostly). */
const WIDE: Record<string, (a: G, s: G, ts: SpellTarget[], k: number, f: number) => void> = {
  // All four elements at once: snow, wind, rain and fire swirling across everything.
  storm(a, _s, ts, k, f) {
    for (let n = 0; n < 80; n++) {
      const col = [0x9ae8ff, 0xd8ffe0, 0x6ab8e8, 0xff7a2a][n % 4];
      const ang = (n / 80) * Math.PI * 2 + k * 6 + (n % 4) * 0.4;
      const r = 40 + ((n * 37) % 160) * (0.5 + k * 0.6);
      a.fillStyle(col, 0.8).fillRect(260 + Math.cos(ang) * r, 110 + Math.sin(ang) * r * 0.45, 3, 3);
    }
    for (const t of ts) hitFlash(a, t, k, 0xffffff, 1.6);
    if (f % 6 < 2 && k > 0.4 && k < 0.8) a.fillStyle(0xffffff, 0.15).fillRect(0, 0, 427, 240);
  },
  // Meltdown: the core goes critical, a white-hot sphere swells over the screen.
  nuke(a, _s, ts, k) {
    const grow = ease(k / HIT_AT);
    const cx = 128, cy = 96;
    a.fillStyle(0xfff4a0, 0.25).fillCircle(cx, cy, 30 + grow * 220);
    a.fillStyle(0xffffff, 0.35).fillCircle(cx, cy, 20 + grow * 120);
    for (let r = 0; r < 3; r++) a.lineStyle(3, 0xffe14a, Math.max(0, 1 - k)).strokeCircle(cx, cy, ((k * 2 + r / 3) % 1) * 300);
    for (const t of ts) hitFlash(a, t, k, 0xfff4a0, 1.5);
  },
  // The Works: condiments rain everywhere while fire rolls in underneath.
  works(a, s, ts, k, f) {
    for (const t of ts) {
      SPELLS.splat(a, s, t, k, 0, f);
      SPELLS.flame(a, s, t, k, 1, f);
    }
  },
  // Squadrons of tiny ships strafe the party, lasers raking across.
  squadron(a, _s, ts, k, f) {
    for (let n = 0; n < 8; n++) {
      const p = (k * 1.6 - n * 0.08) % 1.2;
      const x = -20 + p * 480, y = 30 + n * 14 + Math.sin(p * 6 + n) * 6;
      a.fillStyle(0xff5050, 1).fillTriangle(x, y, x - 8, y - 4, x - 8, y + 4);
      if ((f + n) % 6 < 3 && x > 200) for (const t of ts) a.lineStyle(1, 0xffe14a, 0.7).lineBetween(x, y, t.x + (rnd(n, f) - 0.5) * 20, t.y);
    }
    for (const t of ts) hitFlash(a, t, k, 0xff5050);
  },
  // Race day: speed lines tear across the screen and your gauges run backward.
  speed(a, _s, ts, k) {
    for (let n = 0; n < 30; n++) {
      const y = rnd(n, 2) * 180 + 10;
      const x = ((rnd(n, 5) * 427 - k * 1400 * (0.6 + rnd(n, 7))) % 427 + 427) % 427;
      a.lineStyle(2, n % 3 ? 0xf8e040 : 0xffffff, 0.6).lineBetween(x, y, x + 50 + rnd(n, 9) * 60, y);
    }
    for (const t of ts) hitFlash(a, t, k, 0xf8e040);
  },
  // Junk maze: walls slide in from the edges and box you in.
  grid(a, _s, ts, k) {
    const close = ease(k / HIT_AT);
    for (const t of ts) {
      for (let n = 0; n < 4; n++) {
        const d = 120 - close * 90 + n * 8;
        a.lineStyle(2, 0xc8ccd8, 0.7 - n * 0.12).strokeRect(t.x - d, t.y - d * 0.7, d * 2, d * 1.4);
      }
      hitFlash(a, t, k, 0xc8ccd8);
    }
  },
  // Trench descent: deep water rises over the screen, the light going out.
  abyss(a, _s, ts, k, f) {
    const rise = ease(k / HIT_AT);
    for (let y = 240 - rise * 240; y < 240; y += 6) a.fillStyle(0x0a1a3a, 0.08).fillRect(0, y + Math.sin(y * 0.1 + f * 0.1) * 3, 427, 6);
    for (let n = 0; n < 16; n++) a.fillStyle(0x9ad8ff, 0.6).fillCircle(rnd(n, 1) * 427, 240 - ((k * 300 + rnd(1, n) * 240) % 240), 2);
    for (const t of ts) hitFlash(a, t, k, 0x3a78b8);
  },
  // Insert coin: a giant coin spins down and slams the floor, a shockwave across everything.
  coin(a, _s, ts, k, f) {
    const p = ease(k / HIT_AT);
    const cx = 300, cy = Phaser.Math.Linear(-40, 150, p);
    const w = Math.abs(Math.cos(f * 0.25)) * 34 + 4;
    if (k < HIT_AT + 0.05) {
      a.fillStyle(0xffe14a, 1).fillEllipse(cx, cy, w, 38);
      a.fillStyle(0xfff4c0, 1).fillEllipse(cx - w * 0.15, cy - 4, w * 0.4, 22);
    }
    if (k > HIT_AT) {
      const e = (k - HIT_AT) / (1 - HIT_AT);
      a.lineStyle(4, 0xffe14a, 1 - e).strokeEllipse(cx, 170, e * 700, e * 120);
      a.fillStyle(0xffffff, 0.5 * (1 - e)).fillRect(0, 0, 427, 240);
    }
    for (const t of ts) hitFlash(a, t, k, 0xffe14a, 1.5);
  },
};

/** The bright bloom at the moment of the hit. */
function hitFlash(a: G, t: SpellTarget, k: number, color: number, big = 1): void {
  const c = flashAt(k);
  if (c <= 0) return;
  a.fillStyle(color, 0.5 * c).fillCircle(t.x, t.y, 50 * big * c);
  a.fillStyle(0xffffff, 0.8 * c).fillCircle(t.x, t.y, 22 * big * c);
}

/** UltraGuy gathering power before a spell: rings closing in and motes rising, in its color. */
export function drawCast(a: G, x: number, y: number, k: number, color: number, frame: number, size = 1): void {
  for (let r = 0; r < 3; r++) {
    const rr = 40 * size * (1 - ((k * 1.5 + r / 3) % 1));
    a.lineStyle(2, color, 0.8).strokeCircle(x, y, rr);
  }
  for (let n = 0; n < 12; n++) {
    const e = (k * 2 + rnd(n, 1)) % 1;
    a.fillStyle(n % 2 ? 0xffffff : color, 1 - e).fillRect(x + (rnd(n, 2) - 0.5) * 34 * size, y + 20 * size - e * 50 * size, 2, 2);
  }
  a.fillStyle(color, 0.25 + Math.sin(frame * 0.5) * 0.1).fillCircle(x, y, 18 * size);
}
