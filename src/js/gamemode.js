// Game modes — the single source of truth for what the player may do.
// Every subsystem imports { gameMode } and asks it questions instead of
// hardcoding survival-style rules.
export const MODES = {
  survival:  { name: 'Survival',  icon: '⚔️', desc: 'Mine, craft, fight — the classic!' },
  creative:  { name: 'Creative',  icon: '🎨', desc: 'Fly around and build with endless blocks!' },
  adventure: { name: 'Adventure', icon: '🗺️', desc: 'Non-stop quests, stories and battles!' },
  spectator: { name: 'Spectator', icon: '👻', desc: 'Float through everything, invisible!' },
};

class GameMode {
  constructor() {
    this.mode = 'survival';
    this.onChange = null; // (mode, prev) => {} — set by main.js
  }
  is(m) { return this.mode === m; }
  set(m) {
    if (!MODES[m] || m === this.mode) return false;
    const prev = this.mode;
    this.mode = m;
    if (this.onChange) this.onChange(m, prev);
    return true;
  }
  get def() { return MODES[this.mode]; }

  // --- what the player may do ---
  canBreak()       { return this.mode === 'survival' || this.mode === 'creative'; }
  canPlace()       { return this.mode === 'survival' || this.mode === 'creative'; }
  canInteract()    { return this.mode !== 'spectator'; }  // doors, chests, crafting, eating, talking
  canFight()       { return this.mode !== 'spectator'; }
  canPickup()      { return this.mode !== 'spectator'; }
  instaBreak()     { return this.mode === 'creative'; }
  blockDrops()     { return this.mode === 'survival'; }   // creative breaks vanish, no drops
  infiniteItems()  { return this.mode === 'creative'; }
  toolDurability() { return this.mode === 'survival'; }

  // --- how the world treats the player ---
  invulnerable()   { return this.mode === 'creative' || this.mode === 'spectator'; }
  usesHunger()     { return this.mode === 'survival' || this.mode === 'adventure'; }
  hungerRate()     { return this.mode === 'adventure' ? 0.5 : 1; }
  targetable()     { return this.mode === 'survival' || this.mode === 'adventure'; } // mobs ignore creative & spectator

  // --- movement ---
  canFly()         { return this.mode === 'creative' || this.mode === 'spectator'; }
  forcedFly()      { return this.mode === 'spectator'; }
  noclip()         { return this.mode === 'spectator'; }

  // --- pacing ---
  adventureCadence() { return this.mode === 'adventure' ? 0.45 : 1; } // multiplier on wait between adventures

  serialize()   { return this.mode; }
  deserialize(m){ if (MODES[m]) this.mode = m; }
}

export const gameMode = new GameMode();
