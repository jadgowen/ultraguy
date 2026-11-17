# Ultraguy

A run-and-gun 2D platformer for the browser. TypeScript + Phaser 3 + Vite.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
npm run sprites  # rebuild the hero + enemy/boss sprite sheets from art/*.mjs
ELEVENLABS_API_KEY=your-key npm run audio   # generate music + sound effects (optional)
```

## Game flow
Title -> save select (3 slots; X twice erases one) -> intro stage (DOWNTOWN, boss BLACK JARED) on a new game -> boss select (8 bosses, 3x3 grid).
Each boss gives a weapon; weaknesses form a loop. Beat all 8 and FORTRESS opens on the title menu
(and the middle of boss select): three fortress stages, each ending with a guardian boss (GATEKEEPER,
ABYSS EYE, SPIRE WARDEN; no weapon reward), the BOSS HALL (eight teleporters for boss
rematches), then the final boss (OVERLORD, then SHADE).

Every boss stage is built around its own set piece (legend in `src/level/Level.ts`; logic in
`src/scenes/sky.ts` and `src/scenes/hazards.ts`), taught safely, tested, twisted, then pushed hard, with
a change of direction partway:

| Stage | Built around |
|---|---|
| Foundry | crushers (`!`) that slam in a rolling wave; a lift down a shaft; belts |
| Canopy | bounce flowers (`%`, hold jump to go higher) up through the trees; breaking branches; a drifting log |
| Glacier | cracking ice (`x`) you fall through layer by layer; snowball chutes (`@`) |
| Stratos | moving clouds (`=`/`-`, `v`/`:`), updrafts (`y`), wind gusts (`wind` screens), crumbling clouds |
| Power Plant | switch blocks (`[` / `]` take turns) and dark rooms (`dark` screens) lit by flashes |
| Caldera | lava that rises after you up a two-screen climb (`rise`); lifts and crumbling rock over lava |
| Scrapyard | barrel chutes, compactor presses, crane platforms and conveyor stairs |
| Reef | currents (`{` / `}`) and bubble columns; a trench current that drags you toward spikes |

Stage bosses are always fought in their arenas, where your weapons and parts matter. Some fights
change the game entirely; each is its own scene, entered through a dialogue and a pixelate warp
(`src/scenes/cutscene.ts`), and wired up in `src/scenes/encounters.ts`:

| Where | Fight | Mode | Scene |
|---|---|---|---|
| Boss Hall capsule | Anvil | brick-breaker: smash his forge wall and hit him behind it; his sparks slow your paddle; hot bricks (and every hit on him) drop multiballs; he patches holes | `BreakerScene.ts` |
| Boss Hall capsule | Mantis | lane-crossing hop: dodge the traffic, ride logs and pads, fill all three pads without landing where Mantis waits | `HopScene.ts` |
| Boss Hall capsule | Frostline | one-on-one ice hockey: slippery skating, shots and body checks, first to 3 | `HockeyScene.ts` |
| Boss Hall capsule | Gale | vertical sky shooter: kites, wind gusts that shove your ship, then Gale's feathers, blades and a low tornado you can fly over | `SkiesScene.ts` |
| Boss Hall capsule | Volt | side-view motocross race: JUMP gas, FIRE turbo that overheats, UP/DOWN lanes, tilt in the air | `RaceScene.ts` |
| Boss Hall capsule | Scrap | top-down junk maze: four rooms, keys, a hookshot that swings you across shafts; Scrap's magnet field turns shots until you stun him | `DungeonScene.ts` |
| Boss Hall capsule | Tide | undersea pinball: hit Tide while his shell is open; lanes pry it open, targets start a multiball; a ball saver after each serve | `PinballScene.ts` |
| Boss Hall capsule | Magma | maze bomb battle: drop bombs, blast rock, grab bomb/fire/speed power-ups, 3 hearts each | `BombScene.ts` |
| Boss Hall bonus | Gatekeeper | behind-the-back boxing, three rounds, Coach Jared in your corner | `BoxingScene.ts` |
| Boss Hall bonus (after beating the game) | Overlord | fixed-screen alien shooter: two waves, then the mothership | `ShooterScene.ts` |

Every Boss Hall capsule is its own game (they share `ModeScene.ts`); the exit opens once all eight
stage bosses are beaten (bonus capsules are optional). Win a mode and you're back where you were
(the Hall remembers which capsules are done); lose and you retry from the last checkpoint.

Every hidden part is guarded, and each guardian is fought in a turn-based RPG battle (`RpgScene.ts`,
guardians in `src/scenes/rpgGuardians.ts`): FIGHT, SPELL, GUARD, ITEM (your E-tanks), RUN. Spells are
CHARGE SHOT, REPAIR and every boss weapon you've collected, each with its own effect (QUAKE topples,
THORN hits twice, FROST freezes, CYCLONE spoils his aim, SPARK stuns, FLAME burns, SAW cuts through
his guard, BUBBLE shields you). Each guardian has weak spots and resistances. Your HELMET adds HP and
EN, your ARMOR takes a quarter off every hit.

| Part | Guardian | Gimmick |
|---|---|---|
| UltraBlaster (Foundry) | BEARDSMITH, a dwarven robot | a different tool every turn: drill (through your guard), saw, hammer (dazes), nail gun; a forge-heated hammer |
| Jump Boots (Canopy) | JUCK MCBUCK, a hunter | misses a lot (and complains), but his rifle hits hard; careful aim never misses |
| Helmet (Glacier) | THE HYDRONATOR | offers glasses of water that hit harder each time; GUARD declines and resets it; chapstick heals him fully once |
| Armor (Stratos) | CEEJ GEIGAN, a general | BLITZKRIEG: a WW2 history fact, delivered as damage; artillery barrages, digging in, rallying |

The first time you reach a stage boss it gets a full intro: letterbox bars, the boss lands and strikes its
signature pose (with its own flourish), a name card with its title slides in, it calls out a voice line, and
then its health bar fills (`src/scenes/bossIntro.ts`). Retries after a death skip straight to the quick version.

Each boss stage has a midpoint challenge halfway through, usually a miniboss. Glacier's Tusk Mammoth fights
on thin ice (`_` in the level text, drawn pale and see-through): each charge cracks the slabs it crosses, a
slab cracked twice breaks away into the water, and holes freeze back over after a few seconds. Caldera has
no miniboss. Instead it has the magma elevator (`;` lift, `,` top stop; `src/scenes/elevator.ts`): step on, and it
climbs the shaft with the camera following, magma right behind, fire from the walls and falling rocks.
Just before the midpoint, a low block hides a crawlspace (only the
slide gets in) holding an energy tank (E-tank), and in some stages a 1-UP; it looks like solid wall,
notched at each end, until you're inside. The armor-part rooms hide a 1-UP too.

**Lives.** You start each stage with 2 extra lives (shown under the health bars); 1-UPs add one (up to 9).
Dying with lives left sends you to the last checkpoint; with none left it's GAME OVER and back to the stage
select (or the fortress map).

**Bolts and Rivet's shop.** Beaten enemies drop bolts (big ones now and then), and bolt caches hide in the
crawlspaces and armor-part rooms. Press Q (L1) on the stage select to visit RIVET'S PARTS & PROVISIONS:
1-UPs (added to your lives when you next enter a stage), E-tanks, W-tanks (refill every weapon from the pause
menu), the Spike Guard (survive one spike or lava fall) and the Bolt Magnet (pickups fly to you). More stock
comes in as you beat bosses (`src/shop.ts`).

**Signature enemies.** Each stage has one of its own: Foundry's Hammerbot (slams shockwaves), Canopy's
Snapper (a bud that bites when you're close), Glacier's Snow Roller (grows as it rolls), Stratos's Gust Fan
(blows you back), Power Plant's Tesla Coil (rings of sparks), Caldera's Lava Leaper, Scrapyard's Magnet Drone
(pulls you under it) and Reef's Jelly (zaps straight down). They take the place of some of the stage's usual
enemies (`signature` in each stage file).

**The secret.** One 1-UP hides in every boss stage. Find all eight (they're remembered) and Rivet hands you the
key to MEGAMART, the megastore of Rivet's rival, the BARGAIN BARON: a rooftop run past every signature enemy
and a boss fight (coin tosses, a SALE-sign dash, a coin vacuum, falling stock). Beating him pays 250 bolts and
unlocks the GOLD color scheme.

**Presentation.** Stages open with a flyover (the camera starts a few screens ahead and sweeps back to you
under the title card; JUMP skips). Music crossfades between tracks, and beating a stage boss plays a victory
jingle. The ending is a cast roll: every boss, miniboss and guardian with their sprite and title.

**Dojo** (title screen): a training hall with every weapon, free ammo and endless lives. Target dummies show
the damage each hit does (one hides behind a shield), and the back half has a ladder, ice, a slide tunnel,
conveyor belts, a spring, water and an updraft. Handy for checking weapons and physics changes.
You can carry up to 4 E-tanks (saved); use one from the pause menu to refill your life. Enemies drop
small and large life and weapon-energy pellets.

Four armor parts are hidden in boss stages, each in an upgrade capsule:
- ULTRABLASTER (Foundry, behind a fake wall): charge shots reach full power; without it they stop at half.
- JUMP BOOTS (Canopy, behind a fake wall): jump again in mid-air.
- ARMOR (Stratos, on a ledge only a double jump reaches): a quarter less damage.
- HELMET (Glacier, behind frozen blocks that Flame Burst melts): life and weapon energy go from 28 to 36.
Saves from before parts existed that had beaten a boss get all four.

**EX rematches.** Once the game is beaten, press X (FIRE) on stage select to switch to EX. An EX rematch
starts at the boss door with no E-tanks. The boss takes about 40% less damage, waits less between attacks,
and has one new attack: Anvil's triple hammer hops, Mantis's thorn rain, Frostline's blizzard (find the gap),
Gale's twin dive, Volt's lightning grid (stand on the dark strips), Magma's eruption ripple, Scrap's saw
barrage and Tide's bubble rings. Each EX win puts a star on that boss's panel and unlocks a hero color
scheme (FORGE, MANTIS, GLACIER, SKYWARD, VOLTAGE, MAGMA, RUST, TIDE; `src/skins.ts`). Pick one from the
middle panel of the EX stage select; it replaces the Ultra Gun colors (boss weapons keep their own).

## Audio
`npm run audio` asks ElevenLabs for one looping chiptune track per area and a set of sound effects,
saving them to `public/assets/audio/` with a `manifest.json`. Without it the game is silent apart from
its built-in synthesized sound effects. Regenerate one item with `npm run audio -- --force reef`.

## Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move / climb | Arrows or WASD | D-pad / left stick |
| Jump | Z, Space, K | A |
| Slide (low and fast: under shots, through 1-tile gaps) | Down + Jump, or double-tap a direction | Down + A |
| Fire (hold to charge the Ultra Gun) | X, J | B / X |
| Switch weapon | Q / E | L1 / R1 |
| Pause / weapon select / E-tanks | Enter, Esc, P | Start |

Keys can be remapped in Settings -> Controls (ESC cancels; ESC and Backspace can't be bound). Settings also
has a mixer for music and sound-effect volume. Settings are shared by all save slots.

Boss select: arrows pick a boss, Enter/Z starts the stage, X starts at the boss door (boss test; only in the dev server, not in builds), Backspace goes back.

On phones and tablets, on-screen controls appear with the first touch: d-pad on the left, JUMP / FIRE on
the right, weapon switch above them, and START / BACK at the top (FULL goes fullscreen where the browser
allows it). Held upright, the game sits above the controls; turned sideways, the controls overlay the
edges. Pressing a physical key hides them again. The logic is in `src/touch.ts`.

## Deploy
Live at https://jadgowen.github.io/ultraguy/. `npm run deploy` builds (typecheck, tests, Vite) and
force-pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves.

## Tests
`npm test` runs the Vitest suite in `tests/` (also part of `npm run build`):
- every stage parses and its main path is reachable with no parts (a tile-grid reachability check);
- boss stages have a door, miniboss on a flat floor, energy tank and checkpoints; weapons cover the loop;
- each armor part needs exactly its intended requirement (nothing / Jump Boots / Flame Burst);
- save data: slots, tanks, parts, migration of older saves, corrupt data;
- settings: mixer levels, key remapping conflicts and reserved keys.

## Layout
- `src/constants.ts` – resolution and all movement tuning (`PHYS`), including ice slide and charge timings.
- `src/input.ts` – input layer. The game only reads actions (`jump`, `fire`…), never keys.
- `src/physics.ts` – tile collision (no physics engine); ladder tops and clouds are one-way platforms.
- `src/entities/Player.ts` – hero state machine, ice sliding, Ultra Gun charge.
- `src/entities/Enemies.ts` – all regular enemies plus projectiles.
- `src/entities/bosses/` – shared `Boss` base (intro, health bar, weakness, death) and one file per boss.
- `src/weapons.ts` – weapon stats, hero recolors per weapon.
- `src/level/` – `Level.ts` (format + legend), one file per stage, `themes.ts` (tile/background colors), `stages.ts` (registry).
- `src/scenes/` – title, settings, boss select, and `GameScene` (fixed 60 Hz step, camera, combat, HUD, pause).
- `src/textures.ts` – tiles, backgrounds, store scenery and small effects, drawn in code.
- `art/hero.mjs`, `art/sprites.mjs` – sprite sheet generators (`npm run sprites`). The hero is posed by a small rig (hand-drawn helmet and chest, rig-drawn limbs): 8-frame run with bob, arm swing and head lag, breathing idle, rise/fall/land, two-frame climb. `art/mockups/hero.html` – the design mockups he was chosen from. `art/audio.mjs` – audio generator.
- `src/audio.ts` – music player and sampled sound effects.
