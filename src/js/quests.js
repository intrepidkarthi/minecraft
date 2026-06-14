// quests.js — Adyah's adventure, a multi-chapter story that gives the game goals.
//   Ch.1 "The Lost Brother": talk to Mom -> find the Star Blade -> beat the
//        monster -> rescue Aarav.
//   Ch.2 "Hidden Treasures": find Dad's 3 buried treasure chests (loot!).
//   Ch.3 "The Dragon": defeat the dragon with the Star Blade for the finale.
// A compass HUD always points the way and boss fights show a health bar.
"use strict";
import { B } from './blocks.js';
import { ENEMY_IDS, enemiesByTier, enemyKind, enemyName } from './entities.js';

const TALK_MOM = 0, FIND_BLADE = 1, BEAT_BOSS = 2, TALK_AARAV = 3,
      TREASURE = 4, BEAT_DRAGON = 5, DONE = 6;

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

// ---- endless adventure content: 10 templates × 30 storylines × 24 enemies ----
// Each run draws a fresh template + storyline + randomly-chosen enemies, so no
// two adventures feel the same.
const ADVENTURES = [
  { id: 'hunt',     title: 'Monster Hunt',   kind: 'boss',      tier: 'boss' },
  { id: 'horde',    title: 'The Horde',      kind: 'horde',     tier: 'small', count: 5 },
  { id: 'warband',  title: 'The Warband',    kind: 'horde',     tier: 'mid',   count: 4 },
  { id: 'treasure', title: 'Lost Treasure',  kind: 'treasure' },
  { id: 'trail',    title: 'Treasure Trail', kind: 'treasures3' },
  { id: 'rescue',   title: 'The Rescue',     kind: 'rescue',    tier: 'mid',   count: 2 },
  { id: 'overlord', title: 'The Overlord',   kind: 'overlord',  tier: 'small', count: 3 },
  { id: 'siege',    title: 'Defend the Land', kind: 'survive',  tier: 'small', duration: 28 },
  { id: 'gauntlet', title: 'The Gauntlet',   kind: 'gauntlet',  tier: 'mid',   count: 3 },
  { id: 'beastpack', title: 'Beast Pack',    kind: 'horde',     enemyKind: 'beast', count: 4 }
];

const STORYLINES = [
  "A shadow fell over the village last night…",
  "Aarav heard strange growls coming from the hills.",
  "Mom found mysterious footprints near the garden.",
  "Dad says something has been stealing the crops.",
  "A traveler ran into town shouting about monsters.",
  "The well water turned strange — something lurks nearby.",
  "Bright eyes were seen glowing in the dark woods.",
  "An old map fell from the sky with an X on it.",
  "The village bell rang — danger is near!",
  "A cold wind carries the smell of trouble.",
  "Birds fled the forest all at once this morning.",
  "A glittering trail leads away from the village.",
  "Strange tracks circle the edge of the plains.",
  "Aarav's pet went missing past the hills.",
  "A rumble shook the ground beneath the meadow.",
  "Smoke rises from somewhere beyond the trees.",
  "A friendly villager needs a brave hero's help.",
  "Treasure hunters whisper of riches buried nearby.",
  "The stars formed a strange pattern over the ridge.",
  "A dropped coin pouch hints at hidden loot.",
  "Howls echo from the valley after dark.",
  "Something big left a crater in the field.",
  "Dad lost his lucky tools out in the wild.",
  "A scared traveler points toward the danger.",
  "The ground glitters where a chest may lie buried.",
  "Monsters were spotted gathering near the river.",
  "A magic chest is said to appear for the brave.",
  "The village elders ask for Adyah's courage again.",
  "An ancient foe has awoken from its slumber.",
  "Adventure calls — and only you can answer it!"
];

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
    this.repeatCount = 0;
    this._advBag = [];         // shuffle bags so templates/stories don't repeat
    this._storyBag = [];
    this._dialogOpen = false;
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
    else if (this.step === DONE) { this.adv = null; this.repeatTimer = 40; }   // resume endless mode
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
    this.repeatTimer = 40;   // start the endless adventures
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

  // ================= endless, never-repeating adventures =================
  _updateRepeat(dt) {
    if (this.adv) { this._tickAdventure(dt); return; }
    if (this.step !== DONE) return;   // auto-spawn only in endless mode (post-story)
    this.repeatTimer -= dt;
    if (this.repeatTimer <= 0) this._startAdventure();
  }

  // debug / on-demand: instantly start a fresh random adventure (bound to G)
  debugStartAdventure() {
    if (this._dialogOpen) return;
    if (this.origin.x === 0 && this.origin.z === 0) this.origin = { x: this.player.spawn.x, z: this.player.spawn.z };
    if (this.adv) this._finishAdventure();
    this._startAdventure();
  }

  _randSpot(minD, maxD) {
    const ang = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const x = Math.round(this.origin.x + Math.cos(ang) * d), z = Math.round(this.origin.z + Math.sin(ang) * d);
    return { x, z };
  }
  _pickEnemies(tpl, n) {
    let pool = tpl.enemyKind ? ENEMY_IDS.filter(id => enemyKind(id) === tpl.enemyKind)
             : tpl.tier ? enemiesByTier(tpl.tier) : ENEMY_IDS;
    if (!pool.length) pool = ENEMY_IDS;
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[(Math.random() * pool.length) | 0]);
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
    this.repeatCount++;
    const tpl = ADVENTURES[bagDraw(this._advBag, ADVENTURES)];
    const story = STORYLINES[bagDraw(this._storyBag, STORYLINES)];
    const spot = this._randSpot(40, 80);
    const adv = { tpl, story, kind: tpl.kind, pos: spot, spawned: 0, guardsCleared: false };

    if (tpl.kind === 'boss') {
      const id = this._pickEnemies({ tier: 'boss' }, 1)[0];
      adv.bossId = id; adv.bossName = enemyName(id);
      this._spawnEnemy(id, spot); adv.spawned = 1;
    } else if (tpl.kind === 'horde' || tpl.kind === 'overlord') {
      const list = this._pickEnemies(tpl, tpl.count);
      for (const id of list) this._spawnEnemy(id, spot, 6);
      adv.spawned = list.length; adv.enemyName = enemyName(list[0]);
      if (tpl.kind === 'overlord') { const bid = this._pickEnemies({ tier: 'boss' }, 1)[0]; this._spawnEnemy(bid, spot); adv.spawned++; adv.bossName = enemyName(bid); }
    } else if (tpl.kind === 'gauntlet') {
      adv.queue = this._pickEnemies(tpl, tpl.count);
      this._spawnEnemy(adv.queue.shift(), spot); adv.spawned = 1;
    } else if (tpl.kind === 'rescue') {
      const list = this._pickEnemies(tpl, tpl.count);
      for (const id of list) this._spawnEnemy(id, spot, 5);
      adv.spawned = list.length;
      const y = this._ground(spot.x, spot.z);
      this.entities.spawnMob('villager', spot.x + 0.5, y, spot.z + 0.5, { who: 'aarav', quest: 'alost' });
    } else if (tpl.kind === 'survive') {
      adv.surviveT = tpl.duration; adv.waveT = 0;
    } else if (tpl.kind === 'treasures3') {
      adv.spots = [this._randSpot(35, 60), this._randSpot(45, 75), this._randSpot(55, 90)];
      adv.found = 0;
    }
    // treasure: nothing to spawn, just reach adv.pos

    this.adv = adv;
    this.audio.play('levelup');
    this._dialog(`✨ New Adventure: ${tpl.title}`, [story, this._objective()]);
  }

  _tickAdventure(dt) {
    const a = this.adv, k = a.kind;
    // safety net: an adventure can never get permanently stuck (e.g. an enemy
    // pathed somewhere unreachable). After a generous time limit, award it.
    a.elapsed = (a.elapsed || 0) + dt;
    if (a.elapsed > 300) { this._toast('⏱️ Adventure complete — reward granted!'); return this._finishAdventure(); }
    if (k === 'treasure') {
      if (this._near(a.pos, 2.8)) return this._finishAdventure();
    } else if (k === 'treasures3') {
      const s = a.spots[a.found];
      if (s && this._near(s, 2.8)) { a.found++; if (a.found >= a.spots.length) return this._finishAdventure(); this._toast(`🎁 Treasure ${a.found}/${a.spots.length}!`); this.audio.play('levelup'); }
    } else if (k === 'survive') {
      a.surviveT -= dt; a.waveT -= dt;
      if (a.waveT <= 0 && a.surviveT > 3) { a.waveT = 6; for (const id of this._pickEnemies(a.tpl, 2)) this._spawnEnemy(id, a.pos, 8); }
      if (a.surviveT <= 0) { for (const m of this._livingEnemies()) m.dying = 0.001; return this._finishAdventure(); }
    } else if (k === 'gauntlet') {
      if (this._livingEnemies().length === 0) {
        if (a.queue.length) this._spawnEnemy(a.queue.shift(), this._near(a.pos, 30) ? { x: Math.round(this.player.pos.x + 6), z: Math.round(this.player.pos.z + 6) } : a.pos);
        else return this._finishAdventure();
      }
    } else if (k === 'rescue') {
      if (!a.guardsCleared && this._livingEnemies().length === 0) { a.guardsCleared = true; this._toast('🛡️ Guards defeated — reach your friend!'); }
      if (a.guardsCleared) { const v = this.entities.findQuestMob('alost'); if (v && this._nearPos(v.pos, 2.8)) return this._finishAdventure(); }
    } else { // boss / horde / overlord
      if (this._livingEnemies().length === 0) return this._finishAdventure();
    }
  }

  _near(spot, r) { return Math.hypot(spot.x + 0.5 - this.player.pos.x, spot.z + 0.5 - this.player.pos.z) < r; }
  _nearPos(pos, r) { return Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) < r; }

  _finishAdventure() {
    const fight = this.adv.kind !== 'treasure' && this.adv.kind !== 'treasures3';
    if (this.progression && this.progression.addXp) this.progression.addXp(fight ? 80 : 50);
    const loot = fight ? [{ id: 'diamond', count: 2 }, { id: 'gold_ingot', count: 4 }]
                       : [{ id: 'diamond', count: 3 }, { id: 'apple', count: 4 }];
    for (const l of loot) this.ui.addToInventory({ id: l.id, count: l.count });
    this._clearAdvEnemies();   // remove any stragglers + release rescue villager
    this.audio.play('levelup');
    this._toast(`🏅 ${this.adv.tpl.title} complete! Reward earned.`);
    this.adv = null;
    this.repeatTimer = 45 + Math.random() * 35;   // next adventure in ~1 minute
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
    if (a.kind === 'treasures3') { const s = a.spots[a.found] || a.pos; return { name: 'Treasure', x: s.x, z: s.z }; }
    if (a.kind === 'rescue' && a.guardsCleared) { const v = this.entities.findQuestMob('alost'); const p = v ? v.pos : a.pos; return { name: 'Friend', x: p.x, z: p.z }; }
    const e = this._livingEnemies()[0];
    const p = e ? e.pos : a.pos;
    return { name: e ? enemyName(e.type) : 'Monster', x: p.x, z: p.z };
  }
  _advBossMob() {
    const a = this.adv;
    if (!a || (a.kind !== 'boss' && a.kind !== 'overlord' && a.kind !== 'gauntlet')) return null;
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
      case 'survive': return `Survive the attack! (${Math.max(0, Math.ceil(a.surviveT))}s)`;
      case 'gauntlet': return `Defeat every challenger (${a.queue.length + alive} left)`;
      case 'rescue': return a.guardsCleared ? 'Reach your rescued friend!' : `Defeat the guards (${alive} left)`;
      case 'boss': return `Defeat the ${a.bossName || 'monster'}!`;
      case 'overlord': return `Defeat the Overlord and minions (${alive} left)`;
      default: return `Defeat the monsters (${alive} left)`;
    }
  }

  // ---- dialogue + toast ----
  blocking() { return this._dialogOpen; }
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

  // ---- save ----
  serialize() { return { step: this.step, started: this.started, origin: this.origin, opened: [...this.opened], repeatCount: this.repeatCount }; }
  deserialize(d) {
    if (!d) return;
    this.step = d.step != null ? d.step : TALK_MOM;
    this.started = !!d.started;
    if (d.origin) this.origin = d.origin;
    if (Array.isArray(d.opened)) this.opened = new Set(d.opened);
    this.repeatCount = d.repeatCount || 0;
  }
}
