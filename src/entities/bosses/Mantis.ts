import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'leap' | 'throw' | 'vanish' | 'pounce';

/**
 * MANTIS (Canopy). Weak to Cyclone.
 *  - leap: high jump that lands on the far side of the player
 *  - throw: two thorn boomerangs that fly out and curve back
 *  - vanish: fades out (can't be hit), reappears above you and drops
 */
export class Mantis extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'mantis', 22, 30, 'cyclone', at, room);
  }

  protected untouchable(): boolean {
    return this.alpha < 0.5;
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

      case 'leap': {
        if (this.t === 1) {
          // Land about 56px past the player, inside the room.
          const side = p.cx < this.cx ? -1 : 1;
          const target = Phaser.Math.Clamp(p.cx + side * 56, this.room.left + 16, this.room.right - 16);
          this.vx = (target - this.cx) / 52;
          this.vy = -6.5;
          this.grounded = false;
          this.facing = side as 1 | -1;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          sfx.land();
          this.facePlayer();
          this.setMode('idle', this.phase2 ? 14 : 28);
        }
        break;
      }

      case 'throw':
        this.physics();
        if (this.t === 14 || (this.phase2 && this.t === 30)) {
          for (const dy of [-8, 8]) {
            this.g.spawnEnemyShot({
              x: this.cx - 5,
              y: this.cy + dy - 5,
              w: 10,
              h: 10,
              vx: this.facing * 3.4,
              vy: 0,
              ax: -this.facing * 0.075, // slows, then comes back
              tex: 'bthorn',
              dmg: 3,
              spin: 0.3,
              life: 170,
            });
          }
          sfx.enemyShot();
        }
        if (this.t >= (this.phase2 ? 44 : 30)) this.setMode('idle', this.phase2 ? 20 : 36);
        break;

      case 'vanish':
        // Fade out, hang invisible, then reappear above the player.
        this.physics();
        this.alpha = Math.max(0, 1 - this.t / 24);
        if (this.t === 50) {
          this.x = Phaser.Math.Clamp(p.cx - this.w / 2, this.room.left, this.room.right - this.w);
          this.y = this.room.top;
          this.vx = this.vy = 0;
          this.grounded = false;
          this.setMode('pounce');
        }
        break;

      case 'pounce':
        this.alpha = Math.min(1, this.t / 12);
        if (this.t < 16) break; // hover while it fades in (the tell)
        if (this.physics().landed) {
          this.g.shake(4);
          sfx.land();
          this.alpha = 1;
          this.setMode('idle', this.phase2 ? 18 : 32);
        }
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['leap', 'leap', 'throw', 'vanish'];
    const pool = options.filter((m) => !(m === 'vanish' && this.last === 'vanish'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected introPose(): string {
    return 'throw';
  }

  protected pose(): string {
    if (!this.grounded) return 'jump';
    if (this.mode === 'throw' && this.t >= 8) return 'throw';
    return 'idle';
  }
}
