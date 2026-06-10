// items.js — item registry, tool stats, crafting recipes, smelting, mining math
"use strict";
import { B, blockDef } from './blocks.js';

// Stacks: { id: number(block) | string(item), count, dur? }
// ---------------------------------------------------------------- registry
const TIER = { wood: 0, stone: 1, iron: 2, gold: 3, diamond: 4 };
const SPEED = [2, 4, 6, 12, 8];
const DURA = [59, 131, 250, 32, 1561];
const SWORD_DMG = [4, 5, 6, 4, 7];
const TOOL_DMG = [2, 3, 4, 2, 5];

const MAT_COLORS = {
  wood: ['#a3824f', '#6e552f'], stone: ['#8a8a8a', '#5c5c5c'],
  iron: ['#d8d8d8', '#9a9a9a'], gold: ['#fcdb4a', '#c7a226'], diamond: ['#4fd8e0', '#2fa3b8']
};

export const ITEMS = {};
function item(id, name, opt = {}) { ITEMS[id] = Object.assign({ id, name, stack: 64 }, opt); }

item('stick', 'Stick');
item('coal', 'Coal');
item('iron_ingot', 'Iron Ingot');
item('gold_ingot', 'Gold Ingot');
item('diamond', 'Diamond');
item('redstone', 'Redstone Dust');
item('apple', 'Apple', { food: 4 });
item('porkchop', 'Raw Porkchop', { food: 3 });
item('porkchop_cooked', 'Cooked Porkchop', { food: 8 });
item('beef', 'Raw Beef', { food: 3 });
item('steak', 'Steak', { food: 8 });
item('chicken', 'Raw Chicken', { food: 2 });
item('chicken_cooked', 'Cooked Chicken', { food: 6 });
item('feather', 'Feather');
item('string', 'String');
item('gunpowder', 'Gunpowder');
item('bone', 'Bone');
item('rotten_flesh', 'Rotten Flesh', { food: 2 });

for (const mat of ['wood', 'stone', 'iron', 'gold', 'diamond']) {
  const t = TIER[mat], cap = mat[0].toUpperCase() + mat.slice(1);
  const matName = mat === 'wood' ? 'Wooden' : mat === 'gold' ? 'Golden' : cap;
  item(mat + '_pickaxe', matName + ' Pickaxe', { stack: 1, tool: { cls: 'pickaxe', tier: t, speed: SPEED[t], dura: DURA[t], dmg: TOOL_DMG[t] } });
  item(mat + '_axe', matName + ' Axe', { stack: 1, tool: { cls: 'axe', tier: t, speed: SPEED[t], dura: DURA[t], dmg: TOOL_DMG[t] + 1 } });
  item(mat + '_shovel', matName + ' Shovel', { stack: 1, tool: { cls: 'shovel', tier: t, speed: SPEED[t], dura: DURA[t], dmg: TOOL_DMG[t] - 1 } });
  item(mat + '_sword', matName + ' Sword', { stack: 1, tool: { cls: 'sword', tier: t, speed: 1.5, dura: DURA[t], dmg: SWORD_DMG[t] } });
}

export function itemDef(id) {
  if (typeof id === 'number') return blockDef(id);
  return ITEMS[id];
}
export function itemName(id) {
  const d = itemDef(id);
  return d ? d.name : '?';
}
export function maxStack(id) {
  if (typeof id === 'number') return 64;
  return (ITEMS[id] && ITEMS[id].stack) || 64;
}

// ---------------------------------------------------------------- icons (16x16 pixel art)
const iconCache = new Map();
export function itemIcon(id) { // returns canvas (string item ids only)
  if (iconCache.has(id)) return iconCache.get(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const c = cv.getContext('2d');
  const P = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  drawIcon(id, P, c);
  iconCache.set(id, cv);
  return cv;
}

function drawTool(P, kind, mat) {
  const [main, dark] = MAT_COLORS[mat];
  const stick = '#8a6238', stickD = '#6b4a2a';
  // diagonal handle
  const handle = [[6, 9], [7, 8], [8, 7], [5, 10], [4, 11], [3, 12]];
  if (kind === 'pickaxe') {
    for (const [x, y] of handle) { P(x, y, stick); P(x + 1, y, stickD); }
    const head = [[6, 3], [7, 3], [8, 3], [9, 3], [10, 4], [11, 5], [12, 6], [5, 4], [4, 5], [3, 6], [9, 4], [10, 5]];
    for (const [x, y] of head) P(x, y, main);
    P(6, 4, dark); P(7, 4, dark); P(8, 4, dark);
  } else if (kind === 'axe') {
    for (const [x, y] of handle) { P(x, y, stick); P(x + 1, y, stickD); }
    for (const [x, y] of [[7, 2], [8, 2], [9, 3], [9, 4], [8, 5], [7, 5], [6, 3], [6, 4], [7, 3], [7, 4], [8, 3], [8, 4], [10, 4]]) P(x, y, main);
    P(7, 3, dark); P(8, 4, dark);
  } else if (kind === 'shovel') {
    for (const [x, y] of [[7, 8], [8, 7], [9, 6], [6, 9], [5, 10], [4, 11]]) { P(x, y, stick); P(x + 1, y, stickD); }
    for (const [x, y] of [[10, 3], [11, 3], [11, 4], [12, 4], [10, 4], [11, 2], [12, 3], [10, 5], [12, 5], [11, 5]]) P(x, y, main);
    P(11, 4, dark);
  } else { // sword
    for (const [x, y] of [[4, 12], [5, 11]]) { P(x, y, stickD); P(x + 1, y, stick); }
    P(3, 10, dark); P(4, 9, dark); P(6, 12, dark); P(7, 11, dark); P(5, 10, dark); P(6, 10, dark); P(5, 9, dark);
    for (let i = 0; i < 7; i++) { P(6 + i, 8 - i, main); P(7 + i, 8 - i, i === 6 ? main : dark); }
    P(13, 2, main);
  }
}

function drawIcon(id, P, c) {
  const m = id.match(/^(wood|stone|iron|gold|diamond)_(pickaxe|axe|shovel|sword)$/);
  if (m) { drawTool(P, m[2], m[1]); return; }
  switch (id) {
    case 'stick':
      for (let i = 0; i < 8; i++) { P(4 + i, 12 - i, '#8a6238'); P(5 + i, 12 - i, '#6b4a2a'); } break;
    case 'coal':
      blob(P, '#2b2b2b', '#1a1a1a', '#3f3f3f'); break;
    case 'iron_ingot': ingot(P, '#d8d8d8', '#9a9a9a', '#f0f0f0'); break;
    case 'gold_ingot': ingot(P, '#fcdb4a', '#c7a226', '#fff08a'); break;
    case 'diamond':
      for (const [x, y] of [[7, 3], [8, 3], [6, 4], [9, 4], [5, 5], [10, 5], [5, 6], [10, 6], [6, 7], [9, 7], [7, 8], [8, 8]]) P(x, y, '#4fd8e0');
      for (const [x, y] of [[7, 4], [8, 4], [6, 5], [7, 5], [8, 5], [9, 5], [6, 6], [7, 6], [8, 6], [9, 6], [7, 7], [8, 7]]) P(x, y, '#8af0f5');
      P(7, 5, '#d2fbfd'); break;
    case 'redstone':
      for (const [x, y] of [[6, 8], [7, 7], [8, 8], [9, 9], [5, 9], [7, 9], [8, 10], [6, 10], [9, 7], [10, 8]]) P(x, y, '#c41818');
      P(7, 8, '#ff3b2e'); P(8, 9, '#ff3b2e'); break;
    case 'apple':
      for (let y = 5; y <= 11; y++) for (let x = 5; x <= 10; x++) {
        const dx = x - 7.5, dy = y - 8; if (dx * dx / 9 + dy * dy / 10 <= 1) P(x, y, '#c41818');
      }
      P(6, 6, '#ff6b5e'); P(7, 6, '#ff6b5e'); P(6, 7, '#ff6b5e');
      P(8, 4, '#6b4a2a'); P(8, 3, '#6b4a2a'); P(9, 3, '#3f7a2a'); P(10, 3, '#3f7a2a'); break;
    case 'porkchop': meat(P, '#f08a98', '#d86878', '#fbd2d8'); break;
    case 'porkchop_cooked': meat(P, '#b8825a', '#96603c', '#dba87a'); break;
    case 'beef': meat(P, '#c43c3c', '#962a2a', '#e87a7a'); break;
    case 'steak': meat(P, '#7a4a2a', '#5c351c', '#9a6a42'); break;
    case 'chicken': meat(P, '#f0c8a8', '#d8a880', '#fbe8d2'); break;
    case 'chicken_cooked': meat(P, '#c8904a', '#a87232', '#e0b87a'); break;
    case 'feather':
      for (let i = 0; i < 8; i++) { P(5 + i, 12 - i, '#e8e8e8'); P(6 + i, 12 - i, '#ffffff'); P(5 + i, 11 - i, '#cfcfcf'); }
      P(4, 13, '#9a9a9a'); break;
    case 'string':
      for (const [x, y] of [[5, 4], [6, 5], [6, 6], [7, 7], [7, 8], [8, 9], [8, 10], [9, 11]]) P(x, y, '#e8e8e8'); break;
    case 'gunpowder': blob(P, '#5c5c5c', '#3f3f3f', '#7a7a7a'); break;
    case 'bone':
      for (let i = 0; i < 6; i++) P(5 + i, 10 - i, '#f0f0e0');
      P(4, 11, '#f0f0e0'); P(4, 12, '#f0f0e0'); P(5, 12, '#f0f0e0'); P(10, 5, '#f0f0e0'); P(11, 5, '#f0f0e0'); P(11, 4, '#f0f0e0'); P(10, 4, '#fafaf0'); break;
    case 'rotten_flesh': meat(P, '#8a5c3c', '#5c8a3c', '#6b4a2a'); break;
    default:
      c.fillStyle = '#f0f'; c.fillRect(4, 4, 8, 8);
  }
}
function blob(P, a, b, hi) {
  for (const [x, y] of [[6, 5], [7, 5], [8, 5], [9, 6], [5, 6], [5, 7], [6, 8], [7, 9], [8, 9], [9, 8], [10, 7], [6, 6], [7, 6], [8, 6], [6, 7], [7, 7], [8, 7], [9, 7], [7, 8], [8, 8]]) P(x, y, a);
  P(7, 7, b); P(8, 8, b); P(6, 6, hi);
}
function ingot(P, a, b, hi) {
  for (let y = 7; y <= 10; y++) for (let x = 3 + (10 - y); x <= 9 + (10 - y); x++) P(x, y, a);
  for (let x = 3; x <= 9; x++) P(x, 11, b);
  for (let i = 0; i < 4; i++) P(12 - i, 7 + i, b);
  for (let x = 6; x <= 12; x++) P(x, 6, hi);
}
function meat(P, a, b, hi) {
  for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
    const dx = x - 7.5, dy = y - 7.5;
    if (dx * dx + dy * dy * 1.4 <= 13) P(x, y, a);
  }
  P(6, 6, hi); P(7, 6, hi); P(6, 7, hi);
  P(9, 9, b); P(8, 10, b); P(10, 8, b);
}

// ---------------------------------------------------------------- crafting
// pattern: array of strings; key: char -> id matcher
const RECIPES = [];
function shaped(pattern, key, out, outCount = 1) { RECIPES.push({ type: 'shaped', pattern, key, out, outCount }); }
function shapeless(inputs, out, outCount = 1) { RECIPES.push({ type: 'shapeless', inputs, out, outCount }); }

const ANY_PLANKS = [B.OAK_PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS];
const ANY_LOG = [B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG];

shapeless([ANY_LOG], B.OAK_PLANKS, 4);   // resolved dynamically: log type → its planks
shaped(['P', 'P'], { P: ANY_PLANKS }, 'stick', 4);
shaped(['PP', 'PP'], { P: ANY_PLANKS }, B.CRAFTING, 1);
shaped(['CCC', 'C C', 'CCC'], { C: [B.COBBLE] }, B.FURNACE, 1);
shaped(['PPP', 'P P', 'PPP'], { P: ANY_PLANKS }, B.CHEST, 1);
shaped(['C', 'S'], { C: ['coal'], S: ['stick'] }, B.TORCH, 4);
shaped(['SS', 'SS'], { S: [B.STONE] }, B.STONE_BRICKS, 4);
shaped(['SS', 'SS'], { S: [B.SAND] }, B.SANDSTONE, 1);
shaped(['RRR', 'R R', 'RRR'], { R: ['redstone'] }, B.GLOWSTONE, 1);

const TOOL_MATS = [
  ['wood', ANY_PLANKS], ['stone', [B.COBBLE]], ['iron', ['iron_ingot']],
  ['gold', ['gold_ingot']], ['diamond', ['diamond']]
];
for (const [mat, M] of TOOL_MATS) {
  shaped(['MMM', ' S ', ' S '], { M, S: ['stick'] }, mat + '_pickaxe');
  shaped(['MM', 'MS', ' S'], { M, S: ['stick'] }, mat + '_axe');
  shaped(['MM', 'SM', 'S '], { M, S: ['stick'] }, mat + '_axe'); // mirrored
  shaped(['M', 'S', 'S'], { M, S: ['stick'] }, mat + '_shovel');
  shaped(['M', 'M', 'S'], { M, S: ['stick'] }, mat + '_sword');
}

// match a grid (array of 9 or 4 stacks, row-major) → {out, outCount, planksFix} | null
export function matchRecipe(grid, w) {
  const h = grid.length / w;
  // bounds of non-empty cells
  let minX = w, minY = h, maxX = -1, maxY = -1, items = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = grid[y * w + x];
    if (s) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); items.push(s.id); }
  }
  if (maxX < 0) return null;
  const gw = maxX - minX + 1, gh = maxY - minY + 1;

  for (const r of RECIPES) {
    if (r.type === 'shapeless') {
      if (items.length !== r.inputs.length) continue;
      // single-input shapeless (logs)
      const matcher = r.inputs[0];
      if (items.length === 1 && matcher.includes(items[0])) {
        let out = r.out;
        if (items[0] === B.BIRCH_LOG) out = B.BIRCH_PLANKS;
        else if (items[0] === B.SPRUCE_LOG) out = B.SPRUCE_PLANKS;
        return { out, outCount: r.outCount };
      }
      continue;
    }
    const pw = r.pattern[0].length, ph = r.pattern.length;
    if (pw !== gw || ph !== gh) continue;
    let ok = true;
    for (let y = 0; y < gh && ok; y++) for (let x = 0; x < gw && ok; x++) {
      const ch = r.pattern[y][x];
      const s = grid[(y + minY) * w + (x + minX)];
      if (ch === ' ') { if (s) ok = false; continue; }
      if (!s) { ok = false; continue; }
      const allowed = r.key[ch];
      if (!allowed || !allowed.includes(s.id)) ok = false;
    }
    if (ok) return { out: r.out, outCount: r.outCount };
  }
  return null;
}

// ---------------------------------------------------------------- smelting
const SMELT = new Map([
  [B.IRON_ORE, { out: 'iron_ingot', count: 1 }],
  [B.GOLD_ORE, { out: 'gold_ingot', count: 1 }],
  [B.SAND, { out: B.GLASS, count: 1 }],
  [B.COBBLE, { out: B.STONE, count: 1 }],
  ['porkchop', { out: 'porkchop_cooked', count: 1 }],
  ['beef', { out: 'steak', count: 1 }],
  ['chicken', { out: 'chicken_cooked', count: 1 }],
  [B.OAK_LOG, { out: 'coal', count: 1 }],
  [B.BIRCH_LOG, { out: 'coal', count: 1 }],
  [B.SPRUCE_LOG, { out: 'coal', count: 1 }]
]);
export function smeltResult(id) { return SMELT.get(id) || null; }
export function fuelValue(id) { // number of smelts
  if (id === 'coal') return 8;
  if (ANY_LOG.includes(id)) return 1.5;
  if (ANY_PLANKS.includes(id)) return 1.5;
  if (id === 'stick') return 0.5;
  if (id === B.CRAFTING || id === B.CHEST || id === B.BOOKSHELF) return 1.5;
  return 0;
}

// ---------------------------------------------------------------- mining math
export function breakSeconds(def, held) {
  if (def.hardness < 0) return Infinity;
  if (def.hardness === 0) return 0.05;
  const tool = held && typeof held.id === 'string' && ITEMS[held.id] && ITEMS[held.id].tool;
  const needsTool = def.minTier >= 0;
  const rightClass = tool && def.tool && tool.cls === def.tool;
  const canHarvest = !needsTool || (rightClass && tool.tier >= def.minTier);
  let t = def.hardness * (canHarvest ? 1.5 : 5);
  if (rightClass) t /= tool.speed;
  if (def.tool === 'sword' || (tool && tool.cls === 'sword' && def.name.includes('Leaves'))) t /= 1.5;
  return Math.max(0.05, t);
}
export function canHarvest(def, held) {
  if (def.minTier < 0) return true;
  const tool = held && typeof held.id === 'string' && ITEMS[held.id] && ITEMS[held.id].tool;
  return !!(tool && def.tool && tool.cls === def.tool && tool.tier >= def.minTier);
}
export function attackDamage(held) {
  const tool = held && typeof held.id === 'string' && ITEMS[held.id] && ITEMS[held.id].tool;
  return tool ? tool.dmg : 1;
}
