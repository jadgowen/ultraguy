// Shared scaffolding for the boss design mockups (anvil.html, magma.html and
// volt.html came first and carry their own copy). A page calls Kit.start({...})
// with its palette, move timeline, pose() and designs; each design's draw(P)
// returns { b: Buf, glow: {...} }, and the page's effects(env) draws the extras.

/* eslint-disable no-unused-vars */
class Buf {
  constructor(w, h, pal) { this.w = w; this.h = h; this.pal = pal; this.c = new Array(w * h).fill(''); }
  part(inside, ramp, { shine = true } = {}) {
    const { w, h } = this;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) m[y * w + x] = 1;
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || at(nx, ny)) continue;
        if (this.c[ny * w + nx]) this.c[ny * w + nx] = 'K';
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      let c = ramp.base;
      if (!at(x, y - 1)) c = shine && !at(x - 1, y) ? ramp.shine : ramp.light;
      else if (!at(x - 1, y) && at(x, y + 1)) c = ramp.light;
      else if (!at(x, y + 1)) c = ramp.dark;
      else if (!at(x + 1, y)) c = ramp.dark;
      this.c[y * w + x] = c;
    }
  }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = c; }
  rect(x0, y0, w, h, c) { for (let y = Math.round(y0); y < Math.round(y0) + h; y++) for (let x = Math.round(x0); x < Math.round(x0) + w; x++) this.px(x, y, c); }
  line(pts, c) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= n; k++) this.px(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c);
    }
  }
  outline() {
    const { w, h } = this;
    const out = this.c.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.c[y * w + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && this.c[ny * w + nx] && this.c[ny * w + nx] !== 'K') { out[y * w + x] = 'K'; break; }
      }
    }
    this.c = out;
  }
  draw(ctx, ox, oy, s) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.c[y * this.w + x];
      if (!c) continue;
      ctx.fillStyle = this.pal[c];
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
}
const capsule = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r;
};
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rrect = (x0, y0, x1, y1, rad = 1) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + rad, Math.min(x1 - rad, x));
  const cy = Math.max(y0 + rad, Math.min(y1 - rad, y));
  return Math.hypot(x - cx, y - cy) <= rad + 0.01;
};
const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const or = (...fs) => (x, y) => fs.some((f) => f(x, y));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

function glowAt(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'source-over';
}

const Kit = {
  start(cfg) {
    const W = cfg.W ?? 48, H = cfg.H ?? 44, S = 5;
    const LOOP = cfg.moves.reduce((a, m) => a + m.len, 0);
    const moveAt = (f) => {
      let t = f % LOOP;
      for (const m of cfg.moves) { if (t < m.len) return { name: m.name, t, k: t / m.len }; t -= m.len; }
      return { name: cfg.moves[0].name, t: 0, k: 0 };
    };
    document.title = `${cfg.name} design mockups`;
    document.body.innerHTML = `<h1>${cfg.name}: design mockups</h1><p class="lead">${cfg.lead}</p>
      <div class="controls"><label><input type="checkbox" id="slow" /> slow motion</label>
      <label><input type="checkbox" id="fx" checked /> effects</label></div><div class="grid" id="grid"></div>`;
    const sheet = new Image(); sheet.src = '/assets/sprites.png';
    let frames = null; fetch('/assets/sprites.json').then((r) => r.json()).then((j) => (frames = j));
    const heroImg = new Image(); heroImg.src = '/assets/hero.png';
    let heroMeta = null; fetch('/assets/hero.json').then((r) => r.json()).then((j) => (heroMeta = j));
    const cards = [];
    const add = (d) => {
      const card = document.createElement('div');
      card.className = 'card' + (d.current ? ' current' : '');
      card.innerHTML = `<h2>${d.name}</h2><div class="tag">${d.tag}</div>`;
      const big = document.createElement('canvas'); big.width = 92 * S; big.height = 66 * S; card.appendChild(big);
      const row = document.createElement('div'); row.className = 'poses';
      const minis = [];
      for (const [label, m] of cfg.minis) {
        const wrap = document.createElement('div');
        const c = document.createElement('canvas'); c.width = 52 * 2; c.height = 48 * 2;
        wrap.appendChild(c); wrap.appendChild(document.createTextNode(label)); row.appendChild(wrap);
        minis.push({ c, m });
      }
      card.appendChild(row);
      document.getElementById('grid').appendChild(card);
      cards.push({ d, big, minis, bits: [], state: {} });
    };
    add({ id: 'current', current: true, name: 'CURRENT', tag: cfg.currentTag });
    cfg.designs.forEach(add);
    const drawCurrent = (ctx, m, x, y, s, lift, alpha = 1) => {
      if (!frames || !sheet.complete) return;
      const key = cfg.currentFrame(m);
      if (!frames[key]) return;
      const [fx, fy, fw, fh] = frames[key];
      ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha;
      ctx.drawImage(sheet, fx, fy, fw, fh, x - (fw / 2) * s, y - fh * s - lift * s, fw * s, fh * s);
      ctx.globalAlpha = 1;
    };
    let f = 0;
    const tick = () => {
      f += document.getElementById('slow').checked ? 0.25 : 1;
      const fx = document.getElementById('fx').checked;
      const fi = Math.floor(f);
      const m = moveAt(fi);
      const P = cfg.pose(m, fi);
      for (const card of cards) {
        const ctx = card.big.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, card.big.width, card.big.height);
        const groundY = 60 * S;
        cfg.backdrop?.(ctx, card.big.width, card.big.height, groundY, S);
        ctx.fillStyle = cfg.floor[0]; ctx.fillRect(0, groundY, card.big.width, card.big.height - groundY);
        ctx.fillStyle = cfg.floor[1]; ctx.fillRect(0, groundY, card.big.width, S);
        if (heroMeta && heroImg.complete) {
          const fw = heroMeta.frameWidth, fh = heroMeta.frameHeight, idx = heroMeta.frames.idle1 ?? 0, cols = Math.max(1, Math.floor(heroImg.width / fw));
          ctx.drawImage(heroImg, (idx % cols) * fw, Math.floor(idx / cols) * fh, fw, fh, 6 * S, groundY - fh * S, fw * S, fh * S);
        }
        const place = cfg.place(m, P); // { x, lift, alpha, flip }
        const env = { ctx, m, P, fi, S, groundY, card, fx, W, H, place };
        if (card.d.current) {
          drawCurrent(ctx, m, place.x * S, groundY, S, place.lift ?? 0, place.alpha ?? 1);
          cfg.effects?.({ ...env, current: true, ox: (place.x - W / 2) * S, oy: groundY - H * S - (place.lift ?? 0) * S, glow: null });
        } else {
          const { b, glow } = card.d.draw(P);
          const ox = (place.x - W / 2) * S, oy = groundY - H * S - (place.lift ?? 0) * S;
          ctx.fillStyle = `rgba(0,0,0,${0.3 - Math.min(0.2, (place.lift ?? 0) / 90)})`;
          ctx.beginPath(); ctx.ellipse(place.x * S, groundY + S, (15 - Math.min(7, (place.lift ?? 0) / 4)) * S, 2 * S, 0, 0, Math.PI * 2); ctx.fill();
          ctx.save();
          if (place.flip) { ctx.translate(ox * 2 + W * S, 0); ctx.scale(-1, 1); }
          ctx.globalAlpha = place.alpha ?? 1;
          b.draw(ctx, ox, oy, S);
          ctx.restore();
          if (fx) cfg.effects?.({ ...env, ox, oy, glow, flipX: place.flip ? (gx) => ox * 2 + W * S - gx : (gx) => gx });
        }
        for (const mini of card.minis) {
          const c = mini.c.getContext('2d');
          c.imageSmoothingEnabled = false;
          c.clearRect(0, 0, mini.c.width, mini.c.height);
          c.fillStyle = cfg.floor[0]; c.fillRect(0, 44 * 2, mini.c.width, 8);
          if (card.d.current) drawCurrent(c, mini.m, 26 * 2, 44 * 2, 2, 0);
          else {
            const PP = cfg.pose(mini.m, 0);
            const { b } = card.d.draw(PP);
            b.draw(c, (26 - W / 2) * 2, 44 * 2 - H * 2, 2);
          }
        }
      }
      requestAnimationFrame(tick);
    };
    window.tick = tick;
    window.Kit.frameNow = () => f;
    window.Kit.setFrame = (v) => (f = v);
    window.Kit.loop = LOOP;
    requestAnimationFrame(tick);
  },
  /** Particles kept per card: add with push(card, {...}), step+draw with run(env, draw). */
  push(card, p) { card.bits.push(p); },
  run(env, draw) {
    for (const p of env.card.bits) { p.x += p.vx ?? 0; p.y += p.vy ?? 0; p.vy = (p.vy ?? 0) + (p.g ?? 0); p.life--; draw(p); }
    env.card.bits = env.card.bits.filter((p) => p.life > 0);
  },
};
window.Kit = Kit;
