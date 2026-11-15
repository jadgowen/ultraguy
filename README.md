# Ultraguy

A run-and-gun 2D platformer for the browser. TypeScript + Phaser 3 + Vite.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

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
- `src/textures.ts` – placeholder art for tiles, enemies and bosses, drawn in code.
- `art/hero.mjs` – hero sprite sheet generator (`npm run sprites`).
