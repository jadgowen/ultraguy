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
Title -> intro stage (DOWNTOWN, boss BLACK JARED) on a new game -> boss select (8 bosses, 3x3 grid).
Each boss gives a weapon; weaknesses form a loop. Beat all 8 and FORTRESS opens on the title menu
(and the middle of boss select): three fortress stages, then the final boss (OVERLORD, then SHADE).

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
| Pause / weapon select | Enter, Esc, P | Start |

Boss select: arrows pick a boss, Enter/Z starts the stage, X starts at the boss door (boss test), Backspace goes back.

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
