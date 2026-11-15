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
(and the middle of boss select): three fortress stages, the BOSS HALL (eight teleporters for boss
rematches), then the final boss (OVERLORD, then SHADE).

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

Boss select: arrows pick a boss, Enter/Z starts the stage, X starts at the boss door (boss test), Backspace goes back.

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
