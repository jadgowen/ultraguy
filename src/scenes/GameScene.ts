import Phaser from 'phaser';
import { playMusic, stageMusic, stopMusic } from '../audio';
import { DEV_TOOLS, PHYS, SCREEN_H, SCREEN_W, STEP_MS, TILE, VIEW_H, VIEW_W } from '../constants';
import { Enemy, Projectile, createEnemy } from '../entities/Enemies';
import { Player } from '../entities/Player';
import { Boss, Miniboss, Room, createBoss } from '../entities/bosses';
import { Controls } from '../input';
import { BossKind, Door, ELECTRIC_OFF_INDEX, Level, Point, Section, StageId, Tile } from '../level/Level';
import { PART_ORDER, PARTS } from '../parts';
import { BOSS_STAGES, getStage } from '../level/stages';
import { THEMES } from '../level/themes';
import { Box, moveY, overlaps } from '../physics';
import { MAX_TANKS, loadSave, recordClear, recordPart, setTanks } from '../save';
import { sfx } from '../sfx';
import { WEAPONS, WeaponId } from '../weapons';
import { Hazards } from './hazards';
import { Sky } from './sky';

const TRANSITION_FRAMES = 64;
const DOOR_PAN_FRAMES = 80;
const DOOR_TILE_FRAMES = 5; // frames per door tile opening/closing
const DOOR_TILE_INDEX = Tile.Door - 1;
const ELECTRIC_ON_INDEX = Tile.Electric - 1;
const ELECTRIC_PERIOD = 100;

/** Damage a boss takes from its weakness weapon. */
const WEAKNESS_DAMAGE = 4;
/** Freeze-frames when a weakness hit lands. */
const WEAK_HIT_STOP = 6;

/** Boss rematch room: which boss each teleporter (left to right) sends you to. */
const REMATCH_ORDER: BossKind[] = ['anvil', 'mantis', 'frostline', 'gale', 'volt', 'magma', 'scrap', 'tide'];
const TELEPORT_FRAMES = 40;

/** Display names for each stage boss (from the stage data). */
const BOSS_NAMES: Partial<Record<BossKind, string>> = Object.fromEntries(
  Object.values(BOSS_STAGES).map((st) => [st.boss, st.bossName]),
);

export interface GameSceneData {
  stage: StageId;
  /** Start at the checkpoint just before the boss door. */
  bossTest?: boolean;
}

export interface ShotOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  tex: string;
  dmg?: number;
  /** Falls, and breaks on the ground. */
  gravity?: boolean;
  /** Horizontal acceleration (boomerangs). */
  ax?: number;
  spin?: number;
  /** Remove after this many steps. */
  life?: number;
  /** Falls, then rolls along the floor until it hits a wall. */
  rolls?: boolean;
  /** Falls and bounces along the floor. */
  bounces?: boolean;
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
  ammo: number;
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
  /** Horizontal push applied to the player this step (Gale's gusts, Scrap's magnet). */
  wind = 0;
  /** Moving clouds, crumbling clouds, updrafts and stage wind gusts. */
  private sky!: Sky;
  /** Crushers, switch blocks, roller chutes, currents, darkness, rising lava. */
  private hazards!: Hazards;
  /** Electric barriers ('Z' tiles) are live. They switch every ELECTRIC_PERIOD steps. */
  electricOn = true;
  private electricT = 0;
  private electricTiles: { c: number; r: number }[] = [];

  private stageId: StageId = 'foundry';
  private bullets: Projectile[] = [];
  private enemies: Enemy[] = [];
  private shots: Projectile[] = [];
  private pickups: Pickup[] = [];
  private effects: Effect[] = [];

  private boss: Boss | null = null;
  /**
   * During a boss fight the camera locks to the room's center and the fight
   * happens inside the visible part of the room (rooms are wider than the view).
   */
  private arena: { camX: number; left: number; right: number } | null = null;
  /** The current boss room (kept for the final boss's second phase). */
  private bossRoom: Room | null = null;
  private shadeRing: Phaser.GameObjects.Image | null = null;
  private bossDefeated = false;
  /** The stage's miniboss has been beaten this visit. */
  private miniDefeated = false;
  /** Energy tanks lying in the stage (taken ones stay taken this visit). */
  private tankItems: { box: Box; sprite: Phaser.GameObjects.Image; taken: boolean }[] = [];
  /** Rematch room: capsules, which are done, and a teleport in progress. */
  private capsules: { box: Box; sprite: Phaser.GameObjects.Image; kind: BossKind; done: boolean }[] = [];
  private teleport: { t: number; to: 'arena' | 'hub'; kind?: BossKind; back?: Point } | null = null;
  private hubSpot: Point | null = null;
  /** Freeze-frame counter (weakness hits). */
  private hitStop = 0;
  /** Upgrade capsule (armor part) in this stage, and the pickup sequence timer. */
  private upgradeItem: { box: Box; sprite: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; taken: boolean } | null = null;
  private partGetT = 0;
  private weaponLabel!: Phaser.GameObjects.Text;
  private weaponLabelT = 0;
  private bossDeathT = 0;
  /** Weapons earned so far (from the save). */
  private unlocked: WeaponId[] = ['buster'];
  private weaponGetT = 0;

  private section!: Section;
  private camX = 0;
  private camY = 0;
  private acc = 0;
  private paused = false;
  private pauseIndex = 0;
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

  create(data: GameSceneData): void {
    // Scene instances are reused on restart, so reset all state here.
    this.stageId = data?.stage ?? 'foundry';
    this.bullets = [];
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.effects = [];
    this.boss = null;
    this.arena = null;
    this.bossRoom = null;
    this.shadeRing = null;
    this.bossDefeated = false;
    this.miniDefeated = false;
    this.tankItems = [];
    this.capsules = [];
    this.teleport = null;
    this.hubSpot = null;
    this.hitStop = 0;
    this.weaponLabelT = 0;
    this.upgradeItem = null;
    this.partGetT = 0;
    this.bossDeathT = 0;
    this.weaponGetT = 0;
    this.wind = 0;
    this.unlocked = loadSave().weapons;
    this.acc = 0;
    this.paused = false;
    this.transition = null;
    this.doorSeq = null;
    this.clearTimer = 0;
    this.hudKey = '';
    this.goalSprite = null;

    const stage = getStage(this.stageId);
    this.level = new Level(stage);
    const start = DEV_TOOLS && data?.bossTest && this.level.bossTestStart ? this.level.bossTestStart : this.level.playerStart;
    this.checkpoint = { ...start };

    const theme = THEMES[stage.theme];
    this.cameras.main.setBackgroundColor(theme.sky);
    this.bg = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, `bg_${stage.theme}`).setOrigin(0).setScrollFactor(0).setDepth(-10);

    const map = this.make.tilemap({ data: this.level.tileIndexGrid(), tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!.setDepth(0);
    // Water sits on its own translucent layer drawn over the sprites.
    if (this.level.hasWater()) {
      const waterMap = this.make.tilemap({ data: this.level.waterIndexGrid(), tileWidth: TILE, tileHeight: TILE });
      const waterSet = waterMap.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!;
      waterMap.createLayer(0, waterSet, 0, 0)!.setDepth(15).setAlpha(0.4);
    }
    // Fake walls hide what's behind them: drawn over the sprites.
    if (this.level.findTiles(Tile.Fake).length) {
      const fakeMap = this.make.tilemap({ data: this.level.fakeIndexGrid(), tileWidth: TILE, tileHeight: TILE });
      const fakeSet = fakeMap.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!;
      fakeMap.createLayer(0, fakeSet, 0, 0)!.setDepth(16);
    }
    this.sky = new Sky(
      {
        scene: this,
        level: this.level,
        layer: this.layer,
        player: () => this.player,
        view: () => ({ x: this.camX, y: this.camY }),
        burst: (x, y, tex, n) => this.burst(x, y, tex, n),
        windStreak: (dir) => this.windStreak(dir),
      },
      stage.theme,
    );
    this.hazards = new Hazards({
      scene: this,
      level: this.level,
      layer: this.layer,
      theme: stage.theme,
      player: () => this.player,
      view: () => ({ x: this.camX, y: this.camY }),
      shake: (n) => this.shake(n),
      spawnShot: (o) => this.spawnEnemyShot(o),
    });
    this.electricTiles = this.level.findTiles(Tile.Electric);
    this.electricOn = true;
    this.electricT = 0;

    // Scenery (intro storefront and store interior, etc.).
    for (const d of stage.decor ?? []) {
      const depth = d.depth ?? 1;
      if (d.rect) this.add.rectangle(d.x, d.y, d.rect.w, d.rect.h, d.rect.fill).setOrigin(0).setDepth(depth);
      if (d.tex) this.add.image(d.x, d.y, d.tex).setOrigin(0).setDepth(depth);
      if (d.text) this.add.text(d.x, d.y, d.text, { fontFamily: 'monospace', fontSize: `${d.size ?? 8}px`, color: d.color ?? '#ffffff' }).setDepth(depth + 0.1);
    }

    if (this.level.goal) {
      this.goalSprite = this.add.image(this.level.goal.x, this.level.goal.y, 'goal').setOrigin(0.5, 1).setDepth(4);
    }
    for (const t of this.level.tanks) {
      const sprite = this.add.image(t.x, t.y, 'etank').setOrigin(0.5, 1).setDepth(4);
      this.tankItems.push({ box: { x: t.x - 6, y: t.y - 10, w: 12, h: 10 }, sprite, taken: false });
    }
    // Rematch room: one capsule per boss; the exit opens once all are beaten.
    [...this.level.teleporters]
      .sort((a, b) => a.x - b.x)
      .forEach((t, i) => {
        const sprite = this.add.image(t.x, t.y, 'capsule_on').setOrigin(0.5, 1).setDepth(3);
        this.capsules.push({ box: { x: t.x - 8, y: t.y - 28, w: 16, h: 28 }, sprite, kind: REMATCH_ORDER[i % REMATCH_ORDER.length], done: false });
        const label = BOSS_NAMES[REMATCH_ORDER[i % REMATCH_ORDER.length]] ?? '';
        this.add.text(t.x, t.y - 38, label, { fontFamily: 'monospace', fontSize: '7px', color: '#c8ccd8' }).setOrigin(0.5).setDepth(3);
      });
    if (this.capsules.length) {
      const hub = this.level.playerStart;
      this.add.text(hub.x + 140, hub.y - 120, 'UP in a capsule to rematch a boss', { fontFamily: 'monospace', fontSize: '8px', color: '#5ef0c8' }).setOrigin(0.5).setDepth(3);
    }
    this.goalSprite?.setVisible(!this.capsules.length);
    // Upgrade capsule: holds this stage's armor part until it's found.
    const up = this.level.upgrade;
    const part = stage.upgrade;
    if (up && part) {
      const owned = loadSave().parts.includes(part);
      const sprite = this.add.image(up.x, up.y, owned ? 'capsule_off' : 'capsule_on').setOrigin(0.5, 1).setDepth(3);
      const icon = this.add.image(up.x, up.y - 15, `part_${part}`).setDepth(3.5).setVisible(!owned);
      this.upgradeItem = { box: { x: up.x - 8, y: up.y - 28, w: 16, h: 28 }, sprite, icon, taken: owned };
    }

    this.controls = new Controls(this);
    this.player = new Player(this, loadSave().parts);

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.banner = this.add
      .text(VIEW_W / 2, VIEW_H / 2 - 16, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff1e0', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setAlign('center')
      .setScrollFactor(0)
      .setDepth(60);
    this.pauseLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(70).setVisible(false);
    this.weaponLabel = this.add
      .text(12, 80, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff1e0', stroke: '#000000', strokeThickness: 2 })
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    playMusic(this, stageMusic(stage));
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
    if (this.hitStop > 0) {
      this.hitStop--;
      return;
    }
    if (this.weaponLabelT > 0 && --this.weaponLabelT === 0) this.weaponLabel.setVisible(false);

    if (this.clearTimer > 0) {
      this.stepEffects();
      if (--this.clearTimer === 0) this.scene.start(this.exitScene(true));
      return;
    }
    if (this.readyTimer > 0) {
      this.readyTimer--;
      this.banner.setText('READY').setVisible(Math.floor(this.readyTimer / 8) % 2 === 0);
      this.player.sprite.setVisible(false);
      if (this.readyTimer === 0) this.banner.setVisible(false);
      return;
    }
    if (this.weaponGetT > 0) {
      this.stepWeaponGet();
      return;
    }
    if (this.partGetT > 0) {
      this.stepPartGet();
      return;
    }
    if (this.teleport) {
      this.stepTeleport();
      return;
    }
    const cutscene = this.transition || this.doorSeq || this.boss?.inIntro || this.bossDeathT > 0;
    if (this.controls.justPressed('start') && !cutscene && this.player.alive) {
      this.paused = !this.paused;
      if (this.paused) {
        this.pauseIndex = Math.max(0, this.unlocked.indexOf(this.player.weapon));
        this.buildPauseMenu();
      }
      this.pauseLayer.setVisible(this.paused);
      sfx.select();
    }
    if (this.paused) {
      this.stepPauseMenu();
      return;
    }

    if (this.transition) {
      this.stepTransition();
      return;
    }
    if (this.doorSeq) {
      this.stepDoor();
      return;
    }
    if (this.boss?.inIntro) {
      // Player is frozen while the boss drops in and its health bar fills;
      // the boss's name is shown meanwhile.
      this.boss.step();
      const name = this.bossName(this.boss);
      if (name) this.banner.setText(name).setVisible(this.boss.state === 'fill');
      if (!this.boss.inIntro) this.banner.setVisible(false);
      return;
    }

    const p = this.player;
    this.cycleWeapon();
    this.sky.stepMovers();
    p.update();
    this.sky.stepCrumbles();
    this.hazards.step();
    if (!p.alive && p.deadTimer <= 0) {
      this.respawn();
      return;
    }

    this.stepElectric();
    for (const e of this.enemies) e.step();
    this.wind = 0; // the boss sets it again if it's blowing
    this.sky.stepGust();
    this.sky.stepUpdraftFx();
    this.boss?.step();
    this.stepBullets();
    this.stepShots();
    this.stepPickups();
    this.stepEffects();
    this.stepBossDeath();

    this.collide();
    this.checkCapsules();
    if (this.teleport) return;
    this.checkDoors();
    if (this.doorSeq) return;
    this.checkSection();
    this.updateCheckpoint();
    this.tryStartMiniboss();
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
    for (const k of this.pickups) {
      k.render();
      k.sprite.setVisible(k.life < 240 || k.life % 6 < 3);
    }
    if (this.readyTimer > 0) this.player.sprite.setVisible(false);

    const cam = this.cameras.main;
    cam.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.bg.tilePositionX = Math.round(this.camX * 0.25);
    this.drawHud();
  }

  // --- weapons ----------------------------------------------------------------

  /**
   * Fire the player's equipped weapon (`charge` 1-2 for Ultra Gun charge
   * blasts). Returns false when the weapon's on-screen limit is reached or
   * it's out of ammo.
   */
  fireWeapon(charge = 0): boolean {
    const p = this.player;
    const def = WEAPONS[p.weapon];
    // Spark Ring: firing again throws the ring that's circling you.
    const ring = this.bullets.find((b) => b.weapon === 'spark' && b.state === 0);
    if (def.id === 'spark' && ring) {
      ring.state = 1;
      ring.vx = p.facing * 4;
      sfx.thorn();
      return true;
    }
    if (this.bullets.filter((b) => b.weapon === def.id).length >= def.maxOnScreen) return false;
    if (p.ammo[def.id] < def.cost) return false;
    p.ammo[def.id] -= def.cost;

    const f = p.facing;
    const muzzleX = p.cx + f * 12;
    const muzzleY = p.y + 12;
    let b: Projectile;
    switch (def.id) {
      case 'quake':
        // Starts at the feet; if fired in the air it falls to the floor first.
        b = new Projectile(this, p.cx + f * 6 - 4, p.bottom - 12, 8, 12, f * 3, 0, 'pwave');
        b.pierce = true;
        b.ignoresShield = true;
        b.stopAtWalls = true;
        sfx.quake();
        break;
      case 'thorn':
        b = new Projectile(this, muzzleX - 5, muzzleY - 5, 10, 10, f * 4, 0, 'thorn');
        b.pierce = true;
        b.spin = 0.45 * f;
        b.maxLife = 160;
        sfx.thorn();
        break;
      case 'frost':
        b = new Projectile(this, muzzleX - 6, muzzleY - 3, 12, 6, f * 5.5, 0, 'frost');
        sfx.freeze();
        break;
      case 'cyclone':
        b = new Projectile(this, muzzleX - 9 + f * 4, p.bottom - 24, 18, 22, f * 1.8, 0, 'cyclone0');
        b.pierce = true;
        b.maxLife = 240;
        sfx.cyclone();
        break;
      case 'spark':
        b = new Projectile(this, p.cx - 14, p.cy - 14, 28, 28, 0, 0, 'sparkring');
        b.pierce = true;
        b.spin = 0.25;
        b.maxLife = 420;
        sfx.freeze();
        break;
      case 'flame':
        b = new Projectile(this, 0, p.y + 3, 28, 16, 0, 0, 'flamejet');
        b.pierce = true;
        b.state = f;
        b.maxLife = 18;
        sfx.flame();
        break;
      case 'saw': {
        // Aim with the d-pad (8 ways); no direction held = straight ahead.
        const c = this.controls;
        let ax = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
        const ay = (c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0);
        if (ax === 0 && ay === 0) ax = f;
        const d = Math.hypot(ax, ay);
        b = new Projectile(this, p.cx - 5, muzzleY - 5, 10, 10, (ax / d) * 5, (ay / d) * 5, 'sawblade');
        b.spin = 0.5;
        sfx.thorn();
        break;
      }
      case 'bubble':
        b = new Projectile(this, muzzleX - 6, muzzleY - 6, 12, 12, f * 2, -1.5, 'pbubble');
        b.maxLife = 220;
        sfx.bubble();
        break;
      default:
        if (charge === 2) {
          b = new Projectile(this, muzzleX - 11 + f * 4, muzzleY - 7, 22, 14, f * 5, 0, 'charge2');
          b.pierce = true;
          b.power = 3;
          sfx.chargeShot();
        } else if (charge === 1) {
          b = new Projectile(this, muzzleX - 5, muzzleY - 4, 10, 8, f * 4.5, 0, 'charge1');
          b.power = 2;
          sfx.chargeShot();
        } else {
          b = new Projectile(this, muzzleX - 3, muzzleY - 2, 6, 4, f * PHYS.bulletSpeed, 0, 'bullet');
          sfx.shoot();
        }
        b.charge = charge;
    }
    b.weapon = def.id;
    if (def.id !== 'buster') b.power = def.power;
    b.sprite.setFlipX(f < 0);
    this.bullets.push(b);
    return true;
  }

  private stepBullets(): void {
    const p = this.player;
    for (const b of this.bullets) {
      switch (b.weapon) {
        case 'quake':
          b.life++;
          b.x += b.vx;
          b.vy = Math.min(b.vy + PHYS.gravity, PHYS.maxFall);
          if (moveY(this.level, b, b.vy, true)) b.vy = 0;
          break;
        case 'thorn': {
          // Flies out, slows, then homes back to the player (who catches it).
          if (b.life < 18) b.vx -= Math.sign(b.vx) * 0.2;
          else {
            const dx = p.cx - b.cx;
            const dy = p.cy - b.cy;
            const d = Math.max(1, Math.hypot(dx, dy));
            b.vx = (dx / d) * 4;
            b.vy = (dy / d) * 4;
            if (overlaps(b, p)) b.dead = true;
          }
          b.step();
          break;
        }
        case 'cyclone':
          b.step();
          b.y += Math.sin(b.life * 0.15) * 0.6;
          b.sprite.setTexture(`cyclone${Math.floor(b.life / 4) % 2}`);
          break;
        case 'spark':
          if (b.state === 0) {
            // Circle with the player until thrown.
            b.x = p.cx - b.w / 2;
            b.y = p.cy - b.h / 2;
            b.life++;
            if (!p.alive || p.weapon !== 'spark') b.dead = true;
          } else b.step();
          break;
        case 'flame':
          // Stays in front of the player for its short life.
          b.x = b.state > 0 ? p.cx + 4 : p.cx - 4 - b.w;
          b.y = p.y + 3;
          b.life++;
          b.sprite.setAlpha(1 - b.life / 24);
          this.meltBlocks(b);
          break;
        case 'bubble':
          b.life++;
          b.vy = Math.min(b.vy + 0.18, 4);
          b.x += b.vx;
          if (this.hitsWall(b)) b.vx = -b.vx;
          if (moveY(this.level, b, b.vy, true)) b.vy = b.vy > 0 ? -3.6 : 0; // bounce
          break;
        default:
          b.step();
      }
      if (b.stopAtWalls && this.hitsWall(b)) b.dead = true;
      if (b.maxLife && b.life > b.maxLife) b.dead = true;
    }
  }

  // --- enemy shots ------------------------------------------------------------

  spawnEnemyShot(o: ShotOptions): Projectile {
    const s = new Projectile(this, o.x, o.y, o.w, o.h, o.vx, o.vy, o.tex);
    s.dmg = o.dmg ?? 2;
    if (o.gravity) {
      s.ay = PHYS.gravity;
      s.diesOnSolid = true;
    }
    s.ax = o.ax ?? 0;
    s.spin = o.spin ?? 0;
    s.maxLife = o.life ?? 0;
    if (o.rolls) {
      s.rolls = true;
      s.stopAtWalls = true;
    }
    s.bounces = !!o.bounces;
    s.sprite.setFlipX(o.vx < 0);
    this.shots.push(s);
    return s;
  }

  fireEnemyShot(x: number, y: number, vx: number, vy: number): void {
    this.spawnEnemyShot({ x: x - 2, y: y - 2, w: 4, h: 4, vx, vy, tex: 'eshot' });
  }

  /** Ground wave that travels along the floor until it hits a wall. */
  fireGroundWave(x: number, floorY: number, dir: 1 | -1, tex = 'wave'): void {
    const s = this.spawnEnemyShot({ x, y: floorY - 12, w: 8, h: 12, vx: dir * 2.5, vy: 0, tex, dmg: 3 });
    s.stopAtWalls = true;
  }

  private stepShots(): void {
    for (const s of this.shots) {
      if (s.bounces) {
        s.life++;
        s.vy = Math.min(s.vy + 0.18, 4);
        s.x += s.vx;
        if (this.hitsWall(s)) s.vx = -s.vx;
        if (moveY(this.level, s, s.vy, true)) s.vy = s.vy > 0 ? -3.6 : 0;
        if (s.maxLife && s.life > s.maxLife) s.dead = true;
        continue;
      }
      if (s.rolls) {
        s.life++;
        s.x += s.vx;
        s.vy = Math.min(s.vy + PHYS.gravity, PHYS.maxFall);
        if (moveY(this.level, s, s.vy, true)) s.vy = 0;
        if (this.hitsWall(s)) s.dead = true;
        continue;
      }
      s.vx += s.ax;
      s.vy = Math.min(s.vy + s.ay, PHYS.maxFall);
      s.step();
      if (s.stopAtWalls && this.hitsWall(s)) s.dead = true;
      if (s.maxLife && s.life > s.maxLife) s.dead = true;
      if (s.diesOnSolid && s.vy > 0 && this.level.isSolid(Math.floor(s.cx / TILE), Math.floor((s.y + s.h) / TILE))) {
        s.dead = true;
        this.burst(s.cx, s.y + s.h, 'spark', 4);
      }
    }
  }

  private hitsWall(s: Projectile): boolean {
    const front = s.vx > 0 ? s.x + s.w : s.x;
    return this.level.isSolid(Math.floor(front / TILE), Math.floor((s.y + s.h / 2) / TILE));
  }

  /** Electric barriers switch on and off on a fixed rhythm. */
  private stepElectric(): void {
    if (!this.electricTiles.length) return;
    if (++this.electricT < ELECTRIC_PERIOD) return;
    this.electricT = 0;
    this.electricOn = !this.electricOn;
    for (const { c, r } of this.electricTiles) this.layer.putTileAt(this.electricOn ? ELECTRIC_ON_INDEX : ELECTRIC_OFF_INDEX, c, r);
    if (this.electricOn) sfx.zap();
  }

  /** Camera shake; `px` is roughly the shake size in game pixels. */
  shake(px: number): void {
    this.cameras.main.shake(200, px / VIEW_W);
  }

  // --- collisions ---------------------------------------------------------------

  private collide(): void {
    const p = this.player;
    const boss = this.boss;

    for (const b of this.bullets) {
      if (b.deflected || b.dead) continue;

      if (boss && boss.state === 'fight' && boss.blocksShots() && overlaps(b, boss)) {
        b.deflect();
        sfx.deflect();
        continue;
      }
      if (boss && boss.state === 'fight' && overlaps(b, boss) && !b.hitTargets.has(boss)) {
        // Shots pass through the boss during its brief post-hit invincibility.
        if (boss.vulnerable) {
          const weak = b.weapon === boss.weakness;
          const dmg = weak ? WEAKNESS_DAMAGE : b.weapon === 'buster' ? b.power : 1;
          boss.hit(dmg, weak);
          if (weak) {
            // Weakness hits land hard: a freeze-frame and a shake.
            sfx.weakHit();
            this.shake(5);
            this.hitStop = WEAK_HIT_STOP;
          } else sfx.hit();
          if (b.pierce) b.hitTargets.add(boss);
          else b.dead = true;
          if (boss.hp === 0) this.startBossDeath();
        }
        if (!b.pierce) continue;
      }

      for (const e of this.enemies) {
        if (e.hp <= 0 || b.hitTargets.has(e) || !overlaps(b, e)) continue;
        if (e.shielded() && !b.ignoresShield) {
          b.deflect();
          sfx.deflect();
          break;
        }
        e.hp -= b.power;
        e.flash = 8;
        sfx.hit();
        if (e.hp <= 0) this.killEnemy(e);
        else if (b.weapon === 'frost') {
          e.frozen = 180;
          sfx.freeze();
        }
        if (b.pierce) b.hitTargets.add(e);
        else {
          b.dead = true;
          break;
        }
      }
    }

    // Spark Ring swats enemy shots out of the air.
    for (const b of this.bullets) {
      if (b.weapon !== 'spark' || b.dead) continue;
      for (const s of this.shots) {
        if (!s.dead && overlaps(b, s)) {
          s.dead = true;
          this.burst(s.cx, s.cy, 'spark', 3);
        }
      }
    }

    if (!p.alive) return;
    for (const e of this.enemies) if (e.hp > 0 && e.harmful() && overlaps(p, e)) p.hurt(e.dmg, e.cx);
    if (boss && boss.harmful && overlaps(p, boss)) p.hurt(4, boss.cx);
    for (const s of this.shots) {
      if (!s.dead && overlaps(p, s) && p.invuln === 0) {
        p.hurt(s.dmg, s.cx);
        s.dead = true;
      }
    }
    for (const k of this.pickups) {
      if (!k.dead && overlaps(p, k)) {
        p.heal(k.heal);
        if (k.ammo) this.refillAmmo(k.ammo);
        k.dead = true;
        sfx.pickup();
      }
    }
    const u = this.upgradeItem;
    if (u && !u.taken && overlaps(p, u.box)) this.startPartGet();
    for (const t of this.tankItems) {
      if (t.taken || !overlaps(p, t.box)) continue;
      t.taken = true;
      t.sprite.setVisible(false);
      setTanks(loadSave().tanks + 1);
      sfx.pickup();
      this.flashLabel(loadSave().tanks >= MAX_TANKS ? 'E-TANK (FULL)' : 'E-TANK');
    }
    const goal = this.level.goal;
    const goalOpen = this.capsules.every((c) => c.done);
    if (goal && goalOpen && overlaps(p, { x: goal.x - 6, y: goal.y - 16, w: 12, h: 16 })) this.stageClear();
  }

  private killEnemy(e: Enemy): void {
    e.spawn.alive = false;
    sfx.enemyDie();
    this.addEffect(e.cx, e.cy, 0, 0, 0, 14, true);
    const roll = Math.random();
    const hasAmmoWeapons = this.unlocked.length > 1;
    if (roll < 0.06) this.dropPickup(e.cx, e.cy, 10, 0, 'hp_big', 12, 10);
    else if (roll < 0.26) this.dropPickup(e.cx, e.cy, 3, 0, 'hp_small', 8, 6);
    else if (hasAmmoWeapons && roll < 0.31) this.dropPickup(e.cx, e.cy, 0, 14, 'ammo_big', 12, 10);
    else if (hasAmmoWeapons && roll < 0.45) this.dropPickup(e.cx, e.cy, 0, 6, 'ammo_small', 8, 6);
  }

  private dropPickup(cx: number, cy: number, heal: number, ammo: number, tex: string, w: number, h: number): void {
    const k = new Projectile(this, cx - w / 2, cy - h / 2, w, h, 0, -2, tex) as Pickup;
    k.heal = heal;
    k.ammo = ammo;
    this.pickups.push(k);
  }

  /** Ammo goes to the equipped weapon, or the emptiest one if the Ultra Gun is equipped. */
  private refillAmmo(n: number): void {
    const p = this.player;
    let target: WeaponId | undefined = p.weapon !== 'buster' ? p.weapon : undefined;
    if (!target) {
      const candidates = this.unlocked.filter((w) => w !== 'buster');
      target = candidates.sort((a, b) => p.ammo[a] - p.ammo[b])[0];
    }
    if (target) p.ammo[target] = Math.min(p.maxAmmo, p.ammo[target] + n);
  }

  private stepPickups(): void {
    for (const k of this.pickups) {
      k.life++;
      k.vy = Math.min(k.vy + PHYS.gravity, PHYS.maxFall);
      if (moveY(this.level, k, k.vy, true)) k.vy = 0;
      if (k.life > 300) k.dead = true;
    }
  }

  // --- effects ------------------------------------------------------------------

  playerBurst(cx: number, cy: number, tex = 'shard'): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 1.5;
      this.addEffect(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp - 2, 0.12, 90, false, tex);
    }
    this.addEffect(cx, cy, 0, 0, 0, 20, true);
  }

  /** A few small particles flying out from a point. */
  burst(x: number, y: number, tex: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random();
      this.addEffect(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 0.5, 0.05, 20, false, tex);
    }
  }

  /** Push from a stage wind gust this step (see sky.ts). */
  get gust(): number {
    return this.sky.gust;
  }

  landOnMover(p: Player, prevBottom: number): boolean {
    return this.sky.landOnMover(p, prevBottom);
  }

  /** Wind streak blowing across the screen in direction `dir`. */
  windStreak(dir: number): void {
    const x = dir > 0 ? -10 : VIEW_W + 10;
    const y = 30 + Math.random() * (VIEW_H - 60);
    const sprite = this.add.image(x, y, 'windline').setDepth(19).setScrollFactor(0).setAlpha(0.7);
    this.effects.push({ sprite, vx: dir * 7, vy: 0, gravity: 0, life: 70, maxLife: 70, grow: false });
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

  // --- boss ---------------------------------------------------------------------

  private trySpawnBoss(): void {
    const at = this.level.boss;
    const kind = this.level.data.boss;
    if (!at || !kind || this.boss || this.bossDefeated) return;
    if (this.level.sectionAt(at.x, at.y - 1) !== this.section) return;
    this.spawnBossInRoom(kind);
  }

  /** Lock the camera on the boss room ('X' marker's section) and start a boss there. */
  private spawnBossInRoom(kind: BossKind): void {
    const at = this.level.boss!;
    const sec = this.level.sectionAt(at.x, at.y - 1)!;
    const camX = Math.round(this.bossRoomCamX(sec));
    this.arena = { camX, left: camX + 8, right: camX + VIEW_W - 8 };
    this.camX = camX;
    this.bossRoom = {
      left: this.arena.left,
      right: this.arena.right,
      top: sec.row * SCREEN_H + 2 * TILE, // under the room's 2-tile ceiling
      floor: at.y,
    };
    this.boss = createBoss(kind, this, at, this.bossRoom);
    playMusic(this, kind === 'overlord' ? 'finalboss' : 'boss');
  }

  /** Name shown while a boss's health bar fills. */
  private bossName(boss: Boss): string | undefined {
    if (boss instanceof Miniboss) return boss.name;
    if (boss.kind === 'shade') return 'SHADE';
    if (boss.kind === this.level.data.boss) return this.level.data.bossName;
    return BOSS_NAMES[boss.kind];
  }

  // --- miniboss -------------------------------------------------------------------

  /**
   * Walking up to the 'M' marker locks the camera with the miniboss near the
   * right edge of the view. Beating it unlocks the camera again.
   */
  private tryStartMiniboss(): void {
    const at = this.level.miniboss;
    const kind = this.level.data.miniboss;
    if (!at || !kind || this.boss || this.miniDefeated || !this.player.alive) return;
    const sec = this.section;
    if (this.level.sectionAt(at.x, at.y - 1) !== sec || this.player.cx < at.x - 170) return;
    const secLeft = sec.x0 * SCREEN_W;
    const secRight = (sec.x1 + 1) * SCREEN_W;
    const camX = Math.round(Phaser.Math.Clamp(at.x + 48 - VIEW_W, secLeft, secRight - VIEW_W));
    this.arena = { camX, left: camX + 8, right: camX + VIEW_W - 8 };
    const room: Room = { left: this.arena.left, right: this.arena.right, top: sec.row * SCREEN_H + TILE, floor: at.y };
    this.boss = createBoss(kind, this, at, room);
    playMusic(this, 'boss');
  }

  // --- boss rematch room -------------------------------------------------------------

  /** Press UP inside an open capsule to teleport to its boss. */
  private checkCapsules(): void {
    const p = this.player;
    if (!this.capsules.length || this.boss || !p.alive || p.state !== 'idle' && p.state !== 'run') return;
    if (!this.controls.justPressed('up')) return;
    const c = this.capsules.find((k) => !k.done && overlaps(p, k.box));
    if (!c) return;
    this.hubSpot = { x: c.box.x + c.box.w / 2, y: c.box.y + c.box.h };
    this.teleport = { t: 0, to: 'arena', kind: c.kind };
    sfx.charge(2);
  }

  /** Beam out (hero flickers away), jump the camera, beam in. */
  private stepTeleport(): void {
    const tp = this.teleport!;
    const p = this.player;
    tp.t++;
    p.vx = p.vy = 0;
    p.sprite.setVisible(tp.t % 4 < 2 && tp.t < TELEPORT_FRAMES / 2 || tp.t > TELEPORT_FRAMES * 0.75);
    if (tp.t === Math.floor(TELEPORT_FRAMES / 2)) {
      this.clearActors();
      if (tp.to === 'arena') {
        const at = this.level.boss!;
        const sec = this.level.sectionAt(at.x, at.y - 1)!;
        const camX = Math.round(this.bossRoomCamX(sec));
        p.reset(camX + 60, at.y);
        this.section = sec;
        this.spawnBossInRoom(tp.kind!);
        this.camY = sec.row * SCREEN_H;
      } else {
        const back = this.hubSpot ?? this.level.playerStart;
        p.reset(back.x, back.y);
        this.section = this.level.sectionAt(p.cx, p.cy)!;
        this.arena = null;
        this.followCamera();
        playMusic(this, stageMusic(this.level.data));
      }
    }
    if (tp.t >= TELEPORT_FRAMES) {
      this.teleport = null;
      p.sprite.setVisible(true);
    }
  }

  /** A player shot is heading at `box` and is within `dist` px (Shade dodges these). */
  playerShotNear(box: Box, dist: number): boolean {
    const cx = box.x + box.w / 2;
    return this.bullets.some((b) => {
      const dx = cx - b.cx;
      return Math.abs(dx) < dist && Math.sign(dx) === Math.sign(b.vx) && b.cy > box.y - 8 && b.cy < box.y + box.h + 8;
    });
  }

  /** Spark Ring circling Shade while its shield is up. */
  drawShadeRing(owner: Box | null): void {
    if (!owner) {
      this.shadeRing?.setVisible(false);
      return;
    }
    this.shadeRing ??= this.add.image(0, 0, 'sparkring').setDepth(9);
    this.shadeRing.setVisible(true).setPosition(Math.round(owner.x + owner.w / 2), Math.round(owner.y + owner.h / 2));
    this.shadeRing.rotation += 0.25;
  }

  /** Camera position that centers a boss room in the view. */
  private bossRoomCamX(sec: Section): number {
    const left = sec.x0 * SCREEN_W;
    const right = (sec.x1 + 1) * SCREEN_W;
    return (left + right) / 2 - VIEW_W / 2;
  }

  /** True if this section holds the stage's boss. */
  private isBossSection(sec: Section): boolean {
    const at = this.level.boss;
    return !!at && this.level.sectionAt(at.x, at.y - 1) === sec;
  }

  private startBossDeath(): void {
    this.bossDeathT = 1;
    this.hitStop = 14;
    this.wind = 0;
    for (const s of this.shots) s.dead = true;
  }

  /** Chain of explosions, then a burst, then the weapon get. */
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
      this.bossDeathT = 0;
      this.drawShadeRing(null);
      // The final boss has a second phase: Shade drops in once the machine is gone.
      if (boss.kind === 'overlord' && this.level.boss && this.bossRoom) {
        this.boss = createBoss('shade', this, this.level.boss, this.bossRoom);
        return;
      }
      // Miniboss: the camera unlocks, it leaves a big refill, and the stage goes on.
      if (boss instanceof Miniboss && !boss.guardian) {
        this.miniDefeated = true;
        this.arena = null;
        this.dropPickup(boss.cx - 10, boss.cy, 10, 0, 'hp_big', 12, 10);
        if (this.unlocked.length > 1) this.dropPickup(boss.cx + 10, boss.cy, 0, 14, 'ammo_big', 12, 10);
        playMusic(this, stageMusic(this.level.data));
        return;
      }
      // Rematch room: back to the hub, with that capsule switched off.
      if (this.capsules.length) {
        const c = this.capsules.find((k) => k.kind === boss.kind && !k.done);
        if (c) {
          c.done = true;
          c.sprite.setTexture('capsule_off');
        }
        this.player.heal(10);
        this.teleport = { t: 0, to: 'hub' };
        if (this.capsules.every((k) => k.done)) {
          this.goalSprite?.setVisible(true);
          this.flashLabel('THE WAY FORWARD IS OPEN');
        }
        return;
      }
      this.bossDefeated = true;
      const reward = this.level.data.bossWeapon;
      if (reward) this.startWeaponGet(reward);
      else this.stageClear();
    }
  }

  // --- armor parts ----------------------------------------------------------------

  /** Flame Burst melts frozen blocks it touches. */
  private meltBlocks(b: Box): void {
    const c0 = Math.floor(b.x / TILE);
    const c1 = Math.floor((b.x + b.w - 1) / TILE);
    const r0 = Math.floor(b.y / TILE);
    const r1 = Math.floor((b.y + b.h - 1) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.level.tileAt(c, r) !== Tile.Melt) continue;
        this.level.setTile(c, r, Tile.Empty);
        this.layer.removeTileAt(c, r);
        this.burst(c * TILE + 8, r * TILE + 8, 'bubble_fx', 4);
        sfx.flame();
      }
    }
  }

  private startPartGet(): void {
    const u = this.upgradeItem!;
    const part = this.level.data.upgrade!;
    u.taken = true;
    u.icon.setVisible(false);
    u.sprite.setTexture('capsule_off');
    recordPart(part);
    const p = this.player;
    p.setParts(loadSave().parts);
    p.heal(p.maxHp);
    if (part === 'helmet') for (const w of this.unlocked) p.ammo[w] = p.maxAmmo;
    p.charge = 0;
    p.vx = 0;
    this.partGetT = 1;
    sfx.clear();
  }

  /** The hero flashes white, then the part's name and what it does. */
  private stepPartGet(): void {
    const t = this.partGetT++;
    const def = PARTS[this.level.data.upgrade!];
    const p = this.player;
    p.state = 'idle';
    p.invuln = 0;
    this.stepEffects();
    if (t < 70) {
      this.banner.setText(`${def.name} GET!`).setVisible(true);
      if (t % 6 === 0) this.burst(p.cx, p.cy, 'spark', 3);
    } else {
      this.banner.setText(`${def.name}\n\n${def.blurb}`).setFontSize(12);
    }
    if (t >= 220) {
      this.partGetT = 0;
      this.banner.setFontSize(16).setVisible(false);
    }
  }

  // --- weapon get ---------------------------------------------------------------

  private startWeaponGet(id: WeaponId): void {
    stopMusic();
    recordClear(this.stageId, id);
    this.unlocked = loadSave().weapons;
    this.player.ammo[id] = this.player.maxAmmo;
    this.player.heal(this.player.maxHp);
    this.player.charge = 0;
    for (const b of this.bullets) b.dead = true;
    this.weaponGetT = 1;
    sfx.clear();
  }

  /** Hero flashes between old and new colors, then shows the weapon name. */
  private stepWeaponGet(): void {
    const t = this.weaponGetT++;
    const id = this.level.data.bossWeapon!;
    const p = this.player;
    p.state = 'idle';
    p.invuln = 0;
    this.stepEffects();
    if (t < 90) {
      p.weapon = Math.floor(t / 6) % 2 === 0 ? id : 'buster';
      this.banner.setText('WEAPON GET!').setVisible(true);
    } else {
      p.weapon = id;
      this.banner.setText(`YOU GOT\n${WEAPONS[id].name}\n\n(select it on the pause menu)`).setFontSize(12);
    }
    if (t >= 260) {
      this.weaponGetT = 0;
      this.banner.setFontSize(16);
      this.stageClear();
    }
  }

  // --- doors --------------------------------------------------------------------

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
      // Walk in past the door (into the visible arena, for a boss room).
      const endX = this.isBossSection(next) ? Math.round(this.bossRoomCamX(next)) + 16 : (d.col + 1) * TILE + 12;
      this.doorSeq = {
        door: d,
        next,
        phase: 'open',
        t: 0,
        fromX: this.camX,
        toX: this.isBossSection(next)
          ? Math.round(this.bossRoomCamX(next))
          : Phaser.Math.Clamp(endX + p.w / 2 - VIEW_W / 2, next.x0 * SCREEN_W, (next.x1 + 1) * SCREEN_W - VIEW_W),
        startX: p.x,
        endX,
      };
      p.charge = 0;
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
        this.player.vx = 0;
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

    // The player can't leave the section sideways (or the arena, in a boss fight).
    const minX = this.arena ? this.arena.left : sec.x0 * SCREEN_W;
    const maxX = (this.arena ? this.arena.right : (sec.x1 + 1) * SCREEN_W) - p.w;
    if (p.x < minX || p.x > maxX) {
      p.x = Phaser.Math.Clamp(p.x, minX, maxX);
      p.vx = 0;
    }

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
    // Ease into an arena lock (minibosses lock mid-scroll) and back out of it.
    const target = this.arena ? this.arena.camX : this.cameraTargetX(this.section);
    const d = target - this.camX;
    this.camX = Math.abs(d) <= 4 ? target : this.camX + Math.sign(d) * 4;
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
    // Shots may briefly go above the screen (lobbed seeds, deflected bullets).
    const tight: Box = { x: this.camX, y: this.camY - 64, w: VIEW_W, h: VIEW_H + 64 };

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
    this.arena = null;
    this.drawShadeRing(null);
    this.bossDeathT = 0;
    this.wind = 0;
    this.sky.reset();
    this.hazards.reset();
    for (const s of this.level.spawns) {
      s.alive = false;
      s.armed = true;
    }
    playMusic(this, stageMusic(this.level.data)); // back to the stage track after a boss
    // Latest checkpoint the player has passed.
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.teleport = null;
    this.section = this.level.sectionAt(this.player.cx, this.player.cy)!;
    this.camX = this.cameraTargetX(this.section);
    this.followCamera();
    this.trySpawnBoss();
    this.readyTimer = 64;
  }

  /** Where to go after leaving this stage. */
  private exitScene(cleared: boolean): string {
    if (this.stageId === 'finale') return cleared ? 'ending' : 'fortress';
    if (getStage(this.stageId).theme === 'fortress') return 'fortress';
    return 'select';
  }

  private stageClear(): void {
    if (this.clearTimer > 0) return;
    recordClear(this.stageId);
    stopMusic();
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
    const p = this.player;
    const hp = p.hp;
    const bossHp = this.boss && this.boss.state !== 'dying' ? this.boss.barHp : -1;
    const ammo = p.weapon === 'buster' ? -1 : p.ammo[p.weapon];
    const bossMax = this.boss?.maxHp ?? 0;
    const key = `${hp}|${bossHp}|${bossMax}|${p.weapon}|${ammo}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    const g = this.hud;
    g.clear();
    // Bars left to right: life, equipped weapon's ammo (if any), boss.
    let x = 12;
    this.drawBar(g, x, hp, p.maxHp, 0xfff1a8);
    if (ammo >= 0) this.drawBar(g, (x += 12), ammo, p.maxAmmo, WEAPONS[p.weapon].colors.main);
    if (bossHp >= 0) this.drawBar(g, (x += 12), bossHp, bossMax, 0xff7050);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, value: number, max: number, color: number): void {
    const y = 16;
    g.fillStyle(0x000000, 1).fillRect(x, y, 8, max * 2 + 2);
    for (let i = 0; i < max; i++) {
      const uy = y + max * 2 - i * 2;
      g.fillStyle(i < value ? color : 0x3a3550, 1).fillRect(x + 1, uy, 6, 1);
    }
  }

  /** Q / E (L1 / R1): switch weapons without pausing. */
  private cycleWeapon(): void {
    const c = this.controls;
    const dir = (c.justPressed('next') ? 1 : 0) - (c.justPressed('prev') ? 1 : 0);
    if (dir === 0 || this.unlocked.length < 2 || !this.player.alive) return;
    const i = this.unlocked.indexOf(this.player.weapon);
    const next = this.unlocked[(i + dir + this.unlocked.length) % this.unlocked.length];
    this.player.weapon = next;
    this.player.charge = 0;
    sfx.tick();
    this.flashLabel(WEAPONS[next].name);
  }

  /** Short message under the health bars. */
  private flashLabel(text: string): void {
    this.weaponLabel.setText(text).setVisible(true);
    this.weaponLabelT = 70;
  }

  /**
   * Pause menu rows: every weapon (moving the cursor equips it), E-TANK
   * (Z / X refills life), EXIT STAGE.
   */
  private get pauseRows(): number {
    return this.unlocked.length + 2;
  }

  private buildPauseMenu(): void {
    const layer = this.pauseLayer;
    layer.removeAll(true);
    const p = this.player;
    const style = { fontFamily: 'monospace', fontSize: '8px', color: '#fff1e0' };
    const rowH = 14;
    const h = 82 + this.pauseRows * rowH;
    const top = VIEW_H / 2 - h / 2;
    const left = VIEW_W / 2 - 100;
    layer.add(this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 200, h, 0x000000, 0.88).setStrokeStyle(1, 0x5ef0c8));
    layer.add(this.add.text(VIEW_W / 2, top + 14, 'PAUSED', { ...style, fontSize: '16px' }).setOrigin(0.5));
    // Armor parts found (dim = not found yet).
    PART_ORDER.forEach((id, i) => {
      layer.add(this.add.image(VIEW_W / 2 - 27 + i * 18, top + 32, `part_${id}`).setAlpha(p.has(id) ? 1 : 0.2));
    });
    const bars = this.add.graphics();
    layer.add(bars);
    this.unlocked.forEach((id, i) => {
      const y = top + 44 + i * rowH;
      const def = WEAPONS[id];
      const selected = i === this.pauseIndex;
      layer.add(this.add.text(left + 12, y, `${selected ? '>' : ' '} ${def.name}`, { ...style, color: selected ? '#fff1e0' : '#8a8fa8' }));
      const value = def.cost === 0 ? p.maxAmmo : p.ammo[id];
      for (let u = 0; u < p.maxAmmo; u++) {
        bars.fillStyle(u < value ? def.colors.main : 0x3a3550, 1).fillRect(left + 120 + u * 2, y + 2, 1, 6);
      }
    });
    const tanks = loadSave().tanks;
    const tankRow = this.unlocked.length;
    const tankY = top + 44 + tankRow * rowH + 4;
    const onTank = this.pauseIndex === tankRow;
    layer.add(this.add.text(left + 12, tankY, `${onTank ? '>' : ' '} E-TANK`, { ...style, color: onTank ? '#9ee8ff' : '#8a8fa8' }));
    for (let i = 0; i < MAX_TANKS; i++) {
      layer.add(this.add.image(left + 126 + i * 14, tankY + 4, 'etank').setAlpha(i < tanks ? 1 : 0.2));
    }
    const exitY = tankY + rowH;
    const onExit = this.pauseIndex === tankRow + 1;
    layer.add(this.add.text(left + 12, exitY, `${onExit ? '>' : ' '} EXIT STAGE`, { ...style, color: onExit ? '#ff9a7a' : '#8a8fa8' }));
    const hint = onExit
      ? 'Z / X to leave the stage'
      : onTank
        ? tanks === 0 ? 'none left: find them in stages' : p.hp >= p.maxHp ? 'life is already full' : 'Z / X to refill your life'
        : WEAPONS[this.unlocked[this.pauseIndex]].blurb;
    layer.add(this.add.text(VIEW_W / 2, top + h - 22, hint, { ...style, color: '#5ef0c8' }).setOrigin(0.5));
    layer.add(this.add.text(VIEW_W / 2, top + h - 10, 'UP/DOWN select   ENTER resume', { ...style, color: '#8a8fa8' }).setOrigin(0.5));
  }

  private stepPauseMenu(): void {
    const c = this.controls;
    const count = this.pauseRows;
    const dir = (c.justPressed('down') ? 1 : 0) - (c.justPressed('up') ? 1 : 0);
    if (dir !== 0) {
      this.pauseIndex = (this.pauseIndex + dir + count) % count;
      const w = this.unlocked[this.pauseIndex];
      if (w) {
        this.player.weapon = w;
        this.player.charge = 0;
      }
      sfx.tick();
      this.buildPauseMenu();
    }
    const act = c.justPressed('jump') || c.justPressed('fire');
    if (!act) return;
    if (this.pauseIndex === this.unlocked.length) {
      const tanks = loadSave().tanks;
      if (tanks > 0 && this.player.hp < this.player.maxHp) {
        setTanks(tanks - 1);
        this.player.heal(this.player.maxHp);
        sfx.pickup();
        this.buildPauseMenu();
      }
    } else if (this.pauseIndex === this.unlocked.length + 1) {
      sfx.select();
      this.scene.start(this.exitScene(false));
    }
  }
}
