// quests.js — Adyah's first adventure: "The Lost Brother".
// A small guided story: talk to Mom -> find the Star Blade -> beat the monster
// -> rescue Aarav. Drives an objective HUD with a compass that points the way,
// pops kid-friendly dialogue, and rewards completion.
"use strict";

// step ids
const TALK_MOM = 0, FIND_BLADE = 1, BEAT_BOSS = 2, TALK_AARAV = 3, DONE = 4;

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

export class Quests {
  constructor({ player, entities, ui, world, audio, progression, lockPointer }) {
    this.player = player; this.entities = entities; this.ui = ui;
    this.world = world; this.audio = audio; this.progression = progression;
    this.lockPointer = lockPointer || (() => {});
    this.step = TALK_MOM;
    this.started = false;          // has the very first Mom encounter happened
    this.origin = { x: 0, z: 0 };  // quest anchored at the player's spawn
    this._dialogOpen = false;
    this._buildDom();
  }

  // ---- target positions (x,z only), anchored to spawn so they're reachable ----
  _off(off) { return { x: Math.round(this.origin.x + off.x), z: Math.round(this.origin.z + off.z) }; }
  get momPos() { return this._off({ x: 9, z: 7 }); }
  get bladePos() { return this._off({ x: 44, z: -16 }); }
  get bossPos() { return this._off({ x: -24, z: 46 }); }
  get aaravPos() { return this._off({ x: -20, z: 49 }); }

  // generate the terrain around a target so spawned entities have ground to
  // stand on (distant chunks aren't loaded yet, so getBlock would be air),
  // then return a safe standing height.
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
    this._spawnMom();
    this._refreshHud();
  }

  resume() {
    if (this.origin.x === 0 && this.origin.z === 0) this.origin = { x: this.player.spawn.x, z: this.player.spawn.z };
    // mobs aren't persisted, so re-create whatever the current step needs.
    if (this.step === TALK_MOM) this._spawnMom();
    else if (this.step === FIND_BLADE) this._ensureBlade();
    else if (this.step === BEAT_BOSS) { this._ensureBlade(false); this._spawnBossAndAarav(); }
    else if (this.step === TALK_AARAV) this._spawnAarav(true);
    this._refreshHud();
  }

  _spawnMom() {
    if (this.entities.findQuestMob('mom')) return;
    const p = this.momPos, y = this._ground(p.x, p.z);
    this.entities.spawnMob('villager', p.x + 0.5, y, p.z + 0.5, { who: 'mom', quest: 'mom' });
  }
  _ensureBlade(drop = true) {
    // the Star Blade drop persists in saves; only place it if it's truly missing
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
    this._spawnAarav(false);
  }
  _spawnAarav(freed) {
    if (this.entities.findQuestMob('aarav')) return;
    const a = this.aaravPos, y = this._ground(a.x, a.z);
    this.entities.spawnMob('villager', a.x + 0.5, y, a.z + 0.5, { who: 'aarav', quest: 'aarav' });
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
        ], () => { this.step = FIND_BLADE; this.started = true; this._ensureBlade(); this._toast('New quest: The Lost Brother'); this._refreshHud(); });
      } else {
        this._dialog('Mom', ["Be careful out there, Adyah. Bring Aarav home!"]);
      }
      return;
    }
    if (who === 'aarav') {
      if (this.step === TALK_AARAV) {
        this._dialog('Aarav', [
          "Adyah! You found me! 🥹",
          "That monster was so scary… but you beat it!",
          "Let's go home together. You're the best big brother ever!"
        ], () => this._complete());
      } else {
        this._dialog('Aarav', ["Help, big brother! Beat the monster first — then I can come out!"]);
      }
      return;
    }
    // any other family member — a friendly hello
    this._dialog('Villager', ["Hello, Adyah! Lovely day to build something. 🙂"]);
  }

  onPickup(id) {
    if (id === 'star_blade' && this.step === FIND_BLADE) {
      this.audio.play('levelup');
      this._dialog('Star Blade', [
        "✨ You found the Star Blade! It hums with starlight.",
        "It's far stronger than any sword. Now go save Aarav!",
        "The compass will lead you to the monster."
      ], () => { this.step = BEAT_BOSS; this._spawnBossAndAarav(); this._refreshHud(); });
    }
  }

  onMobKill(type) {
    if (type === 'boss' && this.step === BEAT_BOSS) {
      this.step = TALK_AARAV;
      this.audio.play('levelup');
      this._toast('💥 The monster is defeated! Go talk to Aarav.');
      this._refreshHud();
    }
  }

  _complete() {
    this.step = DONE;
    if (this.progression && this.progression.addXp) this.progression.addXp(120);
    this.audio.play('levelup');
    this._dialog('🏆 Quest Complete!', [
      "The Lost Brother — finished!",
      "You found the Star Blade, beat the monster, and brought Aarav home. 🎉",
      "Keep the Star Blade — you earned it. More adventures await!"
    ]);
    this._refreshHud();
  }

  // ---- per-frame HUD ----
  update(dt) {
    if (this.step === DONE) { this.elHud.style.display = 'none'; return; }
    const target = this._currentTarget();
    if (!target) { this.elHud.style.display = 'none'; return; }
    this.elHud.style.display = 'block';

    const px = this.player.pos.x, pz = this.player.pos.z;
    const dx = target.x - px, dz = target.z - pz;
    const dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, -dz);
    let rel = bearing + this.player.yaw;
    rel = ((rel % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const arrow = dist < 3 ? '📍' : ARROWS[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];

    let html = `<div class="q-obj">📜 ${this._objective()}</div>`;
    html += `<div class="q-nav">${arrow} <b>${target.name}</b> — ${Math.round(dist)}m</div>`;
    if (this.step === BEAT_BOSS) {
      const boss = this.entities.findQuestMob('boss');
      if (boss) {
        const f = Math.max(0, boss.hp) / (boss.maxHp || 70);
        html += `<div class="q-boss"><span>Monster</span><div class="q-bar"><i style="width:${Math.round(f * 100)}%"></i></div></div>`;
      }
    }
    this.elHud.innerHTML = html;
  }

  _currentTarget() {
    switch (this.step) {
      case TALK_MOM: { const p = this.momPos; return { name: 'Mom', x: p.x, z: p.z }; }
      case FIND_BLADE: { const p = this.bladePos; return { name: 'Star Blade', x: p.x, z: p.z }; }
      case BEAT_BOSS: { const b = this.entities.findQuestMob('boss'); const p = b ? b.pos : this.bossPos; return { name: 'Monster', x: p.x, z: p.z }; }
      case TALK_AARAV: { const a = this.entities.findQuestMob('aarav'); const p = a ? a.pos : this.aaravPos; return { name: 'Aarav', x: p.x, z: p.z }; }
      default: return null;
    }
  }
  _objective() {
    switch (this.step) {
      case TALK_MOM: return 'Find Mom and talk to her';
      case FIND_BLADE: return 'Find the magic Star Blade';
      case BEAT_BOSS: return 'Defeat the monster guarding Aarav';
      case TALK_AARAV: return 'Talk to Aarav and bring him home';
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

  _refreshHud() { /* update() repaints every frame; nothing needed here */ }

  // ---- save ----
  serialize() { return { step: this.step, started: this.started, origin: this.origin }; }
  deserialize(d) {
    if (!d) return;
    this.step = d.step != null ? d.step : TALK_MOM;
    this.started = !!d.started;
    if (d.origin) this.origin = d.origin;
  }
}
