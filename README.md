# minecrAft 🌍

A Minecraft-style voxel survival game. Fully offline desktop app (Electron) for
Windows and macOS. Rebuilt from the ground up on a modular Three.js engine.

## Engine highlights

- **Infinite terrain** — chunked streaming world: plains, forests, birch forests,
  deserts, taiga, snowy plains, mountains, oceans & beaches
- **Caves & ores** — 3D-noise cave systems, lava lakes, coal/iron/gold/redstone/diamond
  veins distributed by depth
- **Real lighting engine** — flood-fill skylight + block light (torches, glowstone,
  lava light up caves), smooth per-vertex lighting with ambient occlusion
- **Day/night cycle** — sun, moon, stars, drifting clouds, sunrise/sunset sky, fog
- **Full survival loop** — health, hunger, drowning, fall damage; inventory with
  drag & drop, 2×2 + 3×3 crafting, furnace smelting, chests
- **Tools that matter** — wood/stone/iron/gold/diamond tiers, durability, correct
  mining speeds and harvest rules
- **Mobs** — zombies, skeletons (with arrows), creepers (they explode), spiders,
  pigs, cows, sheep, chickens; drops, item entities with magnet pickup
- **Feel** — block-crack overlay, particles, procedural sound effects, head bob,
  sprint FOV, first-person held item with swing animation
- **Four game modes** — ⚔️ Survival, 🎨 Creative (fly, endless block palette,
  invulnerable), 🗺️ Adventure (quest-focused, adventures come twice as fast) and
  👻 Spectator (noclip through everything, invisible to mobs). Pick at world
  start, switch anytime with **M**
- **Endless adventures** — levelled random quests that escalate forever: ambushes,
  bounties, guard duty, egg hunts, monster waves, titan bosses; themed storylines,
  named villains, scaling loot & XP — all logged in Adyah's **Book of
  Adventures** (**J**)
- **A bigger world of creatures** — mummies, witches, pirates, ice golems, shadow
  cats, lava hounds, crystal slimes, the Skeleton King & Ghost Captain bosses;
  plus rabbits, foxes, deer, cats and wolf pups; villagers in varied family
  outfits who hop and look around

Everything (textures, sounds, mob skins) is generated procedurally at startup —
no asset downloads, 100% offline.

## Run it

```bash
npm install   # one-time
npm start
```

Build installers: `npm run dist:mac` / `npm run dist:win` → `dist/`

## How to play

| Key | Action |
|-----|--------|
| **W A S D** | Move (double-tap W or Ctrl to sprint) |
| **Mouse** | Look · **Left click (hold)** mine / attack · **Right click** place / use / eat |
| **Space** | Jump / swim up |
| **Shift** | Sneak |
| **1–9 / scroll** | Hotbar |
| **E** | Inventory + 2×2 crafting |
| **Q** | Drop item |
| **F** | Toggle fly (Creative / Spectator) |
| **M** | Game mode switcher |
| **J** | Book of Adventures (quest journal) |
| **G** | Start a random adventure now |
| **F3** | Debug overlay |
| **Esc** | Pause (auto-saves) |

Survival basics: punch a tree → planks → crafting table → wooden pickaxe →
cobblestone → stone tools → furnace → mine iron → iron tools → find diamonds.
Torches keep monsters from spawning. Watch out at night.

## Saves

World seed + your edits + inventory save automatically (every 20 s and on quit):

- **macOS:** `~/Library/Application Support/minecraaft/saves/`
- **Windows:** `%APPDATA%\minecraaft\saves\`

`Game → New World` starts fresh (a backup is kept).

## Project layout

```
minecraAft/
├── main.js              Electron main process (window, menu, save files)
├── preload.js           Safe IPC bridge
└── src/
    ├── index.html       Shell + HUD containers
    ├── styles.css       UI styling
    ├── vendor/three.module.js
    └── js/
        ├── main.js      Game loop: input, mining, combat, furnaces, saving
        ├── gamemode.js  Survival/Creative/Adventure/Spectator rules
        ├── quests.js    Story + endless levelled adventure generator, journal
        ├── progression.js  XP, levels, perks
        ├── achievements.js Milestone toasts
        ├── world.js     Chunk store + flood-fill lighting engine
        ├── worldgen.js  Biomes, terrain, caves, ores, trees
        ├── mesher.js    Chunk meshing: smooth light + ambient occlusion
        ├── renderer.js  Scene, shaders, chunk streaming pipeline
        ├── sky.js       Day/night: sun, moon, stars, clouds
        ├── blocks.js    Block registry + procedural texture atlas
        ├── items.js     Items, tools, recipes, smelting, mining math
        ├── entities.js  Mob models, AI, item drops, arrows
        ├── player.js    Movement, swimming, health/hunger
        ├── physics.js   AABB voxel collision
        ├── particles.js Block-break / explosion particles
        ├── audio.js     Procedural WebAudio sound effects
        ├── ui.js        Hotbar, hearts, inventory, crafting, furnace, chest
        └── noise.js     Seeded simplex + value noise
```
