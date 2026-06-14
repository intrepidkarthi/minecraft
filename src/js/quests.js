// quests.js — Adyah's adventure, a multi-chapter story that gives the game goals.
//   Ch.1 "The Lost Brother": talk to Mom -> find the Star Blade -> beat the
//        monster -> rescue Aarav.
//   Ch.2 "Hidden Treasures": find Dad's 3 buried treasure chests (loot!).
//   Ch.3 "The Dragon": defeat the dragon with the Star Blade for the finale.
// A compass HUD always points the way and boss fights show a health bar.
"use strict";
import { B } from './blocks.js';

const TALK_MOM = 0, FIND_BLADE = 1, BEAT_BOSS = 2, TALK_AARAV = 3,
      TREASURE = 4, BEAT_DRAGON = 5, DONE = 6;

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

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
      "Your whole family is so proud of you. Keep building your world! 🎉"
    ]);
  }

  // ---- per-frame ----
  update(dt) {
    // treasure pickup by walking up to a chest
    if (this.step === TREASURE) this._checkTreasures();

    if (this.step === DONE) { this.elHud.style.display = 'none'; return; }
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
    const bossMob = this.step === BEAT_BOSS ? this.entities.findQuestMob('boss')
      : this.step === BEAT_DRAGON ? this.entities.findQuestMob('dragon') : null;
    if (bossMob) {
      const f = Math.max(0, bossMob.hp) / (bossMob.maxHp || 70);
      html += `<div class="q-boss"><span>${this.step === BEAT_DRAGON ? 'Dragon' : 'Monster'}</span><div class="q-bar"><i style="width:${Math.round(f * 100)}%"></i></div></div>`;
    }
    this.elHud.innerHTML = html;
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
    switch (this.step) {
      case TALK_MOM: { const p = this.momPos; return { name: 'Mom', x: p.x, z: p.z }; }
      case FIND_BLADE: { const p = this.bladePos; return { name: 'Star Blade', x: p.x, z: p.z }; }
      case BEAT_BOSS: { const b = this.entities.findQuestMob('boss'); const p = b ? b.pos : this.bossPos; return { name: 'Monster', x: p.x, z: p.z }; }
      case TALK_AARAV: { const a = this.entities.findQuestMob('aarav'); const p = a ? a.pos : this.aaravPos; return { name: 'Aarav', x: p.x, z: p.z }; }
      case TREASURE: { const t = this._nearestTreasure(); return t ? { name: 'Treasure', x: t.x, z: t.z } : null; }
      case BEAT_DRAGON: { const d = this.entities.findQuestMob('dragon'); const p = d ? d.pos : this.dragonPos; return { name: 'Dragon', x: p.x, z: p.z }; }
      default: return null;
    }
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
    switch (this.step) {
      case TALK_MOM: return 'Find Mom and talk to her';
      case FIND_BLADE: return 'Find the magic Star Blade';
      case BEAT_BOSS: return 'Defeat the monster guarding Aarav';
      case TALK_AARAV: return 'Talk to Aarav and bring him home';
      case TREASURE: return `Find Dad's hidden treasures (${this.opened.size}/3)`;
      case BEAT_DRAGON: return 'Defeat the Dragon with the Star Blade!';
      default: return '';
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
    dlg.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); if (this._dlgAdvance) this._dlgAdvance(); });
  }
  _refreshHud() { /* update() repaints every frame */ }

  // ---- save ----
  serialize() { return { step: this.step, started: this.started, origin: this.origin, opened: [...this.opened] }; }
  deserialize(d) {
    if (!d) return;
    this.step = d.step != null ? d.step : TALK_MOM;
    this.started = !!d.started;
    if (d.origin) this.origin = d.origin;
    if (Array.isArray(d.opened)) this.opened = new Set(d.opened);
  }
}
