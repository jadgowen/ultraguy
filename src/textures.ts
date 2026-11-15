import Phaser from 'phaser';

/**
 * Placeholder art drawn with rectangles at boot. Every texture key here can be
 * replaced later by loading a real sprite sheet under the same key.
 */

const C = {
  orange: 0xf28c28,
  orangeD: 0xb85a1a,
  dark: 0x2b2540,
  visor: 0x5ef0c8,
  white: 0xfff1e0,
  gray: 0x8a8fa8,
  steel: 0x55607a,
  red: 0xd83a4a,
  green: 0x4ac26a,
  purple: 0x8c4ad8,
  yellow: 0xffe14a,
  pink: 0xff6ad5,
};

type Draw = (g: Phaser.GameObjects.Graphics) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function rect(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
}

type HeroPose = 'idle' | 'run1' | 'run2' | 'run3' | 'jump' | 'climb' | 'hurt';

/** Hero frame, 24x24, facing right, body centered so flipX mirrors cleanly. */
function drawHero(g: Phaser.GameObjects.Graphics, pose: HeroPose, shoot: boolean): void {
  const o = 4; // body x offset inside the 24px frame
  const back = pose === 'climb';

  // Helmet
  rect(g, C.orange, o + 4, 1, 8, 8);
  rect(g, C.dark, o + 7, 0, 2, 2);
  if (!back) rect(g, pose === 'hurt' ? C.white : C.visor, o + 8, 3, 4, 3);
  rect(g, C.dark, o + 4, 8, 8, 1);

  // Torso
  rect(g, C.orange, o + 3, 9, 10, 7);
  rect(g, C.dark, o + 3, 14, 10, 2);
  if (!back) rect(g, C.visor, o + 7, 10, 2, 2);

  // Arms
  if (shoot) {
    rect(g, C.orangeD, o + 1, 9, 3, 6);
    rect(g, C.orangeD, o + 12, 10, 5, 3);
    rect(g, C.gray, o + 16, 9, 4, 5);
    rect(g, C.dark, o + 19, 10, 1, 3);
  } else if (pose === 'climb') {
    rect(g, C.orangeD, o + 1, 3, 3, 7);
    rect(g, C.orangeD, o + 12, 9, 3, 6);
  } else if (pose === 'hurt') {
    rect(g, C.orangeD, o + 0, 4, 3, 6);
    rect(g, C.orangeD, o + 13, 4, 3, 6);
  } else if (pose === 'jump') {
    rect(g, C.orangeD, o + 1, 9, 3, 5);
    rect(g, C.orangeD, o + 12, 4, 3, 7);
  } else {
    rect(g, C.orangeD, o + 1, 9, 3, 6);
    rect(g, C.orangeD, o + 12, 9, 3, 6);
  }

  // Legs
  const leg = (x: number, h: number, bootX: number, bootY: number, bootW: number) => {
    rect(g, C.dark, o + x, 16, 3, h);
    rect(g, C.orange, o + bootX, bootY, bootW, 3);
  };
  switch (pose) {
    case 'run1':
      leg(3, 5, 1, 20, 4);
      leg(10, 5, 11, 21, 5);
      break;
    case 'run2':
      leg(6, 6, 5, 21, 6);
      break;
    case 'run3':
      leg(4, 6, 3, 21, 4);
      leg(9, 4, 10, 19, 5);
      break;
    case 'jump':
      leg(3, 4, 2, 19, 4);
      leg(10, 3, 10, 18, 5);
      break;
    case 'climb':
      leg(4, 7, 3, 21, 4);
      leg(9, 4, 9, 18, 4);
      break;
    default:
      leg(4, 6, 3, 21, 5);
      leg(9, 6, 9, 21, 5);
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  // Tileset: 0 solid, 1 ladder, 2 spike, 3 boss door
  make(scene, 'tiles', 64, 16, (g) => {
    rect(g, 0x4a3a5a, 48, 0, 16, 16);
    rect(g, 0x232c3c, 48, 0, 2, 16);
    rect(g, 0x232c3c, 62, 0, 2, 16);
    for (let y = 1; y < 16; y += 4) rect(g, 0xb06ad8, 51, y, 10, 2);
    rect(g, C.yellow, 55, 6, 2, 4);

    rect(g, 0x3e5068, 0, 0, 16, 16);
    rect(g, 0x6b85a6, 0, 0, 16, 2);
    rect(g, 0x6b85a6, 0, 0, 2, 16);
    rect(g, 0x232c3c, 0, 14, 16, 2);
    rect(g, 0x232c3c, 14, 0, 2, 16);
    rect(g, 0x232c3c, 6, 6, 4, 4);
    rect(g, 0x8aa2c2, 6, 6, 2, 2);

    rect(g, 0xc9a227, 16 + 2, 0, 2, 16);
    rect(g, 0xc9a227, 16 + 12, 0, 2, 16);
    for (let y = 2; y < 16; y += 4) rect(g, 0xe8c350, 16 + 2, y, 12, 2);

    g.fillStyle(0xd0d8e0, 1);
    g.fillTriangle(32, 16, 36, 2, 40, 16);
    g.fillTriangle(40, 16, 44, 2, 48, 16);
    g.fillStyle(0x7a8494, 1);
    g.fillTriangle(36, 16, 36, 4, 40, 16);
    g.fillTriangle(44, 16, 44, 4, 48, 16);
  });

  const poses: HeroPose[] = ['idle', 'run1', 'run2', 'run3', 'jump', 'climb', 'hurt'];
  for (const p of poses) {
    make(scene, `p_${p}`, 24, 24, (g) => drawHero(g, p, false));
    if (p !== 'climb' && p !== 'hurt') make(scene, `p_${p}_s`, 24, 24, (g) => drawHero(g, p, true));
  }

  make(scene, 'bullet', 6, 4, (g) => {
    rect(g, C.yellow, 0, 1, 6, 2);
    rect(g, C.yellow, 1, 0, 4, 4);
    rect(g, C.white, 2, 1, 2, 2);
  });
  make(scene, 'eshot', 4, 4, (g) => {
    rect(g, C.pink, 0, 0, 4, 4);
    rect(g, C.white, 1, 1, 2, 2);
  });

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
  // Boss "Anvil": 36x32, facing right.
  type BossPose = 'idle' | 'jump' | 'shoot' | 'crouch';
  const bossBody = 0x9c2f3f;
  const plate = 0x8a8fa8;
  const plateL = 0xc8ccd8;
  const drawBoss = (g: Phaser.GameObjects.Graphics, pose: BossPose) => {
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
  for (const pose of ['idle', 'jump', 'shoot', 'crouch'] as BossPose[]) {
    make(scene, `boss_${pose}`, 36, 32, (g) => drawBoss(g, pose));
  }
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

  make(scene, 'pixel', 1, 1, (g) => rect(g, 0xffffff, 0, 0, 1, 1));

  // Starfield + distant skyline for the background (repeats).
  make(scene, 'bg', 128, 240, (g) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['ultraguy']);
    for (let i = 0; i < 40; i++) rect(g, rnd.pick([0x3a3f66, 0x5a5f8a, 0x9aa0d0]), rnd.between(0, 127), rnd.between(0, 150), 1, 1);
    const heights = [70, 40, 90, 55, 110, 65, 45, 85];
    heights.forEach((hgt, i) => {
      rect(g, 0x1f2340, i * 16, 240 - hgt, 15, hgt);
      for (let y = 240 - hgt + 6; y < 236; y += 10) rect(g, 0x2c3260, i * 16 + 4, y, 2, 3);
    });
  });
}
