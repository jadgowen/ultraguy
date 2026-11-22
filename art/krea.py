#!/usr/bin/env python3
"""
Generate painted battle art for the final boss with Krea (the same API and model
the Julia's Adventure tools use). The key comes from KREA_API_KEY or
~/.krea_api_key and is never printed.

    python3 art/krea.py chimera idol jared creator   # two takes of each
    python3 art/krea.py creator --seeds 11 12 13     # specific seeds
    python3 art/krea.py bg_storm bg_forge bg_store bg_void   # the four battle backdrops (16:9)

Images land in art/mockups/krea/<name>_<seed>.png, on a flat magenta
background so they can be keyed out later.
"""
import json, os, sys, time, urllib.request, urllib.error

BASE = "https://api.krea.ai"
MODEL = "krea/krea-2/medium"
OUT = os.path.join(os.path.dirname(__file__), "mockups", "krea")


def key():
    k = os.environ.get("KREA_API_KEY")
    if k and k.strip():
        return k.strip()
    return open(os.path.expanduser("~/.krea_api_key")).read().strip()


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {key()}")
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def gen(prompt, out, seed, aspect="1:1"):
    st, resp = req("POST", f"{BASE}/generate/image/{MODEL}",
                   {"prompt": prompt, "aspect_ratio": aspect, "resolution": "1K", "creativity": "low", "seed": seed})
    if st != 200:
        print(f"FAIL {out} [{st}]: {resp}", flush=True)
        return False
    jid = resp["job_id"]
    deadline = time.time() + 300
    while time.time() < deadline:
        st, job = req("GET", f"{BASE}/jobs/{jid}")
        if job.get("status") == "completed":
            with urllib.request.urlopen(job["result"]["urls"][0], timeout=60) as im:
                open(out, "wb").write(im.read())
            print(f"DONE {out}", flush=True)
            return True
        if job.get("status") in ("failed", "cancelled"):
            print(f"{job.get('status')} {out}: {job.get('error')}", flush=True)
            return False
        time.sleep(3)
    print(f"TIMEOUT {out}", flush=True)
    return False


# The look: a 16-bit console JRPG's large static battle enemy, painted in fine pixel art.
STYLE = (
    "Large static enemy battle sprite from a 1994 16-bit console fantasy RPG: richly detailed hand-painted "
    "pixel art, limited palette with careful dithering and strong light-to-shadow shading, dramatic and "
    "operatic, grotesque yet beautiful, painted like a classic SNES-era final boss. Full figure, centered, "
    "facing slightly to the left (toward the heroes on the right), no text, no border, no UI, no ground shadow, "
    "isolated on a perfectly flat solid magenta background (#FF00FF)."
)

PROMPTS = {
    "chimera": (
        "THE ELEMENTAL CHIMERA: ONE single monstrous beast (not separate figures) built from the parts of four "
        "elemental robot masters. Its hulking body and legs are cracked black basalt with molten lava glowing in "
        "the cracks and a molten core in its chest; its front arm is a long blue-green sea eel ending in snapping "
        "fanged jaws instead of a hand, and the same eel forms its finned tail; great silver feathered metal wings "
        "with gold trim sprout from its shoulders; its head is a crystalline ice bird's head of pale blue glass "
        "with a sharp beak and a crest of icicles. Fire, water, wind and frost swirl around it. " + STYLE
    ),
    "idol": (
        "THE IRON IDOL: ONE single colossal machine (not robots riding on it) built from the parts of four "
        "mechanical masters. A red forge-steel chest plate with a vent grill and anvil-shaped shoulder pauldrons; "
        "a crackling yellow lightning reactor glowing in its chest; its head a navy-blue helmet with yellow "
        "lightning-bolt horns and big green insect compound eyes, thin pink antennae and pink mandibles; two huge "
        "green scythe-blade insect wings rising behind it; its left arm ends in a giant blacksmith hammer grown "
        "into the forearm; its right arm is rusty scrap metal ending in a huge red horseshoe magnet claw; legs of "
        "mismatched rusty junk plates on pistons. Steam, sparks, lightning. " + STYLE
    ),
    "jared": (
        "BLACK JARED, SUPERSIZED: just a GIANT disembodied mutated HEAD (no body), floating. A Black man's head "
        "swollen to monstrous size and lopsided, skin gone sickly grey-violet with bulging glowing purple veins, "
        "furrowed brows, two mismatched glowing yellow eyes, a huge manic grin full of teeth with mustard drooling "
        "from it, wearing a green baseball cap with an orange stripe that's now too small for him, its brim "
        "cracked. Writhing hot dogs in buns sprout from under the cap like tendrils, dripping ketchup and "
        "mustard. Below him a few small angry living hot dogs with tiny legs and furious eyebrows. Comic and "
        "grotesque. " + STYLE
    ),
    "creator": (
        "THE CREATOR: the final boss, an enormous floating disembodied head looming out of a void. A heavyset "
        "white man in his late thirties with short tousled dark brown hair, a high forehead receding at the "
        "temples, thick dark eyebrows, blue-grey translucent rectangular eyeglasses, a broad face, and a full long "
        "dark brown beard with reddish tones and a little grey under the lower lip, a thick mustache, a steady "
        "stern expression. Lit dramatically from below by the cold glow of old CRT televisions; floating around "
        "him are game cartridges, controllers and small glowing screens. Godlike, enormous, painted like a "
        "classic SNES-era final boss face. " + STYLE
    ),
}


# Battle backdrops (16:9, no figures): the arena behind each tier, painted like a 16-bit JRPG's
# final-dungeon battle backgrounds, rich and detailed, with room in the middle-left for the boss.
BACKDROP = (
    "A battle background from a 1994 16-bit console fantasy RPG's final dungeon: richly detailed, painterly, "
    "atmospheric and operatic, deep dramatic lighting, no characters, no creatures, no people, no text, no UI. "
    "Wide landscape composition, the middle of the frame left open for a boss to stand in."
)
BACKDROPS = {
    "bg_storm": (
        "The sky after the floor of a dark fortress throne room has fallen away: a vast storm sky split into four "
        "weathers that bleed into each other, blizzard snow and ice crystals in the upper left, howling wind and "
        "lightning-lit clouds in the upper right, torrential rain and crashing waves in the lower left, rising "
        "embers and rivers of lava in the lower right; a single broken stone block floats in the foreground where "
        "the heroes stand; shards of the shattered throne room drift in the air. " + BACKDROP
    ),
    "bg_forge": (
        "A colossal abandoned forge-factory hanging in a black void: conveyor belts running off into nowhere, "
        "giant gears, dangling chains and sparking power cables, glowing molten crucibles, mountains of rusted "
        "scrap metal, a single thorny green vine growing through the machinery, steam and sparks, cold blue "
        "electric light against hot orange furnace glow. " + BACKDROP
    ),
    "bg_store": (
        "Inside a convenience store at night, warped and nightmarish: flickering fluorescent lights, aisles of "
        "snacks and drinks stretching too far into darkness, a glowing hot dog roller grill on the counter with "
        "sausages turning, slushie machines, a buzzing neon OPEN sign, mustard and ketchup splattered across the "
        "tiles, the shelves twisting and the ceiling bending as if the store is being pulled apart; sickly green "
        "and purple lighting. " + BACKDROP
    ),
    "bg_void": (
        "An infinite dark cosmic void at the end of a video game: deep indigo and black space with faint "
        "glowing grid lines, distant floating fragments of earlier levels (a factory, a jungle treetop, an ice "
        "field, a volcano, a reef, a city street) drifting like islands, faint glowing pixels rising like stars, "
        "a soft cold cathode-ray glow from below, vast and sacred, like the inside of an old game console's "
        "dream. " + BACKDROP
    ),
}


def main():
    args = sys.argv[1:]
    seeds = [101, 202]
    if "--seeds" in args:
        i = args.index("--seeds")
        seeds = [int(s) for s in args[i + 1:]]
        args = args[:i]
    names = args or list(PROMPTS)
    os.makedirs(OUT, exist_ok=True)
    for name in names:
        for seed in seeds:
            if name in BACKDROPS:
                gen(BACKDROPS[name], os.path.join(OUT, f"{name}_{seed}.png"), seed, aspect="16:9")
            else:
                gen(PROMPTS[name], os.path.join(OUT, f"{name}_{seed}.png"), seed)


if __name__ == "__main__":
    main()
