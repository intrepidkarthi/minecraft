// main.js — game bootstrap + loop: input, mining/placing, combat, furnaces, saving
"use strict";
import * as THREE from '../vendor/three.module.js';
import { B, blockDef, atlasCanvas, TILE, ATLAS_COLS } from './blocks.js';
import { World } from './world.js';
import { CX, CZ, SEA } from './worldgen.js';
import { Renderer } from './renderer.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Particles } from './particles.js';
import { GameAudio } from './audio.js';
import { UI, iconFor } from './ui.js';
import { itemDef, breakSeconds, canHarvest, attackDamage, smeltResult, fuelValue, ITEMS } from './items.js';
import { Achievements } from './achievements.js';
import { Progression } from './progression.js';

const HAS_API = !!(window.gameAPI && window.gameAPI.isElectron);
const Store = {
  async load() { try { if (HAS_API) return await window.gameAPI.load(); const r = localStorage.getItem('minecrAft_w2'); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  async save(d) { try { if (HAS_API) return await window.gameAPI.save(d); localStorage.setItem('minecrAft_w2', JSON.stringify(d)); return true; } catch (e) { return false; } },
  async clear() { try { if (HAS_API) return await window.gameAPI.clear(); localStorage.removeItem('minecrAft_w2'); } catch (e) { } }
};

const DAY_LEN = 720; // seconds for a full day/night cycle

// ============================================================ boot
const loadingEl = document.getElementById('loading');
const loadingBar = document.getElementById('loadbar');
const playOverlay = document.getElementById('playoverlay');
const canvas = document.getElementById('game');

let world, renderer, player, ui, entities, particles, audio, achievements, progression;
let timeOfDay = 0.02;
let saveData = null;
let running = false;

async function boot() {
  saveData = await Store.load();
  if (saveData && saveData.version !== 2) saveData = null; // old format → fresh world

  const seed = saveData ? saveData.seed : (Math.random() * 2 ** 31) | 0;
  world = new World(seed);
  if (saveData) {
    timeOfDay = saveData.time || 0.02;
    if (saveData.edits) for (const [k, v] of saveData.edits) world.edits.set(k, v);
    if (saveData.containers) for (const [k, v] of saveData.containers) world.containers.set(k, v);
  }

  audio = new GameAudio();
  renderer = new Renderer(canvas, world);
  particles = new Particles(renderer.scene);
  player = new Player(world);
  ui = new UI(audio);
  ui.renderDist = renderer.renderDist;
  entities = new Entities(world, renderer.scene, player, particles, audio);
  achievements = new Achievements(ui, audio);
  progression = new Progression(ui, audio, player, entities);
  ui.onCraft = () => achievements.onCraft();

  // spawn point
  let spawn;
  if (saveData && saveData.player) {
    const sp = saveData.player;
    player.pos = { x: sp.pos[0], y: sp.pos[1], z: sp.pos[2] };
    player.yaw = sp.yaw; player.pitch = sp.pitch;
    player.hp = sp.hp; player.hunger = sp.hunger;
    player.flying = !!sp.flying;
    player.spawn = sp.spawn ? { x: sp.spawn[0], y: sp.spawn[1], z: sp.spawn[2] } : { ...player.pos };
    ui.deserialize(saveData.ui);
    entities.deserialize(saveData.drops);
    achievements.deserialize(saveData.ach);
    progression.deserialize(saveData.prog);
  } else {
    spawn = world.gen.findSpawn();
    player.pos = { ...spawn };
    player.spawn = { ...spawn };
    // starter kit for Adyah. Marked `unlimited: true` so blocks never
    // deplete and tools never break — Adyah can keep building forever.
    // Anything he picks up later behaves normally.
    const kit = (id, count) => ({ id, count, unlimited: true });
    const tool = (id) => ({ id, count: 1, dur: ITEMS[id].tool.dura, unlimited: true });
    ui.inv[0] = tool('wood_pickaxe');
    ui.inv[1] = tool('wood_axe');
    ui.inv[2] = tool('wood_sword');
    ui.inv[3] = kit(B.TORCH,      64);
    ui.inv[4] = kit('apple',      10);
    ui.inv[5] = kit(B.OAK_PLANKS, 64);
    ui.inv[6] = kit(B.DIRT,       64);
    ui.inv[7] = kit(B.COBBLE,     64);
    ui.inv[8] = kit(B.OAK_LOG,    64);
  }
  ui.updateHotbar(); ui.updateHUD(player);

  // pregenerate spawn area with progress bar
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      renderer.syncChunks(player.pos.x, player.pos.z, 28);
      const pcx = Math.floor(player.pos.x / CX), pcz = Math.floor(player.pos.z / CZ);
      let done = 0, total = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        total++;
        const c = world.chunkAt(pcx + dx, pcz + dz);
        if (c && c.meshed) done++;
      }
      loadingBar.style.width = Math.round(done / total * 100) + '%';
      if (done >= total || performance.now() - t0 > 12000) resolve();
      else requestAnimationFrame(step);
    };
    step();
  });

  // settle player on ground
  if (!saveData) player.pos.y = world.surfaceY(Math.floor(player.pos.x), Math.floor(player.pos.z)) + 1.2;

  loadingEl.style.display = 'none';
  playOverlay.style.display = 'flex';
  running = true;
  requestAnimationFrame(loop);
}

// ============================================================ input
const keys = {};
let mouseDown = [false, false, false];
let lastWTap = 0, wantSprint = false;
let swingT = 1; // viewmodel swing timer
let attackCd = 0;

document.addEventListener('keydown', (e) => {
  if (e.repeat || !ui) return;
  keys[e.code] = true;
  if (e.code === 'KeyW') {
    const now = performance.now();
    if (now - lastWTap < 280) wantSprint = true;
    lastWTap = now;
  }
  if (e.code === 'Escape') {
    if (ui.overlay === 'death') return;
    if (ui.isOpen()) ui.close();
    else { ui.open('pause'); document.exitPointerLock(); }
    return;
  }
  if (e.code === 'KeyK' && !ui.isOpen()) { ui.open('skills'); document.exitPointerLock(); return; }
  if (ui.isOpen() && ui.overlay !== 'pause') {
    if (e.code === 'KeyE') ui.close();
    return;
  }
  if (ui.isOpen()) return;
  if (e.code === 'KeyE') { ui.open('inventory'); document.exitPointerLock(); }
  if (e.code === 'KeyF') { player.flying = !player.flying; ui.toast(player.flying ? 'Flying: ON' : 'Flying: OFF'); }
  if (e.code === 'KeyR') rightClick();              // keyboard alternative for placement / use
  if (e.code === 'KeyB') { mouseDown[0] = true; swingT = 0; }  // keyboard alternative for mine / attack
  if (e.code === 'KeyM') { const m = audio.toggleMute(); ui.toast(m ? 'Sound muted' : 'Sound on'); }
  if (e.code === 'F3') { debugOn = !debugOn; ui.showDebug(debugOn); }
  if (e.code === 'KeyQ') dropSelected();
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 9) { ui.sel = n - 1; ui.updateHotbar(); }
  }
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyW') wantSprint = false;
  if (e.code === 'KeyB') mouseDown[0] = false;
});
window.addEventListener('wheel', (e) => {
  if (!ui || ui.isOpen()) return;
  ui.sel = (ui.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
  ui.updateHotbar();
});
document.addEventListener('mousedown', (e) => {
  if (!running || ui.isOpen()) return;
  // Allow gameplay clicks even without pointer-lock (Mac trackpad can lose it easily).
  // The play overlay covers the canvas before first play, so we won't accidentally fire then.
  mouseDown[e.button] = true;
  if (e.button === 2) rightClick();
  if (e.button === 0) { swingT = 0; }
  // If pointer-lock isn't active, this click can re-acquire it transparently
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener('mouseup', (e) => { mouseDown[e.button] = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousemove', (e) => {
  if (!ui || document.pointerLockElement !== canvas || ui.isOpen()) return;
  player.yaw -= e.movementX * 0.0023;
  player.pitch -= e.movementY * 0.0023;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});

playOverlay.addEventListener('mousedown', (e) => {
  // Swallow this click so the document handler below doesn't also count it as a
  // mine/place. The user clicked to resume; they didn't mean to swing.
  e.stopPropagation();
});
let firstLaunch = true;
playOverlay.addEventListener('click', () => {
  playOverlay.style.display = 'none';
  // First-launch tutorial: show help dialog if this is a fresh world
  if (firstLaunch && !saveData) {
    firstLaunch = false;
    ui.open('pause'); ui.overlay = 'help'; ui._refreshOverlay();
    return;
  }
  canvas.requestPointerLock();
  audio._ensure();
});
document.addEventListener('pointerlockchange', () => {
  // Pointer-lock can drop for many reasons on macOS (Esc, focus loss, gesture). Don't
  // jam the user into a pause menu — show the click-to-resume overlay instead so a
  // single click puts them back in the game.
  if (document.pointerLockElement !== canvas && ui && !ui.isOpen() && running && !player.dead) {
    playOverlay.style.display = 'flex';
  }
});

// reacquire pointer lock when UI closes
function uiClosed() {
  if (!player.dead) canvas.requestPointerLock();
}

// ============================================================ interaction
let mineTarget = null, mineProgress = 0, mineTime = 0;
let debugOn = false;
let hintedPlace = false;

function eyeRay() {
  const e = player.eyePos(), d = player.lookDir();
  return { e, d };
}

function rightClick() {
  const { e, d } = eyeRay();
  const hit = world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, player.reach);
  const held = ui.selected();

  // interactive blocks
  if (hit) {
    const id = hit.id;
    if (id === B.CRAFTING) { ui.open('crafting'); document.exitPointerLock(); return; }
    if (id === B.FURNACE || id === B.FURNACE_LIT) {
      const k = hit.x + ',' + hit.y + ',' + hit.z;
      let st = world.containers.get(k);
      if (!st) { st = { type: 'furnace', in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 }; world.containers.set(k, st); }
      ui.open('furnace', { type: 'furnace', state: st, pos: k });
      document.exitPointerLock(); return;
    }
    if (id === B.CHEST) {
      const k = hit.x + ',' + hit.y + ',' + hit.z;
      let st = world.containers.get(k);
      if (!st) { st = { type: 'chest', slots: new Array(27).fill(null) }; world.containers.set(k, st); }
      ui.open('chest', { type: 'chest', slots: st.slots, pos: k });
      document.exitPointerLock(); return;
    }
  }

  if (!held) return;

  // eat food
  const def = itemDef(held.id);
  if (def && def.food) {
    if (player.hunger < 20) {
      player.eat(def.food);
      ui.consumeSelected();
      audio.play('eat'); setTimeout(() => audio.play('burp'), 250);
      ui.updateHUD(player);
      swingT = 0;
    }
    return;
  }

  // place block
  if (typeof held.id !== 'number') {
    // tool/item selected — gentle one-time hint that placement needs a block in hand
    if (hit && !hintedPlace) { ui.toast('📦 Press 6, 7, 8 or 9 to pick a block to place'); hintedPlace = true; }
    return;
  }
  if (!hit) return;
  const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
  const targetId = world.getBlock(px, py, pz);
  if (!blockDef(targetId).replaceable) return;
  const bdef = blockDef(held.id);
  // placement rules
  if (bdef.cross) {
    const below = world.getBlock(px, py - 1, pz);
    if (held.id === B.TORCH) {
      let support = blockDef(below).solid;
      if (!support) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (blockDef(world.getBlock(px + dx, py, pz + dz)).solid) support = true;
      if (!support) return;
    } else if (!blockDef(below).solid) return;
  }
  // don't place solid blocks inside player
  if (bdef.solid) {
    const overlapX = Math.abs(player.pos.x - (px + 0.5)) < 0.5 + player.hw;
    const overlapZ = Math.abs(player.pos.z - (pz + 0.5)) < 0.5 + player.hw;
    const overlapY = player.pos.y < py + 1 && player.pos.y + player.h > py;
    if (overlapX && overlapZ && overlapY) return;
  }
  world.setBlock(px, py, pz, held.id);
  ui.consumeSelected();
  audio.play('place');
  achievements.onPlace(held.id);
  swingT = 0;
}

function dropSelected() {
  const s = ui.selected();
  if (!s) return;
  const d = player.lookDir();
  const e = player.eyePos();
  entities.dropItem({ id: s.id, count: 1, dur: s.dur }, e.x + d.x * 0.5, e.y - 0.3, e.z + d.z * 0.5,
    { x: d.x * 6, y: d.y * 6 + 2, z: d.z * 6 });
  ui.consumeSelected();
}

function doMining(dt) {
  if (!mouseDown[0] || ui.isOpen() || player.dead) {
    mineTarget = null; mineProgress = 0;
    renderer.setCrack(null, 0);
    return;
  }
  const { e, d } = eyeRay();

  // attack mobs first
  if (attackCd <= 0) {
    const mobHit = entities.raycastMob(e.x, e.y, e.z, d.x, d.y, d.z, 3.6);
    const blockHit = world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, 3.6);
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      const held = ui.selected();
      entities.hitMob(mobHit.mob, attackDamage(held) + (player.attackBonus || 0), d.x, d.z);
      if (held && typeof held.id === 'string' && ITEMS[held.id] && ITEMS[held.id].tool) ui.damageSelectedTool();
      attackCd = 0.35;
      swingT = 0;
      mineTarget = null; mineProgress = 0;
      renderer.setCrack(null, 0);
      return;
    }
  }

  const hit = world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, player.reach);
  if (!hit) { mineTarget = null; mineProgress = 0; renderer.setCrack(null, 0); return; }
  const def = blockDef(hit.id);
  if (def.hardness < 0 && !player.flying) { renderer.setCrack(null, 0); return; }

  const tkey = hit.x + ',' + hit.y + ',' + hit.z;
  if (mineTarget !== tkey) {
    mineTarget = tkey;
    mineProgress = 0;
    mineTime = player.flying ? 0.12 : breakSeconds(def, ui.selected());
  }
  swingT = Math.min(swingT, 0.25); // keep swinging
  mineProgress += dt / mineTime;
  if (Math.random() < dt * 9) {
    audio.play('dig', def.sound);
    particles.burst(hit.x + 0.5 + hit.face[0] * 0.55, hit.y + 0.5 + hit.face[1] * 0.55, hit.z + 0.5 + hit.face[2] * 0.55,
      0x888888, 1, { speed: 1.5 });
  }
  renderer.setCrack(hit, mineProgress);

  if (mineProgress >= 1) {
    breakBlock(hit, def);
    mineTarget = null; mineProgress = 0;
    renderer.setCrack(null, 0);
  }
}

function breakBlock(hit, def) {
  // chest contents spill
  const k = hit.x + ',' + hit.y + ',' + hit.z;
  const cont = world.containers.get(k);
  if (cont) {
    const slots = cont.type === 'chest' ? cont.slots : [cont.in, cont.fuel, cont.out];
    for (const s of slots) if (s) entities.dropItem(s, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    world.containers.delete(k);
  }

  world.setBlock(hit.x, hit.y, hit.z, B.AIR);
  particles.blockBreak(hit.x, hit.y, hit.z, hit.id);
  audio.play('break', def.sound);
  achievements.onBreak(hit.id);
  progression.onBreakOre(hit.id);

  // drops
  if (!player.flying) {
    let drops = [];
    if (typeof def.drop === 'string' && def.drop.startsWith('leaves')) {
      if (Math.random() < 0.05) drops.push({ id: 'apple', count: 1 });
    } else if (def.drop) {
      if (def.drop.count > 0) {
        if (canHarvest(def, ui.selected())) drops.push({ id: def.drop.id !== undefined ? def.drop.id : def.drop.item, count: def.drop.count });
      }
    } else {
      if (canHarvest(def, ui.selected())) drops.push({ id: hit.id, count: 1 });
    }
    for (const s of drops) entities.dropItem(s, hit.x + 0.5, hit.y + 0.3, hit.z + 0.5);
    const held = ui.selected();
    if (held && typeof held.id === 'string' && ITEMS[held.id] && ITEMS[held.id].tool && def.hardness > 0) ui.damageSelectedTool();
    player.exhaustion += 0.03;
  } else {
    // flying = creative-ish: still give the block
    const id = def.drop && def.drop.id !== undefined ? def.drop.id : hit.id;
  }
}

// creeper explosions
function explode(x, y, z, r) {
  audio.play('explosion');
  particles.explosion(x, y, z);
  const r2 = r * r;
  for (let bx = Math.floor(x - r); bx <= x + r; bx++)
    for (let by = Math.floor(y - r); by <= y + r; by++)
      for (let bz = Math.floor(z - r); bz <= z + r; bz++) {
        const dx = bx + 0.5 - x, dy = by + 0.5 - y, dz = bz + 0.5 - z;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const id = world.getBlock(bx, by, bz);
        if (id === B.AIR || id === B.WATER || id === B.BEDROCK || id === B.OBSIDIAN || id === B.LAVA) continue;
        world.setBlock(bx, by, bz, B.AIR);
        if (Math.random() < 0.25) entities.dropItem({ id, count: 1 }, bx + 0.5, by + 0.5, bz + 0.5);
      }
  // damage player
  const pd = Math.hypot(player.pos.x - x, player.pos.y + 0.9 - y, player.pos.z - z);
  if (pd < r * 2) {
    player.damage(Math.round((1 - pd / (r * 2)) * 16), 'explosion');
    const kx = (player.pos.x - x) / (pd || 1), kz = (player.pos.z - z) / (pd || 1);
    player.vel.x += kx * 12; player.vel.z += kz * 12; player.vel.y += 7;
  }
}

// furnace simulation (runs even when closed)
function tickFurnaces(dt) {
  for (const [k, st] of world.containers) {
    if (st.type !== 'furnace') continue;
    const canSmelt = () => {
      if (!st.in) return false;
      const r = smeltResult(st.in.id);
      if (!r) return false;
      if (!st.out) return true;
      return st.out.id === r.out && st.out.count + r.count <= 64;
    };
    let changed = false;
    if (st.burn > 0) {
      st.burn -= dt;
      if (canSmelt()) {
        st.cook += dt;
        if (st.cook >= 10) {
          st.cook = 0;
          const r = smeltResult(st.in.id);
          st.in.count--; if (st.in.count <= 0) st.in = null;
          if (st.out) st.out.count += r.count; else st.out = { id: r.out, count: r.count };
          changed = true;
        }
      } else st.cook = Math.max(0, st.cook - dt * 2);
    } else {
      st.cook = Math.max(0, st.cook - dt * 2);
      if (canSmelt() && st.fuel) {
        const fv = fuelValue(st.fuel.id);
        if (fv > 0) {
          st.fuel.count--; if (st.fuel.count <= 0) st.fuel = null;
          st.burn = fv * 10; st.burnMax = st.burn;
          changed = true;
        }
      }
    }
    // sync lit state
    const [x, y, z] = k.split(',').map(Number);
    const cur = world.getBlock(x, y, z);
    if (st.burn > 0 && cur === B.FURNACE) world.setBlock(x, y, z, B.FURNACE_LIT);
    else if (st.burn <= 0 && cur === B.FURNACE_LIT) world.setBlock(x, y, z, B.FURNACE);
    if (changed && ui.overlay === 'furnace' && ui.container && ui.container.state === st) ui._refreshOverlay();
  }
  // live progress bar while a furnace screen is open
  furnaceUiT += dt;
  if (ui.overlay === 'furnace' && furnaceUiT > 0.3 && !ui.cursor) { furnaceUiT = 0; ui._refreshOverlay(); }
}
let furnaceUiT = 0;

function actionHintFor(held) {
  if (!held) return '✋ Press 1–9 to pick an item';
  if (typeof held.id === 'number') {
    if (held.id === B.TORCH) return '🔥 Right-click or R to place a torch';
    return '🧱 Right-click or R to place a block';
  }
  const d = ITEMS[held.id];
  if (d && d.food)  return '🍎 Right-click or R to eat';
  if (d && d.tool) {
    if (d.tool.cls === 'pickaxe') return '⛏️  Hold left-click or B to mine stone';
    if (d.tool.cls === 'axe')     return '🪓 Hold left-click or B to chop wood';
    if (d.tool.cls === 'sword')   return '⚔️  Left-click or B to attack monsters';
    if (d.tool.cls === 'shovel')  return '🥄 Hold left-click or B to dig dirt';
  }
  return '';
}

// ============================================================ view model (held item)
let vmGroup = null, vmMesh = null, vmHeld = null;
function makeHeldMesh(id) {
  if (typeof id === 'number') {
    const def = blockDef(id);
    const mats = [];
    for (let f = 0; f < 6; f++) {
      const t = def.tex[f];
      const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
      cv.getContext('2d').drawImage(atlasCanvas, (t % ATLAS_COLS) * TILE, ((t / ATLAS_COLS) | 0) * TILE, TILE, TILE, 0, 0, TILE, TILE);
      const tx = new THREE.CanvasTexture(cv);
      tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
      mats.push(new THREE.MeshBasicMaterial({ map: tx, transparent: !def.opaque, alphaTest: def.opaque ? 0 : 0.3 }));
    }
    return new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mats);
  }
  const tex = new THREE.CanvasTexture(iconFor(id));
  tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
  m.rotation.set(0, -0.3, 0);
  return m;
}
function updateViewModel(dt) {
  if (!vmGroup) {
    vmGroup = new THREE.Group();
    renderer.camera.add(vmGroup);
    renderer.scene.add(renderer.camera);
  }
  const held = ui.selected();
  const hid = held ? held.id : null;
  if (hid !== vmHeld) {
    vmHeld = hid;
    if (vmMesh) { vmGroup.remove(vmMesh); }
    vmMesh = hid !== null ? makeHeldMesh(hid) : null;
    if (vmMesh) vmGroup.add(vmMesh);
  }
  if (!vmMesh) return;
  swingT = Math.min(1, swingT + dt * 3.2);
  const sw = Math.sin(swingT * Math.PI) * 1.1;
  const bob = Math.sin(player.bobPhase * 2) * 0.018 * player.bobAmt;
  vmGroup.position.set(0.34, -0.34 + bob, -0.55);
  vmGroup.rotation.set(-sw * 0.9 + bob * 2, sw * 0.5, -sw * 0.3);
  // light tint
  const lx = Math.floor(player.pos.x), ly = Math.floor(player.pos.y + 1), lz = Math.floor(player.pos.z);
  const lv = 0.3 + 0.7 * Math.max(world.getBlk(lx, ly, lz), world.getSky(lx, ly, lz) * renderer.sky.dayFactor) / 15;
  vmMesh.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => mt.color.setScalar(lv)); });
}

// ============================================================ save
function buildSave() {
  return {
    version: 2,
    seed: world.seed,
    time: timeOfDay,
    player: {
      pos: [player.pos.x, player.pos.y, player.pos.z],
      yaw: player.yaw, pitch: player.pitch,
      hp: player.hp, hunger: player.hunger, flying: player.flying,
      spawn: [player.spawn.x, player.spawn.y, player.spawn.z]
    },
    ui: ui.serialize(),
    edits: [...world.edits],
    containers: [...world.containers],
    drops: entities.serialize(),
    ach: achievements.serialize(),
    prog: progression.serialize()
  };
}
let saveTimer = 0;
async function doSave() { await Store.save(buildSave()); }

if (HAS_API) {
  window.gameAPI.onFlushSave(async () => { await doSave(); window.gameAPI.flushDone(); });
  window.gameAPI.onNewWorld(async () => { await Store.clear(); location.reload(); });
  window.gameAPI.onShowHelp(() => { if (!ui.isOpen()) { ui.open('pause'); ui.overlay = 'help'; ui._refreshOverlay(); document.exitPointerLock(); } });
}

// ============================================================ loop
let last = performance.now();
let fps = 0, fpsN = 0, fpsT = 0;
let wasInWater = false;
let stepT = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const elapsed = now / 1000;

  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }

  const paused = ui.isOpen() && (ui.overlay === 'pause' || ui.overlay === 'help');
  timeOfDay = (timeOfDay + (paused ? 0 : dt / DAY_LEN)) % 1;
  const isNight = timeOfDay > 0.52 && timeOfDay < 0.98;

  if (!paused) {
    const input = {
      forward: keys['KeyW'], back: keys['KeyS'], left: keys['KeyA'], right: keys['KeyD'],
      jump: keys['Space'], sneak: keys['ShiftLeft'] || keys['ShiftRight'],
      sprint: keys['ControlLeft'] || wantSprint
    };
    if (ui.isOpen()) { for (const k in input) input[k] = false; }

    const hpBefore = player.hp;
    player.update(dt, input);
    if (player.hp < hpBefore) { ui.flashDamage(); audio.play('hurt'); }
    ui.updateHUD(player);

    // water splash
    if (player.inWater && !wasInWater) audio.play('splash');
    wasInWater = player.inWater;

    // footsteps
    const hSpeed = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && hSpeed > 2 && !player.inWater) {
      stepT -= dt * hSpeed;
      if (stepT <= 0) {
        stepT = 2.2;
        const below = blockDef(world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)));
        audio.play('step', below.sound);
      }
    }

    attackCd = Math.max(0, attackCd - dt);
    doMining(dt);
    tickFurnaces(dt);
    entities.dayFactor = renderer.sky.dayFactor;
    entities.update(dt, isNight);
    achievements.onTick(timeOfDay);

    // death
    if (player.dead && ui.overlay !== 'death') {
      // drop inventory
      for (let i = 0; i < 36; i++) {
        if (ui.inv[i]) { entities.dropItem(ui.inv[i], player.pos.x, player.pos.y + 1, player.pos.z); ui.inv[i] = null; }
      }
      ui.updateHotbar();
      ui.open('death');
      document.exitPointerLock();
    }

    // highlight
    if (!ui.isOpen()) {
      const { e, d } = eyeRay();
      renderer.setHighlight(world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, player.reach));
    } else renderer.setHighlight(null);
  }

  // chunk streaming
  renderer.syncChunks(player.pos.x, player.pos.z, 7);

  // camera
  const cam = renderer.camera;
  const bobY = Math.sin(player.bobPhase * 2) * 0.05 * player.bobAmt;
  const bobX = Math.cos(player.bobPhase) * 0.035 * player.bobAmt;
  cam.position.set(player.pos.x + bobX * Math.cos(player.yaw), player.pos.y + player.eye + bobY, player.pos.z - bobX * Math.sin(player.yaw));
  cam.rotation.order = 'YXZ';
  cam.rotation.set(player.pitch, player.yaw, 0);
  const targetFov = player.sprinting ? 82 : player.flying ? 80 : 75;
  if (Math.abs(cam.fov - targetFov) > 0.2) { cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }

  updateViewModel(dt);
  particles.update(dt, cam);
  renderer.update(timeOfDay, cam.position, dt, elapsed);

  // underwater tint
  document.getElementById('watertint').style.display = player.headInWater ? 'block' : 'none';

  // persistent action hint based on selected item
  ui.setAction(actionHintFor(ui.selected()));

  renderer.render();

  // autosave
  saveTimer += dt;
  if (saveTimer > 20) { saveTimer = 0; doSave(); }

  if (debugOn) {
    const bio = ['Ocean', 'Beach', 'Plains', 'Forest', 'Birch Forest', 'Desert', 'Taiga', 'Snowy', 'Mountains'][world.gen.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z))];
    ui.debug(
      `${fps} fps | xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
      `biome ${bio} | time ${(timeOfDay * 24 + 6).toFixed(1) % 24}h | chunks ${world.chunks.size}\n` +
      `mobs ${entities.mobs.length} | drops ${entities.items.length}`
    );
  }
}

// UI hooks
window.addEventListener('DOMContentLoaded', () => { });
boot().then(() => {
  ui.onClose = uiClosed;
  ui.onRespawn = () => {
    player.respawn();
    // make sure spawn terrain exists and stand on it
    const scx = Math.floor(player.pos.x / CX), scz = Math.floor(player.pos.z / CZ);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.ensureChunk(scx + dx, scz + dz);
    player.pos.y = world.surfaceY(Math.floor(player.pos.x), Math.floor(player.pos.z)) + 1.2;
    ui.close();
    ui.updateHUD(player);
    canvas.requestPointerLock();
  };
  ui.onRenderDist = (v) => { renderer.renderDist = v; };
  entities.onPickup = (stack) => { achievements.onPickup(stack.id); return ui.addToInventory(stack); };
  entities.onMobKill = (type) => { achievements.onMobKill(type); progression.onMobKill(type); };
  entities.onExplosion = explode;
});
