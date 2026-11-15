import { PHYS } from '../../constants';
import { heroFrames } from '../../heroSprites';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import type { WeaponId } from '../../weapons';
import { Boss, Room } from './Boss';

type Move = WeaponId | 'charge';
const MOVES: Move[] = ['buster', 'charge', 'quake', 'thorn', 'frost', 'cyclone', 'spark', 'flame', 'saw', 'bubble'];

/**
 * SHADE (final boss, phase 2): a dark copy of UltraGuy. Same size, same
 * moves: runs, jumps, dodges your shots, and fires a random one of the hero's
 * weapons each time (charging the Ultra Gun shows a tell first).
 */
export class Shade extends Boss {
  private readonly frames: Record<string, number>;
  private move: Move = 'buster';
  private moveT = 0;
  private cooldown = 50;
  private shootPose = 0;
  private hopCooldown = 40;
  private shieldT = 0;
  private animT = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'shade', 12, 22, null, at, room);
    this.frames = heroFrames(g);
  }

  /** The Spark Ring shield bats your shots away. */
  blocksShots(): boolean {
    return this.shieldT > 0;
  }

  protected think(): void {
    const p = this.g.player;
    this.facePlayer();
    this.animT++;
    if (this.shootPose > 0) this.shootPose--;
    if (this.shieldT > 0 && --this.shieldT === 0) this.throwRing();

    // Keep a fighting distance: back off when close, close in when far.
    const dist = Math.abs(p.cx - this.cx);
    const want = this.move === 'flame' && this.moveT > 0 ? 30 : 110;
    let dir = 0;
    if (dist > want + 20) dir = this.facing;
    else if (dist < want - 20) dir = -this.facing;
    this.vx = dir * PHYS.run;

    // Hop now and then, and to dodge shots coming at it.
    if (this.grounded && --this.hopCooldown <= 0) {
      const incoming = this.g.playerShotNear(this, 60);
      if (incoming || Math.random() < 0.02) {
        this.vy = -PHYS.jump;
        this.grounded = false;
        this.hopCooldown = 30;
      }
    }
    this.physics();

    // Attacks.
    if (this.moveT > 0) {
      this.moveT--;
      this.runMove();
    } else if (--this.cooldown <= 0) {
      this.move = MOVES[Math.floor(Math.random() * MOVES.length)];
      this.moveT = this.move === 'charge' ? 50 : this.move === 'flame' ? 60 : 1;
      this.cooldown = this.phase2 ? 40 : 60;
    }
  }

  /** Fire the chosen weapon (some moves play out over several steps). */
  private runMove(): void {
    const p = this.g.player;
    const f = this.facing;
    const mx = this.cx + f * 12;
    const my = this.y + 12;
    const shot = (o: Partial<Parameters<GameScene['spawnEnemyShot']>[0]> & { tex: string; w: number; h: number }) =>
      this.g.spawnEnemyShot({ x: mx - o.w / 2, y: my - o.h / 2, vx: 0, vy: 0, dmg: 3, ...o });
    this.shootPose = 16;
    switch (this.move) {
      case 'buster':
        shot({ tex: 'bullet', w: 6, h: 4, vx: f * 4 });
        sfx.shoot();
        break;
      case 'charge':
        // 50-step charge with a visible tell, then a big blast.
        this.shootPose = 0;
        if (this.moveT === 0) {
          shot({ tex: 'charge2', w: 22, h: 14, vx: f * 4.5, dmg: 5 });
          sfx.chargeShot();
          this.shootPose = 16;
        } else if (this.moveT % 10 === 0) sfx.charge(this.moveT < 25 ? 2 : 1);
        break;
      case 'quake':
        this.g.fireGroundWave(this.cx + f * 6 - 4, this.room.floor, f, 'pwave');
        sfx.quake();
        break;
      case 'thorn':
        shot({ tex: 'thorn', w: 10, h: 10, vx: f * 3.4, ax: -f * 0.075, spin: 0.45, life: 170 });
        sfx.thorn();
        break;
      case 'frost':
        shot({ tex: 'frost', w: 12, h: 6, vx: f * 5 });
        sfx.freeze();
        break;
      case 'cyclone':
        this.g.spawnEnemyShot({ x: mx - 9, y: this.room.floor - 22, w: 18, h: 22, vx: f * 1.8, vy: 0, tex: 'cyclone0', dmg: 4, life: 240 });
        sfx.cyclone();
        break;
      case 'spark':
        this.shieldT = 90; // ring circles Shade, then gets thrown
        sfx.freeze();
        break;
      case 'flame':
        // Walks in close, then bursts.
        if (Math.abs(p.cx - this.cx) < 50 || this.moveT === 0) {
          this.g.spawnEnemyShot({ x: f > 0 ? this.cx + 4 : this.cx - 32, y: this.y + 3, w: 28, h: 16, vx: 0, vy: 0, tex: 'flamejet', dmg: 4, life: 18 });
          sfx.flame();
          this.moveT = 0;
        } else this.shootPose = 0;
        break;
      case 'saw': {
        const a = Math.atan2(p.cy - my, p.cx - mx);
        for (const sp of [-0.25, 0, 0.25]) shot({ tex: 'sawblade', w: 10, h: 10, vx: Math.cos(a + sp) * 4, vy: Math.sin(a + sp) * 4, spin: 0.5 });
        sfx.thorn();
        break;
      }
      case 'bubble':
        shot({ tex: 'pbubble', w: 12, h: 12, vx: f * 2, vy: -1.5, bounces: true, life: 220 });
        sfx.bubble();
        break;
    }
  }

  private throwRing(): void {
    this.g.spawnEnemyShot({ x: this.cx - 14, y: this.cy - 14, w: 28, h: 28, vx: this.facing * 3, vy: 0, tex: 'sparkring', dmg: 3, spin: 0.25 });
  }

  protected pose(): string {
    return 'idle'; // unused: render() draws hero frames instead
  }

  render(): void {
    const s = this.shootPose > 0 ? '_s' : '';
    let name: string;
    if (!this.grounded) name = `jump${s}`;
    else if (Math.abs(this.vx) > 0) name = ['run1', 'run2', 'run3', 'run2'][Math.floor(this.animT / 7) % 4] + s;
    else name = `idle${s}`;
    if (this.posing) name = 'idle_s'; // intro: arm cannon raised
    this.sprite.setTexture('hero_shade', this.frames[name]);
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.bottom));
    this.sprite.setAlpha(1);
    const charging = this.move === 'charge' && this.moveT > 0;
    if (this.flash > 0 && this.flash % 4 < 2) this.sprite.setTintFill(0xffffff);
    else if (charging && this.animT % 4 < 2) this.sprite.setTintFill(this.moveT < 25 ? 0xffe14a : 0x8af0ff);
    else this.sprite.clearTint();
    // Spark Ring circling Shade while the shield is up.
    this.g.drawShadeRing(this.shieldT > 0 ? this : null);
  }
}
