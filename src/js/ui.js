// ui.js — HUD (hotbar/hearts/hunger), inventory, crafting, furnace, chest, menus
"use strict";
import { B, blockDef, atlasCanvas, TILE, ATLAS_COLS } from './blocks.js';
import { itemDef, itemName, itemIcon, maxStack, matchRecipe, smeltResult, fuelValue, ITEMS } from './items.js';
import { PERKS } from './progression.js';

const $ = (sel) => document.querySelector(sel);
function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

// Build a new stack object from a source stack, carrying over the bits that
// must never be lost when a kid drags / splits / shift-clicks items around the
// inventory: the durability AND the `unlimited` flag. Dropping `unlimited` here
// is exactly how Adyah's infinite starter kit used to silently run out.
function packStack(src, count) {
  const o = { id: src.id, count };
  if (src.dur !== undefined) o.dur = src.dur;
  if (src.unlimited) o.unlimited = true;
  return o;
}

// ---------------------------------------------------------------- icons
const iconCache = new Map();
export function iconFor(id) {
  const k = typeof id === 'number' ? 'b' + id : id;
  if (iconCache.has(k)) return iconCache.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  if (typeof id === 'number') {
    const def = blockDef(id);
    const src = (t) => [(t % ATLAS_COLS) * TILE, ((t / ATLAS_COLS) | 0) * TILE];
    if (def.cross) {
      const [sx, sy] = src(def.tex[0]);
      c.drawImage(atlasCanvas, sx, sy, TILE, TILE, 2, 2, 28, 28);
    } else {
      // isometric cube
      c.save();
      c.translate(2, 2); c.scale(0.85, 0.85);
      const [tx, ty] = src(def.tex[2]);   // top
      const [lx, ly] = src(def.tex[5]);   // -z as left
      const [rx, ry] = src(def.tex[0]);   // +x as right
      c.save(); c.setTransform(0.85, 0.425, -0.85, 0.425, 2 + 13.6, 2 + 3.4);
      c.drawImage(atlasCanvas, tx, ty, TILE, TILE, 0, 0, 16, 16); c.restore();
      c.save(); c.setTransform(0.85, 0.425, 0, 0.85, 2, 2 + 10.2);
      c.filter = 'brightness(78%)';
      c.drawImage(atlasCanvas, lx, ly, TILE, TILE, 0, 0, 16, 16); c.restore();
      c.save(); c.setTransform(0.85, -0.425, 0, 0.85, 2 + 13.6, 2 + 17);
      c.filter = 'brightness(58%)';
      c.drawImage(atlasCanvas, rx, ry, TILE, TILE, 0, 0, 16, 16); c.restore();
      c.restore();
    }
  } else {
    c.drawImage(itemIcon(id), 0, 0, 16, 16, 2, 2, 28, 28);
  }
  iconCache.set(k, cv);
  return cv;
}

// ---------------------------------------------------------------- UI class
export class UI {
  constructor(audio) {
    this.audio = audio;
    this.inv = new Array(36).fill(null);   // 0-8 hotbar
    this.sel = 0;
    this.cursor = null;
    this.craftGrid = new Array(9).fill(null);
    this.craftW = 2;
    this.container = null;  // {type, slots?|state?, pos}
    this.overlay = null;    // 'inventory'|'crafting'|'furnace'|'chest'|'pause'|'death'|'help'|'skills'
    this.onClose = null;
    this.onCraft = null;    // () => void  (set by main.js)
    this.world = null;
    this.mainRows = 3;      // all main-inventory rows always available (no level gating)
    this.progression = null;

    this._buildHUD();
    this._buildScreens();
    this._hudCache = '';
    this.toastTimer = null;
  }

  // ============================== HUD ==============================
  _buildHUD() {
    const hud = $('#hud');
    this.elHearts = el('div', 'bar hearts', hud);
    this.elHunger = el('div', 'bar hunger', hud);
    this.elAir = el('div', 'bar air', hud);
    this.elHotbar = el('div', 'hotbar', hud);
    this.hotSlots = [];
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot hot', this.elHotbar);
      this.hotSlots.push(s);
    }
    this.elAction = $('#actiontext');
    this.elToast = $('#toast');
    this.elTooltip = $('#tooltip');
    this.elDebug = $('#debug');
    this.elVignette = $('#vignette');
  }

  renderSlotInto(div, stack, big = false) {
    div.innerHTML = '';
    if (!stack) return;
    const cv = iconFor(stack.id);
    const img = cv.cloneNode();
    img.getContext('2d').drawImage(cv, 0, 0);
    img.className = 'icon';
    div.appendChild(img);
    if (stack.unlimited) {
      const n = el('span', 'count', div);
      n.textContent = '∞';
      n.classList.add('inf');
    } else if (stack.count > 1) {
      const n = el('span', 'count', div);
      n.textContent = stack.count;
    }
    const d = itemDef(stack.id);
    if (d && d.tool && stack.dur !== undefined && stack.dur < d.tool.dura) {
      const bar = el('div', 'durbar', div);
      const fill = el('div', 'durfill', bar);
      const f = stack.dur / d.tool.dura;
      fill.style.width = (f * 100) + '%';
      fill.style.background = f > 0.5 ? '#5ad65a' : f > 0.25 ? '#d6cc5a' : '#d65a5a';
    }
  }

  updateHotbar() {
    for (let i = 0; i < 9; i++) {
      const s = this.hotSlots[i];
      s.classList.toggle('selected', i === this.sel);
      this.renderSlotInto(s, this.inv[i]);
    }
  }

  updateHUD(p) {
    const key = [p.hp, p.hunger, p.air, p.headInWater].join(',');
    if (key === this._hudCache) return;
    this._hudCache = key;
    const fill = (root, count, value, cls) => {
      root.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const v = value - i * 2;
        el('span', cls + (v >= 2 ? ' full' : v >= 1 ? ' half' : ' empty'), root);
      }
    };
    fill(this.elHearts, 10, p.hp, 'heart');
    fill(this.elHunger, 10, p.hunger, 'drum');
    this.elAir.innerHTML = '';
    if (p.headInWater) {
      for (let i = 0; i < p.maxAir; i++) el('span', 'bubble' + (i < p.air ? ' full' : ' empty'), this.elAir);
    }
  }

  selected() { return this.inv[this.sel]; }

  consumeSelected(n = 1) {
    const s = this.inv[this.sel];
    if (!s) return;
    if (s.unlimited) return;       // starter kit blocks never deplete
    s.count -= n;
    if (s.count <= 0) this.inv[this.sel] = null;
    this.updateHotbar();
  }

  damageSelectedTool() {
    const s = this.inv[this.sel];
    if (!s || typeof s.id !== 'string') return;
    if (s.unlimited) return;       // starter tools never break
    const d = ITEMS[s.id];
    if (!d || !d.tool) return;
    if (s.dur === undefined) s.dur = d.tool.dura;
    s.dur--;
    if (s.dur <= 0) {
      this.inv[this.sel] = null;
      this.audio.play('break', 'glass');
      this.toast(d.name + ' broke!');
    }
    this.updateHotbar();
  }

  addToInventory(stack) {
    let remaining = stack.count;
    const ms = maxStack(stack.id);
    const cap = 9 + this.mainRows * 9;   // only unlocked slots are reachable
    // merge into existing (hotbar first)
    for (const idxs of [[...Array(9).keys()], [...Array(cap - 9).keys()].map(i => i + 9)]) {
      for (const i of idxs) {
        const s = this.inv[i];
        if (s && s.id === stack.id && s.count < ms && (typeof stack.id !== 'string' || !ITEMS[stack.id] || !ITEMS[stack.id].tool)) {
          const take = Math.min(ms - s.count, remaining);
          s.count += take; remaining -= take;
          if (remaining <= 0) { this.updateHotbar(); this._refreshOverlay(); return 0; }
        }
      }
    }
    for (let i = 0; i < cap; i++) {
      if (!this.inv[i]) {
        this.inv[i] = packStack(stack, Math.min(ms, remaining));
        remaining -= this.inv[i].count;
        if (remaining <= 0) { this.updateHotbar(); this._refreshOverlay(); return 0; }
      }
    }
    this.updateHotbar(); this._refreshOverlay();
    return remaining;
  }

  setAction(t) { this.elAction.textContent = t; }
  toast(t) {
    this.elToast.textContent = t;
    this.elToast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.elToast.classList.remove('show'), 2500);
  }
  flashDamage() {
    this.elVignette.classList.remove('flash');
    void this.elVignette.offsetWidth;
    this.elVignette.classList.add('flash');
  }
  debug(t) { this.elDebug.textContent = t; }
  showDebug(v) { this.elDebug.style.display = v ? 'block' : 'none'; }

  // ============================== screens ==============================
  _buildScreens() {
    this.elScreen = $('#screen');
    this.cursorEl = $('#cursorstack');
    document.addEventListener('mousemove', (e) => {
      this.cursorEl.style.left = e.clientX + 'px';
      this.cursorEl.style.top = e.clientY + 'px';
      this._tooltipMove(e);
    });
    // touch: held item follows the finger while an inventory screen is open
    document.addEventListener('touchmove', (e) => {
      if (!this.cursor || !this.overlay) return;
      const t = e.touches[0]; if (!t) return;
      this.cursorEl.style.left = t.clientX + 'px';
      this.cursorEl.style.top = t.clientY + 'px';
    }, { passive: true });
  }

  isOpen() { return this.overlay !== null; }

  open(kind, container) {
    this.overlay = kind;
    this.container = container || null;
    this.craftW = kind === 'crafting' ? 3 : 2;
    this.elScreen.style.display = 'flex';
    this._refreshOverlay();
    this.audio.play('open');
  }

  close() {
    if (!this.overlay) return;
    // return crafting grid + cursor to inventory
    for (let i = 0; i < 9; i++) {
      if (this.craftGrid[i]) { this.addToInventory(this.craftGrid[i]); this.craftGrid[i] = null; }
    }
    if (this.cursor) { this.addToInventory(this.cursor); this.cursor = null; this._renderCursor(); }
    this.overlay = null;
    this.container = null;
    this.elScreen.style.display = 'none';
    this.elTooltip.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  _refreshOverlay() {
    if (!this.overlay) return;
    const root = this.elScreen;
    root.innerHTML = '';
    const panel = el('div', 'panel', root);

    if (this.overlay === 'pause') return this._buildPause(panel);
    if (this.overlay === 'death') return this._buildDeath(panel);
    if (this.overlay === 'help') return this._buildHelp(panel);
    if (this.overlay === 'skills') return this._buildSkills(panel);

    const title = el('div', 'ptitle', panel);

    if (this.overlay === 'inventory' || this.overlay === 'crafting') {
      title.textContent = this.overlay === 'crafting' ? 'Crafting Table' : 'Inventory';
      const w = this.craftW;
      const wrap = el('div', 'craftwrap', panel);
      const grid = el('div', 'grid g' + w, wrap);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        const i = y * 3 + x;
        this._slot(grid, () => this.craftGrid[i], (s) => { this.craftGrid[i] = s; }, 'craft');
      }
      el('div', 'arrow', wrap).textContent = '→';
      const outWrap = el('div', 'grid g1', wrap);
      this._slot(outWrap, () => this._craftResult(), null, 'craftout');
    } else if (this.overlay === 'furnace') {
      title.textContent = 'Furnace';
      const st = this.container.state;
      const wrap = el('div', 'furnwrap', panel);
      const colL = el('div', 'furncol', wrap);
      this._slot(colL, () => st.in, (s) => { st.in = s; }, 'furnin');
      const flame = el('div', 'flame', colL);
      flame.textContent = '🔥';
      flame.style.opacity = st.burn > 0 ? 1 : 0.15;
      this._slot(colL, () => st.fuel, (s) => { st.fuel = s; }, 'furnfuel');
      const mid = el('div', 'furnmid', wrap);
      const barBg = el('div', 'cookbar', mid);
      const fillC = el('div', 'cookfill', barBg);
      fillC.style.width = Math.round((st.cook / 10) * 100) + '%';
      el('div', 'arrow', mid).textContent = '→';
      this._slot(el('div', 'grid g1', wrap), () => st.out, (s) => { st.out = s; }, 'furnout');
    } else if (this.overlay === 'chest') {
      title.textContent = 'Chest';
      const grid = el('div', 'grid g9', panel);
      for (let i = 0; i < 27; i++) {
        this._slot(grid, () => this.container.slots[i], (s) => { this.container.slots[i] = s; }, 'chest');
      }
    }

    // player inventory section — all rows are always available
    el('div', 'ptitle small', panel).textContent = '';
    const cap = 9 + this.mainRows * 9;
    const main = el('div', 'grid g9', panel);
    for (let i = 9; i < cap; i++) {
      this._slot(main, () => this.inv[i], (s) => { this.inv[i] = s; }, 'invmain');
    }
    const hot = el('div', 'grid g9 hotrow', panel);
    for (let i = 0; i < 9; i++) {
      this._slot(hot, () => this.inv[i], (s) => { this.inv[i] = s; this.updateHotbar(); }, 'invhot');
    }
  }

  _craftResult() {
    const w = this.craftW;
    const grid = [];
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) grid.push(this.craftGrid[y * 3 + x]);
    const r = matchRecipe(grid, w);
    return r ? { id: r.out, count: r.outCount } : null;
  }

  _takeCraft(all) {
    let made = 0;
    do {
      const res = this._craftResult();
      if (!res) break;
      if (this.cursor) {
        if (this.cursor.id !== res.id || this.cursor.count + res.count > maxStack(res.id)) break;
        this.cursor.count += res.count;
      } else {
        this.cursor = { ...res };
        if (typeof res.id === 'string' && ITEMS[res.id] && ITEMS[res.id].tool) this.cursor.dur = ITEMS[res.id].tool.dura;
      }
      for (let i = 0; i < 9; i++) {
        if (this.craftGrid[i]) {
          this.craftGrid[i].count--;
          if (this.craftGrid[i].count <= 0) this.craftGrid[i] = null;
        }
      }
      made++;
      this.audio.play('craft');
      if (this.onCraft) this.onCraft();
    } while (all && made < 64);
  }

  // Core slot interaction, shared by mouse and touch.
  // button: 0 = pick up / place / merge, 2 = split half / place one.
  _slotAction(button, shift, get, set, kind) {
    const cur = this.cursor;
    const s = get();
    if (kind === 'craftout') {
      if (button === 0) this._takeCraft(shift);
      this._renderCursor(); this._refreshOverlay();
      return;
    }
    if (shift && button === 0 && s && set) {
      // quick-move
      set(null);
      const left = this._quickMove(s, kind);
      if (left > 0) { s.count = left; set(s); }
      this.updateHotbar(); this._refreshOverlay();
      return;
    }
    if (button === 0) {
      // left: swap / merge
      const curIsTool = typeof cur?.id === 'string' && ITEMS[cur.id] && ITEMS[cur.id].tool;
      if (cur && s && cur.id === s.id && !curIsTool) {
        const ms = maxStack(s.id);
        const take = Math.min(ms - s.count, cur.count);
        s.count += take; cur.count -= take;
        if (cur.count <= 0) this.cursor = null;
        set(s);
      } else {
        if (set || !cur) { this.cursor = s; if (set) set(cur); }
      }
    } else if (button === 2) {
      if (cur) {
        // place one
        if (kind === 'furnfuel' && fuelValue(cur.id) <= 0) return;
        if (!s) { set && set(packStack(cur, 1)); if (!cur.unlimited) cur.count--; }
        else if (s.id === cur.id && s.count < maxStack(s.id)) { s.count++; if (!cur.unlimited) cur.count--; set(s); }
        if (cur.count <= 0) this.cursor = null;
      } else if (s) {
        // split half — an infinite stack keeps the full kit and stays put
        if (s.unlimited) {
          this.cursor = packStack(s, s.count);
        } else {
          const half = Math.ceil(s.count / 2);
          this.cursor = packStack(s, half);
          s.count -= half;
          set && set(s.count > 0 ? s : null);
        }
      }
    }
    this.audio.play('click');
    this._renderCursor();
    this.updateHotbar();
    this._refreshOverlay();
  }

  _slot(parent, get, set, kind) {
    const div = el('div', 'slot', parent);
    const render = () => this.renderSlotInto(div, get());
    render();
    div.addEventListener('mousedown', (e) => { e.preventDefault(); this._slotAction(e.button, e.shiftKey, get, set, kind); });
    div.addEventListener('contextmenu', e => e.preventDefault());
    div.addEventListener('mouseenter', () => { const s = get(); if (s) this._tooltipShow(itemName(s.id)); });
    div.addEventListener('mouseleave', () => { this.elTooltip.style.display = 'none'; });
    // touch: tap = pick up / place, long-press = split half / place one.
    let lpTimer = null, handled = false;
    div.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.changedTouches[0];
      this.cursorEl.style.left = t.clientX + 'px'; this.cursorEl.style.top = t.clientY + 'px';
      handled = false;
      lpTimer = setTimeout(() => { handled = true; this._slotAction(2, false, get, set, kind); }, 450);
    }, { passive: false });
    div.addEventListener('touchend', (e) => {
      e.preventDefault(); e.stopPropagation();
      clearTimeout(lpTimer);
      if (!handled) this._slotAction(0, false, get, set, kind);
    }, { passive: false });
    div.addEventListener('touchcancel', () => clearTimeout(lpTimer));
    return div;
  }

  _quickMove(s, kind) {
    if (kind === 'chest' || kind === 'craft' || kind === 'furnin' || kind === 'furnfuel' || kind === 'furnout') {
      return this.addToInventory(s);
    }
    // from inventory → container if open
    if (this.container && this.container.type === 'chest') {
      const slots = this.container.slots;
      let remaining = s.count;
      const ms = maxStack(s.id);
      for (let i = 0; i < 27 && remaining > 0; i++) {
        const t = slots[i];
        if (t && t.id === s.id && t.count < ms) { const take = Math.min(ms - t.count, remaining); t.count += take; remaining -= take; }
      }
      for (let i = 0; i < 27 && remaining > 0; i++) {
        if (!slots[i]) { slots[i] = packStack(s, remaining); remaining = 0; }
      }
      return remaining;
    }
    // hotbar <-> main
    let remaining = s.count;
    const ms = maxStack(s.id);
    const cap = 9 + this.mainRows * 9;
    const range = kind === 'invhot' ? [9, cap] : [0, 9];
    for (let i = range[0]; i < range[1] && remaining > 0; i++) {
      const t = this.inv[i];
      if (t && t.id === s.id && t.count < ms) { const take = Math.min(ms - t.count, remaining); t.count += take; remaining -= take; }
    }
    for (let i = range[0]; i < range[1] && remaining > 0; i++) {
      if (!this.inv[i]) { this.inv[i] = packStack(s, remaining); remaining = 0; }
    }
    return remaining;
  }

  _renderCursor() {
    this.cursorEl.innerHTML = '';
    if (this.cursor) {
      this.renderSlotInto(this.cursorEl, this.cursor);
      this.cursorEl.style.display = 'block';
    } else this.cursorEl.style.display = 'none';
  }

  _tooltipShow(t) { this.elTooltip.textContent = t; this.elTooltip.style.display = 'block'; }
  _tooltipMove(e) {
    this.elTooltip.style.left = (e.clientX + 14) + 'px';
    this.elTooltip.style.top = (e.clientY - 24) + 'px';
  }

  // ---------- pause / death / help ----------
  _buildPause(panel) {
    panel.classList.add('menu');
    el('div', 'ptitle', panel).textContent = 'Game Paused';
    const btn = (label, fn) => { const b = el('button', 'mbtn', panel); b.textContent = label; b.onclick = () => { this.audio.play('click'); fn(); }; return b; };
    btn('Back to Game', () => this.close());
    btn('Skills & Perks', () => { this.overlay = 'skills'; this._refreshOverlay(); });
    btn('How to Play', () => { this.overlay = 'help'; this._refreshOverlay(); });
    btn(this.audio.muted ? 'Sound: OFF' : 'Sound: ON', () => { this.audio.toggleMute(); this._refreshOverlay(); });
    const rd = el('div', 'rdrow', panel);
    rd.innerHTML = '<span>Render distance:</span>';
    for (const v of [4, 6, 8, 10]) {
      const b = el('button', 'mbtn small' + (this.renderDist === v ? ' active' : ''), rd);
      b.textContent = v;
      b.onclick = () => { if (this.onRenderDist) this.onRenderDist(v); this.renderDist = v; this._refreshOverlay(); };
    }
    el('div', 'hint', panel).textContent = 'Your world saves automatically.';
  }

  _buildDeath(panel) {
    panel.classList.add('menu', 'death');
    el('div', 'ptitle', panel).textContent = 'You died!';
    const b = el('button', 'mbtn', panel);
    b.textContent = 'Respawn';
    b.onclick = () => { if (this.onRespawn) this.onRespawn(); };
  }

  _buildSkills(panel) {
    panel.classList.add('menu', 'skills');
    el('div', 'ptitle', panel).textContent = 'Skills & Perks';
    const prog = this.progression;
    const pts = prog ? prog.pointsAvailable() : 0;
    const ptsEl = el('div', 'hint', panel);
    ptsEl.innerHTML = `Available skill points: <b>${pts}</b>`;
    const grid = el('div', 'perkgrid', panel);
    for (const p of PERKS) {
      const card = el('div', 'perk', grid);
      const t = el('div', 'perktitle', card); t.textContent = p.title;
      const d = el('div', 'perkdesc', card);  d.textContent = p.desc;
      const owned = prog && prog.hasPerk(p.id);
      const b = el('button', 'mbtn small', card);
      if (owned) { b.textContent = '✓ Unlocked'; b.disabled = true; b.classList.add('owned'); }
      else if (pts <= 0) { b.textContent = 'Need more levels'; b.disabled = true; }
      else {
        b.textContent = 'Unlock (1 pt)';
        b.onclick = () => { if (prog && prog.unlockPerk(p.id)) this._refreshOverlay(); };
      }
    }
    const back = el('button', 'mbtn', panel);
    back.textContent = 'Back';
    back.onclick = () => { this.audio.play('click'); this.close(); };
  }

  _buildHelp(panel) {
    panel.classList.add('menu', 'help');
    el('div', 'ptitle', panel).textContent = 'How to Play';

    // Build tutorial — the most-asked question
    const buildBox = el('div', 'helpsection', panel);
    el('div', 'helphdr', buildBox).textContent = '🏗️ How to Build';
    const buildSteps = [
      ['1', 'Press a number key', '6 = planks, 7 = dirt, 8 = cobblestone, 9 = logs'],
      ['2', 'Look at the ground in front of you', 'A faint outline shows where the block will go'],
      ['3', 'Right-click — or press R', 'A block appears! Repeat to make walls, floors, towers']
    ];
    const buildList = el('div', 'helpsteps', buildBox);
    for (const [n, action, hint] of buildSteps) {
      const row = el('div', 'helpstep', buildList);
      el('div', 'stepnum', row).textContent = n;
      const tx = el('div', 'steptext', row);
      el('b', null, tx).textContent = action;
      el('span', 'subtext', tx).textContent = hint;
    }
    el('div', 'hint', buildBox).innerHTML = 'Your <b>planks, dirt, cobble, logs, torches, sword, pickaxe and axe</b> never run out — they show <b>∞</b>. Build all you want!';

    // Mine tutorial
    const mineBox = el('div', 'helpsection', panel);
    el('div', 'helphdr', mineBox).textContent = '⛏️ How to Mine';
    const mineSteps = [
      ['1', 'Press 1', 'Wooden Pickaxe in hand'],
      ['2', 'Look at any stone or block', ''],
      ['3', 'Hold left-click — or press B', 'The block cracks, then breaks and you get it']
    ];
    const mineList = el('div', 'helpsteps', mineBox);
    for (const [n, action, hint] of mineSteps) {
      const row = el('div', 'helpstep', mineList);
      el('div', 'stepnum', row).textContent = n;
      const tx = el('div', 'steptext', row);
      el('b', null, tx).textContent = action;
      el('span', 'subtext', tx).textContent = hint;
    }

    // Mouse controls
    const mouseBox = el('div', 'helpsection', panel);
    el('div', 'helphdr', mouseBox).textContent = '🖱️ Mouse Controls';
    const mouseRows = [
      ['Move mouse', 'Look around'],
      ['Left click / hold', 'Mine blocks · attack monsters'],
      ['Right click', 'Place block · use · eat'],
      ['Scroll wheel', 'Cycle hotbar slots 1–9'],
      ['Click the screen', 'Re-locks the mouse if it slips out']
    ];
    const mtbl = el('div', 'helptable', mouseBox);
    for (const [k, v] of mouseRows) {
      const r = el('div', 'helprow', mtbl);
      el('b', null, r).textContent = k;
      el('span', null, r).textContent = v;
    }
    el('div', 'hint', mouseBox).innerHTML = 'If the mouse ever stops looking around, just <b>click the screen</b> once to grab it back. <b>B</b> (mine) and <b>R</b> (place) work too if you’d rather use the keyboard.';

    // Full keybindings
    const keysBox = el('div', 'helpsection', panel);
    el('div', 'helphdr', keysBox).textContent = '⌨️ All Keys';
    const rows = [
      ['W A S D', 'Move'], ['Mouse', 'Look around'], ['Space', 'Jump / swim up'],
      ['Ctrl or double-W', 'Sprint'], ['Shift', 'Sneak'],
      ['Left click (hold) or B', 'Mine block / attack'],
      ['Right click or R', 'Place block / use / eat'],
      ['1–9 / scroll', 'Choose hotbar item'],
      ['E', 'Inventory & 2×2 crafting'], ['K', 'Skills & perks'], ['Q', 'Drop item'],
      ['F', 'Toggle fly'], ['Space (flying)', 'Fly up'], ['Shift (flying)', 'Fly down'],
      ['M', 'Mute'], ['F3', 'Debug info'], ['Esc', 'Pause']
    ];
    const tbl = el('div', 'helptable', keysBox);
    for (const [k, v] of rows) {
      const r = el('div', 'helprow', tbl);
      el('b', null, r).textContent = k;
      el('span', null, r).textContent = v;
    }

    const b = el('button', 'mbtn', panel);
    b.textContent = 'Got it! Back to game';
    b.onclick = () => { this.audio.play('click'); this.close(); };
  }

  serialize() {
    return { inv: this.inv, sel: this.sel };
  }
  deserialize(d) {
    if (!d) return;
    if (Array.isArray(d.inv)) this.inv = d.inv.map(s => s || null).slice(0, 36);
    while (this.inv.length < 36) this.inv.push(null);
    this.sel = d.sel || 0;
    this.updateHotbar();
  }
}
