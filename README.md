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
| Fire | X, J | B / X |
| Start / pause | Enter, Esc, P | Start |

## Layout
- `src/constants.ts` – resolution and all movement tuning (`PHYS`). Tune feel here.
- `src/input.ts` – input layer. The game only reads actions (`jump`, `fire`…), never keys.
- `src/physics.ts` – tile collision (no physics engine), ladder tops are one-way platforms.
- `src/entities/Player.ts` – hero state machine: idle, run, jump, fall, climb, hurt, dead.
- `src/entities/Enemies.ts` – walker, hopper, flyer, turret (shielded), plus projectiles.
- `src/level/` – stages as ASCII screens (legend in `Level.ts`), arranged in a layout grid.
- `src/scenes/GameScene.ts` – fixed 60 Hz step, section camera + screen transitions, spawning, combat, HUD, pause.
- `src/textures.ts` – placeholder art drawn in code. Replace keys with real sprite sheets later.
