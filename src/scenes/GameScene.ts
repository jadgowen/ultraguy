import Phaser from 'phaser';
import { nowPlaying, playJingle, playMusic, playVoice, stageMusic, stopMusic } from '../audio';
import { BOSS_INTROS, INTRO, IntroCard } from './bossIntro';
import { TileFx } from '../tileFx';
import { ArenaFx } from './arenaFx';
import { Beam } from './beam';
import { uiHighlight, uiPanel } from '../uiArt';
import { ensureScene, startScene } from './lazy';
import { Blackout } from './blackout';
import { Elevator } from './elevator';
import { DEV_TOOLS, PHYS, SCREEN_H, SCREEN_W, STEP_MS, TILE, VIEW_H, VIEW_W } from '../constants';
import { Enemy, Projectile, createEnemy } from '../entities/Enemies';
import { Player } from '../entities/Player';
import { Boss, Miniboss, Room, createBoss } from '../entities/bosses';
import { ARENA_ONLY } from '../entities/bosses/Miniboss';
import { Controls } from '../input';
import { BossKind, Door, ELECTRIC_OFF_INDEX, Level, MiniKind, Point, Section, StageId, Tile } from '../level/Level';
import { PART_ORDER, PARTS } from '../parts';
import { BOSS_STAGES, getStage } from '../level/stages';
import { THEMES } from '../level/themes';
import { Box, moveY, overlaps } from '../physics';
import { skinForStage } from '../skins';
import { BOLT_BIG, BOLT_CACHE, BOLT_SMALL } from '../shop';
import { MAX_TANKS, addBolts, updateSave, recordExClear, loadSave, meetPip, recordClear, recordPart, setTanks, wearSavedSkin } from '../save';
import { Pip } from '../entities/Pip';
import { PIP_MODULES, pipOwns, pipUnlocked } from '../pip';
import { sfx } from '../sfx';
import { WEAPONS, WeaponId, WEAPON_ORDER } from '../weapons';
import { AUTO_GID, PARALLAX, autoIndex, hasEnvArt } from '../envArt';
import { dialogue, pixelateIn, pixelateOut } from './cutscene';
import { BOSS_ENCOUNTERS, BOSS_GAMES, CHALLENGE_BOLTS, CHALLENGE_MERCY, Encounter, MINI_ENCOUNTERS, PART_GUARDIANS, Resume, Ret } from './encounters';
import { Hazards } from './hazards';
import { Sky } from './sky';
import { PixelText, pixelText } from '../pixelFont';

/** How long the stage title card shows, in steps. */
const TITLE_CARD_FRAMES = 170;
const TRANSITION_FRAMES = 64;
/** How long the camera glides when it hands over between following you and riding the magma elevator. */
const CAM_GLIDE_FRAMES = 48;
const DOOR_PAN_FRAMES = 80;
const DOOR_TILE_FRAMES = 5; // frames per door tile opening/closing
const DOOR_TILE_INDEX = Tile.Door - 1;
const ELECTRIC_ON_INDEX = Tile.Electric - 1;
const ELECTRIC_PERIOD = 100;

/** Damage a boss takes from its weakness weapon. */
const WEAKNESS_DAMAGE = 4;
/** Freeze-frames when a weakness hit lands. */
const WEAK_HIT_STOP = 6;
/** Extra lives on entering a stage (shown on the HUD), and the most you can hold. */
const LIVES_START = 2;
const LIVES_MAX = 9;
/**
 * Lives and taken 1-UPs for the current stage visit. They live outside the
 * scene so a trip into an encounter (and back) doesn't reset them.
 */
const visit = { stage: '' as string, lives: LIVES_START, oneUpsTaken: new Set<number>(), cachesTaken: new Set<number>(), challengeLosses: 0, miniDefeated: false };
/** Freeze-frame when a full charge shot hits a boss. */
const CHARGE_HIT_STOP = 3;
/** After the Mammoth falls through the ice, the holes freeze back over this soon (steps; it surfaces in about 75). */
const ICE_REFREEZE_AFTER_FALL = 40;

/**
 * Boss Hall: which boss each teleporter (left to right) sends you to. All
 * eight must be beaten to open the exit. (The minigames are in the ARCADE.)
 */
const REMATCH_ORDER: BossKind[] = ['anvil', 'mantis', 'frostline', 'gale', 'volt', 'magma', 'scrap', 'tide'];

/** Display names for each stage boss (from the stage data). */
const BOSS_NAMES: Partial<Record<BossKind, string>> = Object.fromEntries(
  Object.values(BOSS_STAGES).map((st) => [st.boss, st.bossName]),
);

export interface GameSceneData {
  stage: StageId;
  /** Start at the checkpoint just before the boss door. */
  bossTest?: boolean;
  /** EX rematch: straight to the boss door, a tougher boss, no E-tanks. */
  ex?: boolean;
  /** Coming back from a special-mode encounter (race, boxing, ...): where from, and how it went. */
  resume?: Resume;
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
  /** Pip is carrying it back to you. */
  carried?: boolean;
  heal: number;
  ammo: number;
  /** Bolts (currency) it's worth. */
  bolts?: number;
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
  /** Push from enemies this step (Gust Fans, Magnet Drones); becomes `wind` next step. */
  enemyWind = 0;
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
  /** A boss fought in its own game: the encounter has started (until we hear back). */
  private bossWarped = false;
  /** That boss, standing in his room while he talks. */
  private bossStandIn: Phaser.GameObjects.Image | null = null;
  /** The stage's miniboss has been beaten this visit. */
  private miniDefeated = false;
  /** The boss's challenge ('A'): settled (won, or pushed past), and the boss standing there until then. */
  private challengeDone = false;
  private challengeStandIn: Phaser.GameObjects.Image | null = null;
  /** Energy tanks lying in the stage (taken ones stay taken this visit). */
  private tankItems: { box: Box; sprite: Phaser.GameObjects.Image; taken: boolean }[] = [];
  private oneUpItems: { box: Box; sprite: Phaser.GameObjects.Image; taken: boolean; key: number }[] = [];
  private cacheItems: { box: Box; sprite: Phaser.GameObjects.Image; taken: boolean; key: number }[] = [];
  /** The Bolt Magnet (bought at Rivet's): pickups fly to you. */
  private magnet = false;
  /** Bolts held (mirrors the save, so the HUD needn't read it every frame). */
  private boltCount = 0;
  /** Counts down after the last life is lost, then back to the select screen. */
  private gameOverT = 0;
  /** Rematch room: capsules, which are done, and a teleport in progress. */
  private capsules: { box: Box; sprite: Phaser.GameObjects.Image; kind: BossKind; done: boolean }[] = [];
  /**
   * The teleport beam running right now (stage start, respawn, the Boss Hall's
   * capsules), and what to do when it's done. Play waits for it.
   */
  private beam: Beam | null = null;
  private beamThen: (() => void) | null = null;
  /** Boss Hall: the stage whose arena you're refighting in (for arenaFx), or null. */
  private hallArenaStage: StageId | null = null;
  private hubSpot: Point | null = null;
  /** Freeze-frame counter (weakness hits). */
  private hitStop = 0;
  /** Upgrade capsule (armor part) in this stage, and the pickup sequence timer. */
  private upgradeItem: { box: Box; sprite: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; taken: boolean } | null = null;
  private partGetT = 0;
  private weaponLabel!: PixelText;
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
  /** A dialogue (or other story beat) that has the screen; steps instead of the game. */
  private story: (() => void) | null = null;
  /** This visit's armor-part guardian has been beaten (or isn't there). */
  private partGuardianBeaten = false;
  /** Stage title card (only when a stage starts, not after a death). */
  private titleCard: Phaser.GameObjects.Container | null = null;
  /** Bosses whose full intro has played this visit (retries get the quick one). */
  private introSeen = new Set<BossKind>();
  /** The full boss intro on screen: letterbox bars and the name card. */
  private intro: { bars: Phaser.GameObjects.Rectangle[]; card: Phaser.GameObjects.Container; name: PixelText; title: PixelText; full: string; data: IntroCard; done: boolean } | null = null;
  private titleT = 0;
  /** Stage-intro flyover: the camera starts this far ahead and sweeps back to the hero (null: none). */
  private flyFrom: number | null = null;
  private flyTo = 0;
  private clearTimer = 0;
  /** An EX rematch (see Boss.ex). */
  exMode = false;
  /** A Boss Hall capsule rematch (stage bosses fight a notch harder there). */
  hallRematch = false;

  private layer!: Phaser.Tilemaps.TilemapLayer;
  /** Wall drawn over a hidden room until the player steps inside it. */
  private secrets: { cells: Set<number>; layer: Phaser.Tilemaps.TilemapLayer }[] = [];
  /** Thin ice under strain: cracks on it so far, and the countdown to it giving way. */
  /** Caldera's magma elevator (null elsewhere). */
  private elevator: Elevator | null = null;
  /**
   * Who has the camera: the sections (following you) or the lift. When that
   * changes, the camera glides over (eased in and out, like the scroll between
   * floors) instead of jumping.
   */
  private camMode: 'free' | 'lift' = 'free';
  private camGlide: { fromX: number; fromY: number; t: number } | null = null;
  /** Pip, the hero's drone (once a boss is down). */
  private pip: Pip | null = null;
  /** Power Plant's blackout (null elsewhere). */
  private blackout: Blackout | null = null;
  /** What the stage's boss room does by itself (Caldera's lava surge, Glacier's icicles). */
  private arenaFx!: ArenaFx;
  private iceCracks = new Map<number, { c: number; r: number; n: number; breakT: number; img: Phaser.GameObjects.Image }>();
  /** Broken thin ice, freezing back over (frames left). */
  private iceHoles: { c: number; r: number; t: number }[] = [];
  /** Living tiles: lava, ice glints, water shimmer, springs, belts. */
  private tileFx: TileFx | null = null;
  private fxFrame = 0;
  /** Background layers and how fast each scrolls with the camera. */
  private bgLayers: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  private hud!: Phaser.GameObjects.Graphics;
  private hudKey = '';
  /** Per bar: the value it showed last, and the drain of the units just lost (they flash, then fall away). */
  private barTrail: Record<string, { last: number; lost: number; t: number }> = {};
  private goalSprite: Phaser.GameObjects.Image | null = null;
  private banner!: PixelText;
  private pauseLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('game');
  }

  create(data: GameSceneData): void {
    wearSavedSkin();
    // Scene instances are reused on restart, so reset all state here.
    this.stageId = data?.stage ?? 'foundry';
    this.introSeen = new Set();
    this.intro = null;
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
    this.bossWarped = false;
    this.bossStandIn = null;
    this.miniDefeated = false;
    this.challengeDone = false;
    this.challengeStandIn = null;
    this.tankItems = [];
    this.oneUpItems = [];
    this.cacheItems = [];
    this.magnet = loadSave().magnet;
    this.boltCount = loadSave().bolts;
    this.gameOverT = 0;
    // A fresh visit to a stage starts with the usual lives; coming back from an encounter keeps them.
    if (!data?.resume || visit.stage !== this.stageId) {
      visit.stage = this.stageId;
      visit.lives = LIVES_START;
      visit.oneUpsTaken = new Set();
      visit.cachesTaken = new Set();
      visit.challengeLosses = 0;
      visit.miniDefeated = false;
      // 1-UPs bought at Rivet's go into this stage's lives.
      const bought = this.stageId === 'dojo' ? 0 : loadSave().spareLives;
      if (bought) {
        visit.lives = Math.min(LIVES_MAX, visit.lives + bought);
        updateSave((d) => (d.spareLives = 0));
      }
    }
    // Back from an encounter (the boss's game, a part's guardian): a miniboss beaten on this visit stays beaten.
    this.miniDefeated = visit.miniDefeated;
    this.capsules = [];
    this.beam = null;
    this.beamThen = null;
    this.hallArenaStage = null;
    this.hubSpot = null;
    this.hitStop = 0;
    this.weaponLabelT = 0;
    this.upgradeItem = null;
    this.partGetT = 0;
    this.bossDeathT = 0;
    this.weaponGetT = 0;
    this.wind = 0;
    // The dojo hands you every weapon.
    this.unlocked = this.stageId === 'dojo' ? [...WEAPON_ORDER] : loadSave().weapons;
    this.acc = 0;
    this.paused = false;
    this.transition = null;
    this.doorSeq = null;
    this.clearTimer = 0;
    this.exMode = !!data?.ex;
    this.hallRematch = false;
    this.hudKey = '';
    this.barTrail = {};
    this.goalSprite = null;
    this.story = null;
    this.partGuardianBeaten = false;

    const stage = getStage(this.stageId);
    this.level = new Level(stage);
    const atDoor = (DEV_TOOLS && data?.bossTest) || this.exMode;
    const start = atDoor && this.level.bossTestStart ? this.level.bossTestStart : this.level.playerStart;
    this.checkpoint = { ...start };

    const theme = THEMES[stage.theme];
    this.cameras.main.setBackgroundColor(theme.sky);
    // 16-bit themes: auto-tiled blocks and layered parallax. Others: flat tiles, one background.
    const env = hasEnvArt(stage.theme);
    this.bgLayers = env
      ? PARALLAX.map(({ layer, factor }) => ({
          sprite: this.add.tileSprite(0, 0, VIEW_W, VIEW_H, `bgl_${stage.theme}_${layer}`).setOrigin(0).setScrollFactor(0).setDepth(-12 + layer),
          factor,
        }))
      : [{ sprite: this.add.tileSprite(0, 0, VIEW_W, VIEW_H, `bg_${stage.theme}`).setOrigin(0).setScrollFactor(0).setDepth(-10), factor: 0.25 }];
    const autoTile = (grid: number[][], is: (t: Tile) => boolean) =>
      env ? grid.map((row, r) => row.map((v, c) => (is(this.level.tileAt(c, r)) ? autoIndex(this.level.blockMask(c, r), c, r) : v))) : grid;

    const map = this.make.tilemap({ data: autoTile(this.level.tileIndexGrid(), (t) => t === Tile.Solid), tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!;
    const sets = [tileset];
    if (env) sets.push(map.addTilesetImage('auto', `auto_${stage.theme}`, TILE, TILE, 0, 0, AUTO_GID)!);
    this.layer = map.createLayer(0, sets, 0, 0)!.setDepth(0);
    // Water sits on its own translucent layer drawn over the sprites.
    if (this.level.hasWater()) {
      const waterMap = this.make.tilemap({ data: this.level.waterIndexGrid(), tileWidth: TILE, tileHeight: TILE });
      const waterSet = waterMap.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!;
      waterMap.createLayer(0, waterSet, 0, 0)!.setDepth(15).setAlpha(0.4);
    }
    // Fake walls hide what's behind them: drawn over the sprites.
    if (this.level.findTiles(Tile.Fake).length) {
      const fakeMap = this.make.tilemap({ data: autoTile(this.level.fakeIndexGrid(), (t) => t === Tile.Fake), tileWidth: TILE, tileHeight: TILE });
      const fakeSets = [fakeMap.addTilesetImage('tiles', `tiles_${stage.theme}`, TILE, TILE, 0, 0)!];
      if (env) fakeSets.push(fakeMap.addTilesetImage('auto', `auto_${stage.theme}`, TILE, TILE, 0, 0, AUTO_GID)!);
      fakeMap.createLayer(0, fakeSets, 0, 0)!.setDepth(16);
    }
    this.secrets = env ? this.coverSecrets(stage.theme) : [];
    this.fxFrame = 0;
    this.iceCracks = new Map();
    this.iceHoles = [];
    this.setPieceTrack = null;
    for (const { c, r } of this.level.thinIce) this.markThin(c, r);
    this.elevator = this.level.elevator
      ? new Elevator({
          scene: this,
          level: this.level,
          theme: stage.theme,
          player: () => this.player,
          shake: (n) => this.shake(n),
          spawnShot: (o) => this.spawnEnemyShot(o),
          arrived: () => {
            this.section = this.level.sectionAt(this.player.cx, this.player.cy) ?? this.section;
          },
          say: (text) => this.say(text, 60),
        })
      : null;
    this.tileFx = new TileFx(this, this.level, stage.theme, (c, r) => this.layer.removeTileAt(c, r));
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
      burst: (x, y, tex, n) => this.burst(x, y, tex, n),
      spawnShot: (o) => this.spawnEnemyShot(o),
      lights: () => [...(this.boss instanceof Miniboss ? this.boss.lights() : []), ...(this.pip?.lights() ?? [])],
      crushBoss: (box) => this.crushBoss(box),
    });
    this.blackout =
      this.level.data.blackout && this.level.generators.length
        ? new Blackout({
            scene: this,
            level: this.level,
            layer: this.layer,
            player: () => this.player,
            view: () => ({ x: this.camX, y: this.camY }),
            shake: (n) => this.shake(n),
            burst: (x, y, tex, n) => this.burst(x, y, tex, n),
            setDark: (screens, on) => {
              for (const id of screens) {
                if (on) this.hazards.extraDark.add(id);
                else this.hazards.extraDark.delete(id);
              }
            },
            spawnEnemy: (kind, x, y) => {
              this.enemies.push(createEnemy(this, { kind, x, y, alive: true, armed: false }));
            },
            enemyCount: () => this.enemies.length,
            say: (text, frames) => this.say(text, frames),
            music: (out) => (out ? stopMusic(700) : playMusic(this, stageMusic(this.level.data))),
          })
        : null;
    this.arenaFx = new ArenaFx({
      scene: this,
      // (In the Boss Hall, the room does what the boss's own stage room does.)
      stage: () => this.hallArenaStage ?? this.stageId,
      player: () => this.player,
      boss: () => (this.boss && !(this.boss instanceof Miniboss) ? this.boss : null),
      room: () => this.bossRoom,
      spawnShot: (o) => this.spawnEnemyShot(o),
      shake: (n) => this.shake(n),
      burst: (x, y, tex, n) => this.burst(x, y, tex, n),
    });
    this.electricTiles = this.level.findTiles(Tile.Electric);
    this.electricOn = true;
    this.electricT = 0;

    // Scenery (intro storefront and store interior, etc.).
    for (const d of stage.decor ?? []) {
      const depth = d.depth ?? 1;
      if (d.rect) this.add.rectangle(d.x, d.y, d.rect.w, d.rect.h, d.rect.fill).setOrigin(0).setDepth(depth);
      if (d.tex) this.add.image(d.x, d.y, d.tex).setOrigin(0).setDepth(depth);
      if (d.text) pixelText(this, d.x, d.y, d.text, { fontFamily: 'monospace', fontSize: `${d.size ?? 8}px`, color: d.color ?? '#ffffff' }).setDepth(depth + 0.1);
    }

    if (this.level.goal) {
      this.goalSprite = this.add.image(this.level.goal.x, this.level.goal.y, 'goal').setOrigin(0.5, 1).setDepth(4);
    }
    for (const t of this.exMode ? [] : this.level.tanks) {
      const sprite = this.add.image(t.x, t.y, 'etank').setOrigin(0.5, 1).setDepth(4);
      this.tankItems.push({ box: { x: t.x - 6, y: t.y - 10, w: 12, h: 10 }, sprite, taken: false });
    }
    for (const o of this.level.oneUps) {
      const key = o.y * 10000 + o.x;
      if (visit.oneUpsTaken.has(key)) continue;
      const sprite = this.add.image(o.x, o.y, 'oneup').setOrigin(0.5, 1).setDepth(4);
      this.oneUpItems.push({ box: { x: o.x - 7, y: o.y - 12, w: 14, h: 12 }, sprite, taken: false, key });
    }
    for (const o of this.level.boltCaches) {
      const key = o.y * 10000 + o.x;
      if (visit.cachesTaken.has(key)) continue;
      const sprite = this.add.image(o.x, o.y, 'nut_cache').setOrigin(0.5, 1).setDepth(4);
      this.cacheItems.push({ box: { x: o.x - 7, y: o.y - 12, w: 14, h: 12 }, sprite, taken: false, key });
    }
    // Rematch room: one capsule per boss; the exit opens once all are beaten.
    [...this.level.teleporters]
      .sort((a, b) => a.x - b.x)
      .forEach((t, i) => {
        const kind = REMATCH_ORDER[i % REMATCH_ORDER.length];
        const sprite = this.add.image(t.x, t.y, 'capsule_on').setOrigin(0.5, 1).setDepth(3);
        this.capsules.push({ box: { x: t.x - 8, y: t.y - 28, w: 16, h: 28 }, sprite, kind, done: false });
        pixelText(this, t.x, t.y - 38, BOSS_NAMES[kind] ?? '', { fontFamily: 'monospace', fontSize: '7px', color: '#c8ccd8' }).setOrigin(0.5).setDepth(3);
      });
    if (this.capsules.length) {
      const hub = this.level.playerStart;
      pixelText(this, hub.x + 140, hub.y - 120, 'UP in a capsule to rematch a boss', { fontFamily: 'monospace', fontSize: '8px', color: '#5ef0c8' }).setOrigin(0.5).setDepth(3);
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
    this.banner = pixelText(this, VIEW_W / 2, VIEW_H / 2 - 16, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff1e0', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setAlign('center')
      .setScrollFactor(0)
      .setDepth(60);
    this.makePip();
    this.pauseLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(70).setVisible(false);
    this.weaponLabel = pixelText(this, 12, 80, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff1e0', stroke: '#000000', strokeThickness: 2 })
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    playMusic(this, stageMusic(stage));
    // Back from a special-mode boss fight: either carry on to the reward, or
    // try again from the checkpoint by the boss door.
    const resume = data?.resume;
    if (resume) this.prepareResume(resume);
    // Starting at the boss door (boss test) means the miniboss is behind you.
    if ((DEV_TOOLS && data?.bossTest) || this.exMode) this.miniDefeated = this.challengeDone = true;
    this.placeChallenger();
    this.respawn();
    if (resume) {
      pixelateIn(this, 800);
      this.finishResume(resume);
    } else if (this.exMode) this.showTitleCard(`${stage.bossName ?? stage.name} EX`, 'no E-tanks. no mercy.', 0xff5050);
    else this.showTitleCard(stage.name, stage.tagline, theme.solid.light);
  }

  /**
   * The room holding the upgrade capsule, if it's enclosed (behind a fake or
   * frozen wall), is covered with wall until you step in, so the camera can't
   * give it away.
   */
  /**
   * Hidden spots get drawn over as solid wall until you're inside: the armor
   * part's room (and anything else in a small closed room), and the
   * crawlspaces under low blocks where E-tanks and 1-UPs hide (left notched
   * open at each end, the only hint).
   */
  private coverSecrets(theme: string): { cells: Set<number>; layer: Phaser.Tilemaps.TilemapLayer }[] {
    const L = this.level;
    const key = (c: number, r: number) => r * L.cols + c;
    const open = (c: number, r: number) => r >= 0 && r < L.rows && c >= 0 && c < L.cols && !L.isSolid(c, r) && L.tileAt(c, r) !== Tile.Fake;
    const spots = [L.upgrade, ...L.tanks, ...L.oneUps].filter((p): p is Point => !!p);
    const found: Set<number>[] = [];
    for (const p of spots) {
      const start = { c: Math.floor(p.x / TILE), r: Math.floor((p.y - 1) / TILE) };
      if (found.some((f) => f.has(key(start.c, start.r)))) continue;
      // A small closed room?
      const room = new Set<number>();
      const queue = [start];
      while (queue.length && room.size <= 80) {
        const { c, r } = queue.pop()!;
        if (!open(c, r) || room.has(key(c, r))) continue;
        room.add(key(c, r));
        queue.push({ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 });
      }
      if (room.size <= 80) {
        found.push(room);
        continue;
      }
      // A crawlspace: the run of open cells with a ceiling right overhead.
      if (L.isSolid(start.c, start.r - 1)) {
        let c0 = start.c;
        let c1 = start.c;
        while (open(c0 - 1, start.r) && L.isSolid(c0 - 1, start.r - 1)) c0--;
        while (open(c1 + 1, start.r) && L.isSolid(c1 + 1, start.r - 1)) c1++;
        const cells = new Set<number>();
        for (let c = c0 + 1; c <= c1 - 1; c++) cells.add(key(c, start.r));
        if (cells.size) found.push(cells);
      }
    }
    return found.map((cells) => {
      const data = Array.from({ length: L.rows }, (_, r) => Array.from({ length: L.cols }, (_, c) => (cells.has(key(c, r)) ? autoIndex(15, c, r) : -1)));
      const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const set = map.addTilesetImage('auto', `auto_${theme}`, TILE, TILE, 0, 0, AUTO_GID)!;
      return { cells, layer: map.createLayer(0, set, 0, 0)!.setDepth(16) };
    });
  }

  /** Fade the cover off a hidden spot once the player is inside. */
  private revealSecret(): void {
    const p = this.player;
    const here = Math.floor((p.bottom - 4) / TILE) * this.level.cols + Math.floor(p.cx / TILE);
    const s = this.secrets.find((x) => x.cells.has(here));
    if (!s) return;
    this.tweens.add({ targets: s.layer, alpha: 0, duration: 350 });
    this.secrets = this.secrets.filter((x) => x !== s);
    sfx.checkpoint();
  }

  /** The band that slides in with the stage's name before READY. */
  private showTitleCard(name: string, tagline: string | undefined, accent: number): void {
    this.titleCard?.destroy();
    this.titleCard = null;
    this.titleT = 0;
    this.flyFrom = null;
    if (this.stageId === 'intro') return; // the intro has its own opening
    // The flyover: a look a few screens ahead first, then back to the hero.
    const sec = this.section;
    const maxCam = (sec.x1 + 1) * SCREEN_W - VIEW_W;
    const ahead = Math.min(this.camX + SCREEN_W * 3, maxCam);
    if (ahead - this.camX > SCREEN_W) {
      this.flyFrom = ahead;
      this.flyTo = this.camX;
      this.camX = ahead;
    }
    const y = VIEW_H - 44; // lower third, so the flyover shows
    const band = this.add.rectangle(0, y, VIEW_W, 58, 0x1a1428, 0.92).setOrigin(0, 0.5);
    const top = this.add.rectangle(0, y - 29, VIEW_W, 2, accent).setOrigin(0, 0.5);
    const bottom = this.add.rectangle(0, y + 29, VIEW_W, 2, accent).setOrigin(0, 0.5);
    const title = pixelText(this, VIEW_W / 2, y - 7, name, { fontFamily: 'monospace', fontSize: '20px', color: '#fff1e0', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5);
    const sub = pixelText(this, VIEW_W / 2, y + 15, tagline ?? '', { fontFamily: 'monospace', fontSize: '8px', color: '#5ef0c8' })
      .setOrigin(0.5);
    this.titleCard = this.add.container(0, 0, [band, top, bottom, title, sub]).setScrollFactor(0).setDepth(66);
    this.titleT = TITLE_CARD_FRAMES;
    sfx.ready();
  }

  /** Slide in, hold, slide out (while the camera sweeps back to the hero). */
  private stepTitleCard(): void {
    const c = this.titleCard!;
    // Jump or Start skips ahead to READY.
    if (this.titleT > 20 && (this.controls.justPressed('jump') || this.controls.justPressed('start'))) this.titleT = 20;
    const t = TITLE_CARD_FRAMES - --this.titleT;
    if (this.flyFrom !== null) {
      const k = Math.min(1, t / (TITLE_CARD_FRAMES - 20));
      const smooth = k * k * (3 - 2 * k);
      this.camX = this.titleT <= 20 ? this.flyTo : this.flyFrom + (this.flyTo - this.flyFrom) * smooth;
      if (this.titleT === 0) {
        this.camX = this.flyTo;
        this.flyFrom = null;
      }
    }
    const ease = (k: number) => 1 - (1 - k) ** 3;
    const slide = 18;
    if (t < slide) c.x = -VIEW_W * (1 - ease(t / slide));
    else if (this.titleT < slide) c.x = VIEW_W * (1 - ease(this.titleT / slide));
    else c.x = 0;
    if (this.titleT === 0) {
      c.destroy();
      this.titleCard = null;
    }
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
    if (this.story) {
      this.story();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop--;
      return;
    }
    this.tileFx?.step(++this.fxFrame, { x: this.camX, y: this.camY, w: VIEW_W, h: VIEW_H });  // tiles keep living through cards and intros
    this.stepIceCracks();
    if (this.weaponLabelT > 0 && --this.weaponLabelT === 0) this.weaponLabel.setVisible(false);

    if (this.clearTimer > 0) {
      this.stepEffects();
      if (--this.clearTimer === 0) this.scene.start(this.exitScene(true));
      return;
    }
    if (this.gameOverT > 0) {
      this.stepEffects();
      if (--this.gameOverT === 0) this.scene.start(this.exitScene(false));
      return;
    }
    if (this.titleT > 0) {
      this.stepTitleCard();
      this.player.sprite.setVisible(false);
      return;
    }
    if (this.readyTimer > 0) {
      this.readyTimer--;
      this.banner.setText('READY').setVisible(Math.floor(this.readyTimer / 8) % 2 === 0);
      this.player.sprite.setVisible(false);
      if (this.readyTimer === 0) {
        this.banner.setVisible(false);
        // Then he beams in.
        this.startBeam('in');
      }
      return;
    }
    if (this.beam) {
      this.stepEffects();
      if (!this.beam.step()) {
        this.beam = null;
        this.player.sprite.setVisible(true);
        const then = this.beamThen;
        this.beamThen = null;
        then?.();
      }
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
      // the boss's name is shown meanwhile (a full name card the first time).
      this.boss.step();
      this.stepEffects();
      if (this.intro) this.stepBossIntro(this.boss);
      else {
        const name = this.bossName(this.boss);
        if (name) this.banner.setText(name).setVisible(this.boss.state === 'fill');
        if (!this.boss.inIntro) this.banner.setVisible(false);
      }
      return;
    }
    if (this.intro && !this.intro.done) this.endBossIntro();

    const p = this.player;
    if (this.stageId === 'dojo') for (const w of this.unlocked) p.ammo[w] = p.maxAmmo; // free ammo
    this.cycleWeapon();
    this.sky.stepMovers();
    this.elevator?.step();
    p.update();
    this.pip?.step();
    this.sky.stepCrumbles();
    this.hazards.step();
    this.blackout?.step();
    this.arenaFx.step();
    this.stepSetPieceMusic();
    this.revealSecret();
    if (!p.alive && p.deadTimer <= 0) {
      this.loseLife();
      return;
    }

    this.stepElectric();
    for (const e of this.enemies) e.step();
    this.wind = this.enemyWind; // fans and magnets (the boss adds to it if it's blowing)
    this.enemyWind = 0;
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
    if (this.beam) return;
    this.checkDoors();
    if (this.doorSeq) return;
    this.checkSection();
    this.updateCheckpoint();
    this.tryStartMiniboss();
    this.tryStartChallenge();
    this.animateChallenger();
    if (!this.transition) this.followCamera();
    this.manageSpawns();
    this.cull();
  }

  private render(): void {
    this.player.render();
    this.pip?.render();
    for (const e of this.enemies) e.render();
    this.boss?.render();
    for (const b of this.bullets) b.render();
    for (const s of this.shots) s.render();
    for (const k of this.pickups) {
      k.render();
      k.sprite.setVisible(k.life < 240 || k.life % 6 < 3);
    }
    if (this.readyTimer > 0 || this.beam) this.player.sprite.setVisible(false);

    const cam = this.cameras.main;
    cam.setScroll(Math.round(this.camX), Math.round(this.camY));
    for (const b of this.bgLayers) b.sprite.tilePositionX = Math.round(this.camX * b.factor);
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
    if (this.bullets.filter((b) => b.weapon === def.id && !b.pip && !b.rear).length >= def.maxOnScreen) return false;
    if (p.ammo[def.id] < def.cost) return false;
    p.ammo[def.id] -= def.cost;

    const f = p.facing;
    const muzzleX = p.cx + f * 12;
    // Measured from the feet, so a shot fired mid-slide comes out of the cannon, not the floor.
    const muzzleY = p.bottom - (p.h < 20 ? 7 : 10);
    let b: Projectile;
    switch (def.id) {
      case 'quake':
        // Starts at the feet; if fired in the air it falls to the floor first.
        b = new Projectile(this, p.cx + f * 6 - 4, p.bottom - 12, 8, 12, f * 3, 0, 'quake0');
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
        b = new Projectile(this, muzzleX - 9 + f * 4, p.bottom - 24, 18, 22, f * 1.8, 0, 'cyclonef0');
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
          this.backblast(p, f);
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
    // Muzzle flash: a quick pop at the cannon (bigger for charged shots).
    this.addEffect(muzzleX + f * 2, muzzleY, 0, 0, 0, charge ? 8 : 5, true);
    if (charge === 2) this.shake(2);
    return true;
  }

  /**
   * A full charge also kicks out a short blast behind you (like Mega Man X's),
   * so an enemy crowding your back gets hit too. It lives a few frames, pierces,
   * and doesn't count toward the shots-on-screen limit.
   */
  private backblast(p: Player, f: number): void {
    const w = 20;
    const bb = new Projectile(this, f > 0 ? p.x - w + 2 : p.x + p.w - 2, p.y, w, p.h, -f * 1.2, 0, 'charge2');
    bb.pierce = true;
    bb.power = 3;
    bb.charge = 2;
    bb.rear = true;
    bb.maxLife = 7;
    bb.weapon = 'buster';
    bb.sprite.setFlipX(f > 0).setAlpha(0.55);
    this.bullets.push(bb);
    this.addEffect(p.cx - f * 12, p.cy, 0, 0, 0, 8, true);
    this.burst(p.cx - f * 12, p.cy, 'spark', 4);
  }

  private stepBullets(): void {
    const p = this.player;
    for (const b of this.bullets) {
      switch (b.weapon) {
        case 'quake': {
          b.life++;
          b.x += b.vx;
          b.vy = Math.min(b.vy + PHYS.gravity, PHYS.maxFall);
          const onFloor = moveY(this.level, b, b.vy, true);
          if (onFloor) b.vy = 0;
          // The crest heaves as it rolls, kicking dust out behind it.
          b.sprite.setTexture(`quake${Math.floor(b.life / 4) % 4}`);
          if (onFloor && b.life % 6 === 0) this.dust(b.cx - Math.sign(b.vx) * 4, b.y + b.h, -Math.sign(b.vx), 1);
          break;
        }
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
          b.sprite.setTexture(`cyclonef${Math.floor(b.life / 3) % 4}`);
          if (b.life % 10 === 0) this.addEffect(b.cx + (Math.random() - 0.5) * 14, b.y + b.h - 2, -Math.sign(b.vx) * 0.6, -0.3, 0, 14, false, 'windline');
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
    // In the dark, enemy shots glow (drawn over the darkness) so you can see them coming.
    if (this.hazards?.isDark(this.level.screenIdAt(o.x, o.y))) s.sprite.setDepth(31);
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
      // Pip's shots are for enemies only: bosses ignore them.
      const boss = b.pip ? null : this.boss;
      if (this.blackout?.shoot(b)) {
        this.impact(b);
        b.dead = true;
        continue;
      }
      // A miniboss's breakable part soaks up the shots that hit it.
      if (boss instanceof Miniboss && !b.hitTargets.has(boss)) {
        const box = boss.partBoxes().find((pb) => overlaps(b, pb));
        if (box) {
          const weak = b.weapon === boss.weakness;
          const dmg = weak ? WEAKNESS_DAMAGE : b.weapon === 'buster' ? b.power : 1;
          if (boss.hitPart(dmg)) this.breakPart(boss, box);
          else sfx.hit();
          this.impact(b);
          if (b.pierce) b.hitTargets.add(boss);
          else b.dead = true;
          continue;
        }
      }

      // Other things in the fight (the Abyss Eye's wall pods) take shots too.
      if (boss && boss.state === 'fight' && !b.hitTargets.has(boss)) {
        const tgt = boss.targets().find((t) => overlaps(b, t));
        if (tgt) {
          tgt.hit(b.weapon === 'buster' ? b.power : 2);
          sfx.hit();
          this.impact(b);
          if (!b.pierce) b.dead = true;
          continue;
        }
      }

      // Shots that hit the boss's cover (Jared's counter) or a shield bounce off it.
      const cover = boss?.coverTop() ?? null;
      const covered = cover !== null && b.y + b.h / 2 > cover;
      if (boss && boss.state === 'fight' && (boss.blocksShot(b) || covered) && overlaps(b, boss)) {
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
          this.impact(b);
          if (weak) {
            // Weakness hits land hard: a freeze-frame and a shake.
            sfx.weakHit();
            this.shake(5);
            this.hitStop = WEAK_HIT_STOP;
          } else {
            sfx.hit();
            if (b.charge === 2) {
              // A full charge connecting: a beat of freeze and a thump.
              this.hitStop = CHARGE_HIT_STOP;
              this.shake(3);
            }
          }
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
        if (this.stageId === 'dojo') this.damageNumber(e.cx, e.y, b.power);
        this.impact(b);
        if (b.charge === 2) this.hitStop = Math.max(this.hitStop, 2);
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
        if (k.bolts) {
          this.boltCount = addBolts(k.bolts);
          sfx.tick();
        } else sfx.pickup();
        k.dead = true;
      }
    }
    const u = this.upgradeItem;
    if (u && !u.taken && overlaps(p, u.box)) {
      const guardian = this.level.data.upgrade && PART_GUARDIANS[this.level.data.upgrade];
      if (guardian && !this.partGuardianBeaten) {
        this.partGuardianBeaten = true; // (until we hear back)
        this.startEncounter(guardian, { kind: 'part', step: 0 });
      } else this.startPartGet();
    }
    for (const o of this.cacheItems) {
      if (o.taken || !overlaps(p, o.box)) continue;
      o.taken = true;
      o.sprite.setVisible(false);
      visit.cachesTaken.add(o.key);
      this.boltCount = addBolts(BOLT_CACHE);
      sfx.pickup();
      this.burst(o.box.x + 7, o.box.y + 4, 'spark', 6);
      this.flashLabel(`+${BOLT_CACHE} BOLTS`);
    }
    for (const o of this.oneUpItems) {
      if (o.taken || !overlaps(p, o.box)) continue;
      o.taken = true;
      o.sprite.setVisible(false);
      visit.oneUpsTaken.add(o.key);
      this.gainLife();
      // Every hidden 1-UP ever found counts toward the secret stage.
      const found = `${this.stageId}:${o.box.x}:${o.box.y}`;
      updateSave((d) => {
        if (!d.oneUpsFound.includes(found)) d.oneUpsFound.push(found);
      });
    }
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
    // A few bits of debris thrown up and out.
    for (let i = 0; i < 4; i++) this.addEffect(e.cx, e.cy, (Math.random() - 0.5) * 3, -1.5 - Math.random() * 1.5, 0.15, 30, false, 'shard');
    const roll = Math.random();
    const hasAmmoWeapons = this.unlocked.length > 1;
    if (roll < 0.06) this.dropPickup(e.cx, e.cy, 10, 0, 'hp_big', 12, 10);
    else if (roll < 0.26) this.dropPickup(e.cx, e.cy, 3, 0, 'hp_small', 8, 6);
    else if (hasAmmoWeapons && roll < 0.31) this.dropPickup(e.cx, e.cy, 0, 14, 'ammo_big', 12, 10);
    else if (hasAmmoWeapons && roll < 0.45) this.dropPickup(e.cx, e.cy, 0, 6, 'ammo_small', 8, 6);
    // Bolts, on their own roll (not in the dojo).
    if (this.stageId !== 'dojo') {
      const b = Math.random();
      if (b < 0.12) this.dropBolts(e.cx, e.cy, BOLT_BIG);
      else if (b < 0.65) this.dropBolts(e.cx, e.cy, BOLT_SMALL);
    }
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
    const p = this.player;
    for (const k of this.pickups) {
      if (k.carried) continue; // Pip has it
      k.life++;
      // Bolt Magnet: anything close drifts in to you.
      const dx = p.cx - k.cx;
      const dy = p.cy - k.cy;
      if (this.magnet && p.alive && k.life > 12 && Math.hypot(dx, dy) < 96) {
        const d = Math.max(1, Math.hypot(dx, dy));
        k.x += (dx / d) * 2.6;
        k.y += (dy / d) * 2.6;
        k.vy = 0;
      } else {
        k.vy = Math.min(k.vy + PHYS.gravity, PHYS.maxFall);
        if (moveY(this.level, k, k.vy, true)) k.vy = 0;
      }
      if (k.life > 300) k.dead = true;
    }
  }

  /** Bolts burst out of a beaten enemy. */
  private dropBolts(cx: number, cy: number, value: number): void {
    const big = value >= BOLT_BIG;
    const k = new Projectile(this, cx - (big ? 5 : 3), cy - (big ? 5 : 3), big ? 10 : 6, big ? 10 : 6, (Math.random() - 0.5) * 1.5, -2.5, big ? 'nut_big' : 'nut') as Pickup;
    k.heal = 0;
    k.ammo = 0;
    k.bolts = value;
    this.pickups.push(k);
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

  /** Dojo: how much a hit did, floating up off the target. */
  private damageNumber(x: number, y: number, n: number): void {
    const t = pixelText(this, x, y - 2, String(n), { fontFamily: 'monospace', fontSize: '8px', color: n >= 3 ? '#ffe14a' : '#fff1e0', stroke: '#000000', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(30);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** Sparks where a shot connects, thrown back the way it came. */
  private impact(b: Projectile): void {
    const x = b.vx >= 0 ? b.x + b.w : b.x;
    const back = b.vx >= 0 ? -1 : 1;
    for (let i = 0; i < (b.charge === 2 ? 5 : 3); i++) {
      this.addEffect(x, b.y + b.h / 2, back * (0.6 + Math.random() * 1.2), (Math.random() - 0.5) * 1.6, 0.04, 12, false, 'spark');
    }
  }

  // --- thin ice ----------------------------------------------------------------------

  /**
   * Something heavy went over thin ice at columns c0..c1 of `row`: each slab
   * cracks; a slab cracked twice wobbles, then breaks away into the water.
   */
  crackIce(c0: number, c1: number, row: number): void {
    for (let c = c0; c <= c1; c++) {
      if (!this.level.thinIce.some((t) => t.c === c && t.r === row) || this.level.tileAt(c, row) !== Tile.Ice) continue;
      const k = row * this.level.cols + c;
      let crack = this.iceCracks.get(k);
      if (!crack) {
        crack = { c, r: row, n: 0, breakT: 0, img: this.add.image(c * TILE, row * TILE, 'ice_crack1').setOrigin(0, 0).setDepth(0.4) };
        this.iceCracks.set(k, crack);
      }
      crack.n++;
      sfx.crumble();
      // One crack is enough: the slab wobbles, then goes (the Mammoth charges back over it).
      if (crack.n >= 1 && crack.breakT === 0) {
        crack.img.setTexture('ice_crack2');
        crack.breakT = 40;
      }
    }
  }

  private stepIceCracks(): void {
    for (const [k, crack] of this.iceCracks) {
      if (crack.breakT === 0) continue;
      crack.img.x = crack.c * TILE + (crack.breakT % 4 < 2 ? 1 : -1); // wobble
      if (--crack.breakT > 0) continue;
      this.level.setTile(crack.c, crack.r, Tile.Empty);
      this.layer.removeTileAt(crack.c, crack.r);
      crack.img.destroy();
      this.iceCracks.delete(k);
      this.iceHoles.push({ c: crack.c, r: crack.r, t: 300 });
      for (let i = 0; i < 6; i++) this.addEffect(crack.c * TILE + 8, crack.r * TILE + 4, (Math.random() - 0.5) * 3, -1 - Math.random() * 2, 0.2, 30, false, 'spark');
      sfx.crumble();
      this.shake(2);
    }
    // Holes freeze back over after a while (not on top of anyone).
    const p = this.player;
    this.iceHoles = this.iceHoles.filter((h) => {
      if (--h.t > 0) return true;
      const x0 = h.c * TILE;
      const y0 = h.r * TILE;
      const inside = (o: { x: number; y: number; w: number; h: number }) => o.x < x0 + TILE && o.x + o.w > x0 && o.y < y0 + TILE && o.y + o.h > y0;
      if ((p.alive && inside(p)) || (this.boss && inside(this.boss))) {
        h.t = 10;
        return true;
      }
      this.level.setTile(h.c, h.r, Tile.Ice);
      this.layer.putTileAt(Tile.Ice - 1, h.c, h.r);
      this.markThin(h.c, h.r);
      for (let i = 0; i < 4; i++) this.addEffect(x0 + 2 + Math.random() * 12, y0 + Math.random() * 6, 0, -0.4, 0, 24, false, 'spark');
      return false;
    });
  }

  /** Thin ice reads as thin: paler and see-through, so you can tell it from the solid kind. */
  private markThin(c: number, r: number): void {
    const t = this.layer.getTileAt(c, r);
    if (!t) return;
    t.setAlpha(0.6);
    t.tint = 0xc8f0ff;
  }

  /** Put every thin-ice slab back (after a death). */
  private restoreIce(): void {
    for (const crack of this.iceCracks.values()) crack.img.destroy();
    this.iceCracks.clear();
    this.iceHoles = [];
    for (const { c, r } of this.level.thinIce) {
      if (this.level.tileAt(c, r) === Tile.Ice) continue;
      this.level.setTile(c, r, Tile.Ice);
      this.layer.putTileAt(Tile.Ice - 1, c, r);
      this.markThin(c, r);
    }
  }

  /** A spring was bounced on (squash it). */
  springPop(c: number, r: number): void {
    this.tileFx?.springPop(c, r);
  }

  /** Puffs of dust at someone's feet, drifting `dir` (-1 / 1, 0 = both ways). */
  dust(x: number, y: number, dir: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const d = dir || (i % 2 === 0 ? -1 : 1);
      this.addEffect(x + d * i * 2, y - 2, d * (0.3 + Math.random() * 0.5), -0.15 - Math.random() * 0.25, 0, 16 + Math.floor(Math.random() * 6), true, 'dust');
    }
  }

  /** Push from a stage wind gust this step (see sky.ts). */
  get gust(): number {
    return this.sky.gust;
  }

  landOnMover(p: Player, prevBottom: number): boolean {
    return this.sky.landOnMover(p, prevBottom) || (this.elevator?.landOn(p, prevBottom) ?? false);
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
    if (!at || !kind || this.boss || this.bossDefeated || this.bossWarped) return;
    if (this.level.sectionAt(at.x, at.y - 1) !== this.section) return;
    const game = BOSS_ENCOUNTERS[kind];
    if (game) this.startBossEncounter(kind, game);
    else this.spawnBossInRoom(kind);
  }

  /**
   * A boss fought only in its own game: the camera locks on his room, he stands
   * there and says his piece, then the screen pixelates into his game.
   */
  private startBossEncounter(kind: BossKind, game: Encounter): void {
    const at = this.level.boss!;
    const sec = this.level.sectionAt(at.x, at.y - 1)!;
    const camX = Math.round(this.bossRoomCamX(sec));
    this.arena = { camX, left: camX + 8, right: camX + VIEW_W - 8 };
    this.camX = camX;
    this.bossWarped = true;
    const p = this.player;
    p.vx = 0;
    this.bossStandIn?.destroy();
    this.bossStandIn = this.add.image(at.x, at.y, `${kind}_idle1`).setOrigin(0.5, 1).setFlipX(p.cx < at.x).setDepth(5);
    this.shake(4);
    sfx.charge(2);
    this.startEncounter(game, { kind: 'boss', step: 0, ex: this.exMode }, true);
  }

  /** Lock the camera on the boss room ('X' marker's section) and start a boss there. */
  private spawnBossInRoom(kind: BossKind, at: Point = this.level.boss!): void {
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
    this.beginBossIntro(this.boss);
    playMusic(this, kind === 'overlord' ? 'finalboss' : 'boss');
  }

  // --- boss intro ---------------------------------------------------------------

  /**
   * The first time you meet a stage boss: letterbox bars, the boss lands and
   * strikes its pose with a flash, a name card slides in (the name types out,
   * then its title), it calls out a line, and only then does its bar fill.
   */
  private beginBossIntro(boss: Boss): void {
    this.endBossIntro(true);
    const card = BOSS_INTROS[boss.kind];
    const name = this.bossName(boss);
    if (!card || !name || this.introSeen.has(boss.kind)) return;
    this.introSeen.add(boss.kind);
    boss.fillDelay = INTRO.fill;
    boss.introHold = INTRO.hold;
    const accent = card.color ?? THEMES[this.level.data.theme].solid.light;
    const bars = [
      this.add.rectangle(0, 0, VIEW_W, 16, 0x000000).setOrigin(0, 0),
      this.add.rectangle(0, VIEW_H, VIEW_W, 16, 0x000000).setOrigin(0, 1),
    ].map((b) => b.setScrollFactor(0).setDepth(45).setScale(1, 0));
    // The card: a dark stripe edged in the stage's color, chevrons leading in.
    const y = 92;
    const g = this.add.graphics();
    g.fillStyle(0x1a1428, 0.9).fillPoints([{ x: 18, y }, { x: VIEW_W, y }, { x: VIEW_W - 18, y: y + 40 }, { x: 0, y: y + 40 }], true);
    g.fillStyle(accent).fillRect(0, y, VIEW_W, 2).fillRect(0, y + 38, VIEW_W, 2);
    for (let i = 0; i < 3; i++) g.fillPoints([{ x: 30 + i * 10, y: y + 8 }, { x: 36 + i * 10, y: y + 8 }, { x: 30 + i * 10, y: y + 32 }, { x: 24 + i * 10, y: y + 32 }], true);
    for (let i = 0; i < 3; i++) g.fillPoints([{ x: VIEW_W - 36 - i * 10, y: y + 8 }, { x: VIEW_W - 30 - i * 10, y: y + 8 }, { x: VIEW_W - 36 - i * 10, y: y + 32 }, { x: VIEW_W - 42 - i * 10, y: y + 32 }], true);
    const nameText = pixelText(this, VIEW_W / 2, y + 6, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff1e0', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0);
    const css = `#${accent.toString(16).padStart(6, '0')}`;
    const titleText = pixelText(this, VIEW_W / 2, y + 26, card.title, { fontFamily: 'monospace', fontSize: '8px', color: css }).setOrigin(0.5, 0).setAlpha(0);
    const parts: Phaser.GameObjects.GameObject[] = [g, nameText, titleText];
    if (this.exMode) parts.push(pixelText(this, VIEW_W - 64, y + 4, 'EX', { fontFamily: 'monospace', fontSize: '12px', color: '#ff5050', stroke: '#000000', strokeThickness: 3 }));
    const container = this.add.container(VIEW_W, 0, parts).setScrollFactor(0).setDepth(58);
    this.intro = { bars, card: container, name: nameText, title: titleText, full: name, data: card, done: false };
  }

  private stepBossIntro(boss: Boss): void {
    const it = this.intro!;
    const t = boss.introT;
    const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
    // Bars close in as it drops, and stay through the card.
    const k = ease(boss.state === 'drop' ? 0.5 : 0.5 + (t + 1) / 16);
    for (const b of it.bars) b.setScale(1, k);
    if (t < 0) return;
    // The card slides in from the right.
    it.card.x = VIEW_W * (1 - ease((t - INTRO.cardIn) / 14));
    // The pose: a white flash across the screen.
    if (t === 24) {
      this.cameras.main.flash(140, 255, 255, 255);
      // Its signature flourish: particles thrown off it, and its sound.
      const fx = it.data.fx;
      if (fx) {
        sfx[fx.sound]();
        const n = fx.n ?? 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
          const sp = 1 + Math.random() * 1.6;
          this.addEffect(boss.cx, boss.cy, Math.cos(a) * sp, Math.sin(a) * sp - 0.8, fx.tex === 'bubble_fx' ? -0.02 : 0.06, 28, false, fx.tex);
        }
      }
    }
    // The name types out, a tick per letter; then the title fades up.
    const shown = Math.max(0, Math.floor((t - INTRO.type) / 2));
    if (shown <= it.full.length && it.name.text.length !== shown) {
      it.name.setText(it.full.slice(0, shown));
      if (shown > 0 && it.full[shown - 1] !== ' ') sfx.tick();
    }
    const titleAt = INTRO.type + it.full.length * 2 + 4;
    it.title.setAlpha(Math.min(1, Math.max(0, (t - titleAt) / 10)));
    if (t === INTRO.voice && it.data.voice) playVoice(this, it.data.voice);
  }

  /** Card slides off to the left, bars pull away (or vanish at once). */
  private endBossIntro(now = false): void {
    const it = this.intro;
    if (!it) return;
    it.done = true;
    this.intro = null;
    if (now) {
      it.card.destroy();
      for (const b of it.bars) b.destroy();
      return;
    }
    this.tweens.add({ targets: it.card, x: -VIEW_W, duration: 260, ease: 'Cubic.easeIn', onComplete: () => it.card.destroy() });
    for (const b of it.bars) this.tweens.add({ targets: b, scaleY: 0, duration: 260, onComplete: () => b.destroy() });
  }

  /** Dialogue, then warp into the encounter's mode. */
  private startEncounter(enc: Encounter, ret: Ret, atTop = false): void {
    stopMusic();
    const skip = () => this.controls.justPressed('start') || this.controls.justPressed('jump');
    void ensureScene(this.game, enc.scene); // fetch its code while they talk
    this.story = dialogue(this, enc.lines(), skip, () => {
      this.story = () => {};
      pixelateOut(this, 900, () => startScene(this, enc.scene, { stage: this.stageId, ret }));
    }, atTop);
  }

  /** Before respawning: where to come back to after an encounter. */
  private prepareResume(r: Resume): void {
    const L = this.level;
    const before = (x: number) => L.checkpoints.filter((c) => c.x < x).sort((a, b) => b.x - a.x)[0];
    if (r.kind === 'vault') {
      // Back in the Boss Hall, in front of that capsule, with the hall as you left it.
      const won = new Set([...(r.done ?? []), ...(r.won ? [r.step] : [])]);
      this.capsules.forEach((c, i) => {
        if (!won.has(i)) return;
        c.done = true;
        c.sprite.setTexture('capsule_off');
      });
      const c = this.capsules[r.step];
      if (c) this.checkpoint = { x: c.box.x + c.box.w / 2, y: c.box.y + c.box.h };
    } else if (r.kind === 'mini') {
      this.miniDefeated = visit.miniDefeated = r.won;
      const at = L.miniboss;
      if (at) {
        const cp = r.won ? { x: at.x, y: at.y } : before(at.x);
        if (cp) this.checkpoint = { ...cp };
      }
    } else if (r.kind === 'boss') {
      // Won: back in his empty room. Lost: that try is over, back at the door.
      const at = L.boss;
      if (at) {
        if (r.won) {
          this.bossDefeated = true;
          const sec = L.sectionAt(at.x, at.y - 1);
          this.checkpoint = { x: sec ? this.bossRoomCamX(sec) + 60 : at.x - 80, y: at.y };
        } else {
          const cp = before(at.x);
          if (cp) this.checkpoint = { ...cp };
        }
      }
    } else if (r.kind === 'challenge') {
      // Won: carry on from where the boss stood. Lost: back at the room's checkpoint.
      this.challengeDone = r.won;
      const at = L.challenge;
      if (at) {
        const cp = r.won ? { x: at.x, y: at.y } : before(at.x);
        if (cp) this.checkpoint = { ...cp };
      }
    } else if (r.kind === 'part') {
      this.partGuardianBeaten = r.won;
      const at = L.upgrade;
      if (at) {
        const cp = r.won ? { x: at.x - 20, y: at.y } : before(at.x);
        if (cp) this.checkpoint = { ...cp };
      }
    }
  }

  /** After respawning: carry on. */
  private finishResume(r: Resume): void {
    this.readyTimer = 0;
    if (r.kind === 'boss') {
      if (r.won) {
        // Straight on to the reward, as if he'd gone down in a blaze.
        this.player.heal(this.player.maxHp);
        playJingle(this, 'jingle_victory');
        const reward = this.level.data.bossWeapon;
        if (this.exMode) this.exClear();
        else if (reward) this.startWeaponGet(reward);
        else this.stageClear();
        return;
      }
      // Losing his game costs a try, the same as falling to him.
      if (this.stageId !== 'dojo' && visit.lives > 0) visit.lives--;
      else if (this.stageId !== 'dojo') {
        this.loseLife(); // none left: GAME OVER
        return;
      }
    }
    if (r.kind === 'challenge') {
      if (r.won) {
        this.player.heal(this.player.maxHp);
        playJingle(this, 'jingle_victory');
        this.boltCount = addBolts(CHALLENGE_BOLTS);
        this.flashLabel(`+${CHALLENGE_BOLTS} BOLTS`);
        visit.challengeLosses = 0;
      } else {
        // Losing their game costs no life (a GAME OVER would mean the whole
        // stage again): just another go, and after a few, the choice to push past.
        visit.challengeLosses++;
      }
    }
    playMusic(this, stageMusic(this.level.data));
    if (r.kind === 'vault' && r.won) {
      this.player.heal(10);
      if (this.capsules.every((k) => k.done)) {
        this.goalSprite?.setVisible(true);
        this.flashLabel('THE WAY FORWARD IS OPEN');
      }
    }
  }

  /** Name shown while a boss's health bar fills. */
  private bossName(boss: Boss): string | undefined {
    if (boss instanceof Miniboss) return boss.name;
    if (boss.kind === 'shade') return 'SHADE';
    if (boss.kind === this.level.data.boss) return this.level.data.bossName;
    return BOSS_NAMES[boss.kind];
  }

  // --- the boss's challenge ------------------------------------------------------------

  /** The stage's boss waits in the challenge room ('A') until you've settled their game. */
  private placeChallenger(): void {
    this.challengeStandIn?.destroy();
    this.challengeStandIn = null;
    const at = this.level.challenge;
    const kind = this.level.data.boss;
    if (!at || !kind || this.challengeDone || !BOSS_GAMES[kind]) return;
    this.challengeStandIn = this.add.image(at.x, at.y, `${kind}_idle`).setOrigin(0.5, 1).setDepth(5);
  }

  /** Idle frames (where the boss has them), facing you. */
  private animateChallenger(): void {
    const img = this.challengeStandIn;
    const kind = this.level.data.boss;
    if (!img || !kind) return;
    const f = `${kind}_idle${1 + (Math.floor(this.fxFrame / 10) % 4)}`;
    if (this.textures.exists(f)) img.setTexture(f);
    img.setFlipX(this.player.cx < img.x);
  }

  /**
   * Walking up to the boss in the challenge room locks the camera on the room;
   * they say their piece and take you into their game. After a few losses they
   * offer to let you push past instead (no bolts; they'll be waiting at the end).
   */
  private tryStartChallenge(): void {
    const at = this.level.challenge;
    const kind = this.level.data.boss;
    const game = kind && BOSS_GAMES[kind];
    const p = this.player;
    if (!at || !game || this.challengeDone || this.boss || !p.alive || this.story) return;
    const sec = this.section;
    if (this.level.sectionAt(at.x, at.y - 1) !== sec || p.cx < at.x - 150) return;
    const secLeft = sec.x0 * SCREEN_W;
    const secRight = (sec.x1 + 1) * SCREEN_W;
    const camX = Math.round(Phaser.Math.Clamp(at.x + 64 - VIEW_W, secLeft, secRight - VIEW_W));
    this.arena = { camX, left: camX + 8, right: camX + VIEW_W - 8 };
    this.camX = camX;
    p.vx = 0;
    this.challengeDone = true; // (until we hear back)
    this.shake(3);
    sfx.charge(2);
    const go = () => this.startEncounter(game, { kind: 'challenge', step: visit.challengeLosses, ex: this.exMode }, true);
    if (visit.challengeLosses < CHALLENGE_MERCY) {
      go();
      return;
    }
    const [line] = game.lines();
    const name = this.level.data.bossName ?? line.name;
    const skip = () => this.controls.justPressed('start') || this.controls.justPressed('jump');
    this.story = dialogue(this, [{ ...line, name, voice: undefined, text: "Back again? You don't quit, I'll give you that. Want another go... or will you just get on with it?" }], skip, () => {
      this.story = this.choose(['ONE MORE TRY', 'PUSH PAST'], (i) => {
        if (i === 0) {
          go();
          return;
        }
        // Pushed past: they leave, and it's settled at the end of the stage.
        this.story = null;
        this.arena = null;
        visit.challengeLosses = 0;
        if (this.challengeStandIn) {
          this.burst(this.challengeStandIn.x, this.challengeStandIn.y - 16, 'spark', 10);
          this.challengeStandIn.destroy();
          this.challengeStandIn = null;
        }
        sfx.charge(1);
        this.flashLabel(`${name} WILL BE WAITING`);
      });
    }, true);
  }

  /** A small two-way choice at the top of the screen; returns the step to run while it's up. */
  private choose(options: string[], picked: (i: number) => void): () => void {
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(80);
    const w = 180;
    const x = (VIEW_W - w) / 2;
    layer.add(this.add.rectangle(x, 24, w, 18 + options.length * 14, 0x0a0c18, 0.92).setOrigin(0).setStrokeStyle(2, 0x5ef0c8));
    const items = options.map((o, i) => pixelText(this, x + 26, 32 + i * 14, o, { fontFamily: 'monospace', fontSize: '8px', color: '#fff1e0' }));
    const cursor = pixelText(this, x + 12, 32, '>', { fontFamily: 'monospace', fontSize: '8px', color: '#5ef0c8' });
    layer.add([...items, cursor]);
    let sel = 0;
    let t = 0;
    return () => {
      t++;
      const c = this.controls;
      if (c.justPressed('up') || c.justPressed('down')) {
        sel = (sel + (c.justPressed('down') ? 1 : options.length - 1)) % options.length;
        sfx.tick();
      }
      cursor.y = 32 + sel * 14;
      items.forEach((it, i) => it.setColor(i === sel ? '#ffe14a' : '#fff1e0'));
      if (t > 10 && (c.justPressed('jump') || c.justPressed('start') || c.justPressed('fire'))) {
        layer.destroy();
        sfx.pickup();
        picked(sel);
      }
    };
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
    const special = MINI_ENCOUNTERS[this.stageId];
    if (special) {
      this.miniDefeated = true; // (until we hear back)
      this.startEncounter(special, { kind: 'mini', step: 0 });
      return;
    }
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
    this.startBeam('out', () => this.beamToArena(c.kind));
  }

  /** Beam in (or out) where the player stands; `then` runs when it's over. */
  private startBeam(dir: 'in' | 'out', then?: () => void): void {
    const p = this.player;
    p.vx = p.vy = 0;
    this.beam?.destroy();
    const s = p.sprite;
    const look = { texture: s.texture.key, frame: s.frame.name, flipX: s.flipX };
    const top = this.camY - 8;
    this.beam = dir === 'in' ? Beam.in(this, Math.round(p.cx), Math.round(p.bottom), top, look) : Beam.out(this, Math.round(p.cx), Math.round(p.bottom), top, look);
    this.beamThen = then ?? null;
  }

  /** Boss Hall: the arena for this boss (a copy of its own stage's), and the stage it's from. */
  private rematchArena(kind: BossKind): { at: Point; stage: StageId | null } {
    const a = this.level.data.rematchArenas?.find((r) => r.kind === kind);
    const at = (a && this.level.bossSpots.find((s) => Math.floor((s.y - 1) / SCREEN_H) === a.row)) ?? this.level.boss!;
    return { at, stage: a?.stage ?? null };
  }

  /** Gone from the hall: land in the boss's arena, beam in, then the boss drops in. */
  private beamToArena(kind: BossKind): void {
    const p = this.player;
    this.clearActors();
    const { at, stage } = this.rematchArena(kind);
    this.hallArenaStage = stage;
    const sec = this.level.sectionAt(at.x, at.y - 1)!;
    const camX = Math.round(this.bossRoomCamX(sec));
    p.reset(camX + 60, at.y);
    this.section = sec;
    this.arena = { camX, left: camX + 8, right: camX + VIEW_W - 8 };
    this.camX = camX;
    this.camY = sec.row * SCREEN_H;
    this.camGlide = null;
    this.startBeam('in', () => {
      this.hallRematch = true;
      this.spawnBossInRoom(kind, at);
    });
  }

  /** Back from a rematch: beam out of the arena, into the hall by that capsule. */
  private beamToHub(): void {
    this.startBeam('out', () => {
      const p = this.player;
      this.clearActors();
      this.boss?.destroy();
      this.boss = null;
      this.bossRoom = null;
      this.hallArenaStage = null;
      const back = this.hubSpot ?? this.level.playerStart;
      p.reset(back.x, back.y);
      this.section = this.level.sectionAt(p.cx, p.cy - 1)!;
      this.arena = null;
      this.camX = this.cameraTargetX(this.section);
      this.camY = this.section.row * SCREEN_H;
      this.camGlide = null;
      playMusic(this, stageMusic(this.level.data));
      this.startBeam('in');
    });
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
    stopMusic(900); // the boss theme fades as the explosions start
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
      // A stage boss down: the victory jingle (it carries on through the weapon get).
      if (!(boss instanceof Miniboss) && boss.kind !== 'overlord') playJingle(this, 'jingle_victory');
      boss.sprite.setVisible(false);
    } else if (t === 170) {
      boss.destroy();
      this.boss = null;
      this.bossDeathT = 0;
      this.drawShadeRing(null);
      // The final boss has a second phase: Shade drops in once the machine is gone.
      if (boss.kind === 'overlord' && this.level.boss && this.bossRoom) {
        this.boss = createBoss('shade', this, this.level.boss, this.bossRoom);
        this.beginBossIntro(this.boss);
        return;
      }
      // Miniboss: the camera unlocks, it leaves a big refill, and the stage goes on.
      if (boss instanceof Miniboss) {
        this.miniDefeated = visit.miniDefeated = true;
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
        this.beamToHub();
        if (this.capsules.every((k) => k.done)) {
          this.goalSprite?.setVisible(true);
          this.flashLabel('THE WAY FORWARD IS OPEN');
        }
        return;
      }
      this.bossDefeated = true;
      const reward = this.level.data.bossWeapon;
      if (this.exMode) this.exClear();
      else if (reward) this.startWeaponGet(reward);
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
      this.banner.setText(`YOU GOT\n${def.title}!`).setVisible(true);
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
    if (nowPlaying() !== 'jingle_victory') stopMusic();
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
      this.banner.setText('NEW WEAPON!').setVisible(true);
    } else {
      p.weapon = id;
      this.banner.setText(`YOU GOT\nTHE ${WEAPONS[id].name}!\n\nSelect it on the pause menu.`).setFontSize(12);
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
      sfx.door();
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

    // Riding the magma elevator: the lift has the camera, no screen changes (the magma kills).
    if (this.elevator?.active) return;
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
    const lift = !!this.elevator?.active;
    const mode = lift ? 'lift' : 'free';
    if (mode !== this.camMode) {
      this.camMode = mode;
      this.camGlide = { fromX: this.camX, fromY: this.camY, t: 0 };
    }
    let tx: number;
    let ty: number;
    if (lift) {
      tx = this.elevator!.camX;
      ty = this.elevator!.camY;
    } else {
      // Ease into an arena lock (minibosses lock mid-scroll) and back out of it.
      const target = this.arena ? this.arena.camX : this.cameraTargetX(this.section);
      const d = target - this.camX;
      tx = Math.abs(d) <= 4 ? target : this.camX + Math.sign(d) * 4;
      ty = this.section.row * SCREEN_H;
    }
    const g = this.camGlide;
    if (g) {
      // Eased in and out toward wherever the target is now (the lift keeps moving).
      const k = ++g.t / CAM_GLIDE_FRAMES;
      const e = k * k * (3 - 2 * k);
      if (!lift && !this.arena) tx = this.cameraTargetX(this.section);
      this.camX = g.fromX + (tx - g.fromX) * e;
      this.camY = g.fromY + (ty - g.fromY) * e;
      if (g.t >= CAM_GLIDE_FRAMES) this.camGlide = null;
      return;
    }
    this.camX = tx;
    this.camY = ty;
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

  /**
   * Spike Guard (from Rivet's): touching spikes or lava uses one up instead of
   * killing you; you're thrown clear and flash. Returns true if one was used.
   */
  useGuard(): boolean {
    if (this.stageId === 'dojo' || this.exMode || loadSave().guards <= 0) return false;
    updateSave((d) => d.guards--);
    sfx.deflect();
    this.shake(4);
    this.burst(this.player.cx, this.player.bottom, 'spark', 10);
    this.flashLabel('SPIKE GUARD!');
    return true;
  }

  /** One more try (up to the cap). */
  private gainLife(): void {
    visit.lives = Math.min(LIVES_MAX, visit.lives + 1);
    sfx.clear();
    this.flashLabel('1UP!');
  }

  /** Out of life: back to the last checkpoint if there's a try left, else GAME OVER. */
  private loseLife(): void {
    if (this.stageId === 'dojo') {
      this.respawn();
      return;
    }
    if (visit.lives > 0) {
      visit.lives--;
      this.respawn();
      return;
    }
    visit.stage = ''; // next visit starts fresh
    stopMusic();
    this.boss?.destroy();
    this.boss = null;
    this.banner.setText('GAME OVER').setFontSize(16).setVisible(true);
    this.gameOverT = 200;
  }

  private respawn(): void {
    this.restoreIce();
    this.elevator?.reset();
    // Back at a checkpoint the camera is just there (no glide).
    this.camMode = 'free';
    this.camGlide = null;
    this.blackout?.reset();
    this.arenaFx.reset();
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
    this.setPieceTrack = null;
    // Latest checkpoint the player has passed.
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.pip?.reset();
    this.beam?.destroy();
    this.beam = null;
    this.beamThen = null;
    this.hallArenaStage = null;
    this.section = this.level.sectionAt(this.player.cx, this.player.cy)!;
    this.camX = this.cameraTargetX(this.section);
    this.followCamera();
    this.trySpawnBoss();
    this.readyTimer = 64;
  }

  /** Where to go after leaving this stage. */
  private exitScene(cleared: boolean): string {
    if (this.stageId === 'dojo') return 'title';
    // Leaving the intro before it's ever been beaten starts the game over (no skipping it).
    if (this.stageId === 'intro' && !cleared && !loadSave().cleared.includes('intro')) return 'title';
    if (this.stageId === 'finale') return cleared ? 'ending' : 'fortress';
    if (getStage(this.stageId).theme === 'fortress') return 'fortress';
    return 'select';
  }

  /** Won an EX rematch: a star on the stage select, then back there. */
  private exClear(): void {
    if (this.clearTimer > 0) return;
    const first = !loadSave().exCleared.includes(this.stageId);
    recordExClear(this.stageId);
    if (nowPlaying() !== 'jingle_victory') {
      stopMusic();
      sfx.victory();
    }
    // The first win unlocks this boss's color scheme for the hero.
    const skin = skinForStage(this.stageId);
    if (first && skin) {
      this.clearTimer = 300;
      this.banner.setText(`EX CLEAR!\n\nNEW COLOR: ${skin.name}\n\nWear it from the middle of\nthe EX stage select.`).setFontSize(12).setVisible(true);
      this.time.delayedCall(700, () => sfx.pickup());
    } else {
      this.clearTimer = 200;
      this.banner.setText('EX CLEAR!').setVisible(true);
    }
  }

  private stageClear(): void {
    if (this.clearTimer > 0) return;
    // The secret stage's vault: a pile of bolts (and the GOLD colors) the first time.
    if (this.stageId === 'vault' && !loadSave().cleared.includes('vault')) {
      this.boltCount = addBolts(250);
      this.flashLabel('VAULT LOOT: +250 BOLTS, GOLD COLORS');
    }
    if (this.stageId !== 'dojo') recordClear(this.stageId);
    const jingle = nowPlaying() === 'jingle_victory';
    if (!jingle) stopMusic(400);
    this.clearTimer = 200;
    this.banner.setText('STAGE CLEAR').setVisible(true);
    this.goalSprite?.setVisible(false);
    if (!jingle) sfx.clear(); // (after a boss the victory jingle is still going)
  }

  /** Checkpoints activate when the player gets close. */
  private updateCheckpoint(): void {
    for (const c of this.level.checkpoints) {
      if (Math.abs(this.player.cx - c.x) < 48 && Math.abs(this.player.bottom - c.y) < 96 && this.checkpoint !== c) {
        // A chime for a new checkpoint (not the one you started or respawned at).
        if (this.checkpoint.x !== c.x || this.checkpoint.y !== c.y) sfx.checkpoint();
        this.checkpoint = c;
      }
    }
  }

  // --- HUD / pause ------------------------------------------------------------

  private drawHud(): void {
    const p = this.player;
    const hp = p.hp;
    const bossHp = this.boss && this.boss.state !== 'dying' ? this.boss.barHp : -1;
    const ammo = p.weapon === 'buster' ? -1 : p.ammo[p.weapon];
    const bossMax = this.boss?.maxHp ?? 0;
    const trails = [this.stepTrail('hp', hp), this.stepTrail(`ammo_${p.weapon}`, ammo), this.stepTrail('boss', bossHp)];
    // Low life pulses (so the bar needs redrawing as it beats).
    const low = hp > 0 && hp <= p.maxHp / 4 ? Math.floor(this.fxFrame / 8) % 2 : 0;
    const key = `${hp}|${bossHp}|${bossMax}|${p.weapon}|${ammo}|${trails.map((t) => `${t.lost}:${t.t % 4 < 2}`).join(',')}|${low}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    const g = this.hud;
    g.clear();
    // Bars left to right: life, equipped weapon's ammo (if any), boss.
    let x = 12;
    const life = low ? { light: 0xffd0c8, main: 0xff7a6a, dark: 0xc83a3a } : { light: 0xffffff, main: 0xfff1a8, dark: 0xd8b048 };
    this.drawBar(g, x, hp, p.maxHp, life, 'life', trails[0]);
    if (ammo >= 0) this.drawBar(g, (x += 12), ammo, p.maxAmmo, WEAPONS[p.weapon].colors, 'weapon', trails[1]);
    if (bossHp >= 0) this.drawBar(g, (x += 12), bossHp, bossMax, { light: 0xffc0b0, main: 0xff7050, dark: 0xc03828 }, 'boss', trails[2]);
  }

  /** Track a bar's drain: units just lost hold for a moment, then slide down to the new value. */
  private stepTrail(id: string, value: number): { lost: number; t: number } {
    const tr = (this.barTrail[id] ??= { last: value, lost: value, t: 0 });
    if (value < tr.last && value >= 0) {
      tr.lost = Math.max(tr.lost, tr.last);
      tr.t = 0;
    }
    tr.last = value;
    tr.t++;
    if (tr.lost > value && tr.t > 14 && tr.t % 2 === 0) tr.lost--;
    if (tr.lost < value) tr.lost = value;
    return tr;
  }

  /**
   * One energy bar: a shaded metal frame with a capped top, three-tone units
   * (bright edge, body, shadow) in a dark well, units just lost flashing, and a
   * badge under it saying whose bar it is (helmet, weapon gem, boss skull).
   */
  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    value: number,
    max: number,
    c: { light: number; main: number; dark: number },
    kind: 'life' | 'weapon' | 'boss',
    trail: { lost: number; t: number },
  ): void {
    const K = 0x1a1428;
    const px = (col: number, px0: number, py: number, w = 1, h = 1) => g.fillStyle(col, 1).fillRect(px0, py, w, h);
    const y = 16;
    const top = y - 3;
    const bot = y + max * 2 + 3;
    // Frame: outline, gunmetal with a lit left/top edge and a shaded right edge, a cap with two rivets.
    px(K, x - 1, top, 10, bot - top);
    px(K, x, top - 1, 8, 1);
    px(0x55607a, x, top, 8, bot - top - 1);
    px(0xc8ccd8, x, top, 1, bot - top - 1);
    px(0x8a8fa8, x + 1, top, 6, 1);
    px(0x2b2540, x + 7, top + 1, 1, bot - top - 2);
    px(0xfff1e0, x + 2, top + 1);
    px(0xfff1e0, x + 5, top + 1);
    // The well and its units.
    px(0x0e0c18, x + 1, y + 1, 6, max * 2 + 1);
    for (let i = 0; i < max; i++) {
      const uy = y + max * 2 - i * 2;
      if (i < value) {
        px(c.main, x + 1, uy, 6);
        px(c.light, x + 1, uy);
        px(c.dark, x + 6, uy);
      } else if (i < trail.lost) {
        px(trail.t % 4 < 2 ? 0xffffff : 0xff9080, x + 1, uy, 6);
      } else {
        px(0x2b2540, x + 1, uy, 6);
        px(0x3a3550, x + 2, uy, 4);
      }
    }
    // The top lit unit gets a glint.
    if (value > 0) px(0xffffff, x + 2, y + max * 2 - (value - 1) * 2, 2);
    // Badge.
    const by = bot - 1;
    px(K, x - 2, by, 12, 10);
    px(0x55607a, x - 1, by + 1, 10, 8);
    px(0xc8ccd8, x - 1, by + 1, 10, 1);
    px(0x2b2540, x - 1, by + 8, 10, 1);
    px(0x0e0c18, x + 1, by + 2, 6, 6);
    const ix = x + 1;
    const iy = by + 2;
    const icon = (rows: string[], pal: Record<string, number>) =>
      rows.forEach((row, r) => [...row].forEach((ch, k) => ch !== '.' && px(pal[ch], ix + k, iy + r)));
    if (kind === 'life') icon(['.oooo.', 'oOOOOo', 'oVVVOo', 'oVVVOo', 'oOOOOo', '.o..o.'], { o: 0xc85a1a, O: 0xf28c28, V: 0x5ef0c8 });
    else if (kind === 'weapon') icon(['..ll..', '.lmmd.', 'lmmmmd', 'lmmmmd', '.mmdd.', '..dd..'], { l: c.light, m: c.main, d: c.dark });
    else icon(['.wwww.', 'wwwwww', 'wKwwKw', 'wwwwww', '.wKKw.', '.w..w.'], { w: 0xff7050, K: 0x1a1428 });
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
  /** The set piece playing its own track right now (chase, climb), if any. */
  private setPieceTrack: string | null = null;

  /** The compactor chase and the Great Climb get music of their own while they're on. */
  private stepSetPieceMusic(): void {
    if (this.boss || !this.player.alive) return;
    const rise = this.level.data.rise;
    const id = this.level.screenIdAt(this.player.cx, this.player.cy);
    const want = this.hazards.wallOn ? 'chase' : this.hazards.lavaOn && this.level.data.theme === 'jungle' && rise?.screens.includes(id) ? 'climb' : null;
    if (want === this.setPieceTrack) return;
    this.setPieceTrack = want;
    playMusic(this, want ?? stageMusic(this.level.data));
  }

  /** Pip comes along once a stage boss is down, with what you've bought and switched on for it. */
  private makePip(): void {
    this.pip?.destroy();
    this.pip = null;
    const save = loadSave();
    if (!pipUnlocked(save)) return;
    const mods = new Set(PIP_MODULES.filter((m) => pipOwns(save, 'module', m.id) && !save.pipOff.includes(m.id)).map((m) => m.id));
    const T = TILE;
    this.pip = new Pip(
      {
        scene: this,
        player: () => this.player,
        view: () => ({ x: this.camX, y: this.camY, w: VIEW_W, h: VIEW_H }),
        targets: () =>
          this.enemies.filter((e) => e.hp > 0 && e.cx > this.camX && e.cx < this.camX + VIEW_W && e.cy > this.camY && e.cy < this.camY + VIEW_H && !this.level.isSolid(Math.floor(e.cx / T), Math.floor(e.cy / T))),
        pickups: () => this.pickups,
        shots: () => this.shots,
        shoot: (x, y, vx, vy) => {
          const b = new Projectile(this, x, y, 4, 4, vx, vy, 'pip_shot');
          b.pip = true;
          b.power = 1;
          b.maxLife = 50;
          this.bullets.push(b);
        },
        dark: () => this.hazards.isDark(this.level.screenIdAt(this.player.cx, this.player.cy)),
        wet: (x, y) => this.level.isWater(Math.floor(x / TILE), Math.floor(y / TILE)),
      },
      { shell: save.pipShell, paint: save.pipPaint, trail: save.pipTrail },
      mods,
    );
    if (!save.pipMet) {
      meetPip();
      this.time.delayedCall(2400, () => this.say('PIP JOINS YOU!', 100));
    }
    // Its hum and particles go when the stage does.
    this.events.once('shutdown', () => {
      this.pip?.destroy();
      this.pip = null;
    });
  }

  /** Big centered text for a while (HOLD ON!, BLACKOUT!). */
  private sayT: Phaser.Time.TimerEvent | null = null;
  private say(text: string, frames = 60): void {
    this.banner.setText(text).setVisible(true);
    this.sayT?.remove();
    this.sayT = this.time.delayedCall((frames * 1000) / 60, () => this.banner.setVisible(false));
  }

  /** A boss hit a wall hard: the room may react (icicles in Glacier). */
  arenaSlam(): void {
    this.arenaFx.slam();
  }

  /** A miniboss's part came off: bits fly, it staggers (a chunk of damage), and loses that attack. */
  private breakPart(b: Miniboss, box: Box): void {
    const x = box.x + box.w / 2;
    const y = box.y + box.h / 2;
    this.burst(x, y, 'boom', 3);
    this.burst(x, y, 'spark', 10);
    for (let i = 0; i < 6; i++) this.addEffect(x, y, (Math.random() - 0.5) * 4, -2 - Math.random() * 2, 0.2, 40, false, 'spark');
    sfx.weakHit();
    this.shake(6);
    this.hitStop = WEAK_HIT_STOP;
    b.hit(3, true);
    this.flashLabel(`${b.part!.label} BROKEN!`);
    if (b.hp === 0) this.startBossDeath();
  }

  /**
   * A miniboss is down to half health: its fight changes.
   *  - Press Titan: the presses speed up.
   *  - Tusk Mammoth: enraged (its slams already shake the ice loose).
   *  - Storm Kite: the storm builds: stronger, more frequent gusts, and lightning.
   *  - Angler: the dark deepens: no more flashes, and its lure dims.
   */
  miniPhase(kind: MiniKind): void {
    const lines: Partial<Record<MiniKind, string>> = {
      press: 'THE LINE SPEEDS UP!',
      mammoth: "IT'S ENRAGED!",
      kite: 'THE STORM BUILDS!',
      angler: 'THE DARK DEEPENS!',
    };
    this.say(lines[kind] ?? 'IT FIGHTS HARDER!', 80);
    this.shake(5);
    sfx.quake();
    if (kind === 'press') this.hazards.rush = 1.7;
    if (kind === 'kite') {
      this.sky.storm = 1.35;
      this.cameras.main.flash(180, 255, 255, 255);
      sfx.zap();
    }
    if (kind === 'angler') this.hazards.noFlash = true;
  }

  /** A line of advice for a fight (how to beat an arena-only miniboss). */
  hint(text: string): void {
    this.say(text, 150);
  }

  /** The Mammoth went through the ice: the freezing water does the damage. */
  miniFell(b: Miniboss): void {
    if (b.state !== 'fight') return;
    b.hit(ARENA_ONLY.mammoth!.hit, true);
    sfx.splash();
    this.shake(5);
    for (let i = 0; i < 10; i++) this.addEffect(b.cx + (Math.random() - 0.5) * 30, this.bossRoomFloor(b) - 2, (Math.random() - 0.5) * 3, -2 - Math.random() * 3, 0.2, 30, false, 'spark');
    this.flashLabel('INTO THE DRINK!');
    // The ice heals fast while it's under: open holes freeze over (and slabs
    // cracked on that charge mend) before it's back up and charging, so it
    // has to break through again rather than run straight back in.
    for (const h of this.iceHoles) h.t = Math.min(h.t, ICE_REFREEZE_AFTER_FALL);
    for (const [k, crack] of this.iceCracks) {
      crack.img.destroy();
      this.iceCracks.delete(k);
    }
    if (b.hp === 0) this.startBossDeath();
  }

  private bossRoomFloor(b: Miniboss): number {
    return b.bottom;
  }

  /** A press came down on the miniboss (Foundry's line): a big hit. */
  private crushBoss(box: Box): boolean {
    const b = this.boss;
    if (!(b instanceof Miniboss) || b.state !== 'fight' || !overlaps(box, b)) return false;
    b.hit(ARENA_ONLY.press!.hit, true);
    b.crushed();
    this.shake(6);
    sfx.titanCrush();
    this.hitStop = WEAK_HIT_STOP;
    this.burst(b.cx, b.y + 4, 'spark', 10);
    this.flashLabel('CRUSHED!');
    if (b.hp === 0) this.startBossDeath();
    return true;
  }

  private flashLabel(text: string): void {
    this.weaponLabel.setText(text).setVisible(true);
    this.weaponLabelT = 70;
  }

  /**
   * Pause menu rows: every weapon (moving the cursor equips it), E-TANK
   * (Z / X refills life), W-TANK (refills every weapon), EXIT STAGE.
   */
  private get pauseRows(): number {
    return this.unlocked.length + 3;
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
    layer.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05040a, 0.45).setOrigin(0));
    layer.add(this.add.image(VIEW_W / 2, VIEW_H / 2, uiPanel(this, 200, h, 'steel', 0.94)));
    layer.add(pixelText(this, VIEW_W / 2 + 1, top + 15, 'PAUSED', { ...style, fontSize: '16px', color: '#1a1428' }).setOrigin(0.5));
    layer.add(pixelText(this, VIEW_W / 2, top + 14, 'PAUSED', { ...style, fontSize: '16px', color: '#ffc070' }).setOrigin(0.5));
    // The selected row's highlight.
    const rowY = (i: number) => (i < this.unlocked.length ? top + 44 + i * rowH : top + 44 + this.unlocked.length * rowH + 4 + (i - this.unlocked.length) * rowH);
    layer.add(this.add.image(left + 6, rowY(this.pauseIndex) - 2, uiHighlight(this, 188, 12)).setOrigin(0, 0));
    // Armor parts found (dim = not found yet).
    PART_ORDER.forEach((id, i) => {
      layer.add(this.add.image(VIEW_W / 2 - 27 + i * 18, top + 32, `part_${id}`).setAlpha(p.has(id) ? 1 : 0.2));
    });
    // Tries left (left of the parts) and bolts (right of them); the dojo has neither.
    if (this.stageId !== 'dojo') {
      layer.add(this.add.image(left + 12, top + 32, 'oneup').setOrigin(0, 0.5));
      layer.add(pixelText(this, left + 28, top + 28, `x${visit.lives}`, style));
      layer.add(this.add.image(left + 150, top + 32, 'nut').setOrigin(0, 0.5));
      layer.add(pixelText(this, left + 164, top + 28, String(this.boltCount), { ...style, color: '#c8ccd8' }));
    }
    const bars = this.add.graphics();
    layer.add(bars);
    this.unlocked.forEach((id, i) => {
      const y = top + 44 + i * rowH;
      const def = WEAPONS[id];
      const selected = i === this.pauseIndex;
      layer.add(pixelText(this, left + 12, y, `${selected ? '>' : ' '} ${def.name}`, { ...style, color: selected ? '#fff1e0' : '#8a8fa8' }));
      const value = def.cost === 0 ? p.maxAmmo : p.ammo[id];
      // Ammo: a framed gauge, the units in the weapon's colors with a lit top.
      bars.fillStyle(0x1a1428).fillRect(left + 119, y + 1, p.maxAmmo * 2 + 1, 8);
      for (let u = 0; u < p.maxAmmo; u++) {
        const on = u < value;
        bars.fillStyle(on ? def.colors.main : 0x2b2540, 1).fillRect(left + 120 + u * 2, y + 2, 1, 6);
        if (on) bars.fillStyle(def.colors.light, 1).fillRect(left + 120 + u * 2, y + 2, 1, 2);
      }
    });
    const tanks = loadSave().tanks;
    const tankRow = this.unlocked.length;
    const tankY = top + 44 + tankRow * rowH + 4;
    const onTank = this.pauseIndex === tankRow;
    layer.add(pixelText(this, left + 12, tankY, `${onTank ? '>' : ' '} E-TANK`, { ...style, color: onTank ? '#9ee8ff' : '#8a8fa8' }));
    for (let i = 0; i < MAX_TANKS; i++) {
      layer.add(this.add.image(left + 126 + i * 14, tankY + 4, 'etank').setAlpha(i < tanks ? 1 : 0.2));
    }
    const wtanks = loadSave().wtanks;
    const wRow = tankRow + 1;
    const wY = tankY + rowH;
    const onW = this.pauseIndex === wRow;
    layer.add(pixelText(this, left + 12, wY, `${onW ? '>' : ' '} W-TANK`, { ...style, color: onW ? '#ffe14a' : '#8a8fa8' }));
    for (let i = 0; i < 2; i++) layer.add(this.add.image(left + 126 + i * 14, wY + 4, 'etank').setTint(0xffe14a).setAlpha(i < wtanks ? 1 : 0.2));
    const exitY = wY + rowH;
    const onExit = this.pauseIndex === tankRow + 2;
    layer.add(pixelText(this, left + 12, exitY, `${onExit ? '>' : ' '} EXIT STAGE`, { ...style, color: onExit ? '#ff9a7a' : '#8a8fa8' }));
    const ammoFull = this.unlocked.every((w) => WEAPONS[w].cost === 0 || p.ammo[w] >= p.maxAmmo);
    const hint = onExit
      ? this.exitScene(false) === 'title' && this.stageId === 'intro' ? 'Z / X to quit to the title' : 'Z / X to leave the stage'
      : onW
        ? this.exMode ? 'no W-tanks in an EX rematch' : wtanks === 0 ? "none: buy them at Rivet's" : ammoFull ? 'weapons are already full' : 'Z / X to refill every weapon'
      : onTank
        ? this.exMode ? 'no E-tanks in an EX rematch' : tanks === 0 ? 'none left: find them in stages' : p.hp >= p.maxHp ? 'life is already full' : 'Z / X to refill your life'
        : WEAPONS[this.unlocked[this.pauseIndex]].blurb;
    layer.add(pixelText(this, VIEW_W / 2, top + h - 22, hint, { ...style, color: '#5ef0c8' }).setOrigin(0.5));
    layer.add(pixelText(this, VIEW_W / 2, top + h - 10, 'UP/DOWN select   ENTER resume', { ...style, color: '#8a8fa8' }).setOrigin(0.5));
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
      if (tanks > 0 && this.player.hp < this.player.maxHp && !this.exMode) {
        setTanks(tanks - 1);
        this.player.heal(this.player.maxHp);
        sfx.pickup();
        this.buildPauseMenu();
      }
    } else if (this.pauseIndex === this.unlocked.length + 1) {
      const p = this.player;
      if (loadSave().wtanks > 0 && !this.exMode && this.unlocked.some((w) => WEAPONS[w].cost > 0 && p.ammo[w] < p.maxAmmo)) {
        updateSave((d) => d.wtanks--);
        for (const w of this.unlocked) p.ammo[w] = p.maxAmmo;
        sfx.pickup();
        this.buildPauseMenu();
      }
    } else if (this.pauseIndex === this.unlocked.length + 2) {
      sfx.select();
      this.scene.start(this.exitScene(false));
    }
  }
}
