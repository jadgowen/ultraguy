import Phaser from 'phaser';
import { PHYS, PLAYER_MAX_HP, TILE } from '../constants';
import { moveX, moveY, touchesSpike } from '../physics';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'climb' | 'hurt' | 'dead';

/**
 * The hero, written as a state machine. Each state owns its own update so
 * jumping, ladders and damage never tangle together.
 */
export class Player {
  x = 0;
  y = 0;
  readonly w = 12;
  readonly h = 22;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  state: PlayerState = 'idle';
  grounded = false;
  hp = PLAYER_MAX_HP;
  invuln = 0;
  shootPose = 0;
  private hurtTimer = 0;
  private knockDir = 0;
  deadTimer = 0;
  private animT = 0;
  private climbT = 0;
  private ladderCol = 0;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(private g: GameScene) {
    this.sprite = g.add.image(0, 0, 'p_idle').setOrigin(0.5, 1).setDepth(10);
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  get bottom(): number {
    return this.y + this.h;
  }
  get alive(): boolean {
    return this.state !== 'dead';
  }

  reset(cx: number, bottom: number): void {
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
    this.vx = this.vy = 0;
    this.facing = 1;
    this.state = 'idle';
    this.grounded = true;
    this.hp = PLAYER_MAX_HP;
    this.invuln = this.shootPose = this.hurtTimer = this.deadTimer = 0;
    this.sprite.setVisible(true);
  }

  update(): void {
    if (this.state === 'dead') {
      this.deadTimer--;
      return;
    }
    if (this.invuln > 0) this.invuln--;
    if (this.shootPose > 0) this.shootPose--;
    this.animT++;

    switch (this.state) {
      case 'hurt':
        this.updateHurt();
        break;
      case 'climb':
        this.updateClimb();
        break;
      default:
        this.updateNormal();
    }

    if (this.alive && this.invuln === 0 && touchesSpike(this.g.level, this)) this.die(true);
  }

  // --- states -------------------------------------------------------------

  private updateNormal(): void {
    const c = this.g.controls;
    const L = this.g.level;
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;

    // Ladders: grab with up when overlapping one, or down when standing on its top.
    const col = Math.floor(this.cx / TILE);
    if (c.isDown('up') && this.ladderOverlap(col)) {
      this.startClimb(col);
      return;
    }
    if (c.isDown('down') && this.grounded && L.isLadderTop(col, Math.floor(this.bottom / TILE))) {
      this.startClimb(col);
      this.y += 6;
      return;
    }

    if (c.justPressed('jump') && this.grounded) {
      this.vy = -PHYS.jump;
      this.grounded = false;
    }
    // Variable jump height: letting go of jump kills upward speed.
    if (!c.isDown('jump') && this.vy < 0) this.vy = 0;

    this.vx = dir * PHYS.run; // no acceleration: full speed or stopped
    this.applyMotion();

    this.state = this.grounded ? (dir !== 0 ? 'run' : 'idle') : this.vy < 0 ? 'jump' : 'fall';
    if (c.justPressed('fire')) this.shoot();
  }

  private updateClimb(): void {
    const c = this.g.controls;
    const L = this.g.level;
    const col = this.ladderCol;

    if (c.justPressed('jump')) {
      this.state = 'fall';
      this.vy = 0;
      return;
    }
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;

    if (c.justPressed('fire')) this.shoot();
    if (this.shootPose > 0) return; // shooting pauses climbing

    const up = c.isDown('up');
    const down = c.isDown('down');
    if (up && !down) {
      this.y -= PHYS.climb;
      this.climbT++;
      const feetRow = Math.floor((this.bottom - 1) / TILE);
      if (!L.isLadder(col, feetRow)) {
        // Climbed off the top: stand on the ladder top.
        this.y = (feetRow + 1) * TILE - this.h;
        this.toGround();
      }
    } else if (down && !up) {
      this.climbT++;
      if (moveY(L, this, PHYS.climb, false)) {
        this.toGround();
      } else if (!this.ladderOverlap(col)) {
        this.state = 'fall';
        this.vy = 0;
      }
    }
  }

  private updateHurt(): void {
    this.hurtTimer--;
    this.vx = this.knockDir * PHYS.knockback;
    this.applyMotion();
    if (this.hurtTimer <= 0) this.state = this.grounded ? 'idle' : 'fall';
  }

  // --- helpers ------------------------------------------------------------

  private applyMotion(): void {
    const L = this.g.level;
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    moveX(L, this, this.vx);
    const falling = this.vy > 0;
    const wasGrounded = this.grounded;
    const hit = moveY(L, this, this.vy, true);
    this.grounded = hit && falling;
    if (hit) this.vy = 0;
    if (this.grounded && !wasGrounded) sfx.land();
  }

  private ladderOverlap(col: number): boolean {
    const r0 = Math.floor(this.y / TILE);
    const r1 = Math.floor((this.bottom - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) if (this.g.level.isLadder(col, r)) return true;
    return false;
  }

  private startClimb(col: number): void {
    this.state = 'climb';
    this.ladderCol = col;
    this.x = col * TILE + TILE / 2 - this.w / 2;
    this.vx = this.vy = 0;
    this.grounded = false;
  }

  private toGround(): void {
    this.state = 'idle';
    this.grounded = true;
    this.vy = 0;
  }

  private shoot(): void {
    if (this.g.firePlayerBullet(this.cx + this.facing * 12, this.y + 12, this.facing)) this.shootPose = 16;
  }

  hurt(dmg: number, sourceX: number): void {
    if (this.invuln > 0 || this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp === 0) {
      this.die(true);
      return;
    }
    sfx.hurt();
    this.state = 'hurt';
    this.hurtTimer = PHYS.hurtFrames;
    this.invuln = PHYS.invulnFrames;
    this.knockDir = sourceX > this.cx ? -1 : 1;
    this.facing = (-this.knockDir) as 1 | -1;
    if (this.vy < 0) this.vy = 0;
  }

  die(explode: boolean): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.hp = 0;
    this.deadTimer = 150;
    this.sprite.setVisible(false);
    if (explode) this.g.playerBurst(this.cx, this.cy);
    sfx.die();
  }

  heal(n: number): void {
    this.hp = Math.min(PLAYER_MAX_HP, this.hp + n);
  }

  // --- rendering ----------------------------------------------------------

  render(): void {
    if (this.state === 'dead') return;
    const s = this.shootPose > 0;
    let key: string;
    let flip = this.facing < 0;
    switch (this.state) {
      case 'hurt':
        key = 'p_hurt';
        break;
      case 'climb':
        if (s) key = 'p_jump_s';
        else {
          key = 'p_climb';
          flip = Math.floor(this.climbT / 8) % 2 === 1;
        }
        break;
      case 'jump':
      case 'fall':
        key = s ? 'p_jump_s' : 'p_jump';
        break;
      case 'run': {
        const cycle = ['run1', 'run2', 'run3', 'run2'][Math.floor(this.animT / 7) % 4];
        key = `p_${cycle}${s ? '_s' : ''}`;
        break;
      }
      default:
        key = s ? 'p_idle_s' : 'p_idle';
    }
    this.sprite.setTexture(key);
    this.sprite.setFlipX(flip);
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.bottom));
    // Flicker while invincible (but stay solid during the knockback pose).
    this.sprite.setVisible(this.state === 'hurt' || this.invuln === 0 || this.invuln % 4 < 2);
  }
}
