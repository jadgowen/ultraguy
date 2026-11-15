import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'rise' | 'hover' | 'blow' | 'tornado' | 'aim' | 'dive' | 'recover';

/**
 * GALE (Stratos). Weak to Frost Spike. Flies after the intro.
 *  - blow: a gust that pushes you toward the far wall (fight it by walking)
 *  - tornado: fires small tornadoes low and high (jump or duck under)
 *  - dive: flashes, then swoops at where you're standing
 */
export class Gale extends Boss {
  private mode: Mode = 'rise';
  private hoverY: number;
  private side: 1 | -1 = 1;
  private last: Mode | null = null;
  private diveVx = 0;
  private diveVy = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'gale', 26, 26, 'frost', at, room);
    // Low enough that a jumping shot reaches it, high enough to walk under.
    this.hoverY = room.floor - 60;
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.t = 0;
  }

  /** Fly toward a point; returns true when there. */
  private flyTo(x: number, y: number, speed: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.cy;
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

  protected think(): void {
    const p = this.g.player;
    const speed = this.phase2 ? 2.2 : 1.6;
    switch (this.mode) {
      case 'rise':
        if (this.flyTo(this.cx, this.hoverY, 1.5)) this.setMode('hover');
        break;

      case 'hover': {
        // Drift to one side of the room, bobbing, then attack.
        const tx = this.side > 0 ? this.room.right - 56 : this.room.left + 56;
        this.flyTo(tx, this.hoverY + Math.sin(this.t * 0.08) * 6, speed);
        this.facePlayer();
        if (this.t >= (this.phase2 ? 50 : 70)) this.choose();
        break;
      }

      case 'blow': {
        this.facePlayer();
        const active = this.t > 20 && this.t < (this.phase2 ? 140 : 110);
        if (active) {
          // Push away from Gale. Walking against it at full speed still gains ground.
          this.g.wind = this.facing * (this.phase2 ? 1.1 : 0.9);
          if (this.t % 3 === 0) this.g.windStreak(this.facing);
          if (this.t % 20 === 0) sfx.wind();
        }
        if (this.phase2 && this.t === 70) this.fireTornado(p.cy);
        if (this.t >= (this.phase2 ? 150 : 120)) this.endAttack();
        break;
      }

      case 'tornado':
        this.facePlayer();
        if (this.t === 16) this.fireTornado(this.room.floor - 8);
        if (this.t === 46) this.fireTornado(this.room.floor - 40);
        if (this.phase2 && this.t === 76) this.fireTornado(this.room.floor - 8);
        if (this.t >= (this.phase2 ? 100 : 70)) this.endAttack();
        break;

      case 'aim':
        // Rise a little and flash: the dive is coming.
        this.y -= 0.4;
        this.facePlayer();
        if (this.t >= (this.phase2 ? 18 : 28)) {
          const dx = p.cx - this.cx;
          const dy = p.cy - this.cy;
          const d = Math.max(1, Math.hypot(dx, dy));
          const v = this.phase2 ? 4.5 : 3.8;
          this.diveVx = (dx / d) * v;
          this.diveVy = (dy / d) * v;
          this.setMode('dive');
        }
        break;

      case 'dive':
        this.x = Phaser.Math.Clamp(this.x + this.diveVx, this.room.left, this.room.right - this.w);
        this.y += this.diveVy;
        if (this.bottom >= this.room.floor || this.t > 90) {
          this.y = Math.min(this.y, this.room.floor - this.h);
          this.g.shake(4);
          sfx.land();
          this.setMode('recover');
        }
        break;

      case 'recover':
        if (this.t > 20 && this.flyTo(this.cx, this.hoverY, 1.8)) this.endAttack();
        break;
    }
  }

  private fireTornado(y: number): void {
    this.g.spawnEnemyShot({ x: this.cx - 5, y: y - 7, w: 10, h: 14, vx: this.facing * 2.2, vy: 0, tex: 'btornado', dmg: 3 });
    sfx.enemyShot();
  }

  private endAttack(): void {
    this.side = -this.side as 1 | -1;
    this.setMode('hover');
  }

  private choose(): void {
    const options: Mode[] = ['blow', 'tornado', 'aim'];
    const pool = options.filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return this.mode === 'aim' && this.t % 6 < 3;
  }

  protected pose(): string {
    if (this.mode === 'blow' || this.mode === 'tornado') return 'blow';
    if (this.mode === 'dive' || this.mode === 'aim') return 'dive';
    return 'idle';
  }
}
