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

Some fights change the game entirely. Each is its own scene, entered through a dialogue and a
pixelate warp (`src/scenes/cutscene.ts`), and wired up in `src/scenes/encounters.ts`:

| Fight | Mode | Scene |
|---|---|---|
| Volt (Power Plant) | side-view motocross race: JUMP gas, FIRE turbo that overheats, UP/DOWN lanes, tilt in the air | `RaceScene.ts` |
| Gatekeeper (Fortress Gate) | behind-the-back boxing, three rounds, Coach Jared in your corner | `BoxingScene.ts` |
| Magma (Caldera) | maze bomb battle: drop bombs, blast rock, grab bomb/fire/speed power-ups, 3 hearts each | `BombScene.ts` |
| Briar Toad (Canopy miniboss) | lane-crossing hop: dodge the trail, ride logs and pads, fill all three pads in time | `HopScene.ts` |
| Overlord (finale) | fixed-screen alien shooter: two waves, then the mothership | `ShooterScene.ts` |
| Shade (finale, after the Overlord) | one-on-one fighting game, best of three; DOWN, FORWARD + FIRE fireball, FORWARD, DOWN + FIRE uppercut | `FighterScene.ts` |

Win and you carry on (the boss reward, the next fight in a chain, or the part); lose and you retry from
the last checkpoint. Any upgrade part can have a guardian (`PART_GUARDIANS` in `encounters.ts`).

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

Each boss stage has a miniboss halfway through, and an energy tank (E-tank) on a ledge just before it.
You can carry up to 4 E-tanks (saved); use one from the pause menu to refill your life. Enemies drop
small and large life and weapon-energy pellets.

Four armor parts are hidden in boss stages, each in an upgrade capsule:
- ULTRABLASTER (Foundry, behind a fake wall): charge shots reach full power; without it they stop at half.
- JUMP BOOTS (Canopy, behind a fake wall): jump again in mid-air.
- ARMOR (Stratos, on a ledge only a double jump reaches): a quarter less damage.
- HELMET (Glacier, behind frozen blocks that Flame Burst melts): life and weapon energy go from 28 to 36.
Saves from before parts existed that had beaten a boss get all four.

## Audio
`npm run audio` asks ElevenLabs for one looping chiptune track per area and a set of sound effects,
saving them to `public/assets/audio/` with a `manifest.json`. Without it the game is silent apart from
its built-in synthesized sound effects. Regenerate one item with `npm run audio -- --force reef`.

## Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move / climb | Arrows or WASD | D-pad / left stick |
| Jump | Z, Space, K | A |
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
- `art/hero.mjs`, `art/sprites.mjs` – sprite sheet generators (`npm run sprites`); `art/audio.mjs` – audio generator.
- `src/audio.ts` – music player and sampled sound effects.
