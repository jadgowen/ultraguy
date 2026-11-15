import Phaser from 'phaser';
import type { ThemeId } from './level/Level';
import { THEMES, Theme } from './level/themes';

/**
 * Placeholder art drawn with rectangles at boot (everything except the hero,
 * which is a real sprite sheet). Every key can later be replaced by loading a
 * sprite sheet under the same key.
 */

const C = {
  orange: 0xf28c28,
  dark: 0x2b2540,
  visor: 0x5ef0c8,
  white: 0xfff1e0,
  gray: 0x8a8fa8,
  steel: 0x55607a,
  red: 0xd83a4a,
  green: 0x4ac26a,
  leaf: 0x3a9a3a,
  purple: 0x8c4ad8,
  yellow: 0xffe14a,
  pink: 0xff6ad5,
  cyan: 0x8ad8f8,
  ice: 0xdff4ff,
  navy: 0x2a3a6a,
  brown: 0x7a5a3a,
};

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function rect(g: G, color: number, x: number, y: number, w: number, h: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
}

function tri(g: G, color: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
  g.fillStyle(color, 1);
  g.fillTriangle(x1, y1, x2, y2, x3, y3);
}

// --- stage themes ----------------------------------------------------------------

/** Tileset per theme: 0 solid, 1 ladder, 2 spike, 3 boss door, 4 ice, 5 cloud. */
function makeTileset(scene: Phaser.Scene, id: ThemeId, t: Theme): void {
  make(scene, `tiles_${id}`, 96, 16, (g) => {
    const s = t.solid;
    rect(g, s.base, 0, 0, 16, 16);
    rect(g, s.light, 0, 0, 16, 2);
    rect(g, s.light, 0, 0, 2, 16);
    rect(g, s.dark, 0, 14, 16, 2);
    rect(g, s.dark, 14, 0, 2, 16);
    rect(g, s.dark, 6, 6, 4, 4);
    rect(g, s.accent, 6, 6, 2, 2);
    if (s.top !== undefined) {
      rect(g, s.top, 0, 0, 16, 3);
      rect(g, s.topShade ?? s.top, 0, 3, 16, 1);
      rect(g, s.topShade ?? s.top, 3, 4, 2, 1);
      rect(g, s.topShade ?? s.top, 10, 4, 3, 1);
    }

    rect(g, t.ladder.rail, 16 + 2, 0, 2, 16);
    rect(g, t.ladder.rail, 16 + 12, 0, 2, 16);
    for (let y = 2; y < 16; y += 4) rect(g, t.ladder.rung, 16 + 2, y, 12, 2);

    tri(g, t.spike.light, 32, 16, 36, 2, 40, 16);
    tri(g, t.spike.light, 40, 16, 44, 2, 48, 16);
    tri(g, t.spike.dark, 36, 16, 36, 4, 40, 16);
    tri(g, t.spike.dark, 44, 16, 44, 4, 48, 16);

    rect(g, 0x4a3a5a, 48, 0, 16, 16);
    rect(g, 0x232c3c, 48, 0, 2, 16);
    rect(g, 0x232c3c, 62, 0, 2, 16);
    for (let y = 1; y < 16; y += 4) rect(g, 0xb06ad8, 51, y, 10, 2);
    rect(g, C.yellow, 55, 6, 2, 4);

    // Ice: glossy with diagonal glints.
    rect(g, t.ice.base, 64, 0, 16, 16);
    rect(g, t.ice.light, 64, 0, 16, 2);
    rect(g, t.ice.dark, 64, 14, 16, 2);
    rect(g, t.ice.light, 67, 5, 2, 2);
    rect(g, t.ice.light, 69, 7, 2, 2);
    rect(g, t.ice.light, 74, 4, 2, 2);
    rect(g, t.ice.dark, 72, 10, 4, 1);

    // Cloud: puffy top, see-through underside (it's a one-way platform).
    rect(g, t.cloud.base, 80, 3, 16, 7);
    rect(g, t.cloud.base, 82, 1, 5, 2);
    rect(g, t.cloud.base, 89, 0, 5, 3);
    rect(g, t.cloud.shade, 80, 9, 16, 3);
    rect(g, t.cloud.shade, 82, 12, 12, 1);
  });
}

function makeBackground(scene: Phaser.Scene, id: ThemeId, t: Theme): void {
  const { far, near, detail } = t.bg;
  make(scene, `bg_${id}`, 128, 240, (g) => {
    const rnd = new Phaser.Math.RandomDataGenerator([id]);
    switch (t.bg.style) {
      case 'skyline': {
        for (let i = 0; i < 40; i++) rect(g, rnd.pick([0x3a3f66, 0x5a5f8a, detail]), rnd.between(0, 127), rnd.between(0, 150), 1, 1);
        [70, 40, 90, 55, 110, 65, 45, 85].forEach((hgt, i) => {
          rect(g, far, i * 16, 240 - hgt, 15, hgt);
          for (let y = 240 - hgt + 6; y < 236; y += 10) rect(g, near, i * 16 + 4, y, 2, 3);
        });
        break;
      }
      case 'trees': {
        // Trunks with hanging leaf clumps.
        for (const x of [6, 40, 70, 104]) {
          rect(g, far, x, 0, 10, 240);
          rect(g, near, x + 2, 0, 2, 240);
        }
        for (let i = 0; i < 26; i++) {
          const x = rnd.between(-8, 120);
          const y = rnd.between(0, 200);
          rect(g, near, x, y, rnd.between(14, 26), rnd.between(6, 12));
          rect(g, detail, x + 3, y + 2, 6, 2);
        }
        break;
      }
      case 'mountains': {
        for (let i = 0; i < 30; i++) rect(g, detail, rnd.between(0, 127), rnd.between(0, 200), 1, 1);
        tri(g, far, -20, 240, 40, 110, 100, 240);
        tri(g, near, 50, 240, 100, 140, 160, 240);
        tri(g, detail, 30, 128, 40, 110, 50, 128);
        tri(g, detail, 92, 154, 100, 140, 108, 154);
        break;
      }
      case 'clouds': {
        const puff = (x: number, y: number, w: number, color: number) => {
          rect(g, color, x, y + 4, w, 8);
          rect(g, color, x + 4, y, w / 2, 6);
        };
        puff(4, 40, 40, far);
        puff(70, 90, 48, far);
        puff(20, 150, 56, far);
        puff(84, 190, 40, near);
        puff(-10, 210, 50, near);
        puff(60, 220, 60, near);
        break;
      }
    }
  });
}

// --- enemies ----------------------------------------------------------------------

function makeEnemies(scene: Phaser.Scene): void {
  for (const f of [0, 1]) {
    make(scene, `walker${f}`, 16, 16, (g) => {
      rect(g, C.red, 4, 1, 8, 2);
      rect(g, C.red, 2, 3, 12, 8);
      rect(g, C.white, 8, 5, 4, 3);
      rect(g, C.dark, 10, 6, 2, 2);
      rect(g, C.dark, f ? 1 : 3, 11, 3, 5);
      rect(g, C.dark, f ? 12 : 10, 11, 3, 5);
    });
  }
  make(scene, 'hopper0', 16, 14, (g) => {
    rect(g, C.green, 3, 2, 10, 2);
    rect(g, C.green, 1, 4, 14, 10);
    rect(g, C.white, 3, 6, 3, 3);
    rect(g, C.white, 10, 6, 3, 3);
    rect(g, C.dark, 4, 7, 2, 2);
    rect(g, C.dark, 11, 7, 2, 2);
  });
  make(scene, 'hopper1', 16, 14, (g) => {
    rect(g, C.green, 4, 0, 8, 2);
    rect(g, C.green, 3, 2, 10, 12);
    rect(g, C.white, 4, 4, 3, 3);
    rect(g, C.white, 9, 4, 3, 3);
    rect(g, C.dark, 5, 5, 2, 2);
    rect(g, C.dark, 10, 5, 2, 2);
  });
  make(scene, 'turret0', 16, 16, (g) => {
    rect(g, C.gray, 0, 10, 16, 6);
    rect(g, C.dark, 0, 15, 16, 1);
    rect(g, C.steel, 2, 4, 12, 6);
    rect(g, C.gray, 4, 3, 8, 2);
  });
  make(scene, 'turret1', 16, 16, (g) => {
    rect(g, C.gray, 0, 10, 16, 6);
    rect(g, C.dark, 0, 15, 16, 1);
    rect(g, C.dark, 3, 5, 10, 5);
    rect(g, 0xff5050, 6, 6, 4, 3);
    rect(g, C.steel, 2, 0, 12, 4);
  });
  for (const f of [0, 1]) {
    make(scene, `flyer${f}`, 16, 12, (g) => {
      rect(g, C.purple, 4, 3, 8, 6);
      rect(g, C.yellow, 8, 4, 3, 3);
      rect(g, C.purple, 0, f ? 0 : 6, 4, 5);
      rect(g, C.purple, 12, f ? 0 : 6, 4, 5);
    });
  }

  // Jungle: camouflaged lurker (lizard) and seed-spitting plant.
  for (const f of [0, 1]) {
    make(scene, `lurker${f}`, 18, 12, (g) => {
      rect(g, 0x5ac04a, 2, 3, 12, 6);
      rect(g, 0x5ac04a, 12, 1, 6, 6);
      rect(g, C.yellow, 15, 2, 2, 2);
      rect(g, 0x3a8a3a, 0, 6, 4, 2); // tail
      rect(g, 0x3a8a3a, f ? 3 : 5, 9, 2, 3);
      rect(g, 0x3a8a3a, f ? 11 : 9, 9, 2, 3);
      rect(g, 0xe05a8a, 4, 4, 2, 2);
      rect(g, 0xe05a8a, 8, 5, 2, 2);
    });
  }
  for (const f of [0, 1]) {
    make(scene, `spitter${f}`, 16, 16, (g) => {
      rect(g, C.leaf, 7, 10, 2, 6);
      rect(g, C.leaf, 2, 12, 5, 2);
      rect(g, C.leaf, 9, 11, 5, 2);
      rect(g, 0xd84a6a, 3, f ? 2 : 3, 10, f ? 8 : 7);
      if (f) rect(g, C.dark, 5, 4, 6, 4);
      else rect(g, 0xff8aa8, 5, 5, 6, 1);
    });
  }
  make(scene, 'seed', 6, 6, (g) => {
    rect(g, 0x8a6a2a, 0, 1, 6, 4);
    rect(g, 0x8a6a2a, 1, 0, 4, 6);
    rect(g, 0xd8b85a, 2, 1, 2, 2);
  });

  // Ice: sliding penguin-bot and dropping icicle.
  for (const f of [0, 1]) {
    make(scene, `slider${f}`, 16, 14, (g) => {
      rect(g, C.navy, 2, 0, 12, 12);
      rect(g, C.white, 5, 4, 7, 7);
      rect(g, C.orange, 12, 4, 4, 2);
      rect(g, C.white, 9, 2, 2, 2);
      rect(g, C.orange, f ? 2 : 4, 12, 4, 2);
      rect(g, C.orange, f ? 9 : 8, 12, 4, 2);
    });
  }
  make(scene, 'icicle', 10, 14, (g) => {
    tri(g, C.cyan, 0, 0, 10, 0, 5, 14);
    tri(g, C.ice, 2, 0, 5, 0, 5, 10);
  });

  // Sky: egg-dropping bomber bird and lightning-throwing sparker.
  for (const f of [0, 1]) {
    make(scene, `bomber${f}`, 18, 12, (g) => {
      rect(g, 0xe05a3a, 3, 4, 12, 6);
      rect(g, 0xe05a3a, 13, 2, 5, 5);
      rect(g, C.yellow, 17, 4, 1, 2);
      rect(g, C.dark, 15, 3, 1, 1);
      rect(g, 0xb03a2a, 5, f ? 0 : 7, 8, 4);
    });
  }
  make(scene, 'egg', 6, 8, (g) => {
    rect(g, C.white, 1, 0, 4, 8);
    rect(g, C.white, 0, 2, 6, 5);
    rect(g, 0xd8c8b8, 1, 5, 4, 2);
  });
  for (const f of [0, 1]) {
    make(scene, `sparker${f}`, 20, 18, (g) => {
      rect(g, C.purple, 7, 0, 6, 7);
      rect(g, C.yellow, 8, 2, 4, 2);
      if (f) rect(g, C.yellow, 13, 0, 3, 6);
      rect(g, 0xffffff, 1, 9, 18, 6);
      rect(g, 0xffffff, 4, 7, 6, 2);
      rect(g, 0xffffff, 11, 6, 6, 3);
      rect(g, 0xc4dcf4, 1, 14, 18, 3);
    });
  }
  make(scene, 'bolt', 6, 12, (g) => {
    rect(g, C.yellow, 2, 0, 3, 5);
    rect(g, C.yellow, 1, 4, 3, 4);
    rect(g, C.yellow, 2, 7, 3, 5);
    rect(g, C.white, 3, 1, 1, 10);
  });
}

// --- bosses -------------------------------------------------------------------------

function makeBosses(scene: Phaser.Scene): void {
  // ANVIL (foundry): 36x32 heavy bot with an anvil head.
  type AnvilPose = 'idle' | 'jump' | 'shoot' | 'crouch';
  const bossBody = 0x9c2f3f;
  const plate = 0x8a8fa8;
  const plateL = 0xc8ccd8;
  const drawAnvil = (g: G, pose: AnvilPose) => {
    const dy = pose === 'crouch' ? 4 : 0;
    const angry = pose === 'shoot' || pose === 'crouch';
    if (pose === 'jump') {
      rect(g, C.dark, 8, 24, 7, 4);
      rect(g, C.dark, 21, 24, 7, 4);
      rect(g, plate, 6, 27, 10, 3);
      rect(g, plate, 20, 27, 10, 3);
    } else {
      rect(g, C.dark, 8, 24, 7, 6 - dy);
      rect(g, C.dark, 21, 24, 7, 6 - dy);
      rect(g, plate, 6, 29, 10, 3);
      rect(g, plate, 20, 29, 10, 3);
    }
    rect(g, bossBody, 6, 10 + dy, 24, 15);
    rect(g, plate, 10, 13 + dy, 16, 8);
    rect(g, plateL, 10, 13 + dy, 16, 1);
    rect(g, angry ? 0xff5050 : C.dark, 15, 16 + dy, 6, 3);
    rect(g, plate, 2, dy, 32, 4);
    rect(g, plateL, 2, dy, 32, 1);
    rect(g, plate, 8, 4 + dy, 20, 6);
    rect(g, C.dark, 8, 9 + dy, 20, 1);
    rect(g, angry ? 0xff5050 : C.yellow, 20, 5 + dy, 6, 3);
    if (pose === 'jump') {
      rect(g, plate, 0, 2, 6, 8);
      rect(g, plate, 30, 2, 6, 8);
    } else if (pose === 'shoot') {
      rect(g, plate, 0, 12, 6, 10);
      rect(g, plate, 28, 14, 6, 6);
      rect(g, C.dark, 33, 15, 3, 4);
    } else {
      rect(g, plate, 0, 12 + dy, 6, 10);
      rect(g, plate, 30, 12 + dy, 6, 10);
    }
  };
  for (const pose of ['idle', 'jump', 'shoot', 'crouch'] as AnvilPose[]) make(scene, `anvil_${pose}`, 36, 32, (g) => drawAnvil(g, pose));

  // MANTIS (jungle): 30x32 green stalker with scythe arms.
  type MantisPose = 'idle' | 'jump' | 'throw';
  const drawMantis = (g: G, pose: MantisPose) => {
    const body = 0x4aa84a;
    const dark = 0x2a6a2a;
    tri(g, body, 14, 0, 28, 6, 14, 12); // head
    rect(g, 0xff5050, 20, 4, 4, 3);
    rect(g, body, 10, 10, 10, 14);
    rect(g, dark, 12, 14, 6, 2);
    rect(g, dark, 4, 20, 10, 4); // abdomen
    if (pose === 'jump') {
      rect(g, dark, 8, 24, 3, 4);
      rect(g, dark, 18, 24, 3, 4);
    } else {
      rect(g, dark, 8, 24, 3, 8);
      rect(g, dark, 18, 24, 3, 8);
    }
    if (pose === 'throw') {
      rect(g, body, 20, 12, 10, 3);
      tri(g, C.ice, 26, 6, 30, 12, 26, 16);
    } else {
      rect(g, body, 18, 12, 4, 8);
      tri(g, C.ice, 20, 4, 26, 14, 20, 16);
    }
    rect(g, body, 6, 12, 4, 7);
  };
  for (const pose of ['idle', 'jump', 'throw'] as MantisPose[]) make(scene, `mantis_${pose}`, 30, 32, (g) => drawMantis(g, pose));

  // FROSTLINE (ice): 32x28 round ice bruiser that belly-slides.
  type FrostPose = 'idle' | 'slide' | 'shoot';
  const drawFrost = (g: G, pose: FrostPose) => {
    const body = 0x6ab8e8;
    const belly = 0xe6f8ff;
    if (pose === 'slide') {
      rect(g, body, 0, 14, 32, 12);
      rect(g, belly, 4, 22, 22, 4);
      rect(g, body, 24, 8, 8, 8);
      rect(g, C.dark, 28, 10, 2, 2);
      rect(g, C.orange, 31, 12, 1, 2);
      return;
    }
    rect(g, body, 4, 4, 24, 20);
    rect(g, body, 8, 0, 16, 4);
    rect(g, belly, 9, 10, 14, 13);
    rect(g, C.dark, 18, 5, 3, 3);
    rect(g, C.orange, 24, 8, 5, 3);
    rect(g, 0x3a78b8, 8, 24, 6, 4);
    rect(g, 0x3a78b8, 18, 24, 6, 4);
    if (pose === 'shoot') {
      rect(g, body, 26, 12, 6, 5);
      rect(g, C.ice, 30, 13, 2, 3);
    } else rect(g, body, 0, 12, 5, 8);
  };
  for (const pose of ['idle', 'slide', 'shoot'] as FrostPose[]) make(scene, `frostline_${pose}`, 32, 28, (g) => drawFrost(g, pose));

  // GALE (sky): 34x28 propeller-winged flyer.
  type GalePose = 'idle' | 'blow' | 'dive';
  const drawGale = (g: G, pose: GalePose) => {
    const body = 0xe8eef8;
    const trim = 0x4a9aba;
    rect(g, body, 10, 6, 14, 16);
    rect(g, trim, 10, 14, 14, 3);
    rect(g, C.dark, 18, 9, 4, 3);
    rect(g, C.yellow, 19, 10, 2, 1);
    rect(g, trim, 14, 0, 6, 6); // propeller hub
    rect(g, 0xc8d4ec, pose === 'blow' ? 4 : 8, 2, pose === 'blow' ? 26 : 18, 2);
    if (pose === 'dive') {
      tri(g, trim, 10, 10, 0, 20, 10, 20);
      tri(g, trim, 24, 10, 34, 20, 24, 20);
    } else {
      tri(g, trim, 10, 8, 0, pose === 'blow' ? 4 : 14, 10, 18);
      tri(g, trim, 24, 8, 34, pose === 'blow' ? 4 : 14, 24, 18);
    }
    if (pose === 'blow') rect(g, C.dark, 24, 16, 6, 4);
    rect(g, trim, 12, 22, 3, 6);
    rect(g, trim, 19, 22, 3, 6);
  };
  for (const pose of ['idle', 'blow', 'dive'] as GalePose[]) make(scene, `gale_${pose}`, 34, 28, (g) => drawGale(g, pose));

  // Boss projectiles
  make(scene, 'wave', 8, 12, (g) => {
    rect(g, C.orange, 0, 4, 8, 8);
    rect(g, C.yellow, 2, 0, 4, 6);
    rect(g, C.white, 3, 7, 2, 4);
  });
  make(scene, 'bshot', 6, 6, (g) => {
    rect(g, 0xff5050, 0, 1, 6, 4);
    rect(g, 0xff5050, 1, 0, 4, 6);
    rect(g, C.yellow, 2, 2, 2, 2);
  });
  make(scene, 'bthorn', 10, 10, (g) => {
    tri(g, 0x8ad84a, 0, 5, 5, 0, 10, 5);
    tri(g, 0x8ad84a, 0, 5, 5, 10, 10, 5);
    rect(g, 0x2a6a2a, 4, 4, 2, 2);
  });
  make(scene, 'iceshard', 6, 6, (g) => {
    tri(g, C.ice, 0, 3, 3, 0, 6, 3);
    tri(g, C.cyan, 0, 3, 3, 6, 6, 3);
  });
  make(scene, 'iceblock', 14, 14, (g) => {
    rect(g, C.cyan, 0, 0, 14, 14);
    rect(g, C.ice, 1, 1, 12, 3);
    rect(g, 0x3a98d0, 0, 12, 14, 2);
  });
  make(scene, 'btornado', 10, 14, (g) => {
    rect(g, 0xe8f4ff, 0, 0, 10, 3);
    rect(g, 0xc8dcf0, 2, 4, 7, 3);
    rect(g, 0xe8f4ff, 3, 8, 5, 3);
    rect(g, 0xc8dcf0, 4, 11, 3, 3);
  });
}

// --- player weapons -------------------------------------------------------------------

function makeWeapons(scene: Phaser.Scene): void {
  make(scene, 'bullet', 6, 4, (g) => {
    rect(g, C.yellow, 0, 1, 6, 2);
    rect(g, C.yellow, 1, 0, 4, 4);
    rect(g, C.white, 2, 1, 2, 2);
  });
  // Ultra Gun charge shots: half and full.
  make(scene, 'charge1', 10, 8, (g) => {
    rect(g, 0x8af0ff, 0, 2, 10, 4);
    rect(g, 0x8af0ff, 2, 0, 6, 8);
    rect(g, C.white, 3, 2, 5, 4);
  });
  make(scene, 'charge2', 22, 14, (g) => {
    rect(g, 0xffe14a, 0, 4, 6, 6);
    rect(g, 0xffb84a, 4, 2, 10, 10);
    rect(g, 0xffe14a, 10, 0, 12, 14);
    rect(g, C.white, 12, 3, 8, 8);
  });
  make(scene, 'pwave', 8, 12, (g) => {
    rect(g, 0x9c2f3f, 0, 4, 8, 8);
    rect(g, 0xc8ccd8, 2, 0, 4, 6);
    rect(g, C.white, 3, 7, 2, 4);
  });
  make(scene, 'thorn', 10, 10, (g) => {
    tri(g, 0x6cc04a, 0, 5, 5, 0, 10, 5);
    tri(g, 0x6cc04a, 0, 5, 5, 10, 10, 5);
    rect(g, 0xc8f080, 3, 3, 4, 4);
    rect(g, 0x3a7a2a, 4, 4, 2, 2);
  });
  make(scene, 'frost', 12, 6, (g) => {
    tri(g, C.ice, 0, 0, 12, 3, 0, 6);
    rect(g, C.cyan, 0, 2, 7, 2);
  });
  for (const f of [0, 1]) {
    make(scene, `cyclone${f}`, 18, 22, (g) => {
      const a = 0xfff8c8;
      const b = 0xf0d860;
      rect(g, f ? a : b, 0, 0, 18, 4);
      rect(g, f ? b : a, 2, 5, 14, 4);
      rect(g, f ? a : b, 4, 10, 10, 4);
      rect(g, f ? b : a, 6, 15, 7, 3);
      rect(g, f ? a : b, 7, 19, 4, 3);
    });
  }
}

// --- misc -------------------------------------------------------------------------------

function makeMisc(scene: Phaser.Scene): void {
  make(scene, 'eshot', 4, 4, (g) => {
    rect(g, C.pink, 0, 0, 4, 4);
    rect(g, C.white, 1, 1, 2, 2);
  });
  make(scene, 'hp_small', 8, 6, (g) => {
    rect(g, C.pink, 0, 0, 8, 6);
    rect(g, C.white, 2, 1, 4, 4);
  });
  make(scene, 'hp_big', 12, 10, (g) => {
    rect(g, C.pink, 0, 0, 12, 10);
    rect(g, C.white, 2, 2, 8, 6);
    rect(g, C.pink, 5, 3, 2, 4);
    rect(g, C.pink, 4, 4, 4, 2);
  });
  make(scene, 'ammo_small', 8, 6, (g) => {
    rect(g, C.visor, 0, 0, 8, 6);
    rect(g, C.dark, 2, 2, 4, 2);
  });
  make(scene, 'goal', 16, 16, (g) => {
    rect(g, C.visor, 3, 0, 10, 16);
    rect(g, C.white, 5, 2, 6, 12);
    rect(g, C.visor, 7, 4, 2, 8);
  });
  make(scene, 'boom', 16, 16, (g) => {
    rect(g, C.white, 6, 0, 4, 16);
    rect(g, C.white, 0, 6, 16, 4);
    rect(g, C.yellow, 3, 3, 10, 10);
    rect(g, C.white, 5, 5, 6, 6);
  });
  make(scene, 'shard', 4, 4, (g) => {
    rect(g, C.orange, 0, 0, 4, 4);
    rect(g, C.white, 1, 1, 2, 2);
  });
  make(scene, 'spark', 3, 3, (g) => {
    rect(g, 0x8af0ff, 0, 0, 3, 3);
    rect(g, C.white, 1, 1, 1, 1);
  });
  make(scene, 'windline', 10, 1, (g) => rect(g, 0xffffff, 0, 0, 10, 1));
  make(scene, 'pixel', 1, 1, (g) => rect(g, 0xffffff, 0, 0, 1, 1));
}

export function generateTextures(scene: Phaser.Scene): void {
  for (const [id, theme] of Object.entries(THEMES) as [ThemeId, Theme][]) {
    makeTileset(scene, id, theme);
    makeBackground(scene, id, theme);
  }
  makeEnemies(scene);
  makeBosses(scene);
  makeWeapons(scene);
  makeMisc(scene);
}
