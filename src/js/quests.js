// quests.js — Adyah's adventure, a multi-chapter story that gives the game goals.
//   Ch.1 "The Lost Brother": talk to Mom -> find the Star Blade -> beat the
//        monster -> rescue Aarav.
//   Ch.2 "Hidden Treasures": find Dad's 3 buried treasure chests (loot!).
//   Ch.3 "The Dragon": defeat the dragon with the Star Blade for the finale.
// A compass HUD always points the way and boss fights show a health bar.
// After the story: an ENDLESS adventure engine — escalating levels, themed
// stories, named villains, a keepsake journal (press J).
"use strict";
import { B } from './blocks.js';
import { ENEMY_IDS, enemiesByTier, enemyKind, enemyName } from './entities.js';
import { gameMode } from './gamemode.js';
import { reportAdventure } from './achievements.js';

const TALK_MOM = 0, FIND_BLADE = 1, BEAT_BOSS = 2, TALK_AARAV = 3,
      TREASURE = 4, BEAT_DRAGON = 5, DONE = 6;

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

// ---- endless adventure content: 16 templates × themed story pools × enemies ----
// Each run draws a fresh template + storyline + a named villain + level-scaled
// enemies, so no two adventures feel the same — and they escalate forever.
const ADVENTURES = [
  { id: 'hunt',      title: 'Monster Hunt',      kind: 'boss',      tier: 'boss' },
  { id: 'horde',     title: 'The Horde',         kind: 'horde',     tier: 'small', count: 5 },
  { id: 'warband',   title: 'The Warband',       kind: 'horde',     tier: 'mid',   count: 4 },
  { id: 'treasure',  title: 'Lost Treasure',     kind: 'treasure' },
  { id: 'trail',     title: 'Treasure Trail',    kind: 'treasures3' },
  { id: 'rescue',    title: 'The Rescue',        kind: 'rescue',    tier: 'mid',   count: 2 },
  { id: 'overlord',  title: 'The Overlord',      kind: 'overlord',  tier: 'small', count: 3 },
  { id: 'siege',     title: 'Defend the Land',   kind: 'survive',   tier: 'small', duration: 28 },
  { id: 'gauntlet',  title: 'The Gauntlet',      kind: 'gauntlet',  tier: 'mid',   count: 3 },
  { id: 'beastpack', title: 'Beast Pack',        kind: 'horde',     enemyKind: 'beast', count: 4 },
  { id: 'ambush',    title: 'The Ambush',        kind: 'ambush',    tier: 'small', count: 4 },
  { id: 'bounty',    title: 'The Bounty',        kind: 'bounty',    tier: 'elite', count: 3 },
  { id: 'caravan',   title: 'Guard Duty',        kind: 'caravan',   tier: 'small', duration: 25 },
  { id: 'eggs',      title: 'The Dragon Eggs',   kind: 'eggs' },
  { id: 'nightmare', title: 'Nightmare Waves',   kind: 'waves',     tier: 'small' },
  { id: 'titan',     title: 'The Titan',         kind: 'titan',     tier: 'boss' }
];

// themed, per-kind story pools (kid-friendly, with family flavor)
const STORY_POOLS = {
  boss: [
    "A giant shadow stomped past the village at dawn…",
    "Mom spotted a HUGE monster napping on the hill!",
    "Aarav dared you: 'Bet you can't beat the big one!'",
    "The ground shakes with every step of a mighty beast.",
    "A single roar rattled every window in the house.",
    "Dad says only the bravest hero can face this one — that's you!"
  ],
  horde: [
    "A whole gang of monsters is marching this way!",
    "Aarav counted the shadows on the hill — too many to count!",
    "Little footprints, lots of them, circle the village.",
    "Mom heard a rowdy monster party beyond the trees.",
    "A scout ran in shouting: 'They're coming in a bunch!'",
    "The birds scattered — a pack of troublemakers is near."
  ],
  overlord: [
    "A bossy monster gathered minions and crowned itself!",
    "Someone built a throne of sticks on the ridge — uh oh.",
    "Dad laughed: 'A monster king? Go un-crown it, Adyah!'",
    "The minions bow to a very grumpy leader nearby.",
    "A crown-shaped shadow looms over the valley.",
    "Even the minions look tired of their loud overlord."
  ],
  treasure: [
    "An old map fell from the sky with an X on it.",
    "The ground glitters where a chest may lie buried.",
    "Dad whispered: 'I hid something shiny out there…'",
    "A magic chest is said to appear for the brave.",
    "A dropped coin pouch hints at hidden loot.",
    "Treasure hunters whisper of riches buried nearby."
  ],
  treasures3: [
    "Three sparkles winked from three far-away hills!",
    "Mom found a map with not one, not two — THREE X's!",
    "A glittering trail splits three ways. Follow them all!",
    "Aarav swears he buried three surprises… somewhere.",
    "Three magpies each flew off with something shiny.",
    "An old riddle says: 'Three chests for three cheers!'"
  ],
  rescue: [
    "A friendly villager got cornered by monsters — help!",
    "Someone's calling for help beyond the hills!",
    "Aarav's friend wandered too far and needs a hero.",
    "Mom packed a snack for the scared traveler — go save them first!",
    "A villager climbed a rock to hide. Monsters wait below.",
    "Help! A kind traveler is surrounded and needs Adyah!"
  ],
  survive: [
    "The village bell rang — danger is coming in waves!",
    "Batten down! Monsters are charging the meadow!",
    "Dad grabbed his shovel: 'Hold the line with me, Adyah!'",
    "A storm of little monsters is rolling toward home.",
    "Stand your ground — help arrives when the dust settles!",
    "The scouts yell: 'Incoming! Keep them back!'"
  ],
  gauntlet: [
    "A line of challengers wants to test the hero of the land!",
    "One by one, they come — meet each challenger head-on!",
    "The monsters formed an orderly queue. How polite. How doomed.",
    "A tournament of troublemakers has begun — you're the champion!",
    "Aarav made popcorn: 'Beat them one at a time, Adyah!'",
    "Each foe is tougher than the last. Ready?"
  ],
  ambush: [
    "It's a trap! They were hiding behind the rocks!",
    "Rustle rustle — the bushes are FULL of monsters!",
    "They snuck up close while you weren't looking!",
    "Surprise! The sneaky ones picked the wrong hero to ambush.",
    "Mom always says: stay alert! Good thing you are.",
    "Twigs snap all around — they're already here!"
  ],
  bounty: [
    "A wanted poster flutters on the village board!",
    "The elders put a bounty on a notorious troublemaker.",
    "Dad read the poster aloud: 'Reward for the brave!'",
    "That rascal stole the village's picnic basket — unforgivable!",
    "A villain and its bodyguards are hiding out nearby.",
    "The poster sketch is terrifying… and a little silly."
  ],
  caravan: [
    "A traveler must cross the wilds — be their shield!",
    "Aarav's pen-pal is visiting and monsters smell snacks.",
    "Keep the kind traveler safe until the coast is clear!",
    "Mom asked you to walk a friend through the scary part.",
    "A villager clutches a package: 'Please stand guard!'",
    "Guard duty! The bravest job there is."
  ],
  eggs: [
    "Dragon eggs scattered across the land — find them all!",
    "Three warm, glowing eggs rolled off into the wild!",
    "A mother dragon sniffles: her eggs bounced away!",
    "Eggs that sparkle like stars are hidden out there.",
    "Aarav found ONE eggshell — the rest are still out there!",
    "Follow the warm glow — the eggs are waiting."
  ],
  waves: [
    "The nightmare horns sound — three waves are coming!",
    "First the small ones, then the big ones… brace yourself!",
    "A rumble, a bigger rumble, a BIGGEST rumble. Three waves!",
    "The scouts count three banners on the horizon.",
    "Hold strong — each wave is braver than the last!",
    "Mom lit the beacon: 'Waves incoming — you've got this!'"
  ],
  titan: [
    "Something ENORMOUS just blotted out the sun…",
    "A titan awoke and brought little helpers along.",
    "The biggest footprint you've ever seen. And it's fresh.",
    "Even the mountains seem small next to this one.",
    "Dad gulped: 'That's… a big one. Go get 'em, Adyah!'",
    "A titan strides the land — heroes wanted, hero found!"
  ],
  any: [
    "A shadow fell over the village last night…",
    "Bright eyes were seen glowing in the dark woods.",
    "A cold wind carries the smell of trouble.",
    "The village elders ask for Adyah's courage again.",
    "An ancient foe has awoken from its slumber.",
    "Adventure calls — and only you can answer it!"
  ]
};

// villain name generator: "Grumblor the Goblin King", "Snarglepop the Silly"…
const V_A = ['Grum', 'Snar', 'Zog', 'Mor', 'Blit', 'Krag', 'Fizz', 'Gloom', 'Thud', 'Wob', 'Bram', 'Snik'];
const V_B = ['blor', 'gle', 'nax', 'doom', 'wick', 'bash', 'pop', 'fang', 'snout', 'grim', 'zap', 'tooth'];
const V_T = ['the Grumpy', 'the Sneaky', 'the Enormous', 'the Mighty', 'the Silly', 'the Shadowy', 'the Greedy', 'the Clumsy', 'the Loud', 'the Sleepy'];
function villainName(enemyId) {
  const base = V_A[(Math.random() * V_A.length) | 0] + V_B[(Math.random() * V_B.length) | 0];
  if (enemyId && Math.random() < 0.4) return `${base} the ${enemyName(enemyId)} King`;
  return `${base} ${V_T[(Math.random() * V_T.length) | 0]}`;
}

// level-scaled loot tables (existing item ids only)
const LOOT_TABLES = {
  common: [
    [{ id: 'apple', count: 4 }, { id: 'iron_ingot', count: 3 }],
    [{ id: 'coal', count: 6 }, { id: 'steak', count: 2 }],
    [{ id: 'gold_ingot', count: 3 }, { id: 'apple', count: 3 }],
    [{ id: 'iron_ingot', count: 4 }, { id: 'string', count: 3 }]
  ],
  rare: [
    [{ id: 'diamond', count: 2 }, { id: 'gold_ingot', count: 5 }],
    [{ id: 'iron_ingot', count: 8 }, { id: 'steak', count: 4 }],
    [{ id: 'diamond', count: 3 }, { id: 'apple', count: 5 }],
    [{ id: 'gold_ingot', count: 8 }, { id: 'redstone', count: 6 }]
  ],
  epic: [
    [{ id: 'diamond', count: 5 }, { id: 'steak', count: 6 }],
    [{ id: 'diamond', count: 4 }, { id: 'diamond_sword', count: 1 }],
    [{ id: 'diamond', count: 6 }, { id: 'gold_ingot', count: 10 }],
    [{ id: 'diamond_pickaxe', count: 1 }, { id: 'diamond', count: 3 }]
  ]
};

const KIND_ICONS = { boss: '👹', horde: '⚔️', overlord: '👑', treasure: '💰', treasures3: '🗺️', rescue: '🛟', survive: '🛡️', gauntlet: '🥊', ambush: '😱', bounty: '📜', caravan: '🚶', eggs: '🥚', waves: '🌊', titan: '🗿' };
const TIERS = ['small', 'mid', 'elite', 'boss'];

// draw-without-replacement bag so picks don't repeat until the pool empties
function bagDraw(bag, items) {
  if (bag.length === 0) {
    bag.push(...items.map((_, i) => i));
    for (let i = bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  return bag.pop();
}

// treasure chest locations (offsets from spawn) + the loot inside each
const T_OFFS = [{ x: 38, z: 30 }, { x: -44, z: -12 }, { x: 16, z: -50 }];
const T_LOOT = [
  [{ id: 'diamond', count: 4 }, { id: 'apple', count: 6 }, { id: 'iron_ingot', count: 8 }],
  [{ id: 'gold_ingot', count: 10 }, { id: 'diamond_pickaxe', count: 1 }, { id: 'coal', count: 12 }],
  [{ id: 'diamond', count: 6 }, { id: 'diamond_sword', count: 1 }, { id: 'steak', count: 6 }]
];

export class Quests {
  constructor({ player, entities, ui, world, audio, progression, lockPointer }) {
    this.player = player; this.entities = entities; this.ui = ui;
    this.world = world; this.audio = audio; this.progression = progression;
    this.lockPointer = lockPointer || (() => {});
    this.step = TALK_MOM;
    this.started = false;
    this.origin = { x: 0, z: 0 };
    this.opened = new Set();   // treasure keys already collected
    this._tpos = null;         // cached treasure positions [{x,y,z,key,i}]
    // endless, never-repeating mini-adventures after the main story is done
    this.adv = null;           // active adventure object, or null
    this.repeatTimer = 0;      // seconds until the next adventure appears
    this.repeatCount = 0;      // adventures started so far → level = 1 + repeatCount
    this.advDone = 0;          // adventures completed (all time)
    this.journal = [];         // keepsake log: {title, level, kind, result, xp}
    this._advBag = [];         // shuffle bags so templates/stories don't repeat
    this._storyBags = {};      // one bag per story pool
    this._dialogOpen = false;
    this._journalOpen = false;
    this._buildDom();
  }

  // ---- positions, anchored to spawn so they're always reachable ----
  _off(o) { return { x: Math.round(this.origin.x + o.x), z: Math.round(this.origin.z + o.z) }; }
  get momPos() { return this._off({ x: 9, z: 7 }); }
  get bladePos() { return this._off({ x: 44, z: -16 }); }
  get bossPos() { return this._off({ x: -24, z: 46 }); }
  get aaravPos() { return this._off({ x: -20, z: 49 }); }
  get dragonPos() { return this._off({ x: 62, z: -38 }); }

  // generate terrain around a target (distant chunks aren't loaded), return a
  // safe standing height on top of the ground.
  _ground(x, z) {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.world.ensureChunk(cx + dx, cz + dz);
    return this.world.surfaceY(x, z) + 1;
  }

  // ---- lifecycle ----
  init(spawn) {
    this.origin = { x: spawn.x, z: spawn.z };
    this.step = TALK_MOM;
    this.started = false;
    this.opened = new Set();
    this._spawnMom();
    this._refreshHud();
  }

  resume() {
    if (this.origin.x === 0 && this.origin.z === 0) this.origin = { x: this.player.spawn.x, z: this.player.spawn.z };
    if (this.step === TALK_MOM) this._spawnMom();
    else if (this.step === FIND_BLADE) this._ensureBlade();
    else if (this.step === BEAT_BOSS) { this._ensureBlade(false); this._spawnBossAndAarav(); }
    else if (this.step === TALK_AARAV) this._spawnAarav();
    else if (this.step === TREASURE) this._placeTreasures();
    else if (this.step === BEAT_DRAGON) this._spawnDragon();
    else if (this.step === DONE) {   // resume endless mode (keep a saved timer if present)
      this.adv = null;
      if (!(this.repeatTimer > 0)) this.repeatTimer = 40 * gameMode.adventureCadence();
    }
    this._refreshHud();
  }

  // ---- spawners ----
  _spawnMom() {
    if (this.entities.findQuestMob('mom')) return;
    const p = this.momPos, y = this._ground(p.x, p.z);
    this.entities.spawnMob('villager', p.x + 0.5, y, p.z + 0.5, { who: 'mom', quest: 'mom' });
  }
  _ensureBlade(drop = true) {
    const has = this.entities.items.some(it => it.stack && it.stack.id === 'star_blade')
      || this.ui.inv.some(s => s && s.id === 'star_blade');
    if (!has && drop) {
      const p = this.bladePos, y = this._ground(p.x, p.z);
      this.entities.dropItem({ id: 'star_blade', count: 1 }, p.x + 0.5, y + 0.3, p.z + 0.5, { x: 0, y: 0, z: 0 });
    }
  }
  _spawnBossAndAarav() {
    if (!this.entities.findQuestMob('boss')) {
      const b = this.bossPos, y = this._ground(b.x, b.z);
      this.entities.spawnMob('boss', b.x + 0.5, y, b.z + 0.5, { monster: 'ogre', quest: 'boss' });
    }
    this._spawnAarav();
  }
  _spawnAarav() {
    if (this.entities.findQuestMob('aarav')) return;
    const a = this.aaravPos, y = this._ground(a.x, a.z);
    this.entities.spawnMob('villager', a.x + 0.5, y, a.z + 0.5, { who: 'aarav', quest: 'aarav' });
  }
  _spawnDragon() {
    if (this.entities.findQuestMob('dragon')) return;
    const d = this.dragonPos, y = this._ground(d.x, d.z);
    this.entities.spawnMob('dragon', d.x + 0.5, y, d.z + 0.5, { monster: 'dragon', quest: 'dragon' });
  }

  // place a visible chest marker at each not-yet-collected treasure spot
  _placeTreasures() {
    this._tpos = [];
    T_OFFS.forEach((o, i) => {
      const p = this._off(o), y = this._ground(p.x, p.z);
      const key = p.x + ',' + p.z;
      this._tpos.push({ x: p.x, y, z: p.z, key, i });
      if (!this.opened.has(key) && this.world.getBlock(p.x, y, p.z) !== B.CHEST) {
        this.world.setBlock(p.x, y, p.z, B.CHEST);
      }
    });
  }

  // ---- interactions ----
  talkTo(mob) {
    if (this._dialogOpen) return;
    const who = mob.who;
    if (who === 'mom') {
      if (this.step === TALK_MOM) {
        this._dialog('Mom', [
          "Adyah! Thank goodness you're here.",
          "Your little brother Aarav wandered off… and a grumpy monster stole the magic Star Blade!",
          "Please — find the Star Blade, defeat that monster, and bring Aarav safely home.",
          "Follow the compass at the top of your screen. Be brave! 💜"
        ], () => { this.step = FIND_BLADE; this.started = true; this._ensureBlade(); this._toast('New quest: The Lost Brother'); });
      } else {
        this._dialog('Mom', ["You're doing wonderfully, Adyah. Keep going! 💜"]);
      }
      return;
    }
    if (who === 'aarav') {
      if (this.step === TALK_AARAV) {
        this._dialog('Aarav', [
          "Adyah! You found me! 🥹 You beat that scary monster!",
          "Guess what — Dad buried THREE treasure chests for us to find!",
          "Follow the compass to dig them up. Let's go treasure hunting! 🗺️"
        ], () => this._startTreasure());
      } else {
        this._dialog('Aarav', ["Help, big brother! Beat the monster first — then I can come out!"]);
      }
      return;
    }
    this._dialog('Villager', ["Hello, Adyah! Lovely day to build something. 🙂"]);
  }

  onPickup(id) {
    if (id === 'star_blade' && this.step === FIND_BLADE) {
      this.audio.play('levelup');
      this._dialog('Star Blade', [
        "✨ You found the Star Blade! It hums with starlight.",
        "It's far stronger than any sword. Now go save Aarav!",
        "The compass will lead you to the monster."
      ], () => { this.step = BEAT_BOSS; this._spawnBossAndAarav(); });
    }
  }

  onMobKill(type) {
    if (type === 'boss' && this.step === BEAT_BOSS) {
      this.step = TALK_AARAV;
      this.audio.play('levelup');
      this._toast('💥 The monster is defeated! Go talk to Aarav.');
    } else if (type === 'dragon' && this.step === BEAT_DRAGON) {
      this._finale();
    }
    // endless-adventure kills are detected by polling in _tickAdventure
  }

  _startTreasure() {
    this.step = TREASURE;
    this._placeTreasures();
    this._toast('🗺️ New quest: find Dad\'s 3 hidden treasures!');
  }

  _startDragon() {
    this.step = BEAT_DRAGON;
    this._spawnDragon();
    this.audio.play('levelup');
    this._dialog('⚠️ A Dragon!', [
      "A huge dragon has appeared over the land! 🐉",
      "Only the Star Blade can defeat it. You can do this, Adyah!",
      "Follow the compass — and watch its health bar!"
    ]);
  }

  _finale() {
    this.step = DONE;
    if (this.progression && this.progression.addXp) this.progression.addXp(250);
    this.audio.play('levelup');
    this._dialog('🏆 Hero of the Land!', [
      "You did it, Adyah — the dragon is defeated! 🐉⚔️",
      "You found the Star Blade, rescued Aarav, and dug up Dad's treasures.",
      "Your whole family is so proud of you. Keep building your world! 🎉",
      "And keep your eyes open — new adventures will keep finding you! ✨"
    ]);
    // start the endless adventures (adventure mode skips straight to the action)
    this.repeatTimer = gameMode.is('adventure') ? 8 : 40 * gameMode.adventureCadence();
  }

  // ---- per-frame ----
  update(dt) {
    // treasure pickup by walking up to a chest
    if (this.step === TREASURE) this._checkTreasures();
    // tick endless adventures (after the story) or any debug-started one
    if (this.step === DONE || this.adv) this._updateRepeat(dt);

    const target = this._currentTarget();
    if (!target) { this.elHud.style.display = 'none'; return; }
    this.elHud.style.display = 'block';

    const px = this.player.pos.x, pz = this.player.pos.z;
    const dx = target.x - px, dz = target.z - pz;
    const dist = Math.hypot(dx, dz);
    let rel = Math.atan2(dx, -dz) + this.player.yaw;
    rel = ((rel % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const arrow = dist < 3 ? '📍' : ARROWS[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];

    let html = `<div class="q-obj">📜 ${this._objective()}</div>`;
    html += `<div class="q-nav">${arrow} <b>${target.name}</b> — ${Math.round(dist)}m</div>`;
    const bossMob = this.adv ? this._advBossMob()
      : this.step === BEAT_BOSS ? this.entities.findQuestMob('boss')
      : this.step === BEAT_DRAGON ? this.entities.findQuestMob('dragon')
      : null;
    if (bossMob) {
      const f = Math.max(0, bossMob.hp) / (bossMob.maxHp || 70);
      const label = this.step === BEAT_DRAGON ? 'Dragon' : enemyName(bossMob.type);
      html += `<div class="q-boss"><span>${label}</span><div class="q-bar"><i style="width:${Math.round(f * 100)}%"></i></div></div>`;
    }
    this.elHud.innerHTML = html;
  }

  // ================= endless, escalating adventures =================
  _updateRepeat(dt) {
    if (this.adv) { this._tickAdventure(dt); return; }
    if (this.step !== DONE) return;   // auto-spawn only in endless mode (post-story)
    // don't count down while the kid is still reading a dialog (e.g. the
    // finale celebration) — starting a new adventure would replace it mid-read
    if (this._dialogOpen || this._journalOpen) return;
    this.repeatTimer -= dt;
    if (this.repeatTimer <= 0) this._startAdventure();
  }

  // debug / on-demand: instantly start a fresh random adventure (bound to G)
  debugStartAdventure() {
    if (this._dialogOpen || this._journalOpen) return;
    if (this.origin.x === 0 && this.origin.z === 0) this.origin = { x: this.player.spawn.x, z: this.player.spawn.z };
    if (this.adv) this._finishAdventure();
    this._startAdventure();
  }

  _randSpot(minD, maxD) {
    const ang = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const x = Math.round(this.origin.x + Math.cos(ang) * d), z = Math.round(this.origin.z + Math.sin(ang) * d);
    return { x, z };
  }

  // ---- level scaling ----
  // higher levels upgrade tiers: 1-2 small, 3-5 mix in mid, 6-9 add elite,
  // 10+ occasionally sprinkle a boss into the mix.
  _levelTier(base, level) {
    if (base === 'boss') return 'boss';
    let t = Math.max(0, TIERS.indexOf(base));
    const r = Math.random();
    if (level >= 10 && r > 0.9) return 'boss';
    if (level >= 6 && r > 0.55) t = Math.max(t, r > 0.8 ? 2 : 1);
    else if (level >= 3 && r > 0.5) t = Math.max(t, 1);
    return TIERS[Math.min(t, 2)];
  }
  // ~+15% enemies per level, capped at 3× the template count
  _scaleCount(c, level) { return Math.max(1, Math.min(c * 3, Math.round(c * (1 + 0.15 * (level - 1))))); }

  _pickEnemies(tpl, n, level = 1) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const tier = tpl.tier ? this._levelTier(tpl.tier, level) : null;
      let pool;
      if (tpl.enemyKind) {
        pool = ENEMY_IDS.filter(id => enemyKind(id) === tpl.enemyKind);
        if (tier) { const tt = pool.filter(id => enemiesByTier(tier).includes(id)); if (tt.length) pool = tt; }
      } else if (tier) pool = enemiesByTier(tier);
      else pool = ENEMY_IDS;
      if (!pool || !pool.length) pool = ENEMY_IDS;
      out.push(pool[(Math.random() * pool.length) | 0]);
    }
    return out;
  }
  _spawnEnemy(id, spot, spread = 0) {
    const x = spot.x + (Math.random() - 0.5) * spread, z = spot.z + (Math.random() - 0.5) * spread;
    const y = this._ground(Math.round(x), Math.round(z));
    return this.entities.spawnMob(id, x + 0.5, y, z + 0.5, { quest: 'aenemy' });
  }
  _livingEnemies() { return this.entities.mobs.filter(m => m.quest === 'aenemy' && m.dying <= 0); }
  // clear any leftover adventure enemies / rescue villager between adventures
  _clearAdvEnemies() {
    for (const m of this.entities.mobs) {
      if (m.quest === 'aenemy' && m.dying <= 0) m.dying = 0.001;
      else if (m.quest === 'alost') m.quest = null;
    }
  }

  _startAdventure() {
    this._clearAdvEnemies();   // never carry stragglers into a new adventure
    const level = 1 + this.repeatCount;   // escalates forever
    this.repeatCount++;
    const tpl = ADVENTURES[bagDraw(this._advBag, ADVENTURES)];
    const pool = STORY_POOLS[tpl.kind] || STORY_POOLS.any;
    const bag = this._storyBags[tpl.kind] || (this._storyBags[tpl.kind] = []);
    const story = pool[bagDraw(bag, pool)];
    const spot = this._randSpot(40, 80);
    const adv = { tpl, story, kind: tpl.kind, level, pos: spot, spawned: 0, guardsCleared: false };
    const count = tpl.count ? this._scaleCount(tpl.count, level) : 0;

    if (tpl.kind === 'boss') {
      const id = this._pickEnemies({ tier: 'boss' }, 1)[0];
      adv.bossId = id; adv.bossName = villainName(id);
      this._spawnEnemy(id, spot); adv.spawned = 1;
    } else if (tpl.kind === 'horde' || tpl.kind === 'overlord') {
      const list = this._pickEnemies(tpl, count, level);
      for (const id of list) this._spawnEnemy(id, spot, 6);
      adv.spawned = list.length; adv.enemyName = enemyName(list[0]);
      if (tpl.kind === 'overlord') { const bid = this._pickEnemies({ tier: 'boss' }, 1)[0]; this._spawnEnemy(bid, spot); adv.spawned++; adv.bossName = villainName(bid); }
    } else if (tpl.kind === 'gauntlet') {
      adv.queue = this._pickEnemies(tpl, count, level);
      this._spawnEnemy(adv.queue.shift(), spot); adv.spawned = 1;
    } else if (tpl.kind === 'rescue') {
      const list = this._pickEnemies(tpl, count, level);
      for (const id of list) this._spawnEnemy(id, spot, 5);
      adv.spawned = list.length;
      const y = this._ground(spot.x, spot.z);
      this.entities.spawnMob('villager', spot.x + 0.5, y, spot.z + 0.5, { who: 'aarav', quest: 'alost' });
    } else if (tpl.kind === 'survive') {
      adv.surviveT = tpl.duration + Math.min(14, (level - 1) * 2); adv.waveT = 0;
    } else if (tpl.kind === 'treasures3') {
      adv.spots = [this._randSpot(35, 60), this._randSpot(45, 75), this._randSpot(55, 90)];
      adv.found = 0;
    } else if (tpl.kind === 'ambush') {
      // spring the trap right next to the player — already angry!
      const p = this.player.pos;
      adv.pos = { x: Math.round(p.x + (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 5)),
                  z: Math.round(p.z + (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 5)) };
      for (const id of this._pickEnemies(tpl, count, level)) { const m = this._spawnEnemy(id, adv.pos, 6); if (m) m.aggro = true; }
      adv.spawned = count;
    } else if (tpl.kind === 'bounty') {
      const bid = this._pickEnemies({ tier: 'elite' }, 1, level)[0];
      adv.villain = villainName(bid); adv.bossName = adv.villain;
      this._spawnEnemy(bid, spot);
      for (const id of this._pickEnemies({ tier: 'small' }, count, level)) this._spawnEnemy(id, spot, 6);
      adv.spawned = count + 1;
    } else if (tpl.kind === 'caravan') {
      adv.guardT = tpl.duration + Math.min(20, (level - 1) * 2); adv.waveT = 2;
      const y = this._ground(spot.x, spot.z);
      this.entities.spawnMob('villager', spot.x + 0.5, y, spot.z + 0.5, { who: 'aarav', quest: 'alost' });
    } else if (tpl.kind === 'eggs') {
      adv.spots = [this._randSpot(35, 60), this._randSpot(45, 75), this._randSpot(55, 90)];
      adv.found = 0;
    } else if (tpl.kind === 'waves') {
      adv.wave = 0;
      adv.waves = [
        { tier: 'small', count: this._scaleCount(3, level) },
        { tier: 'mid',   count: this._scaleCount(3, level) },
        { tier: 'elite', count: this._scaleCount(2, level) }
      ];
      this.adv = adv;   // _nextWave reads this.adv
      this._nextWave(false);
    } else if (tpl.kind === 'titan') {
      const bid = this._pickEnemies({ tier: 'boss' }, 1)[0];
      adv.villain = villainName(bid); adv.bossName = adv.villain;
      this._spawnEnemy(bid, spot);
      for (const id of this._pickEnemies({ tier: 'small' }, this._scaleCount(2, level), level)) this._spawnEnemy(id, spot, 5);
      adv.spawned = 3;
    }
    // treasure: nothing to spawn, just reach adv.pos

    // memorable, varied titles (named villains where it fits)
    adv.title = tpl.kind === 'bounty' ? `Wanted: ${adv.villain}`
      : tpl.kind === 'titan' ? `The Titan: ${adv.villain}`
      : tpl.kind === 'boss' ? `Monster Hunt: ${adv.bossName}`
      : tpl.kind === 'overlord' ? `The Overlord: ${adv.bossName}`
      : tpl.title;

    this.adv = adv;
    this.audio.play('levelup');
    this._dialog(`⚔️ Level ${level} Adventure: ${adv.title}`, [story, this._objective()]);
  }

  _nextWave(toast = true) {
    const a = this.adv;
    const w = a.waves[a.wave];
    a.wave++;
    for (const id of this._pickEnemies({ tier: w.tier }, w.count, a.level)) this._spawnEnemy(id, a.pos, 7);
    if (toast) { this._toast(`🌊 Wave ${a.wave}/${a.waves.length} — here they come!`); this.audio.play('levelup'); }
  }

  _tickAdventure(dt) {
    const a = this.adv, k = a.kind;
    // safety net: an adventure can never get permanently stuck (e.g. an enemy
    // pathed somewhere unreachable). After a generous time limit, award it.
    a.elapsed = (a.elapsed || 0) + dt;
    if (a.elapsed > 300) { this._toast('⏱️ Adventure complete — reward granted!'); return this._finishAdventure('timeout'); }
    if (k === 'treasure') {
      if (this._near(a.pos, 2.8)) return this._finishAdventure();
    } else if (k === 'treasures3' || k === 'eggs') {
      const s = a.spots[a.found];
      if (s && this._near(s, 2.8)) {
        a.found++;
        if (a.found >= a.spots.length) return this._finishAdventure();
        this._toast(k === 'eggs' ? `🥚 Dragon egg ${a.found}/${a.spots.length}!` : `🎁 Treasure ${a.found}/${a.spots.length}!`);
        this.audio.play('levelup');
      }
    } else if (k === 'survive') {
      a.surviveT -= dt; a.waveT -= dt;
      if (a.waveT <= 0 && a.surviveT > 3) { a.waveT = 6; for (const id of this._pickEnemies(a.tpl, 2, a.level)) this._spawnEnemy(id, a.pos, 8); }
      if (a.surviveT <= 0) { for (const m of this._livingEnemies()) m.dying = 0.001; return this._finishAdventure(); }
    } else if (k === 'caravan') {
      a.guardT -= dt; a.waveT -= dt;
      if (a.waveT <= 0 && a.guardT > 3) { a.waveT = 7; for (const id of this._pickEnemies(a.tpl, 2, a.level)) this._spawnEnemy(id, a.pos, 9); }
      if (a.guardT <= 0) { for (const m of this._livingEnemies()) m.dying = 0.001; return this._finishAdventure(); }
    } else if (k === 'gauntlet') {
      if (this._livingEnemies().length === 0) {
        if (a.queue.length) this._spawnEnemy(a.queue.shift(), this._near(a.pos, 30) ? { x: Math.round(this.player.pos.x + 6), z: Math.round(this.player.pos.z + 6) } : a.pos);
        else return this._finishAdventure();
      }
    } else if (k === 'rescue') {
      if (!a.guardsCleared && this._livingEnemies().length === 0) { a.guardsCleared = true; this._toast('🛡️ Guards defeated — reach your friend!'); }
      if (a.guardsCleared) { const v = this.entities.findQuestMob('alost'); if (v && this._nearPos(v.pos, 2.8)) return this._finishAdventure(); }
    } else if (k === 'waves') {
      if (this._livingEnemies().length === 0) {
        if (a.wave < a.waves.length) this._nextWave();
        else return this._finishAdventure();
      }
    } else { // boss / horde / overlord / ambush / bounty / titan
      if (this._livingEnemies().length === 0) return this._finishAdventure();
    }
  }

  _near(spot, r) { return Math.hypot(spot.x + 0.5 - this.player.pos.x, spot.z + 0.5 - this.player.pos.z) < r; }
  _nearPos(pos, r) { return Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) < r; }

  // level-scaled loot: common (lv 1-3) → rare (4-7) → epic (8+); fights get a bonus
  _advLoot(fight, level) {
    const key = level >= 8 ? 'epic' : level >= 4 ? 'rare' : 'common';
    const table = LOOT_TABLES[key];
    const loot = table[(Math.random() * table.length) | 0].map(s => ({ id: s.id, count: s.count }));
    if (fight && level >= 2) loot.push({ id: 'diamond', count: Math.min(8, 1 + Math.floor(level / 3)) });
    return loot;
  }

  _finishAdventure(result = 'won') {
    const a = this.adv;
    const level = a.level || 1;
    const fight = a.kind !== 'treasure' && a.kind !== 'treasures3' && a.kind !== 'eggs';
    const xp = fight ? 80 + level * 12 : 50 + level * 8;
    if (this.progression && this.progression.addXp) this.progression.addXp(xp);
    for (const l of this._advLoot(fight, level)) this.ui.addToInventory({ id: l.id, count: l.count });
    this._clearAdvEnemies();   // remove any stragglers + release rescue villager
    this.audio.play('levelup');
    this._toast(`🏅 ${a.title || a.tpl.title} complete! Reward earned.`);
    // write it into Adyah's Book of Adventures
    this.advDone++;
    this.journal.unshift({ title: a.title || a.tpl.title, level, kind: a.kind, result, xp });
    if (this.journal.length > 60) this.journal.length = 60;
    reportAdventure({ done: this.advDone, level, result });
    this.adv = null;
    this.repeatTimer = (45 + Math.random() * 35) * gameMode.adventureCadence();
  }

  _checkTreasures() {
    if (!this._tpos) this._placeTreasures();
    const px = this.player.pos.x, pz = this.player.pos.z;
    for (const t of this._tpos) {
      if (this.opened.has(t.key)) continue;
      if (Math.hypot(t.x + 0.5 - px, t.z + 0.5 - pz) < 2.6) {
        this.opened.add(t.key);
        if (this.world.getBlock(t.x, t.y, t.z) === B.CHEST) this.world.setBlock(t.x, t.y, t.z, B.AIR);
        for (const loot of T_LOOT[t.i]) this.ui.addToInventory({ id: loot.id, count: loot.count });
        if (this.entities.particles) this.entities.particles.burst(t.x + 0.5, t.y + 0.5, t.z + 0.5, 0xffe14d, 18);
        this.audio.play('levelup');
        this._toast(`🎁 Treasure found! (${this.opened.size}/3)`);
        if (this.opened.size >= T_OFFS.length) this._startDragon();
        break;
      }
    }
  }

  _currentTarget() {
    if (this.adv) return this._advTarget();
    switch (this.step) {
      case TALK_MOM: { const p = this.momPos; return { name: 'Mom', x: p.x, z: p.z }; }
      case FIND_BLADE: { const p = this.bladePos; return { name: 'Star Blade', x: p.x, z: p.z }; }
      case BEAT_BOSS: { const b = this.entities.findQuestMob('boss'); const p = b ? b.pos : this.bossPos; return { name: 'Monster', x: p.x, z: p.z }; }
      case TALK_AARAV: { const a = this.entities.findQuestMob('aarav'); const p = a ? a.pos : this.aaravPos; return { name: 'Aarav', x: p.x, z: p.z }; }
      case TREASURE: { const t = this._nearestTreasure(); return t ? { name: 'Treasure', x: t.x, z: t.z } : null; }
      case BEAT_DRAGON: { const d = this.entities.findQuestMob('dragon'); const p = d ? d.pos : this.dragonPos; return { name: 'Dragon', x: p.x, z: p.z }; }
      default: return this._advTarget();
    }
  }
  _advTarget() {
    const a = this.adv;
    if (!a) return null;
    if (a.kind === 'treasure') return { name: 'Treasure', x: a.pos.x, z: a.pos.z };
    if (a.kind === 'treasures3' || a.kind === 'eggs') { const s = a.spots[a.found] || a.pos; return { name: a.kind === 'eggs' ? 'Dragon Egg' : 'Treasure', x: s.x, z: s.z }; }
    if (a.kind === 'rescue' && a.guardsCleared) { const v = this.entities.findQuestMob('alost'); const p = v ? v.pos : a.pos; return { name: 'Friend', x: p.x, z: p.z }; }
    if (a.kind === 'caravan') { const v = this.entities.findQuestMob('alost'); const p = v ? v.pos : a.pos; return { name: 'Friend', x: p.x, z: p.z }; }
    const e = this._livingEnemies()[0];
    const p = e ? e.pos : a.pos;
    return { name: e ? enemyName(e.type) : 'Monster', x: p.x, z: p.z };
  }
  _advBossMob() {
    const a = this.adv;
    if (!a || !['boss', 'overlord', 'gauntlet', 'bounty', 'titan', 'waves'].includes(a.kind)) return null;
    let best = null;
    for (const m of this._livingEnemies()) if (!best || (m.maxHp || 0) > (best.maxHp || 0)) best = m;
    return best;
  }
  _nearestTreasure() {
    if (!this._tpos) this._placeTreasures();
    let best = null, bd = Infinity;
    for (const t of this._tpos) {
      if (this.opened.has(t.key)) continue;
      const dd = Math.hypot(t.x - this.player.pos.x, t.z - this.player.pos.z);
      if (dd < bd) { bd = dd; best = t; }
    }
    return best;
  }
  _objective() {
    if (this.adv) return this._advObjective();
    switch (this.step) {
      case TALK_MOM: return 'Find Mom and talk to her';
      case FIND_BLADE: return 'Find the magic Star Blade';
      case BEAT_BOSS: return 'Defeat the monster guarding Aarav';
      case TALK_AARAV: return 'Talk to Aarav and bring him home';
      case TREASURE: return `Find Dad's hidden treasures (${this.opened.size}/3)`;
      case BEAT_DRAGON: return 'Defeat the Dragon with the Star Blade!';
      default: return this._advObjective();
    }
  }
  _advObjective() {
    const a = this.adv;
    if (!a) return '';
    const alive = this._livingEnemies().length;
    switch (a.kind) {
      case 'treasure': return 'Find the hidden treasure!';
      case 'treasures3': return `Collect the treasures (${a.found}/${a.spots.length})`;
      case 'eggs': return `Find the dragon eggs (${a.found}/${a.spots.length})`;
      case 'survive': return `Survive the attack! (${Math.max(0, Math.ceil(a.surviveT))}s)`;
      case 'caravan': return `Protect your friend! (${Math.max(0, Math.ceil(a.guardT))}s)`;
      case 'gauntlet': return `Defeat every challenger (${a.queue.length + alive} left)`;
      case 'rescue': return a.guardsCleared ? 'Reach your rescued friend!' : `Defeat the guards (${alive} left)`;
      case 'boss': return `Defeat ${a.bossName || 'the monster'}!`;
      case 'overlord': return `Defeat the Overlord and minions (${alive} left)`;
      case 'ambush': return `Ambush! Fight them off! (${alive} left)`;
      case 'bounty': return `Defeat ${a.villain || 'the villain'} and the guards (${alive} left)`;
      case 'waves': return `Wave ${a.wave}/${a.waves.length} — defeat them all! (${alive} left)`;
      case 'titan': return `Topple ${a.villain || 'the Titan'} and the minions (${alive} left)`;
      default: return `Defeat the monsters (${alive} left)`;
    }
  }

  // ---- dialogue + toast + journal ----
  blocking() { return this._dialogOpen || this._journalOpen; }
  _dialog(name, lines, onDone) {
    this._dialogOpen = true;
    let i = 0;
    const show = () => {
      this.elDlgName.textContent = name;
      this.elDlgText.textContent = lines[i];
      this.elDlgHint.textContent = (i < lines.length - 1) ? 'Click to continue ▸' : 'Click to close ✓';
    };
    this._dlgAdvance = () => {
      i++;
      if (i >= lines.length) { this._closeDialog(); if (onDone) onDone(); }
      else show();
    };
    show();
    this.elDialog.style.display = 'flex';
    document.exitPointerLock();
    this.audio.play('click');
  }
  _closeDialog() {
    this._dialogOpen = false;
    this.elDialog.style.display = 'none';
    this._dlgAdvance = null;
    if (!this.player.dead) this.lockPointer();
  }
  _toast(t) { this.ui.toast(t); }

  // 📖 Adyah's Book of Adventures — every finished adventure, newest first.
  // main.js calls quests.toggleJournal?.() on KeyJ.
  toggleJournal() {
    if (this._journalOpen) { this._closeJournal(); return; }
    if (this._dialogOpen) return;
    this._journalOpen = true;
    const wins = this.journal.filter(j => j.result === 'won').length;
    const xp = this.journal.reduce((s, j) => s + (j.xp || 0), 0);
    const top = this.journal.reduce((s, j) => Math.max(s, j.level || 1), 0);
    const rows = this.journal.map(j =>
      `<div style="padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.12)">${KIND_ICONS[j.kind] || '✨'} <b>Lv.${j.level || 1}</b> ${j.title} — ${j.result === 'won' ? '🏆 Victory!' : '✨ Done!'} <span style="opacity:.7">+${j.xp || 0} XP</span></div>`
    ).join('') || '<div style="opacity:.75;padding:10px 2px">No adventures yet — they\'ll find you soon! ✨</div>';
    const ov = document.createElement('div');
    ov.className = 'dialog-overlay';
    ov.innerHTML =
      '<div class="dialog-card" style="margin-bottom:6vh;max-height:70vh;display:flex;flex-direction:column">' +
      `<div class="dialog-name">📖 Adyah's Book of Adventures — ${this.advDone} quest${this.advDone === 1 ? '' : 's'} conquered!</div>` +
      `<div style="font-size:14px;opacity:.85;margin-bottom:8px">🏆 ${wins} victories • 🔝 best level ${top || '—'} • ⭐ ${xp} XP earned</div>` +
      `<div class="journal-list" style="overflow-y:auto;font-size:15px;line-height:1.4">${rows}</div>` +
      '<div class="dialog-hint">Click anywhere (or press J / Esc) to close ✓</div>' +
      '</div>';
    document.body.appendChild(ov);
    this._elJournal = ov;
    ov.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.journal-list')) return;   // allow drag-scrolling the list
      e.stopPropagation(); e.preventDefault(); this._closeJournal();
    });
    this._journalKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyJ') { e.stopPropagation(); e.preventDefault(); this._closeJournal(); }
    };
    window.addEventListener('keydown', this._journalKey, true);
    document.exitPointerLock();
    this.audio.play('click');
  }
  _closeJournal() {
    if (!this._journalOpen) return;
    this._journalOpen = false;
    if (this._elJournal) { this._elJournal.remove(); this._elJournal = null; }
    if (this._journalKey) { window.removeEventListener('keydown', this._journalKey, true); this._journalKey = null; }
    if (!this.player.dead) this.lockPointer();
  }

  // ---- DOM ----
  _buildDom() {
    const hud = document.createElement('div');
    hud.id = 'questhud';
    hud.style.display = 'none';
    document.body.appendChild(hud);
    this.elHud = hud;

    const dlg = document.createElement('div');
    dlg.className = 'dialog-overlay';
    dlg.style.display = 'none';
    dlg.innerHTML =
      '<div class="dialog-card">' +
      '<div class="dialog-name"></div>' +
      '<div class="dialog-text"></div>' +
      '<div class="dialog-hint"></div>' +
      '</div>';
    document.body.appendChild(dlg);
    this.elDialog = dlg;
    this.elDlgName = dlg.querySelector('.dialog-name');
    this.elDlgText = dlg.querySelector('.dialog-text');
    this.elDlgHint = dlg.querySelector('.dialog-hint');
    const advance = (e) => { e.stopPropagation(); e.preventDefault(); if (this._dlgAdvance) this._dlgAdvance(); };
    dlg.addEventListener('mousedown', advance);
    // touch: preventDefault here also suppresses the synthesized mousedown, so a
    // tap advances exactly once (critical — the whole story flows through these).
    dlg.addEventListener('touchstart', advance, { passive: false });
  }
  _refreshHud() { /* update() repaints every frame */ }

  // ---- save (only ADDS keys — old version-2 saves still load fine) ----
  serialize() {
    return {
      step: this.step, started: this.started, origin: this.origin,
      opened: [...this.opened], repeatCount: this.repeatCount,
      repeatTimer: this.repeatTimer, advDone: this.advDone,
      journal: this.journal.slice(0, 60)
    };
  }
  deserialize(d) {
    if (!d) return;
    this.step = d.step != null ? d.step : TALK_MOM;
    this.started = !!d.started;
    if (d.origin) this.origin = d.origin;
    if (Array.isArray(d.opened)) this.opened = new Set(d.opened);
    this.repeatCount = d.repeatCount || 0;
    if (typeof d.repeatTimer === 'number' && d.repeatTimer > 0) this.repeatTimer = d.repeatTimer;
    this.advDone = d.advDone || 0;
    if (Array.isArray(d.journal)) this.journal = d.journal.slice(0, 60);
  }
}
