// progression.js — XP, levels, inventory unlocks, perks. Wired by main.js.
"use strict";
import { B } from './blocks.js';

const XP_NEED = (lvl) => 10 + lvl * 5;   // lvl 1->2 = 15, 2->3 = 20, ..., 10->11 = 60

const ORE_XP = {
  [B.COAL_ORE]: 2,
  [B.IRON_ORE]: 5,
  [B.GOLD_ORE]: 10,
  [B.DIAMOND_ORE]: 20,
  [B.REDSTONE_ORE]: 4
};
const HOSTILE_XP = { zombie: 5, skeleton: 5, creeper: 5, spider: 4 };

export const PERKS = [
  { id: 'fast_runner',  title: '🏃 Fast Runner',  desc: 'Sprint 25% faster' },
  { id: 'long_reach',   title: '🤚 Long Reach',   desc: 'Mine from 2 blocks further' },
  { id: 'strong_lungs', title: '🫁 Strong Lungs', desc: 'Hold breath twice as long' },
  { id: 'tough_skin',   title: '🛡️ Tough Skin',  desc: 'Fall damage halved' },
  { id: 'block_magnet', title: '🧲 Block Magnet', desc: 'Pick up items from further' },
  { id: 'heavy_hitter', title: '💥 Heavy Hitter', desc: '+1 attack damage' }
];

export class Progression {
  constructor(ui, audio, player, entities) {
    this.ui = ui; this.audio = audio; this.player = player; this.entities = entities;
    this.level = 1; this.xp = 0;
    this.perks = new Set();
    this._buildXpBar();
    this._refreshBar();
    this._applyPerks();
    // wire the UI's "unlock perk" callback back to us
    ui.progression = this;
  }

  _buildXpBar() {
    const hud = document.getElementById('hud');
    const hotbar = hud.querySelector('.hotbar');
    const xp = document.createElement('div');
    xp.className = 'bar xp';
    xp.innerHTML = '<div class="xp-fill"></div><span class="lvl-text">Lvl 1</span>';
    hud.insertBefore(xp, hotbar);
    this.elXpFill = xp.querySelector('.xp-fill');
    this.elLvl = xp.querySelector('.lvl-text');
  }

  pointsAvailable() {
    // 1 point per level reached (lvl 2 = 1 point, lvl 7 = 6 points); minus perks already taken
    return Math.max(0, (this.level - 1) - this.perks.size);
  }

  addXp(n) {
    if (n <= 0) return;
    this.xp += n;
    while (this.xp >= XP_NEED(this.level)) {
      this.xp -= XP_NEED(this.level);
      this.level++;
      this._onLevelUp();
    }
    this._refreshBar();
  }

  _onLevelUp() {
    this.audio.play('levelup');
    this.ui.toast(`✨ Level ${this.level}!`);
    if (this.level % 5 === 0) {
      this.player.maxHp += 2;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 4);
      setTimeout(() => this.ui.toast(`❤️ Max HP ${this.player.maxHp}`), 700);
    }
    const rows = Math.min(3, 1 + Math.floor(this.level / 5));
    if (this.ui.mainRows !== rows) {
      this.ui.mainRows = rows;
      setTimeout(() => this.ui.toast(`✨ +9 inventory slots!`), 1400);
    }
  }

  unlockPerk(id) {
    if (this.perks.has(id)) return false;
    if (this.pointsAvailable() <= 0) return false;
    if (!PERKS.find(p => p.id === id)) return false;
    this.perks.add(id);
    this._applyPerks();
    this.audio.play('levelup');
    this.ui.toast(`✓ ${PERKS.find(p => p.id === id).title} unlocked`);
    return true;
  }

  _applyPerks() {
    this.player.sprintMult  = this.perks.has('fast_runner')  ? 1.25 : 1;
    this.player.reach       = this.perks.has('long_reach')   ? 7    : 5;
    this.player.maxAir      = this.perks.has('strong_lungs') ? 20   : 10;
    this.player.fallDmgMult = this.perks.has('tough_skin')   ? 0.5  : 1;
    this.player.attackBonus = this.perks.has('heavy_hitter') ? 1    : 0;
    if (this.entities) this.entities.pickupMult = this.perks.has('block_magnet') ? 1.5 : 1;
  }

  hasPerk(id) { return this.perks.has(id); }

  onBreakOre(blockId) { const x = ORE_XP[blockId]; if (x) this.addXp(x); }
  onMobKill(type)     { const x = HOSTILE_XP[type]; if (x) this.addXp(x); }

  _refreshBar() {
    const need = XP_NEED(this.level);
    this.elXpFill.style.width = Math.round((this.xp / need) * 100) + '%';
    this.elLvl.textContent = `Lvl ${this.level}`;
  }

  serialize() {
    return { level: this.level, xp: this.xp, perks: [...this.perks] };
  }
  deserialize(d) {
    if (!d) return;
    this.level = d.level || 1;
    this.xp = d.xp || 0;
    if (Array.isArray(d.perks)) for (const id of d.perks) this.perks.add(id);
    this.player.maxHp = 20 + 2 * Math.floor(this.level / 5);
    this.ui.mainRows = Math.min(3, 1 + Math.floor(this.level / 5));
    this._applyPerks();
    this._refreshBar();
  }
}
