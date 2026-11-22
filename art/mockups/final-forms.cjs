// Renders the final boss's sprite-style forms (Chimera, Iron Idol, giant Jared) from the real boss sprites: node art/mockups/final-forms.cjs
const { decodePNG, Canvas } = require('./img.cjs');
const A = decodePNG(require('path').join(__dirname, '../../public/assets/sprites.png'));
const F = require('../../public/assets/sprites.json');
const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const K = hex('#1a1428');
const sprite = (c, key, x, y, o = {}) => { const [sx, sy, w, h] = F[key]; c.blit(A, sx, sy, w, h, x, y, o); return { w: w * (o.scale ?? 1), h: h * (o.scale ?? 1) }; };
const fill = (c, inside, col) => { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (inside(x + 0.5, y + 0.5)) c.set(x, y, typeof col === 'function' ? col(x, y) : col); };
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const hash = (x, y) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
/** Dark outline around everything drawn so far. */
function outline(c) {
  const solid = (x, y) => { const p = c.get(x, y); return p && p[3] > 128; };
  const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (!solid(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(x + dx, y + dy))) add.push([x, y]);
  for (const [x, y] of add) c.set(x, y, K);
}
/** A soft glow (additive-looking) behind/over. */
function glow(c, cx, cy, r, col, a = 0.5) {
  for (let y = Math.floor(cy - r); y < cy + r; y++) for (let x = Math.floor(cx - r); x < cx + r; x++) {
    const d = Math.hypot(x - cx, y - cy) / r; if (d > 1) continue;
    const p = c.get(x, y); if (!p) continue;
    const k = (1 - d) ** 2 * a;
    c.px.set([Math.min(255, p[0] + col[0] * k), Math.min(255, p[1] + col[1] * k), Math.min(255, p[2] + col[2] * k), Math.max(p[3], Math.round(255 * k * 0.9))], (y * c.w + x) * 4);
  }
}

/**
 * Shade a part like the bosses' rig: lit top edge, lighter left edge, dark bottom and right.
 * ramp = [shine, light, base, dark]; tex(x, y) can override a pixel (cracks, scales, rust).
 */
function part(c, inside, ramp, tex) {
  const R = ramp.map((h) => hex(h));
  const at = (x, y) => inside(x + 0.5, y + 0.5);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (!at(x, y)) continue;
    // A bevel lit from the upper left: how far in from the lit edge, and from the shadowed edge.
    let lit = 9, shade = 9;
    for (let k = 1; k <= 8; k++) { if (lit === 9 && !at(x - k, y - k)) lit = k; if (shade === 9 && !at(x + k, y + k)) shade = k; }
    let col = lit <= 1 ? R[0] : lit <= 3 ? R[1] : shade <= 2 ? R[3] : shade <= 5 && (x + y) % 2 === 0 ? R[3] : R[2];
    const t = tex?.(x, y, col);
    c.set(x, y, t ? hex(t) : col);
  }
}
/** Branching cracks (random walks) for lava rock: a set of pixels. */
function cracks(seed, x0, y0, w, h, n) {
  const set = new Set();
  for (let i = 0; i < n; i++) {
    let x = x0 + hash(seed, i) * w, y = y0 + hash(i, seed) * h, a = hash(seed + i, 7) * Math.PI * 2;
    for (let k = 0; k < 18; k++) {
      set.add(Math.round(x) + ',' + Math.round(y));
      a += (hash(i, k + seed) - 0.5) * 1.2;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  return set;
}
/** A tube along a curve (center points), radius r(t). */
const tube = (pts, r) => (x, y) => {
  for (let i = 0; i < pts.length; i++) { const t = i / (pts.length - 1); if (Math.hypot(x - pts[i][0], y - pts[i][1]) <= r(t)) return true; }
  return false;
};
const curve = (p0, p1, p2, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]; });
const poly = (pts) => (x, y) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };

const BASALT = ['#7a6a7a', '#5a4a5a', '#3a2e3e', '#221a26'];
const CRACKS = cracks(3, 20, 60, 140, 110, 26);
const LAVA = (x, y) => (CRACKS.has(x + ',' + y) ? (hash(x, y) > 0.5 ? '#ffd060' : '#ff7a2a') : CRACKS.has(x + 1 + ',' + y) ? '#c83a1a' : null);
const EEL = ['#b8f8e0', '#5ac8a8', '#2e8a78', '#14524a'];
const ICE = ['#ffffff', '#c8f0ff', '#6ab8e8', '#3a78b8'];
const SILVER = ['#ffffff', '#d8dce8', '#a0a8bc', '#5a6276'];

// ---------- 1. THE ELEMENTAL CHIMERA: one beast, built from all four ----------
// Magma's basalt body and legs (lava in the cracks), Tide's eel as its front arm (jaws
// for a hand) and its tail, Gale's silver wings, and Frostline's crystal head and crest.
function chimera() {
  const c = new Canvas(170, 170);
  // Gale's wings, behind: long feathers fanning up and out, gold along the leading edge.
  for (const [sx, dir] of [[70, -1], [100, 1]]) for (let f = 0; f < 6; f++) {
    const a = -Math.PI / 2 + dir * (0.35 + f * 0.22);
    const len = 62 - f * 6;
    const tip = [sx + Math.cos(a) * len, 58 + Math.sin(a) * len];
    part(c, tube(curve([sx, 58], [(sx + tip[0]) / 2 + dir * 6, (58 + tip[1]) / 2 - 4], tip, 30), (t) => 5 - t * 3.5), SILVER, (x, y) => (f === 0 && hash(x, y) > 0.55 ? '#f8e040' : null));
  }
  // Tide's tail sweeping out behind.
  part(c, tube(curve([110, 130], [150, 140], [160, 112], 30), (t) => 8 - t * 4), EEL);
  part(c, poly([[156, 108], [168, 96], [166, 116], [158, 120]]), EEL);
  // Magma's legs and body: basalt, lava running in the cracks.
  for (const lx of [70, 98]) part(c, (x, y) => y > 108 && y < 158 && Math.abs(x - lx) < 13 - (y - 108) * 0.04, BASALT, LAVA);
  for (const lx of [70, 98]) part(c, (x, y) => y >= 154 && y < 166 && Math.abs(x - lx - 3) < 16 && !(y < 158 && Math.abs(x - lx - 3) > 12), BASALT);
  part(c, (x, y) => ell(84, 92, 38, 30)(x, y) || ell(84, 72, 26, 14)(x, y), BASALT, LAVA);
  // A molten core in the chest, where the four meet.
  part(c, ell(83, 92, 9, 8), ['#fff4c0', '#ffd060', '#ff7a2a', '#c83a1a']);
  // Magma's rock fist (back arm).
  part(c, tube(curve([110, 82], [128, 92], [126, 116], 20), () => 8), BASALT, LAVA);
  part(c, ell(126, 120, 11, 10), BASALT, LAVA);
  // Tide's eel as the front arm, ending in open jaws.
  const armPts = curve([58, 82], [20, 78], [24, 112], 40);
  part(c, tube(armPts, (t) => 10 - t * 2), EEL, (x, y) => (hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.92 ? '#e6ff80' : null));
  part(c, poly([[30, 108], [8, 116], [10, 122], [30, 120]]), EEL); // upper jaw
  part(c, poly([[30, 122], [12, 128], [14, 132], [32, 128]]), EEL); // lower jaw
  for (let x = 12; x < 30; x += 3) { c.set(x, 122, hex('#ffffff')); c.set(x + 1, 126, hex('#ffffff')); }
  c.rect(24, 112, 2, 2, hex('#ffe14a'));
  // Frostline's crystal head on the shoulders, beak toward the heroes, a crest of icicles.
  part(c, ell(80, 54, 17, 15), ICE, (x, y) => ((x - y) % 9 === 0 && hash(x, y) > 0.5 ? '#ffffff' : null));
  part(c, poly([[64, 54], [50, 59], [64, 62]]), ['#fff4a0', '#f8d020', '#d8a010', '#a87008']);
  for (let i = 0; i < 6; i++) part(c, poly([[70 + i * 4, 44], [74 + i * 4 - (i < 3 ? 6 : -6), 24 + Math.abs(i - 2.5) * 3], [76 + i * 4, 44]]), ICE);
  c.rect(70, 50, 4, 3, hex('#141226')); c.rect(71, 51, 2, 1, hex('#ff5050'));
  outline(c);
  glow(c, 83, 92, 26, hex('#ff7a2a'), 0.5);
  glow(c, 80, 50, 22, hex('#9ae8ff'), 0.3);
  return c;
}

const PLATE = ['#ff8a7a', '#d83a3a', '#a01e28', '#5a1018'];
const STEEL = ['#e6eaf4', '#a8b0c4', '#6a7288', '#3a4052'];
const RUST = ['#d89a6a', '#a8683a', '#7a4426', '#4a2614'];
const NAVY = ['#8aa8e8', '#3a5ab8', '#22348a', '#141e52'];
const LEAF = ['#c8ffa0', '#6cc04a', '#3a8a2e', '#1e5a1a'];
const PINK = ['#ffd0e8', '#f08ac0', '#c05a98', '#7a2a5a'];

// ---------- 2. THE IRON IDOL: one machine, built from all four ----------
// Anvil's red plate and anvil pauldrons (and a hammer for an arm), Volt's reactor and
// horned helmet, Scrap's junk legs and magnet claw, Mantis's scythe wings, eyes and antennae.
function idol() {
  const c = new Canvas(190, 180);
  const cx = 95;
  // Mantis's scythe wings rising behind like a halo.
  for (const s of [-1, 1]) part(c, (x, y) => {
    const dx = (x - cx) * s; if (dx < 6) return false;
    const t = (dx - 6) / 70; if (t > 1) return false;
    const top = 70 - Math.sin(t * Math.PI * 0.9) * 62, bot = top + 13 * (1 - t) + 2;
    return y > top && y < bot;
  }, LEAF, (x, y) => (hash(x, y) > 0.93 ? '#e8ffd0' : null));
  // Scrap's junk legs: mismatched rusty plates on pistons.
  for (const s of [-1, 1]) {
    part(c, (x, y) => y > 122 && y < 168 && Math.abs(x - (cx + s * 20)) < 10, RUST, (x, y) => (y % 8 === 0 ? '#4a2614' : hash(Math.floor(x / 5), Math.floor(y / 8)) > 0.7 ? '#a8b0c4' : null));
    part(c, (x, y) => y >= 164 && y < 176 && Math.abs(x - (cx + s * 22)) < 16, STEEL);
  }
  // The torso: Anvil's red chest plate with a grill, Volt's reactor glowing in it.
  part(c, (x, y) => y > 62 && y < 128 && Math.abs(x - cx) < 32 - (y - 62) * 0.15, PLATE, (x, y) => (y > 112 && y < 122 && Math.abs(x - cx) < 14 && x % 3 === 0 ? '#3a1014' : null));
  part(c, ell(cx, 88, 13, 13), ['#fffbe0', '#fff080', '#f8d020', '#a88a08']);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.line?.(0); for (let k = 13; k < 22; k++) c.set(cx + Math.cos(a) * k + (hash(i, k) - 0.5) * 3, 88 + Math.sin(a) * k + (hash(k, i) - 0.5) * 3, hex('#fff4a0')); }
  // Anvil-shaped pauldrons.
  for (const s of [-1, 1]) part(c, poly([[cx + s * 22, 60], [cx + s * 50, 56], [cx + s * 46, 66], [cx + s * 38, 70], [cx + s * 38, 78], [cx + s * 26, 78]]), STEEL);
  // Left arm (toward the heroes): Anvil's hammer, grown into the arm.
  part(c, tube(curve([cx - 40, 74], [cx - 58, 92], [cx - 62, 112], 20), () => 7), STEEL);
  part(c, (x, y) => x > cx - 84 && x < cx - 46 && y > 112 && y < 136, ['#ffffff', '#d8d0c0', '#9a9080', '#5a5246']);
  // Right arm: Scrap's junk arm ending in a big magnet claw.
  part(c, tube(curve([cx + 40, 74], [cx + 60, 90], [cx + 62, 106], 20), () => 7), RUST, (x, y) => (hash(Math.floor(x / 4), Math.floor(y / 4)) > 0.75 ? '#a8b0c4' : null));
  for (const s of [-1, 1]) part(c, (x, y) => Math.abs(x - (cx + 62 + s * 9)) < 5 && y > 108 && y < 134, ['#ffa0a0', '#e83a3a', '#a81e28', '#5a1018'], (x, y) => (y > 128 ? '#e6e8f0' : null));
  part(c, (x, y) => ell(cx + 62, 110, 14, 8)(x, y) && !ell(cx + 62, 110, 5, 3)(x, y) && y < 111, ['#ffa0a0', '#e83a3a', '#a81e28', '#5a1018']);
  // The head: Volt's navy helmet and lightning horns, Mantis's green compound eyes and antennae.
  part(c, ell(cx, 46, 15, 14), NAVY);
  for (const s of [-1, 1]) {
    part(c, poly([[cx + s * 8, 36], [cx + s * 20, 18], [cx + s * 15, 28], [cx + s * 24, 24], [cx + s * 12, 40]]), ['#fffbe0', '#f8e040', '#c8a010', '#7a5a08']);
    part(c, ell(cx + s * 7, 47, 5, 6), LEAF, (x, y) => ((x + y) % 2 === 0 ? '#e8ffd0' : null));
    for (let k = 0; k < 16; k++) c.set(cx + s * (3 + k * 0.9), 32 - k * 1.4, hex('#f08ac0'));
  }
  part(c, poly([[cx - 6, 54], [cx + 6, 54], [cx, 60]]), PINK); // mandible
  outline(c);
  glow(c, cx, 88, 30, hex('#f8e040'), 0.55);
  glow(c, cx - 7, 47, 8, hex('#c8ffa0'), 0.4);
  glow(c, cx + 7, 47, 8, hex('#c8ffa0'), 0.4);
  return c;
}

const CAP = ['#a8f080', '#5aa83a', '#3a7a28', '#1e4a18'];
const SKIN = ['#b08a8a', '#7a5a66', '#5a4050', '#3a2836'];

// ---------- 3. BLACK JARED, SUPERSIZED: a giant mutated head ----------
function jared() {
  const c = new Canvas(190, 170);
  const cx = 92;
  // Hot dogs sprouting from under the cap like tendrils, mustard dripping.
  const dog = (pts) => {
    const inside = tube(pts, (t) => 7 - t * 2);
    part(c, inside, ['#ffe0a0', '#f0c070', '#c8904a', '#8a5a2a']);
    part(c, tube(pts, (t) => 3.6 - t), ['#ffa080', '#e0604a', '#a83a30', '#6a1e1a']);
    pts.forEach(([x, y], i) => { if (i % 3 === 0) c.set(x, y - 1, hex('#f8d020')); });
  };
  dog(curve([62, 48], [20, 30], [10, 70], 40));
  dog(curve([124, 48], [166, 24], [176, 64], 40));
  dog(curve([56, 78], [16, 96], [26, 126], 40));
  dog(curve([130, 80], [172, 104], [160, 134], 40));
  // The head: swollen, lopsided, sickly grey-violet, veins across it.
  part(c, (x, y) => ell(cx, 92, 50, 52)(x, y) || ell(cx + 18, 104, 38, 40)(x, y), SKIN, (x, y) => {
    const v = Math.sin(x * 0.3 + Math.sin(y * 0.2) * 3) + Math.cos(y * 0.25);
    return Math.abs(v) < 0.05 && hash(x, y) > 0.3 ? '#a85ad8' : null;
  });
  // Ears.
  for (const ex of [44, 146]) part(c, ell(ex, 96, 7, 12), SKIN);
  // The cap, too small for him now: green with the orange stripe, the brim cracked.
  part(c, (x, y) => ell(cx, 50, 46, 30)(x, y) && y < 56, CAP);
  part(c, (x, y) => y >= 44 && y < 50 && Math.abs(x - cx) < 44, ['#ffd080', '#f28c28', '#c8641a', '#8a3e10']);
  part(c, (x, y) => y >= 54 && y < 62 && x > cx - 64 && x < cx + 30 + (y - 54), CAP);
  // Brows and eyes: furrowed, glowing yellow, one bigger than the other.
  for (const [ex, er] of [[cx - 20, 9], [cx + 20, 12]]) {
    part(c, ell(ex, 82, er, er * 0.75), ['#fffbd0', '#ffe14a', '#f8b020', '#a86a08']);
    c.rect(ex - 2, 80, 4, 4, hex('#3a1010'));
    part(c, poly([[ex - er - 3, 70], [ex + er + 3, 66 + (ex > cx ? -4 : 4)], [ex + er + 3, 70 + (ex > cx ? -4 : 4)], [ex - er - 3, 74]]), ['#3a2836', '#2a1a26', '#1a1018', '#100810']);
  }
  // Nose, and a huge manic grin full of teeth, mustard drooling from it.
  part(c, ell(cx + 2, 102, 9, 7), SKIN);
  part(c, (x, y) => ell(cx + 4, 126, 38, 16)(x, y) && y > 120 - Math.abs(x - cx - 4) * 0.25, ['#7a2030', '#5a1424', '#3a0a18', '#1e0610']);
  for (let x = cx - 28; x < cx + 36; x += 6) { part(c, poly([[x, 120 - Math.abs(x - cx) * 0.25], [x + 5, 120 - Math.abs(x - cx) * 0.25], [x + 2.5, 128]]), ['#ffffff', '#f4f0e0', '#d8d0b8', '#a89a80']); }
  for (const dx of [-14, 8, 22]) for (let j = 0; j < 10 + (dx % 3) * 3; j++) c.set(cx + dx, 136 + j, hex(j % 4 === 0 ? '#fff080' : '#f8d020'));
  outline(c);
  glow(c, cx - 20, 82, 16, hex('#ffe14a'), 0.5);
  glow(c, cx + 20, 82, 20, hex('#ffe14a'), 0.5);
  // His minions: hotdogs with angry faces and little legs.
  const dogs = new Canvas(140, 30);
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 46, y = 6;
    sprite(dogs, 'hotdog', x, y, { scale: 2 });
    dogs.rect(x + 9, y + 3, 2, 2, K); dogs.rect(x + 17, y + 3, 2, 2, K);
    dogs.rect(x + 8, y + 1, 4, 1, K); dogs.rect(x + 16, y + 1, 4, 1, K);
    for (const lx of [x + 6, x + 20]) dogs.rect(lx, y + 12, 1, 4 + (i % 2), K);
  }
  outline(dogs);
  return { c, dogs };
}

const out = process.argv[2] ?? require('path').join(__dirname, 'final-forms-sheet.png');
const ch = chimera(), id = idol(), { c: jr, dogs } = jared();
const W = 10 + ch.w + 10 + id.w + 10 + jr.w + 10, H = 215;
const sheet = new Canvas(W, H, [20, 22, 38, 255]);
const put = (src, dx, dy) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const p = src.get(x, y); if (p[3] > 0) sheet.set(dx + x, dy + y, p); } };
put(ch, 10, 20);
put(id, 20 + ch.w, 10);
put(jr, 30 + ch.w + id.w, 0);
put(dogs, 30 + ch.w + id.w + 26, 180);
sheet.write(out, 3, [20, 22, 38]);
console.log('ok', W * 3, H * 3);
