import Phaser from 'phaser';
import { PHYS, PLAYER_MAX_HP, SCREEN_H, SCREEN_W, STEP_MS, TILE, VIEW_H, VIEW_W } from '../constants';
import { BOSS_MAX_HP, Boss } from '../entities/Boss';
import { Enemy, Projectile, createEnemy } from '../entities/Enemies';
import { Player } from '../entities/Player';
import { Controls } from '../input';
import { Door, Level, Point, Section, Tile } from '../level/Level';
import { STAGE_1 } from '../level/stage1';
import { Box, moveY, overlaps } from '../physics';
import { sfx } from '../sfx';

const TRANSITION_FRAMES = 64;
const DOOR_PAN_FRAMES = 80;
const DOOR_TILE_FRAMES = 5; // frames per door tile opening/closing

const DOOR_TILE_INDEX = Tile.Door - 1;

export interface GameSceneData {
  /** Start at the checkpoint just before the boss door. */
  bossTest?: boolean;
}

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

/** Boss door sequence: shutter opens, camera pans through, shutter closes. */
interface DoorSequence {
  door: Door;
  next: Section;
  phase: 'open' | 'pan' | 'close';
  t: number;
  fromX: number;
  toX: number;
  startX: number;
  endX: number;
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

  private boss: Boss | null = null;
  private bossDefeated = false;
  private bossDeathT = 0;

  private section!: Section;
  private camX = 0;
  private camY = 0;
  private acc = 0;
  private paused = false;
  private transition: Transition | null = null;
  private doorSeq: DoorSequence | null = null;
  private checkpoint!: Point;
  private readyTimer = 0;
  private clearTimer = 0;

  private layer!: Phaser.Tilemaps.TilemapLayer;
  private bg!: Phaser.GameObjects.TileSprite;
  private hud!: Phaser.GameObjects.Graphics;
  private hudKey = '';
  private goalSprite: Phaser.GameObjects.Image | null = null;
  private banner!: Phaser.GameObjects.Text;
  private pauseLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('game');
  }

  create(data: GameSceneData = {}): void {
    // Scene instances are reused on restart, so reset all state here.
    this.bullets = [];
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.effects = [];
    this.boss = null;
    this.bossDefeated = false;
    this.bossDeathT = 0;
    this.acc = 0;
    this.paused = false;
    this.transition = null;
    this.doorSeq = null;
    this.clearTimer = 0;
    this.hudKey = '';
    this.goalSprite = null;

    this.level = new Level(STAGE_1);
    const start = data.bossTest && this.level.bossTestStart ? this.level.bossTestStart : this.level.playerStart;
    this.checkpoint = { ...start };

    this.cameras.main.setBackgroundColor('#141626');
    this.bg = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'bg').setOrigin(0).setScrollFactor(0).setDepth(-10);

    const map = this.make.tilemap({ data: this.level.tileIndexGrid(), tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!.setDepth(0);

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
      this.stepEffects();
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
    const cutscene = this.transition || this.doorSeq || this.boss?.inIntro;
    if (this.controls.justPressed('start') && !cutscene && this.player.alive) {
      this.paused = !this.paused;
      this.pauseLayer.setVisible(this.paused);
      sfx.select();
    }
    if (this.paused) return;

    if (this.transition) {
      this.stepTransition();
      return;
    }
    if (this.doorSeq) {
      this.stepDoor();
      return;
    }
    if (this.boss?.inIntro) {
      // Player is frozen while the boss drops in and its health bar fills.
      this.boss.step();
      return;
    }

    const p = this.player;
    p.update();
    if (!p.alive && p.deadTimer <= 0) {
      this.respawn();
      return;
    }

    for (const e of this.enemies) e.step();
    this.boss?.step();
    for (const b of this.bullets) b.step();
    this.stepShots();
    this.stepPickups();
    this.stepEffects();
    this.stepBossDeath();

    this.collide();
    this.checkDoors();
    if (this.doorSeq) return;
    this.checkSection();
    this.updateCheckpoint();
    if (!this.transition) this.followCamera();
    this.manageSpawns();
    this.cull();
  }

  private render(): void {
    this.player.render();
    for (const e of this.enemies) e.render();
    this.boss?.render();
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

  fireBossShot(x: number, y: number, vx: number, vy: number): void {
    const s = new Projectile(this, x - 3, y - 3, 6, 6, vx, vy, 'bshot');
    s.dmg = 3;
    this.shots.push(s);
  }

  /** Ground wave that travels along the floor until it hits a wall. */
  fireGroundWave(x: number, floorY: number, dir: 1 | -1): void {
    const s = new Projectile(this, x, floorY - 12, 8, 12, dir * 2.5, 0, 'wave');
    s.dmg = 3;
    s.stopAtWalls = true;
    this.shots.push(s);
  }

  /** Camera shake; `px` is roughly the shake size in game pixels. */
  shake(px: number): void {
    this.cameras.main.shake(200, px / VIEW_W);
  }

  private stepShots(): void {
    for (const s of this.shots) {
      s.step();
      if (s.stopAtWalls) {
        const front = s.vx > 0 ? s.x + s.w : s.x;
        if (this.level.isSolid(Math.floor(front / TILE), Math.floor((s.y + s.h / 2) / TILE))) s.dead = true;
      }
    }
  }

  private collide(): void {
    const p = this.player;
    const boss = this.boss;
    const bossActive = boss && boss.state !== 'dying';

    for (const b of this.bullets) {
      if (b.deflected || b.dead) continue;
      if (bossActive && overlaps(b, boss)) {
        // Shots pass through the boss during its brief post-hit invincibility.
        if (boss.vulnerable) {
          b.dead = true;
          boss.hit(1);
          sfx.hit();
          if (boss.state === 'dying') this.startBossDeath();
        }
        continue;
      }
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
    if (bossActive && overlaps(p, boss)) p.hurt(4, boss.cx);
    for (const s of this.shots) {
      if (!s.dead && overlaps(p, s) && p.invuln === 0) {
        p.hurt(s.dmg, s.x + s.w / 2);
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

  playerBurst(cx: number, cy: number, tex = 'shard'): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 1.5;
      this.addEffect(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp - 2, 0.12, 90, false, tex);
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

  // --- boss -------------------------------------------------------------------

  private trySpawnBoss(): void {
    const at = this.level.boss;
    if (!at || this.boss || this.bossDefeated) return;
    if (this.level.sectionAt(at.x, at.y - 1) !== this.section) return;
    // Appears just under the room's 2-tile ceiling and drops to the floor.
    this.boss = new Boss(this, at, this.section.row * SCREEN_H + 2 * TILE);
  }

  private startBossDeath(): void {
    this.bossDeathT = 1;
    for (const s of this.shots) s.dead = true;
  }

  /** Chain of explosions, then a burst, then STAGE CLEAR. */
  private stepBossDeath(): void {
    const boss = this.boss;
    if (!boss || this.bossDeathT === 0) return;
    const t = this.bossDeathT++;
    if (t < 100) {
      if (t % 6 === 0) {
        this.addEffect(boss.x + Math.random() * boss.w, boss.y + Math.random() * boss.h, 0, 0, 0, 16, true);
        if (t % 12 === 0) sfx.enemyDie();
      }
      boss.sprite.setVisible(t % 4 < 2);
    } else if (t === 100) {
      this.playerBurst(boss.cx, boss.cy, 'shard');
      this.shake(8);
      sfx.die();
      boss.sprite.setVisible(false);
    } else if (t === 170) {
      boss.destroy();
      this.boss = null;
      this.bossDefeated = true;
      this.stageClear();
    }
  }

  // --- doors ------------------------------------------------------------------

  /** Walking right into a boss door opens it. */
  private checkDoors(): void {
    const p = this.player;
    if (!p.alive || p.state === 'climb' || p.state === 'hurt' || !this.controls.isDown('right')) return;
    for (const d of this.level.doors) {
      const touching = Math.abs(p.x + p.w - d.col * TILE) < 0.6 && p.bottom > d.r0 * TILE && p.y < (d.r1 + 1) * TILE;
      if (!touching) continue;
      const next = this.level.sectionAt((d.col + 1) * TILE + TILE / 2, p.cy);
      if (!next || next === this.section) continue;
      this.clearActors();
      const endX = (d.col + 1) * TILE + 12;
      this.doorSeq = {
        door: d,
        next,
        phase: 'open',
        t: 0,
        fromX: this.camX,
        toX: Phaser.Math.Clamp(endX + p.w / 2 - VIEW_W / 2, next.x0 * SCREEN_W, (next.x1 + 1) * SCREEN_W - VIEW_W),
        startX: p.x,
        endX,
      };
      return;
    }
  }

  private stepDoor(): void {
    const seq = this.doorSeq!;
    const { door } = seq;
    const height = door.r1 - door.r0 + 1;
    seq.t++;

    if (seq.phase === 'open') {
      // Shutter rolls up from the bottom.
      if (seq.t % DOOR_TILE_FRAMES === 0) {
        const r = door.r1 - (seq.t / DOOR_TILE_FRAMES - 1);
        if (r >= door.r0) {
          this.level.setTile(door.col, r, Tile.Empty);
          this.layer.removeTileAt(door.col, r);
          sfx.tick();
        }
      }
      if (seq.t >= (height + 2) * DOOR_TILE_FRAMES) {
        seq.phase = 'pan';
        seq.t = 0;
      }
    } else if (seq.phase === 'pan') {
      const k = seq.t / DOOR_PAN_FRAMES;
      this.camX = Phaser.Math.Linear(seq.fromX, seq.toX, k);
      this.player.x = Phaser.Math.Linear(seq.startX, seq.endX, k);
      this.player.autoWalk();
      if (seq.t >= DOOR_PAN_FRAMES) {
        this.section = seq.next;
        seq.phase = 'close';
        seq.t = 0;
      }
    } else {
      // Shutter rolls back down.
      if (seq.t % DOOR_TILE_FRAMES === 0) {
        const r = door.r0 + (seq.t / DOOR_TILE_FRAMES - 1);
        if (r <= door.r1) {
          this.level.setTile(door.col, r, Tile.Door);
          this.layer.putTileAt(DOOR_TILE_INDEX, door.col, r);
          sfx.tick();
        }
      }
      if (seq.t >= (height + 1) * DOOR_TILE_FRAMES) {
        this.doorSeq = null;
        this.player.state = 'idle';
        for (const s of this.level.spawns) s.armed = true;
        this.trySpawnBoss();
      }
    }
  }

  // --- camera & sections ------------------------------------------------------

  private checkSection(): void {
    const p = this.player;
    if (!p.alive) return;
    const sec = this.section;
    const top = sec.row * SCREEN_H;
    const bottom = top + SCREEN_H;

    // The player can't leave the section sideways.
    const minX = sec.x0 * SCREEN_W;
    const maxX = (sec.x1 + 1) * SCREEN_W - p.w;
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
    const left = sec.x0 * SCREEN_W;
    const right = (sec.x1 + 1) * SCREEN_W - VIEW_W;
    // A section narrower than the view is centered instead of scrolled.
    if (right < left) return (left + right) / 2;
    return Phaser.Math.Clamp(this.player.cx - VIEW_W / 2, left, right);
  }

  private followCamera(): void {
    this.camX = this.cameraTargetX(this.section);
    this.camY = this.section.row * SCREEN_H;
  }

  private startTransition(next: Section, dir: 1 | -1): void {
    this.clearActors();
    this.transition = {
      fromX: this.camX,
      fromY: this.camY,
      toX: this.cameraTargetX(next),
      toY: next.row * SCREEN_H,
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
      this.trySpawnBoss();
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
    this.boss?.destroy();
    this.boss = null;
    this.bossDeathT = 0;
    for (const s of this.level.spawns) {
      s.alive = false;
      s.armed = true;
    }
    // Latest checkpoint the player has passed.
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.section = this.level.sectionAt(this.player.cx, this.player.cy)!;
    this.followCamera();
    this.trySpawnBoss();
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
    const bossHp = this.boss && this.boss.state !== 'dying' ? this.boss.barHp : -1;
    const key = `${hp}|${bossHp}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    const g = this.hud;
    g.clear();
    this.drawBar(g, 12, hp, PLAYER_MAX_HP, 0xfff1a8);
    if (bossHp >= 0) this.drawBar(g, 24, bossHp, BOSS_MAX_HP, 0xff7050);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, value: number, max: number, color: number): void {
    const y = 16;
    g.fillStyle(0x000000, 1).fillRect(x, y, 8, max * 2 + 2);
    for (let i = 0; i < max; i++) {
      const uy = y + max * 2 - i * 2;
      g.fillStyle(i < value ? color : 0x3a3550, 1).fillRect(x + 1, uy, 6, 1);
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
