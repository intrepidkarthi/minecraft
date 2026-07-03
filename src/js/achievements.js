// achievements.js — Adyah's milestones: toast + sound when unlocked, persisted in save
"use strict";
import { B } from './blocks.js';
import { ENEMY_IDS } from './entities.js';

const ACH = [
  { id: 'first_chop',    title: '🌳 First Tree!',         hint: 'Chopped your first log.' },
  { id: 'first_stone',   title: '🪨 First Stone!',         hint: 'Mined your first cobblestone.' },
  { id: 'first_place',   title: '🧱 First Block Placed!',  hint: 'Built your first block.' },
  { id: 'first_craft',   title: '🛠️ First Craft!',         hint: 'Made something at a crafting grid.' },
  { id: 'first_torch',   title: '🔥 Light Up the Dark!',   hint: 'Placed your first torch.' },
  { id: 'first_night',   title: '🌙 Survived the Night!',  hint: 'Made it through to morning.' },
  { id: 'first_mob',     title: '⚔️ Monster Slayer!',      hint: 'Defeated your first monster.' },
  { id: 'first_iron',    title: '⛓️ Iron Age!',            hint: 'Picked up your first iron ingot.' },
  { id: 'first_diamond', title: '💎 Diamond Hunter!',      hint: 'Found a diamond!' },
  { id: 'builder',       title: '🏗️ Builder!',             hint: 'Placed 25 blocks.' },
  { id: 'adventurer_1',  title: '🗺️ First Adventure!',     hint: 'Completed your first endless adventure.' },
  { id: 'adventurer_10', title: '🌟 Serial Adventurer!',   hint: 'Completed 10 endless adventures.' },
  { id: 'adventurer_25', title: '🏆 Legend of the Land!',  hint: 'Completed 25 endless adventures.' },
  { id: 'level5_hero',   title: '⚔️ Level 5 Hero!',        hint: 'Conquered a level 5 (or higher) adventure.' }
];

// every adventure enemy counts as a monster, plus the classics and quest bosses
const HOSTILE = new Set(['zombie', 'skeleton', 'creeper', 'spider', 'boss', 'dragon', ...ENEMY_IDS]);

// module-level hook so quests.js can report finished adventures without wiring
let _active = null;
export function reportAdventure(info) { if (_active) _active.onAdventure(info); }
const ORE_DROP_ITEM = new Set(['iron_ingot', 'diamond']);

export class Achievements {
  constructor(ui, audio) {
    this.ui = ui; this.audio = audio;
    this.unlocked = new Set();
    this.placed = 0;
    this.sawNight = false;
    _active = this;
  }

  _unlock(id) {
    if (this.unlocked.has(id)) return;
    const a = ACH.find(x => x.id === id);
    if (!a) return;
    this.unlocked.add(id);
    this.ui.toast(a.title);
    this.audio.play('levelup');
  }

  onBreak(blockId) {
    if (blockId === B.OAK_LOG || blockId === B.BIRCH_LOG || blockId === B.SPRUCE_LOG) this._unlock('first_chop');
    if (blockId === B.STONE || blockId === B.COBBLE) this._unlock('first_stone');
  }
  onPlace(blockId) {
    this._unlock('first_place');
    if (blockId === B.TORCH) this._unlock('first_torch');
    this.placed++;
    if (this.placed >= 25) this._unlock('builder');
  }
  onCraft() { this._unlock('first_craft'); }
  onMobKill(type) { if (HOSTILE.has(type)) this._unlock('first_mob'); }
  // called by quests.js after every finished endless adventure: {done, level, result}
  onAdventure(info) {
    if (!info) return;
    if (info.done >= 1)  this._unlock('adventurer_1');
    if (info.done >= 10) this._unlock('adventurer_10');
    if (info.done >= 25) this._unlock('adventurer_25');
    if (info.level >= 5) this._unlock('level5_hero');
  }
  onPickup(itemId) {
    if (itemId === 'iron_ingot') this._unlock('first_iron');
    if (itemId === 'diamond')    this._unlock('first_diamond');
  }

  // called every tick from the main loop; gets timeOfDay 0..1
  onTick(timeOfDay) {
    const isNight = timeOfDay > 0.52 && timeOfDay < 0.98;
    if (isNight) this.sawNight = true;
    else if (this.sawNight && timeOfDay < 0.5) {
      this.sawNight = false;
      this._unlock('first_night');
    }
  }

  serialize() {
    return { unlocked: [...this.unlocked], placed: this.placed };
  }
  deserialize(d) {
    if (!d) return;
    if (Array.isArray(d.unlocked)) for (const id of d.unlocked) this.unlocked.add(id);
    if (typeof d.placed === 'number') this.placed = d.placed;
  }

  // for the pause overlay: { list: [{title, hint, unlocked}], done, total }
  summary() {
    return {
      list: ACH.map(a => ({ title: a.title, hint: a.hint, unlocked: this.unlocked.has(a.id) })),
      done: this.unlocked.size,
      total: ACH.length
    };
  }
}
