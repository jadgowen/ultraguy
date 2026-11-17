import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'toss' | 'windup' | 'dash' | 'vacuum' | 'crates';

/**
 * THE BARGAIN BARON (secret stage, MEGAMART). Rivet's rival. Weak to Saw Blade.
 *  - toss: flings arcs of gold coins at you (twice in phase 2)
 *  - dash: flashes, then charges across behind a SALE sign, shedding coins
 *  - vacuum: sucks you toward him while firing coins straight out (walk away!)
 *  - crates (phase 2): unsold stock drops from the ceiling where you stand
 */
export class Baron extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'baron', 28, 38, 'saw', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = this.quick(wait);
  }

  private coin(vx: number, vy: number, gravity: boolean): void {
    this.g.spawnEnemyShot({ x: this.cx - 4, y: this.y + 12, w: 8, h: 8, vx, vy, tex: 'coin', dmg: 3, gravity, spin: 0.3, life: 200 });
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
        if (this.t === 16 || (this.phase2 && this.t === 44)) {
          const air = 44;
          const base = (p.cx - this.cx) / air;
          for (const spread of [-0.7, 0, 0.7]) this.coin(Phaser.Math.Clamp(base + spread, -3.2, 3.2), -5, true);
          sfx.pickup();
        }
        if (this.t >= (this.phase2 ? 70 : 46)) this.setMode('idle', 30);
        break;

      case 'windup':
        this.physics();
        if (this.t >= (this.phase2 ? 18 : 28)) {
          this.setMode('dash');
          this.vx = this.facing * (this.phase2 ? 4.2 : 3.4);
        }
        break;

      case 'dash':
        if (this.t % 10 === 0) this.coin(0, -2, true);
        if (this.physics().wall) {
          this.g.shake(5);
          sfx.land();
          this.vx = 0;
          this.setMode('idle', 34);
        }
        break;

      case 'vacuum': {
        this.physics();
        this.facePlayer();
        const active = this.t > 16 && this.t < (this.phase2 ? 130 : 100);
        if (active) {
          // Pulled toward the Baron; walking away at full speed still escapes.
          this.g.wind = Math.sign(this.cx - p.cx) * (this.phase2 ? 1.0 : 0.85);
          if (this.t % 4 === 0) this.g.windStreak(Math.sign(this.cx - p.cx));
          if (this.t % 18 === 0) {
            this.coin(this.facing * 2.6, 0, false);
            sfx.enemyShot();
          }
        }
        if (this.t >= (this.phase2 ? 140 : 110)) this.setMode('idle', 28);
        break;
      }

      case 'crates':
        this.physics();
        if (this.t === 16 || this.t === 40 || this.t === 64) {
          const x = Phaser.Math.Clamp(p.cx, this.room.left + 8, this.room.right - 8);
          this.g.spawnEnemyShot({ x: x - 7, y: this.room.top, w: 14, h: 14, vx: 0, vy: 0, tex: 'nut_cache', dmg: 4, gravity: true });
          sfx.crush();
        }
        if (this.t >= 90) this.setMode('idle', 30);
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['toss', 'windup', 'vacuum', 'toss'];
    if (this.phase2) options.push('crates');
    const pool = this.withEx(options, 'crates').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return this.mode === 'windup' && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'throw';
  }

  protected pose(): string {
    if (this.mode === 'windup' || this.mode === 'dash') return 'dash';
    if ((this.mode === 'toss' && this.t >= 8 && this.t < 30) || this.mode === 'vacuum' || this.mode === 'crates') return 'throw';
    return 'idle';
  }
}
