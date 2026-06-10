# minecrAft — Adyah's World
### Product Documentation (Honest Edition)

**Document owner:** Karthik
**Product:** A personalized, offline Minecraft‑style voxel game built as a gift for his son, **Adyah** (the capital **A** in "minecrAft" is for Adyah).
**Status:** Game is built, playable, and saved to disk. Promotional videos are **not** finished to standard — see Section 8 for the honest account.
**Last updated:** generated from the full build history.

---

## 1. What this product is

minecrAft is a from‑scratch, browser‑and‑desktop voxel survival game in the spirit of Minecraft. It was written specifically as a one‑of‑a‑kind gift: Adyah and his family (Mom, Dad, brother Aarav) appear *inside* the game as characters built from their real photos, and the game has a story/quest where Adyah is the hero.

Two things matter most about the intent, in the owner's own words:
- It had to be a **real game** — installable, plays on Windows and Mac, saves progress — **not** a throwaway browser toy.
- It is meant to be a **once‑in‑a‑lifetime memory** for Adyah.

The game half delivers on that. The video half does not yet — and this document says so plainly.

---

## 2. Requirements, as you actually gave them

This is the honest log of what was asked across the project, in order, so nothing is lost:

1. Build a Minecraft clone named **minecrAft**, capital A for Adyah, **without being told how** — just build it and show the result. Must work **fully offline**.
2. Don't put "A is for Adyah" in the header. Show off the **full range** of Minecraft capabilities. Use the **family photos** (folders: `dadpics`, `mompics`, `aaravpics`, `adyahpics`) for characters. Make it more interesting and adventurous — Adyah loves adventure. Add **villagers and attackers**. Improve the UI. Use Adyah's name where relevant.
3. **Not** a browser game — a proper **Windows + Mac** game, preferably an **Electron app**, a full game he can keep playing with **all progress saved**.
4. Keep all code in the same project folder.
5. Run it and open it in the browser to verify.
6. The `assets` folder was empty — characters needed to actually exist.
7. Make it **more performant**, a **bigger world**, **not childish**; explain how it works, the adventure, difficulty levels, and gameplay.
8. Add the **props real Minecraft has** — farming, building blocks, functional blocks, animals.
9. Add **exploration, treasures, and secrets**.
10. Create **gameplay videos for YouTube** (streamer‑style), using the family photos to make characters. Extract the faces properly. Originally **4 videos** (one each for Adyah, Aarav, Mom, Dad, with Adyah as hero in all), with **background music and voice‑over**.
11. Make the videos **YouTube/streamer quality** — voice, expressions — to **surprise Adyah**.
12. Critical corrections along the way: faces weren't cut out cleanly; characters looked bad and "superimposed"; **characters had no legs**; monsters didn't look like monsters (the dragon looked human); there were no real fights; the audio was **robotic**; the cinematic "didn't look like real Minecraft."
13. Decision: **make the game great first**, record videos later. Use a **natural neural voice**.
14. Keep improving the game: a real dragon, combat feedback, a quest with a goal, a **bow you can shoot**, a **dragon dive attack**, and fix **half‑built structures** in the world.
15. **Review the world** for rendering problems (transparent sides / blocks not fully built).
16. Then: **make the gameplay videos** (real gameplay highlights, male Indian‑English neural voice).
17. Now: **honest product documentation** (this document).

---

## 3. What is actually built and working (the game)

The game is genuine and functional. It is a single‑codebase WebGL engine written without any game libraries.

### 3.1 Engine and world
- **Custom WebGL voxel engine** — no Three.js, no frameworks. Hand‑written shaders, mesher, and chunk system.
- **Chunked, streaming, near‑infinite world** — 16×16 columns, world height 72, sea level 30. Chunks generate and mesh on demand around the player and unload when far. Frustum culling.
- **Per‑chunk greedy‑ish meshing** with correct cross‑chunk face culling (neighbors are generated before meshing so block edges are seamless).
- **Lighting** — per‑chunk skylight + block‑light flood fill, sampled per face, with an ambient floor so nothing is pure black.
- **Shape‑aware mesher** — full cubes plus slabs, stairs, fences, panes, doors, ladders, cross‑plants, and beds, driven by per‑block metadata.
- **Biomes** — plains, forest, desert, snow, mountains, generated from layered value noise.
- **Caves** (3D noise), **ores** (coal, iron, gold, diamond, emerald) with depth‑based distribution, **trees** that generate correctly across chunk boundaries (no clipped canopies), and **buried treasure chambers** (gold + chest + glowstone).

### 3.2 Survival systems
- **Modes:** Survival and Creative. **Difficulty:** Peaceful, Easy, Normal, Hard (affects mob spawns, damage, hunger).
- **Inventory** (36 slots) + **hotbar** (9), click‑to‑move UI.
- **Crafting** — 50+ recipes; some require a crafting table or furnace nearby.
- **Tools and tiers** — wood → stone → iron → diamond, plus hoes; **weapons** including swords across all tiers, a **Hero Sword**, **Emerald Blade**, **Star Shard**, and a **bow with real arrows**.
- **Smelting** (furnace), **storage** (chests), **sleeping** (beds), **farming** (wheat, carrots, potatoes, sugar cane, bone meal growth), **animals** (pigs, cows, sheep, chickens) with breeding and drops.
- **Health, hunger, day/night cycle, autosave.**

### 3.3 Blocks and items (content breadth)
- **~60 block types** — terrain, a full building set (slabs, stairs, fences, panes, doors, ladders), functional blocks (crafting table, furnace, chest, bed, torch, lantern, glowstone), and decorative blocks (pumpkin, hay bale, TNT, obsidian, slime block, quartz), plus plants and flowers.
- **Expanded item set** — tools/weapons, a large food list (bread, cake, cookie, pumpkin pie, mushroom stew, golden carrot, honey, cooked meats/fish, enchanted apple), materials (slimeball, dragon scale, magic crystal, string, gunpowder, clay, paper, book, sugar), and quest/collectible items (Adyah's Compass, Treasure Map, Golden Crown, Dragon Egg, Star Shard).

### 3.4 Characters (the personal heart of the game)
- **The family appears in‑game** — Adyah, Mom, Dad, and Aarav are rendered from their **real photos**. Faces are extracted with OpenCV Haar‑cascade detection and a tight, background‑free crop, then mapped onto the front of a **3D blocky villager model** (head with the photo face, torso in a colored robe, arms, and **walking legs**). Multiple variants per person use multiple photos.
- **Classic Minecraft villagers** — big‑nose, brown‑robe NPCs, also full 3D blocky models, mixed into the village.
- **Monsters as distinct 3D models** — a four‑legged **winged dragon** with horns and a snout, a low **eight‑legged spider**, a slim big‑headed **alien**, a horned **demon**, a bulky **ogre**, and a crowned **slime king**. Each is a real blocky model (not a flat image), with its designed face.
- **Funny idle animation** — characters hop, bob, and wave a bit so the village feels alive.
- **First‑person held weapon** — your selected sword/tool/bow renders in the bottom‑right of the 3D view and swings when you attack (this is drawn into the 3D canvas, so it also appears in recordings).

### 3.5 Combat and the boss
- **Melee** — sword swing animation, a crosshair **hitmarker**, floating **damage numbers**, and knockback.
- **Bow** — fires real **arrow projectiles** that arc, stick into terrain, and damage monsters; consumes arrows.
- **Monsters with distinct attacks** — the spider **webs/slows** you on hit, the alien fires **energy bolts**, the demon throws **fireballs**, and the dragon **breathes fire**.
- **Dragon boss** — it **flies/hovers**, **breathes fireballs**, and periodically **dive‑bombs** you, with a **boss health bar** at the top of the screen and **loot drops** (dragon scale, dragon egg, gold) on defeat.

### 3.6 Story / progression
- **Quest chain with a real goal:** ① Meet the Village (talk to Mom, Dad, Aarav) → ② Arm Yourself (get a sword) → ③ Clear the Webs (defeat 3 spiders) → ④ Defend the Village (defeat the dragon). Each step shows progress, gives a reward, and announces the next quest. Finishing all of them makes Adyah "a legend."
- **Villager dialogue** — right‑click family or villagers for story lines ("Take this, beta — go show that dragon who's boss!").
- A written **story bible** also exists (four character‑themed episodes plus a cinematic quest, "Adyah and the Star Blade") for the video side.

### 3.7 Desktop / persistence
- **Electron desktop app** (`main.js`, `preload.js`) with IPC save/load to the OS user‑data folder — real on‑disk saves (seed + edit‑delta + block entities), with autosave.
- **Launchers:** `Play-minecrAft.command` (Mac) and `Play-minecrAft.bat` (Windows) install dependencies and start the app; `src/serve.command` serves the browser version at `http://localhost:8123`.
- **Fully offline** — no network calls required to play.

---

## 4. How to run it

**Browser (quickest):**
1. Open a terminal in `minecraAft/src` and run `serve.command` (or `python3 -m http.server 8123`).
2. Open `http://localhost:8123/index.html`.
3. Click **New World** (or **Continue**).

**Desktop app (the "real game"):**
- **Mac:** double‑click `Play-minecrAft.command`.
- **Windows:** double‑click `Play-minecrAft.bat`.
- First run installs the Electron engine; after that it launches directly.

**Controls:** WASD move, Space jump, Shift sprint/down, Mouse look, Left‑click mine/attack (or shoot with bow), Right‑click place/use/talk, E inventory, 1–9 hotbar, F fly (creative), Esc pause.

---

## 5. Project structure

```
minecraAft/
├─ src/
│  ├─ index.html        # game shell + HUD
│  ├─ styles.css        # UI styling
│  ├─ game.js           # the entire engine + game (single file)
│  ├─ characters.js     # family/monster character art (embedded, base64)
│  ├─ photos.js         # embedded family photo textures
│  └─ serve.command     # local web server for browser play
├─ main.js, preload.js  # Electron desktop wrapper (real on-disk saves)
├─ package.json
├─ Play-minecrAft.command / .bat   # one-click launchers
├─ assets/characters/   # rendered character art + roster preview
├─ pics/                # the family photos (dad/mom/aarav/adyah)
└─ videos/              # story scripts, audio (music/SFX/voiceover), work-in-progress
```

The whole game logic lives in `src/game.js` as requested ("keep all code in the same folder"). Assets (faces, character art, music, voice) are generated and embedded so the game runs offline with no external files.

---

## 6. The personalization pipeline (how the family got into the game)

1. Photos in `pics/` are scanned with **OpenCV** face detection.
2. The best, largest face per person is **tightly cropped** with a soft mask so there is **no background** — this directly fixed your repeated, valid complaint that early faces had backgrounds and looked pasted on.
3. Faces are composited onto **3D blocky villager models** (the fix for "characters have no legs / look superimposed").
4. Monsters are **designed** as their own blocky creatures rather than faces on random shapes (the fix for "characters look like shit / dragon looks human").

---

## 7. Honest development history

This project went through a lot of rework, and several deliverables were rejected before they were right. That is worth recording honestly:

- **Characters** were redone roughly four times: oval faces with backgrounds → background‑removed cutouts → "villagers + designed monsters" → finally **full 3D blocky models with legs**. Each round was driven by direct, correct feedback that the previous version looked bad. The final character system is good.
- **The world** had two real bugs that were found and fixed: trees were **clipped at chunk boundaries** ("half‑built structures"), and **leaves rendered see‑through** ("transparent sides"). Both are fixed — trees now generate across chunks and foliage is solid.
- **Combat and bosses** were built up incrementally (hit feedback, distinct monster attacks, bow, flying/fire/dive dragon, boss bar, loot) — this part went well.

The honest summary: **the game itself is in good shape.** It does what was asked, it's personal, and it's a real installable game with saves.

---

## 8. The videos — the honest part

This is where the product has **not** met your bar, and I'm not going to pretend otherwise.

**What was asked:** YouTube/streamer‑quality videos with real expressions, a natural voice, the family as characters, a story, and gameplay that matches the narration — good enough to surprise Adyah.

**What actually happened:**
- Multiple complete video attempts were produced and **you rejected them, correctly.** Early versions had flat card‑like characters, a dragon that looked human, no visible weapon, monsters that didn't read, "fights" that were just the camera shaking, action that didn't match the narration, and a **robotic** Google‑TTS voice.
- The root causes were real and technical:
  - **The recording can only capture the game's 3D canvas, not the HTML interface.** So health bars, the boss bar, damage numbers, the quest tracker, and the hotbar do **not** appear in raw captures. (This is why a first‑person weapon model was later drawn *into* the 3D canvas — so at least the sword shows in recordings.)
  - **Cinematic, beat‑perfect gameplay is hard to puppeteer** through browser automation. The autonomous "director" drifted (characters wandered into frame; the player walked into water), which read as amateurish.
  - **Free TTS sounded robotic.** This is now fixed: a **Microsoft neural Indian‑English voice** (male "Prabhat", per your choice) is set up and the gameplay narration is already generated with it. Two samples are in `videos/audio/`.

**Where the video stands right now:**
- The pieces exist: a reliable 1280×720 canvas recorder, the neural voice, music, sound effects, and a gameplay‑highlights director (explore → sword fight → bow → flying/fire‑breathing/dive‑bombing dragon boss → victory) on a clean forest‑clearing arena.
- The most recent recording attempt was **interrupted by the Chrome extension disconnecting**, so the final gameplay video is **not yet rendered**.
- Realistically, the video will look like an **edited gameplay highlight reel** of the (now much‑improved) game with neural commentary, music, sound effects, captions, and a composited boss bar — not a Hollywood cinematic. That is the honest ceiling of what this capture method can produce, and it should be genuinely good now that the game looks right.

**Bottom line on videos:** in progress, fixable, not done. The earlier "delivered" claims were over‑optimistic; the truth is they were redone repeatedly and the final one still needs to be recorded and edited.

---

## 9. Known limitations and honest caveats

- **Video capture omits the HTML HUD** — by design of the capture method; HUD elements other than the in‑canvas weapon must be re‑added in editing.
- **No generated village buildings** — villagers exist, but houses/structures are staged for scenes, not procedurally generated in the world. A future addition.
- **Monster models are stylized blocky approximations**, not high‑detail art.
- **A long‑lived test save inflated mob HP** via a large in‑game "day" counter (cosmetic balance quirk in that one save; a New World is balanced).
- **The top‑left readout can lag** when the browser tab is unfocused/throttled (cosmetic; fine on a focused machine).
- **Performance** is single‑threaded JS/WebGL — smooth at the intended render distance, not tuned for extreme view distances.
- **Cross‑platform installers** (`.dmg` / `.exe`) are **not** built yet; the game runs via the one‑click launchers and Electron, which is functional but not a signed installer.

---

## 10. Remaining work (suggested, honest priorities)

1. **Finish one gameplay‑highlights video** with the neural voice — record, then edit (voice + music + SFX + captions + boss‑bar overlay). This is the nearest unfinished promise.
2. **Package real installers** (`.dmg` for Mac, `.exe` for Windows) so Adyah can double‑click to play — closing the original "real game on Windows and Mac" goal.
3. **A final QA playthrough** start‑to‑finish to catch any rough edges before it's handed to Adyah.
4. Optional content: village houses, a second boss (Slime King), more quests.

---

## 11. Honest verdict

- **The game:** real, personal, playable, and good. It meets the spirit of the request — a genuine offline Minecraft‑style game with Adyah and his family in it, a story to play through, and a boss to beat.
- **The videos:** the weakest part of the project. They were attempted several times, rightly rejected, and are still unfinished. The blockers were genuine (capture limits, automation difficulty, robotic TTS); the TTS and visual issues are now largely solved, and a final, honestly‑"good‑gameplay‑reel" video is the last mile.
- **The gift:** as a **playable game**, it's ready to put in front of Adyah today. As a **YouTube video**, it needs one more focused pass to be something you'd be proud to upload.
