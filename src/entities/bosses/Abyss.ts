import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, BossTarget, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'drift' | 'warn' | 'open' | 'close' | 'stun';

/** A wall pod: a little eye in the arena wall that fires while the big one is shut. */
interface Pod {
  x: number;
  y: number;
  hp: number;
  /** Steps until it fires (it glows for the last 24). */
  t: number;
  img: Phaser.GameObjects.Image;
  flash: number;
}

const POD_HP = 3;
const POD_SIZE = 14;
const POD_RESPAWN = 420;

/**
 * ABYSS EYE (Fortress 2 guardian). Weak to Frost Spike.
 *
 * A great eye floating in a tall chamber of ledges. While its lids are shut,
 * shots bounce off. It drifts from perch to perch (some only reachable from
 * the ledges), cracks its lids (the tell), then opens wide to attack: that's
 * your window. Four pods in the walls shoot at you while it's shut; destroy
 * all four and it reels, staring wide open, for a long beat (they grow back).
 *  - open: a ring of orbs, or three aimed at you (both at half health)
 *  - EX: the pods fire twice as often
 */
export class Abyss extends Boss {
  private mode: Mode = 'drift';
  private target = { x: 0, y: 0 };
  private perch = -1;
  private attack: 'ring' | 'stare' = 'ring';
  private pods: Pod[] = [];
  private readonly fx: BossFx;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'abyss', 34, 34, 'frost', at, room);
    this.fx = new BossFx(g);
  }

  /** Where it hovers (centers, each level with where your gun is on a tier): one low, two by the lower ledges, two up by the high ones. */
  private perches(): { x: number; y: number }[] {
    const { left, floor } = this.room;
    const at = (col: number, up: number) => ({ x: left + col * 16, y: floor - up });
    return [at(16, 24), at(6, 58), at(26, 58), at(12, 106), at(20, 106)];
  }

  protected begin(): void {
    // The pods open in the walls: two on each side, level with the two tiers of ledges.
    const { left, right, floor } = this.room;
    for (const [x, y] of [[left + 1, floor - 113], [left + 1, floor - 65], [right - POD_SIZE - 1, floor - 113], [right - POD_SIZE - 1, floor - 65]]) {
      this.pods.push({ x, y, hp: POD_HP, t: 60 + this.pods.length * 40, img: this.g.add.image(x, y, 'abyss_pod').setOrigin(0).setDepth(5.8), flash: 0 });
    }
    this.goTo();
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.t = 0;
  }

  /** Off to another perch. */
  private goTo(): void {
    const ps = this.perches();
    let i = Phaser.Math.Between(0, ps.length - 1);
    if (i === this.perch) i = (i + 1 + Phaser.Math.Between(0, ps.length - 2)) % ps.length;
    this.perch = i;
    this.target = ps[i];
    this.setMode('drift');
  }

  /** Fly toward the target center; true when there. */
  private fly(speed: number): boolean {
    const dx = this.target.x - this.cx;
    const dy = this.target.y - this.cy;
    const d = Math.hypot(dx, dy);
    if (d <= speed) {
      this.x += dx;
      this.y += dy;
      return true;
    }
    this.x += (dx / d) * speed;
    this.y += (dy / d) * speed;
    return false;
  }

  /** Lids shut (or only cracked): shots bounce off. */
  blocksShots(): boolean {
    return this.state === 'fight' && this.mode !== 'open' && this.mode !== 'stun';
  }

  targets(): BossTarget[] {
    return this.pods
      .filter((p) => p.hp > 0)
      .map((p) => ({
        x: p.x,
        y: p.y,
        w: POD_SIZE,
        h: POD_SIZE,
        hit: (dmg: number) => {
          if (p.flash > 0) return;
          p.hp = Math.max(0, p.hp - Math.max(1, dmg));
          p.flash = 10;
          if (p.hp === 0) this.popPod(p);
        },
      }));
  }

  private popPod(p: Pod): void {
    p.img.setVisible(false);
    p.t = POD_RESPAWN;
    sfx.enemyDie();
    this.g.burst(p.x + POD_SIZE / 2, p.y + POD_SIZE / 2, 'spark', 8);
    this.g.shake(2);
    if (this.pods.every((q) => q.hp === 0)) {
      // All four gone: it reels, wide open.
      this.setMode('stun');
      sfx.weakHit();
    }
  }

  private orb(vx: number, vy: number, x = this.cx, y = this.cy): void {
    this.g.spawnEnemyShot({ x: x - 4, y: y - 4, w: 8, h: 8, vx, vy, tex: 'vorb', dmg: 3 });
  }

  protected think(): void {
    const p = this.g.player;
    const fast = this.phase2;
    this.facePlayer();
    this.stepPods();
    switch (this.mode) {
      case 'drift':
        if (this.fly(fast ? 2 : 1.5) && this.t > 20) this.setMode('warn');
        break;

      case 'warn':
        // The lids crack and tremble: it's about to open.
        this.target.y += Math.sin(this.t * 0.8) * 0.3;
        if (this.t >= this.quick(fast ? 18 : 28)) {
          this.attack = Math.random() < 0.5 ? 'ring' : 'stare';
          sfx.door();
          this.setMode('open');
        }
        break;

      case 'open': {
        const n = fast ? 10 : 8;
        if (this.attack === 'ring' && (this.t === 16 || (fast && this.t === 46))) {
          const off = this.t === 46 ? Math.PI / n : 0;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            this.orb(Math.cos(a) * 1.7, Math.sin(a) * 1.7);
          }
          sfx.zap();
        }
        if (this.attack === 'stare' && this.t >= 14 && this.t % 12 === 2 && this.t < (fast ? 64 : 46)) {
          const d = Math.max(1, Math.hypot(p.cx - this.cx, p.cy - this.cy));
          this.orb(((p.cx - this.cx) / d) * 2.6, ((p.cy - this.cy) / d) * 2.6);
          sfx.enemyShot();
        }
        if (this.t >= (fast ? 80 : 100)) this.setMode('close');
        break;
      }

      case 'close':
        if (this.t >= 10) this.goTo();
        break;

      case 'stun':
        // Reeling: it sinks a little and stares, wide open.
        this.y += Math.sin(this.t * 0.15) * 0.4;
        if (this.t % 10 === 0) this.g.burst(this.cx + Phaser.Math.Between(-12, 12), this.y, 'spark', 1);
        if (this.t >= (fast ? 130 : 160)) this.setMode('close');
        break;
    }
  }

  private stepPods(): void {
    const open = this.mode === 'open' || this.mode === 'stun';
    const every = this.ex ? 90 : 170;
    for (const pod of this.pods) {
      if (pod.flash > 0) pod.flash--;
      pod.t--;
      if (pod.hp === 0) {
        // Grows back in a while (not while the eye is reeling).
        if (pod.t <= 0 && this.mode !== 'stun') {
          pod.hp = POD_HP;
          pod.t = every;
          pod.img.setVisible(true);
          this.g.burst(pod.x + POD_SIZE / 2, pod.y + POD_SIZE / 2, 'spark', 4);
        }
        continue;
      }
      // Pods hold fire while the eye is open (one threat at a time).
      if (open && pod.t < 30) pod.t = 30;
      if (pod.t <= 0) {
        const p = this.g.player;
        const x = pod.x + POD_SIZE / 2;
        const y = pod.y + POD_SIZE / 2;
        const d = Math.max(1, Math.hypot(p.cx - x, p.cy - y));
        this.orb(((p.cx - x) / d) * 2, ((p.cy - y) / d) * 2, x, y);
        sfx.enemyShot();
        pod.t = every + Phaser.Math.Between(0, 40);
      }
    }
  }

  private anchor(frame: string) {
    return BOSS_ANCHORS[`abyss_${frame}`] ?? BOSS_ANCHORS.abyss_open;
  }

  /** The frame for right now (see art/guardianArt.mjs). */
  private frame(): string {
    switch (this.mode) {
      case 'warn':
        return 'crack';
      case 'open':
        return this.t < 5 ? 'half' : this.attack === 'ring' && this.t >= 10 && this.t < 24 ? 'glare' : this.attack === 'stare' ? 'glare' : 'open';
      case 'close':
        return this.t < 5 ? 'half' : 'shut';
      case 'stun':
        return 'open';
      default:
        return 'shut';
    }
  }

  render(): void {
    super.render();
    const frame = this.posing ? 'glare' : this.state === 'fight' ? this.frame() : 'shut';
    const tremble = this.mode === 'warn' ? (this.t % 4 < 2 ? 1 : -1) : 0;
    this.sprite.setTexture(`abyss_${frame}`).setX(Math.round(this.cx) + tremble);
    const a = this.anchor(frame);
    const visible = this.sprite.visible && this.state !== 'dying';
    const glaring = frame === 'glare' || frame === 'open';
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      eye: glaring || frame === 'crack' ? a.eye : undefined,
      eyeColor: frame === 'glare' || frame === 'crack' ? 0xff4a5a : 0xc8a0ff,
      heat: 0,
      visible,
    });
    for (const pod of this.pods) {
      if (pod.hp === 0) continue;
      const hot = pod.t < 24 && !(this.mode === 'open' || this.mode === 'stun');
      pod.img.setTexture(hot ? 'abyss_pod_hot' : 'abyss_pod').setVisible(visible);
      if (pod.flash > 0 && pod.flash % 4 < 2) pod.img.setTintFill(0xffffff);
      else pod.img.clearTint();
    }
  }

  destroy(): void {
    this.fx.destroy();
    for (const p of this.pods) p.img.destroy();
    this.pods = [];
    super.destroy();
  }

  protected introPose(): string {
    return 'glare';
  }

  protected pose(): string {
    return 'shut';
  }
}
