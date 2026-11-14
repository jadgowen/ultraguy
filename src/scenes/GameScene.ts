import Phaser from 'phaser';
import { PHYS, PLAYER_MAX_HP, STEP_MS, TILE, VIEW_H, VIEW_W } from '../constants';
import { Enemy, Projectile, createEnemy } from '../entities/Enemies';
import { Player } from '../entities/Player';
import { Controls } from '../input';
import { Level, Point, Section } from '../level/Level';
import { STAGE_1 } from '../level/stage1';
import { Box, moveY, overlaps } from '../physics';
import { sfx } from '../sfx';

const TRANSITION_FRAMES = 64;

interface Transition {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dir: 1 | -1;
  startY: number;
  next: Section;
}

interface Pickup extends Projectile {
  heal: number;
}

interface Effect {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  grow: boolean;
}

export class GameScene extends Phaser.Scene {
  controls!: Controls;
  level!: Level;
  player!: Player;

  private bullets: Projectile[] = [];
  private enemies: Enemy[] = [];
  private shots: Projectile[] = [];
  private pickups: Pickup[] = [];
  private effects: Effect[] = [];

  private section!: Section;
  private camX = 0;
  private camY = 0;
  private acc = 0;
  private paused = false;
  private transition: Transition | null = null;
  private checkpoint!: Point;
  private readyTimer = 0;
  private clearTimer = 0;

  private bg!: Phaser.GameObjects.TileSprite;
  private hud!: Phaser.GameObjects.Graphics;
  private hudHp = -1;
  private goalSprite: Phaser.GameObjects.Image | null = null;
  private banner!: Phaser.GameObjects.Text;
  private pauseLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('game');
  }

  create(): void {
    // Scene instances are reused on restart, so reset all state here.
    this.bullets = [];
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.effects = [];
    this.acc = 0;
    this.paused = false;
    this.transition = null;
    this.clearTimer = 0;
    this.hudHp = -1;

    this.level = new Level(STAGE_1);
    this.checkpoint = { ...this.level.playerStart };

    this.cameras.main.setBackgroundColor('#141626');
    this.bg = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'bg').setOrigin(0).setScrollFactor(0).setDepth(-10);

    const map = this.make.tilemap({ data: this.level.tileIndexGrid(), tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    map.createLayer(0, tileset, 0, 0)!.setDepth(0);

    if (this.level.goal) {
      this.goalSprite = this.add.image(this.level.goal.x, this.level.goal.y, 'goal').setOrigin(0.5, 1).setDepth(4);
    }

    this.controls = new Controls(this);
    this.player = new Player(this);

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.banner = this.add
      .text(VIEW_W / 2, VIEW_H / 2 - 16, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff1e0' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60);
    this.pauseLayer = this.buildPauseLayer();

    this.respawn();
  }

  // --- main loop ------------------------------------------------------------

  update(_time: number, delta: number): void {
    // Fixed timestep: the simulation always advances in 1/60 s steps.
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.step();
      this.acc -= STEP_MS;
    }
    this.render();
  }

  private step(): void {
    this.controls.poll();

    if (this.clearTimer > 0) {
      if (--this.clearTimer === 0) this.scene.start('title');
      return;
    }
    if (this.readyTimer > 0) {
      this.readyTimer--;
      this.banner.setText('READY').setVisible(Math.floor(this.readyTimer / 8) % 2 === 0);
      this.player.sprite.setVisible(false);
      if (this.readyTimer === 0) this.banner.setVisible(false);
      return;
    }
    if (this.controls.justPressed('start') && !this.transition && this.player.alive) {
      this.paused = !this.paused;
      this.pauseLayer.setVisible(this.paused);
      sfx.select();
    }
    if (this.paused) return;

    if (this.transition) {
      this.stepTransition();
      return;
    }

    const p = this.player;
    p.update();
    if (!p.alive) {
      if (p.deadTimer <= 0) this.respawn();
    }

    for (const e of this.enemies) e.step();
    for (const b of this.bullets) b.step();
    for (const s of this.shots) s.step();
    this.stepPickups();
    this.stepEffects();

    this.collide();
    this.checkSection();
    this.updateCheckpoint();
    if (!this.transition) this.followCamera();
    this.manageSpawns();
    this.cull();
  }

  private render(): void {
    this.player.render();
    for (const e of this.enemies) e.render();
    for (const b of this.bullets) b.render();
    for (const s of this.shots) s.render();
    for (const k of this.pickups) k.sprite.setVisible(k.life < 240 || k.life % 6 < 3).setPosition(Math.round(k.x), Math.round(k.y));
    if (this.readyTimer > 0) this.player.sprite.setVisible(false);

    const cam = this.cameras.main;
    cam.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.bg.tilePositionX = Math.round(this.camX * 0.25);
    this.drawHud();
  }

  // --- combat -----------------------------------------------------------------

  /** Returns false when the on-screen bullet limit is reached. */
  firePlayerBullet(x: number, y: number, dir: 1 | -1): boolean {
    if (this.bullets.length >= PHYS.maxBullets) return false;
    this.bullets.push(new Projectile(this, x - 3, y - 2, 6, 4, dir * PHYS.bulletSpeed, 0, 'bullet'));
    sfx.shoot();
    return true;
  }

  fireEnemyShot(x: number, y: number, vx: number, vy: number): void {
    this.shots.push(new Projectile(this, x - 2, y - 2, 4, 4, vx, vy, 'eshot'));
  }

  private collide(): void {
    const p = this.player;

    for (const b of this.bullets) {
      if (b.deflected || b.dead) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0 || !overlaps(b, e)) continue;
        if (e.shielded()) {
          b.deflect();
          sfx.deflect();
        } else {
          b.dead = true;
          e.hp--;
          e.flash = 8;
          sfx.hit();
          if (e.hp <= 0) this.killEnemy(e);
        }
        break;
      }
    }

    if (!p.alive) return;
    for (const e of this.enemies) if (e.hp > 0 && overlaps(p, e)) p.hurt(e.dmg, e.cx);
    for (const s of this.shots) {
      if (!s.dead && overlaps(p, s) && p.invuln === 0) {
        p.hurt(2, s.x);
        s.dead = true;
      }
    }
    for (const k of this.pickups) {
      if (!k.dead && overlaps(p, k)) {
        p.heal(k.heal);
        k.dead = true;
        sfx.pickup();
      }
    }
    const goal = this.level.goal;
    if (goal && overlaps(p, { x: goal.x - 6, y: goal.y - 16, w: 12, h: 16 })) this.stageClear();
  }

  private killEnemy(e: Enemy): void {
    e.spawn.alive = false;
    sfx.enemyDie();
    this.addEffect(e.cx, e.cy, 0, 0, 0, 14, true);
    const roll = Math.random();
    if (roll < 0.08) this.dropPickup(e.cx, e.cy, 10, 'hp_big', 12, 10);
    else if (roll < 0.3) this.dropPickup(e.cx, e.cy, 3, 'hp_small', 8, 6);
  }

  private dropPickup(cx: number, cy: number, heal: number, tex: string, w: number, h: number): void {
    const k = new Projectile(this, cx - w / 2, cy - h / 2, w, h, 0, -2, tex) as Pickup;
    k.heal = heal;
    this.pickups.push(k);
  }

  private stepPickups(): void {
    for (const k of this.pickups) {
      k.life++;
      k.vy = Math.min(k.vy + PHYS.gravity, PHYS.maxFall);
      if (moveY(this.level, k, k.vy, true)) k.vy = 0;
      if (k.life > 300) k.dead = true;
    }
  }

  playerBurst(cx: number, cy: number): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 1.5;
      this.addEffect(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp - 2, 0.12, 90, false, 'shard');
    }
    this.addEffect(cx, cy, 0, 0, 0, 20, true);
  }

  private addEffect(x: number, y: number, vx: number, vy: number, gravity: number, life: number, grow: boolean, tex = 'boom'): void {
    const sprite = this.add.image(x, y, tex).setDepth(20);
    this.effects.push({ sprite, vx, vy, gravity, life, maxLife: life, grow });
  }

  private stepEffects(): void {
    for (const f of this.effects) {
      f.life--;
      f.vy += f.gravity;
      f.sprite.x += f.vx;
      f.sprite.y += f.vy;
      if (f.grow) {
        const k = 1 - f.life / f.maxLife;
        f.sprite.setScale(0.5 + k).setAlpha(1 - k * 0.8);
      }
    }
    this.effects = this.effects.filter((f) => {
      if (f.life > 0) return true;
      f.sprite.destroy();
      return false;
    });
  }

  // --- camera & sections ------------------------------------------------------

  private checkSection(): void {
    const p = this.player;
    if (!p.alive) return;
    const sec = this.section;
    const top = sec.row * VIEW_H;
    const bottom = top + VIEW_H;

    // The player can't leave the section sideways.
    const minX = sec.x0 * VIEW_W;
    const maxX = (sec.x1 + 1) * VIEW_W - p.w;
    p.x = Phaser.Math.Clamp(p.x, minX, maxX);

    if (p.cy > bottom || p.cy < top) {
      const next = this.level.sectionAt(p.cx, p.cy);
      if (next && next !== sec) {
        this.startTransition(next, p.cy > bottom ? 1 : -1);
        return;
      }
    }
    if (p.y > bottom + 8) p.die(false); // bottomless pit
  }

  private cameraTargetX(sec: Section): number {
    return Phaser.Math.Clamp(this.player.cx - VIEW_W / 2, sec.x0 * VIEW_W, sec.x1 * VIEW_W);
  }

  private followCamera(): void {
    this.camX = this.cameraTargetX(this.section);
    this.camY = this.section.row * VIEW_H;
  }

  private startTransition(next: Section, dir: 1 | -1): void {
    this.clearActors();
    this.transition = {
      fromX: this.camX,
      fromY: this.camY,
      toX: this.cameraTargetX(next),
      toY: next.row * VIEW_H,
      t: 0,
      dir,
      startY: this.player.y,
      next,
    };
  }

  private stepTransition(): void {
    const tr = this.transition!;
    tr.t++;
    const k = tr.t / TRANSITION_FRAMES;
    this.camX = Phaser.Math.Linear(tr.fromX, tr.toX, k);
    this.camY = Phaser.Math.Linear(tr.fromY, tr.toY, k);
    // Carry the player a little way into the new screen.
    this.player.y = tr.startY + tr.dir * 28 * k;
    if (tr.t >= TRANSITION_FRAMES) {
      this.section = tr.next;
      this.transition = null;
      for (const s of this.level.spawns) s.armed = true;
    }
  }

  // --- spawning ---------------------------------------------------------------

  /** Enemies appear when their spawn point scrolls into view and respawn only after it leaves view. */
  private manageSpawns(): void {
    for (const s of this.level.spawns) {
      const inView = s.x > this.camX - 8 && s.x < this.camX + VIEW_W + 8 && s.y > this.camY && s.y - 8 < this.camY + VIEW_H;
      if (s.alive) continue;
      if (!inView) s.armed = true;
      else if (s.armed) {
        s.armed = false;
        s.alive = true;
        this.enemies.push(createEnemy(this, s));
      }
    }
  }

  private cull(): void {
    const view: Box = { x: this.camX - 24, y: this.camY - 24, w: VIEW_W + 48, h: VIEW_H + 48 };
    const tight: Box = { x: this.camX, y: this.camY, w: VIEW_W, h: VIEW_H };

    this.enemies = this.enemies.filter((e) => {
      const gone = e.hp <= 0 || !overlaps(e, view);
      if (gone) {
        e.spawn.alive = false;
        e.destroy();
      }
      return !gone;
    });
    const keep = <T extends Projectile>(list: T[]): T[] =>
      list.filter((b) => {
        const gone = b.dead || !overlaps(b, tight);
        if (gone) b.destroy();
        return !gone;
      });
    this.bullets = keep(this.bullets);
    this.shots = keep(this.shots);
    this.pickups = keep(this.pickups);
  }

  private clearActors(): void {
    for (const e of this.enemies) {
      e.spawn.alive = false;
      e.destroy();
    }
    for (const b of [...this.bullets, ...this.shots, ...this.pickups]) b.destroy();
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.pickups = [];
  }

  // --- life cycle -------------------------------------------------------------

  private respawn(): void {
    this.clearActors();
    for (const f of this.effects) f.sprite.destroy();
    this.effects = [];
    for (const s of this.level.spawns) {
      s.alive = false;
      s.armed = true;
    }
    // Latest checkpoint the player has passed.
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.section = this.level.sectionAt(this.player.cx, this.player.cy)!;
    this.followCamera();
    this.readyTimer = 64;
  }

  private stageClear(): void {
    if (this.clearTimer > 0) return;
    this.clearTimer = 200;
    this.banner.setText('STAGE CLEAR').setVisible(true);
    this.goalSprite?.setVisible(false);
    sfx.clear();
  }

  /** Checkpoints activate when the player gets close. */
  private updateCheckpoint(): void {
    for (const c of this.level.checkpoints) {
      if (Math.abs(this.player.cx - c.x) < 48 && Math.abs(this.player.bottom - c.y) < 96) this.checkpoint = c;
    }
  }

  // --- HUD / pause ------------------------------------------------------------

  private drawHud(): void {
    const hp = this.player.hp;
    if (hp === this.hudHp) return;
    this.hudHp = hp;
    const g = this.hud;
    g.clear();
    const x = 12;
    const y = 16;
    g.fillStyle(0x000000, 1).fillRect(x, y, 8, PLAYER_MAX_HP * 2 + 2);
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      const uy = y + PLAYER_MAX_HP * 2 - i * 2;
      g.fillStyle(i < hp ? 0xfff1a8 : 0x3a3550, 1).fillRect(x + 1, uy, 6, 1);
    }
  }

  private buildPauseLayer(): Phaser.GameObjects.Container {
    const style = { fontFamily: 'monospace', fontSize: '8px', color: '#fff1e0' };
    const box = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 160, 96, 0x000000, 0.85).setStrokeStyle(1, 0x5ef0c8);
    const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 32, 'PAUSED', { ...style, fontSize: '16px' }).setOrigin(0.5);
    const weapon = this.add.text(VIEW_W / 2 - 60, VIEW_H / 2 - 8, '> ARM CANNON   --', style);
    const note = this.add.text(VIEW_W / 2, VIEW_H / 2 + 24, 'boss weapons go here', { ...style, color: '#8a8fa8' }).setOrigin(0.5);
    return this.add.container(0, 0, [box, title, weapon, note]).setScrollFactor(0).setDepth(70).setVisible(false);
  }
}
