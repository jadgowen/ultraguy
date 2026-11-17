import Phaser from 'phaser';
import { PHYS, TILE } from '../constants';
import { BASE_MAX, HELMET_MAX, PartId, armoredDamage } from '../parts';
import { conveyorUnder, moveX, moveY, standingOnIce, touchesSpike, touchesTile } from '../physics';
import { Tile } from '../level/Level';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';
import { heroFrames, LAND_STEPS, heroFrameName } from '../heroSprites';
import { WEAPON_ORDER, WeaponId, heroTexture } from '../weapons';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'climb' | 'hurt' | 'slide' | 'dead';

const STAND_H = 22;

/**
 * The hero, written as a state machine. Each state owns its own update so
 * jumping, ladders and damage never tangle together.
 */
export class Player {
  x = 0;
  y = 0;
  readonly w = 12;
  /** Body height: shorter while sliding. */
  h = STAND_H;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  state: PlayerState = 'idle';
  grounded = false;
  hp = BASE_MAX;
  invuln = 0;
  /** Armor parts found (from the save). */
  parts = new Set<PartId>();
  /** Mid-air jumps left (Jump Boots). */
  private airJumps = 0;
  shootPose = 0;
  /** Frames the fire button has been held (Ultra Gun only). */
  charge = 0;
  /** Keep horizontal momentum in the air after leaving ice. */
  private airSlide = false;
  weapon: WeaponId = 'buster';
  /** Ammo per weapon; kept across deaths, like the classics. */
  readonly ammo = Object.fromEntries(WEAPON_ORDER.map((w) => [w, BASE_MAX])) as Record<WeaponId, number>;
  private hurtTimer = 0;
  private knockDir = 0;
  deadTimer = 0;
  private animT = 0;
  /** Steps into the current run (the run cycle starts on a push-off). */
  private runT = 0;
  /** Landing squash countdown, and whether we were on the ground last frame. */
  private landT = 0;
  private wasGrounded = true;
  private climbT = 0;
  /** Steps of grace after a Spike Guard saves you. */
  private guardT = 0;
  /** Steps of slide left (keeps going while there's no room to stand). */
  private slideT = 0;
  /** Double-tap detection: the last direction tapped and how long ago. */
  private tapDir = 0;
  private tapT = 99;
  private ladderCol = 0;
  readonly sprite: Phaser.GameObjects.Image;
  private readonly frames: Record<string, number>;

  constructor(private g: GameScene, parts: PartId[] = []) {
    this.setParts(parts);
    for (const w of WEAPON_ORDER) this.ammo[w] = this.maxAmmo;
    this.frames = heroFrames(g);
    this.sprite = g.add.image(0, 0, heroTexture('buster'), this.frames.idle).setOrigin(0.5, 1).setDepth(10);
  }

  setParts(parts: PartId[]): void {
    this.parts = new Set(parts);
  }

  has(part: PartId): boolean {
    return this.parts.has(part);
  }

  /** Life and weapon energy capacity (the helmet raises both). */
  get maxHp(): number {
    return this.has('helmet') ? HELMET_MAX : BASE_MAX;
  }
  get maxAmmo(): number {
    return this.has('helmet') ? HELMET_MAX : BASE_MAX;
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
    this.hp = this.maxHp;
    this.airJumps = 0;
    this.invuln = this.shootPose = this.hurtTimer = this.deadTimer = this.charge = 0;
    this.airSlide = false;
    this.h = STAND_H;
    this.y = bottom - this.h;
    this.slideT = 0;
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
    // Run and landing timers, from where last step left us.
    this.runT = this.state === 'run' ? this.runT + 1 : 0;
    const onGround = this.grounded && this.state !== 'climb';
    if (onGround && !this.wasGrounded && this.state !== 'hurt') this.landT = LAND_STEPS;
    else if (this.landT > 0) this.landT--;
    this.wasGrounded = onGround;

    // Anything that ends a slide (a hit, a cutscene) stands you back up.
    if (this.state !== 'slide' && this.h !== STAND_H && this.alive) this.standUp();
    if (this.tapT < 99) this.tapT++;

    switch (this.state) {
      case 'hurt':
        this.updateHurt();
        break;
      case 'slide':
        this.updateSlide();
        break;
      case 'climb':
        this.updateClimb();
        break;
      default:
        this.updateNormal();
    }

    if (this.alive) this.updateCharge();
    const L = this.g.level;
    // Spikes and lava kill, unless a Spike Guard takes it: thrown clear, a little hurt, flashing.
    if (this.guardT > 0) this.guardT--;
    const deadly = (this.invuln === 0 && touchesSpike(L, this)) || touchesTile(this, (c, r) => L.isLava(c, r), 4);
    if (this.alive && deadly && this.guardT === 0) {
      if (this.invuln === 0 && this.g.useGuard()) {
        this.hurt(4, this.cx - this.facing);
        this.vy = -PHYS.jump * 1.2;
        this.grounded = false;
        this.guardT = 45; // a moment to get clear
      } else if (this.invuln === 0 || !touchesSpike(L, this)) this.die(true);
    }
    if (this.alive && this.g.electricOn && touchesTile(this, (c, r) => L.isElectric(c, r), 3)) {
      this.hurt(PHYS.electricDamage, this.cx - this.facing);
    }
  }

  /** Center of the body is in a water tile. */
  get inWater(): boolean {
    return this.g.level.isWater(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE));
  }

  /** 0 = none, 1 = half, 2 = full. */
  get chargeLevel(): number {
    return this.charge >= PHYS.chargeFull ? 2 : this.charge >= PHYS.chargeMid ? 1 : 0;
  }

  /** Hold fire to charge the Ultra Gun; release to fire the charged blast. */
  private updateCharge(): void {
    const c = this.g.controls;
    if (this.weapon !== 'buster') {
      this.charge = 0;
      return;
    }
    if (c.isDown('fire')) {
      // Without the UltraBlaster the charge stops at half power.
      if (this.has('blaster') || this.charge < PHYS.chargeMid) this.charge++;
      if (this.charge === PHYS.chargeMid) sfx.charge(1);
      if (this.charge === PHYS.chargeFull) sfx.charge(2);
    } else {
      const level = this.chargeLevel;
      this.charge = 0;
      if (level > 0 && this.g.fireWeapon(level)) this.shootPose = 16;
    }
  }

  // --- states -------------------------------------------------------------

  private updateNormal(): void {
    const c = this.g.controls;
    const L = this.g.level;
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    if (this.grounded && dir !== 0) {
      // Dust when you set off, and a scuff when you turn on the spot.
      if (this.state === 'idle') this.g.dust(this.cx - dir * 4, this.bottom, -dir, 1);
      else if (dir !== this.facing) this.g.dust(this.cx, this.bottom, -dir, 2);
    }
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

    if (this.grounded) this.airJumps = this.has('boots') ? 1 : 0;
    // Slide: DOWN + JUMP, or a quick double-tap of a direction, on the ground.
    const tapped = c.justPressed('left') ? -1 : c.justPressed('right') ? 1 : 0;
    const doubleTap = tapped !== 0 && tapped === this.tapDir && this.tapT <= 12;
    if (tapped !== 0) {
      this.tapDir = tapped;
      this.tapT = 0;
    }
    if (this.grounded && ((c.justPressed('jump') && c.isDown('down')) || doubleTap)) {
      this.startSlide();
      return;
    }
    const lifted = this.inUpdraft;
    // Hovering at the top of an updraft bobs your middle in and out of it, so feet count for jumping.
    const canAirJump = lifted || L.isUpdraft(Math.floor(this.cx / TILE), Math.floor((this.bottom - 1) / TILE));
    if (c.justPressed('jump') && this.grounded) {
      this.vy = this.inWater ? -PHYS.waterJump : -PHYS.jump;
      this.grounded = false;
      sfx.jump();
    } else if (c.justPressed('jump') && canAirJump) {
      // Rising air: you can always jump again while inside it.
      this.vy = Math.min(this.vy, -PHYS.updraftJump);
    } else if (c.justPressed('jump') && this.airJumps > 0) {
      // Jump Boots: one more jump in mid-air, with a puff under the feet.
      this.airJumps--;
      this.vy = this.inWater ? -PHYS.waterJump : -PHYS.jump * 0.9;
      this.airSlide = false;
      this.g.burst(this.cx, this.bottom, 'boom', 3);
      sfx.land();
    }
    // Variable jump height: letting go of jump kills upward speed.
    // (Not in an updraft: the air itself is what's lifting you there.)
    // (Nor after a spring: that launch isn't yours to cut short.)
    if (this.sprung && this.vy >= 0) this.sprung = false;
    if (!c.isDown('jump') && this.vy < 0 && !lifted && !this.sprung) this.vy = 0;

    const target = dir * PHYS.run;
    const onIce = this.grounded && standingOnIce(L, this);
    if (onIce) {
      // Ice: ease toward the target speed, so you keep sliding after letting go.
      this.vx += Phaser.Math.Clamp(target - this.vx, -PHYS.iceAccel, PHYS.iceAccel);
      this.airSlide = true;
    } else if (this.grounded) {
      this.vx = target; // no acceleration: full speed or stopped
      this.airSlide = false;
    } else if (dir !== 0 || !this.airSlide) {
      this.vx = target; // full air control, except a slide carries into a jump
    }
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

  // --- slide ----------------------------------------------------------------

  private startSlide(): void {
    this.state = 'slide';
    this.slideT = PHYS.slideFrames;
    this.y += STAND_H - PHYS.slideHeight;
    this.h = PHYS.slideHeight;
    this.charge = 0;
    sfx.slide();
    this.g.dust(this.cx - this.facing * 6, this.bottom, -this.facing, 3);
  }

  /** Room overhead to stand back up. */
  private canStand(): boolean {
    const L = this.g.level;
    const top = this.bottom - STAND_H;
    const c0 = Math.floor((this.x + 0.5) / TILE);
    const c1 = Math.floor((this.x + this.w - 0.5) / TILE);
    for (let r = Math.floor(top / TILE); r <= Math.floor((this.y - 0.01) / TILE); r++)
      for (let c = c0; c <= c1; c++) if (L.isSolid(c, r)) return false;
    return true;
  }

  private standUp(): void {
    this.y -= STAND_H - this.h;
    this.h = STAND_H;
  }

  private updateSlide(): void {
    const c = this.g.controls;
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    const room = this.canStand();
    this.slideT--;
    // Pushing the other way turns you around and ends it (if there's room).
    if (dir === -this.facing && room) {
      this.facing = dir as 1 | -1;
      this.slideT = 0;
    } else if (dir === -this.facing) this.facing = dir as 1 | -1;
    if (c.justPressed('jump') && room) {
      // Jump out of a slide (keeps a little of the speed).
      this.standUp();
      this.state = 'jump';
      this.vy = this.inWater ? -PHYS.waterJump : -PHYS.jump;
      this.vx = this.facing * PHYS.run;
      this.grounded = false;
      sfx.jump();
      return;
    }
    this.vx = this.facing * PHYS.slide;
    const wasX = this.x;
    this.applyMotion();
    const blocked = Math.abs(this.x - wasX) < 0.01;
    if (this.animT % 5 === 0 && this.grounded) this.g.dust(this.cx - this.facing * 6, this.bottom, -this.facing, 1);
    // Off a ledge, into a wall, or out of time: stand up (unless a ceiling is in the way).
    const over = !this.grounded || this.slideT <= 0 || (blocked && room);
    if (over && (room || !this.grounded)) {
      if (room) this.standUp();
      this.state = this.grounded ? 'idle' : 'fall';
      this.slideT = 0;
    } else if (this.slideT <= 0) this.slideT = 1; // tucked under a ceiling: keep sliding
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
    const water = this.inWater;
    // A splash going into (or out of) water.
    if (water !== this.wasInWater) {
      if (this.wasInWater !== null) {
        sfx.splash();
        this.g.burst(this.cx, this.cy, 'bubble_fx', 5);
      }
      this.wasInWater = water;
    }
    this.vy = Math.min(this.vy + (water ? PHYS.waterGravity : PHYS.gravity), water ? PHYS.waterMaxFall : PHYS.maxFall);
    if (this.inUpdraft) this.vy = Math.max(this.vy - PHYS.updraftLift, -PHYS.updraftMax);
    if (water && Math.random() < 0.03) this.g.burst(this.cx + this.facing * 4, this.y + 4, 'bubble_fx', 1);
    const belt = this.grounded ? conveyorUnder(L, this) * PHYS.conveyor : 0;
    // Gusts push less while your feet are planted.
    const gust = this.g.gust * (this.grounded ? PHYS.gustGrip : 1);
    const current = L.currentAt(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE)) * PHYS.current;
    // A current carries you: you only sink slowly while you're in one.
    if (current !== 0 && !this.g.controls.isDown('down')) this.vy = Math.min(this.vy, PHYS.currentSink);
    if (moveX(L, this, this.vx + this.g.wind + gust + belt + current)) this.vx = 0;
    const falling = this.vy > 0;
    const fallSpeed = this.vy;
    const wasGrounded = this.grounded;
    const prevBottom = this.bottom;
    const hit = moveY(L, this, this.vy, true);
    this.grounded = hit && falling;
    // Head bonk: a little knock back down, a tick and a spark off the helmet.
    if (hit && !falling && fallSpeed < -1.5) {
      sfx.tick();
      this.g.burst(this.cx, this.y, 'spark', 2);
    }
    if (hit) this.vy = 0;
    if (!this.grounded && this.vy >= 0 && this.g.landOnMover(this, prevBottom)) {
      this.grounded = true;
      this.vy = 0;
    }
    // Springs: landing on one launches you (higher if you're holding jump).
    if (this.grounded && this.onSpring()) {
      this.vy = -(this.g.controls.isDown('jump') ? PHYS.springHigh : PHYS.spring);
      this.grounded = false;
      this.sprung = true;
      this.airJumps = this.has('boots') ? 1 : 0;
      sfx.spring();
      this.g.burst(this.cx, this.bottom, 'spark', 4);
      this.g.springPop(Math.floor(this.cx / TILE), Math.floor((this.bottom + 0.5) / TILE));
      return;
    }
    if (this.grounded && !wasGrounded) {
      sfx.land();
      // Coming down hard kicks up dust both ways.
      if (fallSpeed > 3) this.g.dust(this.cx, this.bottom, 0, fallSpeed > 5.5 ? 4 : 2);
    }
  }

  /** Water state last step (null until the first step), for splashes. */
  private wasInWater: boolean | null = null;

  /** Launched by a spring and still rising. */
  private sprung = false;

  private onSpring(): boolean {
    const L = this.g.level;
    const row = Math.floor((this.bottom + 0.5) / TILE);
    // Either foot on it counts (you can stand half on a spring otherwise).
    return L.tileAt(Math.floor((this.x + 1) / TILE), row) === Tile.Spring || L.tileAt(Math.floor((this.x + this.w - 1) / TILE), row) === Tile.Spring;
  }

  /** Center of the body is in rising air. */
  get inUpdraft(): boolean {
    return this.g.level.isUpdraft(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE));
  }

  private ladderOverlap(col: number): boolean {
    const r0 = Math.floor(this.y / TILE);
    const r1 = Math.floor((this.bottom - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) if (this.g.level.isLadder(col, r)) return true;
    return false;
  }

  private startClimb(col: number): void {
    this.state = 'climb';
    this.airJumps = this.has('boots') ? 1 : 0;
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
    if (this.g.fireWeapon()) this.shootPose = 16;
  }

  /** Scripted walk used by door transitions (no physics, no input). */
  autoWalk(): void {
    this.state = 'run';
    this.facing = 1;
    this.grounded = true;
    this.vy = 0;
    this.animT++;
    this.runT++;
  }

  hurt(dmg: number, sourceX: number): void {
    if (this.invuln > 0 || this.state === 'dead') return;
    if (this.has('armor')) dmg = armoredDamage(dmg);
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp === 0) {
      this.die(true);
      return;
    }
    sfx.hurt();
    // Hit while tucked under a ceiling: take it, but keep sliding (no room to be knocked back).
    if (this.state === 'slide' && !this.canStand()) {
      this.invuln = PHYS.invulnFrames;
      return;
    }
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
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  // --- rendering ----------------------------------------------------------

  render(): void {
    if (this.state === 'dead') return;
    const s = this.shootPose > 0 ? '_s' : '';
    let name: string;
    let flip = this.facing < 0;
    switch (this.state) {
      case 'hurt':
        name = 'hurt';
        break;
      case 'slide':
        name = 'slide';
        break;
      case 'climb':
        if (s) name = 'climb_s';
        else name = Math.floor(this.climbT / 8) % 2 === 0 ? 'climb' : 'climb2'; // hand over hand
        break;
      default:
        name = heroFrameName({
          air: this.state === 'jump' || this.state === 'fall',
          vy: this.vy,
          running: this.state === 'run',
          runT: this.runT,
          animT: this.animT,
          landT: this.landT,
          shoot: !!s,
        });
    }
    this.sprite.setTexture(heroTexture(this.weapon), this.frames[name]);
    this.sprite.setFlipX(flip);
    // One pixel low: the boot outline sits on the floor's ink line instead of above it.
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.bottom) + 1);
    // Flicker while invincible (but stay solid during the knockback pose).
    this.sprite.setVisible(this.state === 'hurt' || this.invuln === 0 || this.invuln % 4 < 2);

    // Charging glow: cyan flicker at half charge, gold/white strobe at full.
    const level = this.chargeLevel;
    const f = this.animT;
    if (level === 2 && f % 4 < 2) this.sprite.setTintFill(f % 8 < 4 ? 0xffe14a : 0xffffff);
    else if (level === 1 && f % 6 < 2) this.sprite.setTint(0x8af0ff);
    else this.sprite.clearTint();
    if (level === 2 && f % 5 === 0) this.g.burst(this.cx + (Math.random() - 0.5) * 16, this.cy + (Math.random() - 0.5) * 18, 'spark', 1);
  }
}
