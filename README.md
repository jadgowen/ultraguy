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
Each boss gives a weapon; weaknesses form a loop. Beat all 8 and the FORTRESS opens in the middle of
boss select: three fortress stages, each ending with a guardian boss (GATEKEEPER,
ABYSS EYE, SPIRE WARDEN; no weapon reward), the BOSS HALL (eight teleporters for harder boss
refights), then the final boss (OVERLORD, then SHADE).

**Arcade** (ARCADE on the title menu, `src/scenes/ArcadeScene.ts`, list in `src/arcade.ts`): replay any
boss's game you've won in the story (all eight stage games and the Gatekeeper's boxing), plus the
Overlord's armada (the alien shooter) once you've beaten the game. Ones you haven't won show as ???
with where to win them. A game played from here comes back here (`ret.kind: 'arcade'`). Wins are kept
in the save (`arcade`); saves from before it are seeded from progress (clearing the Boss Hall or the
finale meant you'd beaten all eight).

**Look.** The regular stage enemies are drawn on the shaded rig too (`art/enemyArt.mjs`; the walker and lava slug
keep their original art). Every minigame now has art of its own (`*Art.ts` beside each scene). Menus share a
steel-framed glass panel and a highlight bar (`src/uiArt.ts`): the title (a shine across the logo, an animated
UltraGuy, drifting embers), boss select (the picked cell glows and its boss comes alive) and the pause menu.

**Ultra Arena** (ULTRA ARENA on the title menu, `src/scenes/ArenaScene.ts`): a first-person deathmatch in the style
of the old 90s shooters. A raycaster draws the arena (textured walls, floors, ceilings or open sky, fog) into a
canvas texture each frame; four of the eight bosses (their own sprites, as billboards) patrol, close in, circle and
shoot. Pick up Spark Shock, Frost Spike, Flame Burst and Saw Blade ammo and health; first to 10 frags. Three arenas:
Fortress, Scrapyard, Stratos. UP/DOWN move, LEFT/RIGHT turn, Q/E strafe, FIRE shoots, JUMP switches weapons, click to
turn with the mouse. On a phone it has its own touch layout: a stick that appears under your left thumb (move and
strafe, analog), drag anywhere on the right to look, FIRE (drag it to aim while shooting) and WPN. A gentle aim
assist helps on every input: with a bot near the crosshair, turning slows over it and the view leans onto it while
you move, aim or shoot. (The first mockup is `art/mockups/arena.html`.)

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

Stage bosses are always fought in their arenas, where your weapons and parts matter. But two-thirds
of the way through each stage, in a room of their own (`challengeRoom` in `src/level/rooms.ts`, marker
`A`, screens `9` and `0` just before the stage's last stretch), the boss is waiting for you, and
challenges you to their own game. Some fights change the game entirely; each is its own scene, entered through a dialogue and a pixelate warp
(`src/scenes/cutscene.ts`), and wired up in `src/scenes/encounters.ts`:

| Where | Fight | Mode | Scene |
|---|---|---|---|
| Foundry challenge | Anvil | brick-breaker: smash his forge wall and hit him behind it; his sparks slow your paddle; hot bricks (and every hit on him) drop multiballs; he patches holes | `BreakerScene.ts` |
| Canopy challenge | Mantis | lane-crossing hop: dodge the traffic, ride logs and pads, fill all three pads without landing where Mantis waits (tiled grass, trail and animated river, sprite logs, pads, beetles, boulders, vines, boars and rolling logs, splashes and dust, jungle margins; art in `hopArt.ts`) | `HopScene.ts` |
| Glacier challenge | Frostline | one-on-one ice hockey: slippery skating, shots and body checks, first to 3 (a painted rink with boards, markings and a snowflake logo, meshed nets with a goal light, top-down skaters with sticks, ice spray and blade trails, a scoreboard over the stands; art in `hockeyArt.ts`) | `HockeyScene.ts` |
| Stratos challenge | Gale | vertical sky shooter (art in `skiesArt.ts`): kites, swooper squadrons, ring-firing spinners, balloon bombers (always carry a P) and darts that flag their column, with wind gusts shoving your ship; P capsules power your shot up to five-way, and the fifth turns it into a big laser that cuts through everything in its column (losing a ship costs a level); then Gale's feathers, blades and a low tornado you can fly over | `SkiesScene.ts` |
| Power Plant challenge | Volt | side-view motocross race: JUMP gas, FIRE turbo that overheats, UP/DOWN lanes, tilt in the air | `RaceScene.ts` |
| Scrapyard challenge | Scrap | top-down junk maze: four rooms, keys, a hookshot that swings you across shafts; Scrap's magnet field turns shots until you stun him (scrap-heap walls with lit tops and front faces, rusted floor plates, magnet posts, shutters, blinking warning lamps, beetles and turret sprouts, a chained claw hookshot, a heart-and-key status bar; art in `dungeonArt.ts`) | `DungeonScene.ts` |
| Reef challenge | Tide | trench descent: dive head-first down a winding deep-sea trench (darker the deeper you go; your lamp and flares light the way) past jellyfish, sea mines and urchins, grabbing air bubbles, while Tide hunts you: his body loops through the dark, then his lights glow where he'll strike, lunging across from the side (aimed where you'd be if you kept cruising, so brake or dive out of it) or surging up from below. Reach the vent at the bottom and he jams in it behind you (art in `trenchArt.ts`; the old pinball table, `PinballScene.ts`, is no longer on a capsule) | `TrenchScene.ts` |
| Caldera challenge | Magma | maze bomb battle: drop bombs, blast rock, grab bomb/fire/speed power-ups, 3 hearts each | `BombScene.ts` |
| Fortress Gate + Arcade | Gatekeeper | behind-the-back boxing (his only fight), three rounds, Coach Jared in your corner (both fighters drawn on the shaded rig in `art/boxArt.mjs`; the arena, with its crowd, lighting rig, banner, ropes and mat, in `boxingArt.ts`; sweeping spotlights, camera flashes and punch sparks). A punch that lands bursts with light, flashes him white then red, jolts the screen and throws off its damage; a blocked one only clanks grey with BLOCK. Knockdown counts are a big outlined number in the ring (yellow for him, red for you) called out by the announcer (`box_count1`..`box_count10`; his count starts after "Down he goes!") | `BoxingScene.ts` |
| Arcade (after beating the game) | Overlord | fixed-screen alien shooter: two waves, then the mothership | `ShooterScene.ts` |

The games share `ModeScene.ts`. **Stage challenges:** walk up to the boss and they say their piece
(Anvil's and Volt's lines were rewritten for a first meeting), then the warp. Win and you carry on
from where they stood, fully healed, with 50 bolts. Lose and you're back at the room's checkpoint
with no life lost (losses don't cost lives, since GAME OVER would mean the whole stage again); after
two losses they offer ONE MORE TRY or PUSH PAST (no bolts; they leave, and you settle it at the end of
the stage). EX rematches start at the boss door, past the challenge.

**Boss Hall.** The eight capsules are platform refights, each in a copy of that boss's own stage arena
(platforms, belts, springs, water, spikes and all, drawn in the fortress's tiles; `rematchArenas` in
`fortress.ts`, one layout row each, and arenaFx runs that stage's room effects), a notch harder than in
their stages (`tier` 1 in `Boss.ts`: about 20% less damage taken, 20% shorter pauses, and their EX
attack; EX itself is tier 2). You beam out of the hall and into the arena, and back again after the
fight. The exit opens once all eight are beaten. (The bonus minigame capsules are gone: those games
are in the ARCADE.)

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

Each boss stage has its own midpoint challenge halfway through: four minibosses fought in arenas that
matter, and four set pieces with no boss at all.

| Stage | Midpoint | How it works |
|---|---|---|
| Foundry | PRESS TITAN on the line | presses (`!`) slam over the arena and the floor is a belt; your shots bounce off him: lure him under a press (three crushes beat him) |
| Canopy | THE GREAT CLIMB | up the inside of a tree on flowers, branches and vines while brambles rise after you (`rise`; a tangle of thorny vines, `rise_jungle`, under a crest of thorny tendrils that sway and curl, some tipped with red buds, `bramble_crest_<k>`; both in `hazards.ts`; the rising brambles and lava are drawn only between the shaft's walls, and the brambles' sides fray into thorny shoots) |
| Glacier | TUSK MAMMOTH on thin ice | your shots bounce off him and he only charges; his charges break the thin ice (`_`, drawn pale) behind him, and charging back over a hole drops him in the water (three falls beat him); holes freeze back over (fast once it's fallen in, so it has to break through again) |
| Stratos | STORM KITE over open sky | a ledge each side, a gap with moving and crumbling clouds between, and the gusts still blowing |
| Power Plant | BLACKOUT | the lights cut out as you walk in (`blackout`), Sparkers swarm; shoot the three generators (`O`) to bring the lights back and open the shutter (`Q`); `src/scenes/blackout.ts` |
| Caldera | MAGMA ELEVATOR | a lift (`;` start, `,` stop) carries you up a shaft with magma right behind (the same living lava as the boss room's surge, also used for the stage's rising lava). The camera glides onto the lift as it rumbles and back off at the top (`CAM_GLIDE_FRAMES`, eased in and out); `src/scenes/elevator.ts` |
| Scrapyard | COMPACTOR ESCAPE | a wall of grinding steel (`compactor`) chases you through junk: slide under the pipes, jump the rest |
| Reef | the ANGLER's dark trench | pitch dark; its lure is the only other light, and it dims and flickers just before it lunges |

The four minibosses are drawn on the same shaded rig as the bosses (`art/miniArt.mjs`), with a frame for each
move: the Press Titan crouches before it stomps, tucks its pistons in the air and flattens when a press lands
on it; the Tusk Mammoth lowers its head and trembles before a charge, gallops kicking up snow, skids, and
flails as it falls through the ice; the Storm Kite flaps, and crackles with current as it calls down rain; the
Angler's jaw gapes before it lunges, its lure on the end of its stalk.

The minibosses fight back differently as the fight goes on (`src/entities/bosses/Miniboss.ts`). The Press
Titan and the Tusk Mammoth can only be beaten by their arenas (`ARENA_ONLY`; a hint says how at the start).
At half health each one's fight changes: the Titan's presses speed up, the Mammoth is enraged, the Kite's
storm builds (harder, more frequent gusts, and lightning strikes where you stand), and the Angler's trench
stops flashing while its lure dims.

**Boss art.** Anvil is the first boss redrawn on the same shaded-parts approach as the hero (the "Molten"
design, picked from `art/mockups/anvil.html`): a 3/4 view with the far arm and leg in shadow, four breaths of
idle, a trembling crouch before the dash, a stretch on takeoff, a squash on landing, and a cannon that kicks.
Every frame also comes white-hot: firing and slamming heat his forge up (glowing seams, blazing furnace,
white-hot fists and cannon) and he cools back down. On top, `src/entities/bosses/bossFx.ts` adds a shadow, a
flickering furnace glow, the visor (red when he means it), a muzzle flash and embers. The art is generated by
`art/anvilArt.mjs` (with `npm run sprites`), which also writes where the glows go on each frame
(`src/entities/bosses/anvilAnchors.ts`). Magma is the second (the "Magma Core" design from `art/mockups/magma.html`, drawn by
`art/magmaArt.mjs`): four glassy obsidian plates around a molten core, with floating fists that bob on their
own. The plates breathe apart a little at rest and split wide on the wind-up, the landing and the eruption, so
the core blazes through: that's the tell. The fireballs form over his raised, molten fist. Volt is the third (the "Tesla Knight" design from `art/mockups/volt.html`,
drawn by `art/voltArt.mjs`): navy armor, lightning-bolt antennae and coil hands, with a battery in his chest whose
bar fills as he charges up to cast. Current crackles between his antennae (more as he charges) and from his
battery to his hands when he casts (the effects layer's arcs), his orbs come out of his raised hand, and his warp
comes apart in bands, throwing sparks. Mantis (the "Orchid Assassin"), Frostline (the "Crystal Bird"), Gale (the "Storm Harpy") and Tide (the
"Leviathan") followed, picked from the mockups in `art/mockups/` and drawn by `art/mantisArt.mjs`,
`frostlineArt.mjs`, `galeArt.mjs` and `tideArt.mjs` (their glow spots are in
`src/entities/bosses/bossAnchors.ts`): each has a four-beat idle, takeoff and landing frames, and attack poses,
with the effects layer on top (Mantis bursts petals as she vanishes, Tide's lights glow sea-green). They all
share the drawing tools in `art/shadedParts.mjs`. Scrap is the last (the "Junk Golem" from `art/mockups/scrap.html`,
drawn by `art/scrapArt.mjs`): a floating giant made of the junk in his magnet's field, with car-block fists. His
stomp is gone; instead he raises his fist, a horseshoe opens in his palm and he pulls the ceiling down: dust
trickles and shadows darken where the junk will fall, then it rains in one piece after another (stand in the gaps).

Each stage's boss room is its own too (`bossArena` in `src/level/rooms.ts`; the room's own behavior is in
`src/scenes/arenaFx.ts`). Bosses fall through one-way ledges, so the ledges are only for you:

| Boss | Arena |
|---|---|
| ANVIL | belts either side of the middle push you outward; two catwalks over his ground waves |
| MANTIS | a bounce flower at each end throws you up to the branches |
| FROSTLINE | ice ledges over his slides; slamming a wall shakes icicles loose from the ceiling |
| GALE | an updraft up the middle carries you to her height, with a cloud either side |
| VOLT | switch-block ledges that take turns, and live floor plates that switch with the barriers |
| MAGMA | the lava surges over the floor every so often (it burns, it doesn't kill; drawn with the stage's animated lava); wait it out on a basalt ledge |
| SCRAP | two junk humps stop his rolling saws, and a crane platform rides back and forth overhead |
| TIDE | underwater, a spike pit in each half of the floor, and a ledge in each half with spikes hanging over it (a full jump off a ledge reaches them). Tide is drawn at twice his sprite's size (as big as in his own game); his bubbles come in aimed fans, he sheds bubbles behind his dash, and once hurt he spits at you while cruising |

Just before the midpoint, a low block hides a crawlspace (only the
slide gets in) holding an energy tank (E-tank), and in some stages a 1-UP; it looks like solid wall,
notched at each end, until you're inside. The armor-part rooms hide a 1-UP too.

**Energy bars.** Life, the equipped weapon's ammo and the boss each get a shaded metal bar with a badge under it
(helmet, weapon gem, boss skull); units you just lost flash and then drain away, and low life pulses red.

**Lives.** You start each stage with 2 extra lives (shown in the pause menu, with your bolts); 1-UPs add one (up to 9).
Dying with lives left sends you to the last checkpoint; with none left it's GAME OVER and back to the stage
select (or the fortress map). Until the intro stage is beaten, GAME OVER or EXIT STAGE there goes back to the title
instead, so it can't be skipped.

**Bolts and Rivet's shop.** Beaten enemies drop bolts (big ones now and then), and bolt caches hide in the
crawlspaces and armor-part rooms. Press Q (L1) on the stage select to visit RIVET'S PARTS & PROVISIONS:
1-UPs (added to your lives when you next enter a stage), E-tanks, W-tanks (refill every weapon from the pause
menu), the Spike Guard (survive one spike or lava fall) and the Bolt Magnet (pickups fly to you). More stock
comes in as you beat bosses (`src/shop.ts`).
Every boss stage ends with an extra stretch before the boss door (screens `7` and `8`: more of the stage's
enemies, a stage hazard and a bolt cache). Enemies drop bolts often (small 2, big 8) and caches hold 25.

**Fortress guardians.** Each has its own fight and room of one-way ledges (`guardArena` in
`src/level/fortress.ts`; art in `art/guardianArt.mjs`):
- GATEKEEPER: fought in the ring. Walking into his room, he stands there and says his piece (the dialogue
  sits at the top so you can see him), then the screen pixelates into his boxing match (`BoxingScene.ts`;
  `BOSS_ENCOUNTERS` in `encounters.ts`). Win and it's STAGE CLEAR back in his empty room; lose and it costs a
  try, back at the door checkpoint (GAME OVER if none are left). EX rematches box too. His old platform fight
  (`Gatekeeper.ts`: a portcullis tower shield, slams, a shield bash) is still in the code, unused.
- ABYSS EYE (`Abyss.ts`): shots bounce off its shut lids. It drifts between perches level with two tiers of
  ledges, cracks its lids (the tell) and opens to fire rings or aimed orbs: that's your window. Four pods in the
  walls shoot while it's shut; destroy all four and it reels, wide open (they grow back).
- SPIRE WARDEN (`Warden.ts`): a winged knight in a tower of three tiers. He leaps between them (toward yours)
  and slashes a sword wave along his tier, lobs fireballs, or dives from above into floor shockwaves.

**Boss hallways.** Past the stage's last door there's a quiet hallway (like the X games): two screens with a low,
beamed ceiling and no enemies, then the boss door. It has the checkpoint (and the boss-test start), so you can
pick your weapon calmly, and a retry after a boss death starts there. `bossHall()` in `src/level/rooms.ts`
(screens `5` and `6`, layout `...|56|XY`); in all eight boss stages, the three fortress stages and MEGAMART.

Rivet also runs a PAINT SHOP (eight color schemes for UltraGuy, 50 to 200 bolts; bought ones join the EX
colors in the stage select's picker) and sells a JUKEBOX (100 bolts) that plays any track you've heard. The
game notes each track the first time it plays, and older saves get the ones their progress proves
(`src/scenes/WardrobeScene.ts`, `src/scenes/JukeboxScene.ts`).

**PIP.** Once you've beaten a stage boss, Rivet sends Pip along with you: a little drone that hangs behind
UltraGuy's shoulder on a spring (it lags when you move off, overshoots when you stop, bobs, tilts into its
motion, flaps its fins, and its thruster never stops sparking, or fizzing bubbles under water, where the SPARKS trail turns to bubbles too). Its eye follows whatever it's interested in.
It jolts and spins when you get hit, and does a lazy loop over your head if you stand still. It comes with a
LAMP (light around it in the dark). Rivet's PIP workshop sells FETCH (80: flies out and brings back bolts and
pickups), GUARD (150: once charged, zaps an enemy shot about to hit you) and ZAP (200: pot shots at enemies,
never bosses); upgrades you own can be switched off. Looks: shells (saucer, cube, birdie, and a golden one for
winning every EX rematch), paints and trails (sparks, bubbles, music, stars) (`src/pip.ts`,
`src/entities/Pip.ts`, `src/scenes/PipScene.ts`). You meet it in Rivet's shop the first time you come back to the
stage select after a boss (`src/scenes/PipIntroScene.ts`): it bursts out of a crate on the counter. It has its
own chirps (fetching, zapping, guarding, startled when you're hit) and a thruster hum that rises with its speed,
and it's in the ending's cast roll, flying along with UltraGuy.

The set pieces have their own audio: chase music while the compactor runs, climbing music while Canopy's
brambles rise, the power dying (and the music with it) in the blackout and surging back, and a crunch when a
press flattens the Press Titan.

**Signature enemies.** Each stage has one of its own: Foundry's Hammerbot (slams shockwaves), Canopy's
Snapper (a bud that bites when you're close), Glacier's Snow Roller (grows as it rolls), Stratos's Gust Fan
(blows you back), Power Plant's Tesla Coil (rings of sparks), Caldera's Lava Leaper, Scrapyard's Magnet Drone
(pulls you under it) and Reef's Jelly (zaps straight down). They take the place of some of the stage's usual
enemies (`signature` in each stage file).

**The secret.** One 1-UP hides in every boss stage. Find all eight (they're remembered) and Rivet hands you the
key to MEGAMART, the megastore of Rivet's rival, the BARGAIN BARON: a rooftop run past every signature enemy
(billboards, water towers and stock left out on the roofs, then the store's front; art in `src/megamartArt.ts`)
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

**Teleport beam** (`src/scenes/beam.ts`). UltraGuy beams in after READY (starting a stage, after a
death) and in and out of the Boss Hall's arenas: a streak of light in his colors drops from the top of
the screen, hits with a flash and sparks, and he forms out of it (a white silhouette growing up from
the ground, then flickering into his colors). Beaming out is the reverse. Play waits while it runs.

**Boss hits.** After a hit a boss can't be hurt for 34 steps (44 after a weakness hit), exactly as long
as it flashes, so rapid fire can't stack hits (`HIT_INVULN` / `WEAK_INVULN` in `Boss.ts`).

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

The game doesn't wait for all of it. Only the sound effects and the title music load before the title screen;
the rest (about 30 MB) streams in behind it, a couple of files at a time: the menu and first-stage music, then
the voice lines, then the remaining music. Anything needed before its turn jumps the queue (a stage's track
starts the moment it arrives). The minigames load their code on demand too, and Phaser is in its own file so it
stays cached across updates.

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
edges. Pressing a physical key hides them again. Ultra Arena swaps in a shooter layout (`setTouchMode('fps')`;
`Controls.stick()` / `Controls.look()` carry the analog stick and look drag). The logic is in `src/touch.ts`.

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
