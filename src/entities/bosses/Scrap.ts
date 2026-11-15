import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'toss' | 'magnet' | 'stomp';

/**
 * SCRAP (Scrapyard). Weak to Flame Burst.
 *  - toss: throws saw blades that land and roll along the floor (jump them)
 *  - magnet: drags you toward it while junk orbits in (walk away!)
 *  - stomp: big jump; landing shakes scrap loose from the ceiling
 */
export class Scrap extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'scrap', 26, 22, 'flame', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = wait;
  }

  protected think(): void {
    const p = this.g.player;
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;

      case 'toss':
        this.physics();
        if (this.t === 14 || this.t === 40 || (this.phase2 && this.t === 66)) {
          this.facePlayer();
          this.g.spawnEnemyShot({ x: this.cx - 7, y: this.y, w: 14, h: 14, vx: this.facing * 2, vy: -3, tex: 'sawshot', dmg: 4, spin: 0.4 * this.facing, rolls: true });
          sfx.thorn();
        }
        if (this.t >= (this.phase2 ? 90 : 64)) this.setMode('idle', 28);
        break;

      case 'magnet': {
        this.physics();
        this.facePlayer();
        const active = this.t > 16 && this.t < (this.phase2 ? 130 : 100);
        if (active) {
          // Pull toward Scrap; walking away at full speed still escapes.
          this.g.wind = Math.sign(this.cx - p.cx) * (this.phase2 ? 1.0 : 0.8);
          if (this.t % 4 === 0) this.g.windStreak(Math.sign(this.cx - p.cx));
        }
        if (this.t % 30 === 20 && active) {
          // Junk flies in from the edges toward Scrap.
          const fromLeft = this.cx > p.cx;
          const x = fromLeft ? this.room.left : this.room.right - 8;
          this.g.spawnEnemyShot({ x, y: this.room.floor - 40 - Math.random() * 40, w: 8, h: 8, vx: fromLeft ? 2.6 : -2.6, vy: 0, tex: 'scrap', dmg: 3, spin: 0.3, life: 140 });
        }
        if (this.t >= (this.phase2 ? 140 : 110)) this.setMode('idle', 28);
        break;
      }

      case 'stomp': {
        if (this.t === 1) {
          this.vx = Phaser.Math.Clamp((p.cx - this.cx) / 56, -2, 2);
          this.vy = -6.6;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.g.shake(7);
          sfx.land();
          const n = this.phase2 ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const x = Phaser.Math.Between(this.room.left + 8, this.room.right - 16);
            this.g.spawnEnemyShot({ x, y: this.room.top - i * 30, w: 8, h: 8, vx: 0, vy: 1, tex: 'scrap', dmg: 3, gravity: true, spin: 0.2 });
          }
          this.setMode('idle', 34);
        }
        break;
      }
    }
  }

  private choose(): void {
    const options: Mode[] = ['toss', 'magnet', 'stomp', 'toss'];
    const pool = options.filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected pose(): string {
    if (this.mode === 'magnet' && this.t > 16) return 'magnet';
    if (this.mode === 'toss' && this.t % 26 < 12) return 'toss';
    return 'idle';
  }
}
