// entities.js — mobs (models + AI), item drops, arrows, spawning
"use strict";
import * as THREE from '../vendor/three.module.js';
import { B, blockDef, atlasCanvas, TILE, ATLAS_COLS } from './blocks.js';
import { itemIcon } from './items.js';
import { moveEntity, inBlock, GRAVITY } from './physics.js';
import { mulberry32, hash2 } from './noise.js';

// ------------------------------------------------------------- part textures
function partTexture(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  paint(c, w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter;
  return tx;
}
function noisy(c, w, h, base, amt, rng) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = 1 + (rng() * 2 - 1) * amt;
    const r = Math.min(255, ((base >> 16) & 255) * f) | 0, g = Math.min(255, ((base >> 8) & 255) * f) | 0, b = Math.min(255, (base & 255) * f) | 0;
    c.fillStyle = `rgb(${r},${g},${b})`; c.fillRect(x, y, 1, 1);
  }
}
const texCache = new Map();
function skinTex(key, base, amt = 0.12, decorate = null, w = 16, h = 16) {
  const k = key;
  if (texCache.has(k)) return texCache.get(k);
  const rng = mulberry32(key.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7));
  const t = partTexture(w, h, (c) => { noisy(c, w, h, base, amt, rng); if (decorate) decorate(c, rng); });
  texCache.set(k, t);
  return t;
}

function box(w, h, d, tex) {
  const m = new THREE.MeshBasicMaterial({ map: tex });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

// ------------------------------------------------------------- mob definitions
const px = 1 / 16; // 1 mc-pixel in blocks

const MOB_DEFS = {
  zombie: { hp: 20, hostile: true, speed: 2.6, dmg: 3, h: 1.9, hw: 0.3, burns: true, drops: [['rotten_flesh', 0, 2]] },
  skeleton: { hp: 20, hostile: true, ranged: true, speed: 2.8, dmg: 3, h: 1.9, hw: 0.3, burns: true, drops: [['bone', 0, 2]] },
  creeper: { hp: 20, hostile: true, creeper: true, speed: 2.9, dmg: 0, h: 1.7, hw: 0.3, drops: [['gunpowder', 0, 2]] },
  spider: { hp: 16, hostile: 'night', speed: 3.4, dmg: 2, h: 0.9, hw: 0.65, drops: [['string', 0, 2]] },
  pig: { hp: 10, speed: 1.8, h: 0.9, hw: 0.4, drops: [['porkchop', 1, 2]] },
  cow: { hp: 10, speed: 1.6, h: 1.35, hw: 0.45, drops: [['beef', 1, 2]] },
  sheep: { hp: 8, speed: 1.6, h: 1.25, hw: 0.42, drops: [[B.WOOL, 1, 1]] },
  chicken: { hp: 4, speed: 1.6, h: 0.7, hw: 0.25, drops: [['chicken', 1, 1], ['feather', 0, 1]] }
};

function buildModel(type) {
  const g = new THREE.Group();
  const parts = {};
  const face = (key, base, deco) => skinTex(key, base, 0.12, deco);

  if (type === 'zombie' || type === 'skeleton') {
    const skin = type === 'zombie' ? 0x4e9444 : 0xc8c8c8;
    const shirt = type === 'zombie' ? 0x3a6db5 : 0x9a9a9a;
    const pants = type === 'zombie' ? 0x3c4f8a : 0x8a8a8a;
    const headT = face(type + '_head', skin);
    const faceT = face(type + '_face', skin, (c) => {
      if (type === 'zombie') {
        c.fillStyle = '#1a1a1a'; c.fillRect(3, 6, 3, 2); c.fillRect(10, 6, 3, 2);
        c.fillStyle = '#274a22'; c.fillRect(6, 10, 4, 3);
      } else {
        c.fillStyle = '#2a2a2a'; c.fillRect(3, 6, 3, 2); c.fillRect(10, 6, 3, 2);
        c.fillStyle = '#6a6a6a'; c.fillRect(5, 11, 6, 2);
        c.fillStyle = '#2a2a2a'; for (let i = 5; i < 11; i += 2) c.fillRect(i, 11, 1, 2);
      }
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(8 * px, 8 * px, 8 * px),
      [headT, headT, headT, headT, headT, faceT].map(t => new THREE.MeshBasicMaterial({ map: t })));
    head.position.y = 28 * px; g.add(head); parts.head = head;
    const body = box(8 * px, 12 * px, 4 * px, face(type + '_body', shirt)); body.position.y = 18 * px; g.add(body);
    const armT = face(type + '_arm', type === 'zombie' ? skin : 0xb5b5b5);
    const legT = face(type + '_leg', pants);
    const aw = type === 'skeleton' ? 2 * px : 4 * px;
    for (const s of [-1, 1]) {
      const arm = box(aw, 12 * px, aw < 3 * px ? 2 * px : 4 * px, armT);
      arm.geometry.translate(0, -5 * px, 0);
      arm.position.set(s * 6 * px, 23 * px, 0);
      if (type === 'zombie') arm.rotation.x = Math.PI / 2;
      g.add(arm); parts['arm' + s] = arm;
      const leg = box(4 * px, 12 * px, 4 * px, legT);
      leg.geometry.translate(0, -6 * px, 0);
      leg.position.set(s * 2 * px, 12 * px, 0);
      g.add(leg); parts['leg' + s] = leg;
    }
  } else if (type === 'creeper') {
    const skinT = face('creeper_skin', 0x4ea84e, null);
    const faceT = face('creeper_face', 0x4ea84e, (c) => {
      c.fillStyle = '#0a0a0a';
      c.fillRect(3, 5, 3, 3); c.fillRect(10, 5, 3, 3);
      c.fillRect(6, 8, 4, 3); c.fillRect(5, 10, 2, 4); c.fillRect(9, 10, 2, 4);
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(8 * px, 8 * px, 8 * px),
      [skinT, skinT, skinT, skinT, skinT, faceT].map(t => new THREE.MeshBasicMaterial({ map: t })));
    head.position.y = 22 * px; g.add(head); parts.head = head;
    const body = box(8 * px, 12 * px, 4 * px, skinT); body.position.y = 12 * px; g.add(body);
    let i = 0;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(4 * px, 6 * px, 4 * px, skinT);
      leg.geometry.translate(0, -3 * px, 0);
      leg.position.set(sx * 2 * px, 6 * px, sz * 3 * px);
      g.add(leg); parts['leg' + (i++)] = leg;
    }
  } else if (type === 'spider') {
    const skinT = face('spider_skin', 0x2a2326);
    const headT = face('spider_face', 0x2a2326, (c) => {
      c.fillStyle = '#c41818'; c.fillRect(3, 5, 2, 2); c.fillRect(11, 5, 2, 2);
      c.fillRect(5, 7, 2, 2); c.fillRect(9, 7, 2, 2);
      c.fillStyle = '#5c5c5c'; c.fillRect(6, 11, 1, 3); c.fillRect(9, 11, 1, 3);
    });
    const bodyB = box(10 * px, 8 * px, 12 * px, skinT); bodyB.position.set(0, 8 * px, 4 * px); g.add(bodyB);
    const head = new THREE.Mesh(new THREE.BoxGeometry(8 * px, 8 * px, 8 * px),
      [skinT, skinT, skinT, skinT, skinT, headT].map(t => new THREE.MeshBasicMaterial({ map: t })));
    head.position.set(0, 8 * px, -5 * px); g.add(head); parts.head = head;
    let i = 0;
    for (const s of [-1, 1]) for (let l = 0; l < 4; l++) {
      const leg = box(14 * px, 2 * px, 2 * px, skinT);
      leg.geometry.translate(s * 7 * px, 0, 0);
      leg.position.set(s * 4 * px, 9 * px, (l - 1.5) * 3.4 * px);
      leg.rotation.z = s * -0.45; leg.rotation.y = s * (l - 1.5) * 0.22;
      g.add(leg); parts['leg' + (i++)] = leg;
    }
  } else {
    // quadrupeds + chicken
    const colors = { pig: 0xf0a8a8, cow: 0x6b4a35, sheep: 0xe8e8e8, chicken: 0xf2f2f2 };
    const base = colors[type];
    const bodyT = face(type + '_body', base, type === 'cow' ? (c, rng) => {
      c.fillStyle = '#f0f0f0';
      for (let i = 0; i < 4; i++) c.fillRect((rng() * 10) | 0, (rng() * 10) | 0, 3 + (rng() * 4) | 0, 3 + (rng() * 3) | 0);
    } : null);
    const headT = face(type + '_head', base, (c) => {
      c.fillStyle = '#1a1a1a'; c.fillRect(3, 5, 2, 2); c.fillRect(11, 5, 2, 2);
      if (type === 'pig') { c.fillStyle = '#e88a8a'; c.fillRect(5, 9, 6, 4); c.fillStyle = '#b55c5c'; c.fillRect(6, 10, 1, 2); c.fillRect(9, 10, 1, 2); }
      if (type === 'cow') { c.fillStyle = '#d8c5b5'; c.fillRect(4, 10, 8, 5); }
      if (type === 'sheep') { c.fillStyle = '#d8b59a'; c.fillRect(5, 9, 6, 6); }
      if (type === 'chicken') { c.fillStyle = '#e8b52a'; c.fillRect(6, 9, 4, 3); c.fillStyle = '#c41818'; c.fillRect(7, 12, 2, 3); }
    });
    if (type === 'chicken') {
      const body = box(6 * px, 6 * px, 8 * px, bodyT); body.position.y = 7 * px; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(4 * px, 6 * px, 4 * px),
        [bodyT, bodyT, bodyT, bodyT, bodyT, headT].map(t => new THREE.MeshBasicMaterial({ map: t })));
      head.position.set(0, 12 * px, -4 * px); g.add(head); parts.head = head;
      const wingT = face('chicken_wing', 0xe0e0e0);
      for (const s of [-1, 1]) {
        const wing = box(1.4 * px, 4 * px, 6 * px, wingT);
        wing.position.set(s * 3.8 * px, 8 * px, 0); g.add(wing); parts['wing' + s] = wing;
      }
      let i = 0;
      for (const s of [-1, 1]) {
        const leg = box(1.5 * px, 4 * px, 1.5 * px, face('chicken_leg', 0xe8b52a));
        leg.geometry.translate(0, -2 * px, 0);
        leg.position.set(s * 1.5 * px, 4 * px, 0); g.add(leg); parts['leg' + (i++)] = leg;
      }
    } else {
      const dims = { pig: [10, 8, 16, 9], cow: [12, 10, 18, 13], sheep: [11, 9, 16, 12] }[type];
      const [bw, bh, bl, by] = dims;
      const body = box(bw * px, bh * px, bl * px, bodyT); body.position.y = by * px; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(8 * px, 8 * px, 6 * px),
        [bodyT, bodyT, bodyT, bodyT, bodyT, headT].map(t => new THREE.MeshBasicMaterial({ map: t })));
      head.position.set(0, (by + 2) * px, -(bl / 2 + 2) * px); g.add(head); parts.head = head;
      const legT = face(type + '_leg', type === 'sheep' ? 0xd8b59a : base);
      let i = 0;
      const legLen = by - dims[1] / 2 + 2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = box(3 * px, legLen * px, 3 * px, legT);
        leg.geometry.translate(0, -legLen / 2 * px, 0);
        leg.position.set(sx * (bw / 2 - 1.5) * px, (by - bh / 2 + 1) * px, sz * (bl / 2 - 2) * px);
        g.add(leg); parts['leg' + (i++)] = leg;
      }
    }
  }
  return { group: g, parts };
}

// ------------------------------------------------------------- entity manager
export class Entities {
  constructor(world, scene, player, particles, audio) {
    this.world = world; this.scene = scene; this.player = player;
    this.particles = particles; this.audio = audio;
    this.mobs = []; this.items = []; this.arrows = [];
    this.onPickup = null;       // (stack) => leftoverCount
    this.onExplosion = null;    // (x,y,z,r) => void (block destruction handled by main)
    this.onMobKill = null;      // (type) => void
    this.pickupMult = 1;        // perk: block magnet multiplies pickup radius
    this.dayFactor = 1;
    this.spawnTimer = 0;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
  }

  // ---------- spawning ----------
  spawnMob(type, x, y, z) {
    const def = MOB_DEFS[type];
    const { group, parts } = buildModel(type);
    group.position.set(x, y, z);
    this.scene.add(group);
    const mob = {
      type, def, model: group, parts,
      pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 },
      hw: def.hw, h: def.h, yaw: this.rng() * Math.PI * 2,
      hp: def.hp, onGround: false, hitWall: false,
      state: 'wander', stateT: this.rng() * 4, targetYaw: this.rng() * Math.PI * 2,
      walkPhase: 0, attackCd: 0, hurtT: 0, dying: 0, fuse: -1, fleeT: 0,
      burnT: 0, aggro: false, fallStart: null
    };
    this.mobs.push(mob);
    return mob;
  }

  dropItem(stack, x, y, z, vel) {
    let model;
    if (typeof stack.id === 'number') {
      model = makeMiniBlock(stack.id);
    } else {
      const tex = new THREE.CanvasTexture(itemIcon(stack.id));
      tex.magFilter = THREE.NearestFilter;
      model = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
    }
    this.scene.add(model);
    const it = {
      stack, model,
      pos: { x, y, z },
      vel: vel || { x: (this.rng() - .5) * 3, y: 3.5, z: (this.rng() - .5) * 3 },
      hw: 0.12, h: 0.25, onGround: false, age: 0, pickupDelay: 0.6
    };
    this.items.push(it);
    return it;
  }

  shootArrow(x, y, z, dx, dy, dz) {
    const geo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9a8a6a });
    const model = new THREE.Mesh(geo, mat);
    model.position.set(x, y, z);
    this.scene.add(model);
    this.arrows.push({ model, pos: { x, y, z }, vel: { x: dx, y: dy, z: dz }, life: 5, stuck: false });
    this.audio.play('bow');
  }

  // ---------- per-frame ----------
  update(dt, isNight) {
    const p = this.player;
    // natural spawn attempts
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      this._trySpawns(isNight);
    }
    this._updateMobs(dt, isNight);
    this._updateItems(dt);
    this._updateArrows(dt);
  }

  _effLight(x, y, z) {
    return Math.max(this.world.getBlk(x, y, z), this.world.getSky(x, y, z) * this.dayFactor);
  }

  _trySpawns(isNight) {
    const p = this.player;
    const hostiles = this.mobs.filter(m => m.def.hostile).length;
    const passives = this.mobs.filter(m => !m.def.hostile).length;
    if (isNight && hostiles < 16) {
      for (let a = 0; a < 4; a++) {
        const ang = this.rng() * Math.PI * 2, d = 26 + this.rng() * 30;
        const x = Math.floor(p.pos.x + Math.cos(ang) * d), z = Math.floor(p.pos.z + Math.sin(ang) * d);
        const y = this.world.surfaceY(x, z) + 1;
        if (y <= 1) continue;
        if (this.world.getBlock(x, y, z) !== B.AIR) continue;
        if (this._effLight(x, y, z) > 7) continue;
        const roll = this.rng();
        const type = roll < 0.4 ? 'zombie' : roll < 0.65 ? 'skeleton' : roll < 0.85 ? 'spider' : 'creeper';
        this.spawnMob(type, x + 0.5, y, z + 0.5);
        break;
      }
    }
    if (!isNight && passives < 12) {
      const ang = this.rng() * Math.PI * 2, d = 26 + this.rng() * 24;
      const x = Math.floor(p.pos.x + Math.cos(ang) * d), z = Math.floor(p.pos.z + Math.sin(ang) * d);
      const y = this.world.surfaceY(x, z) + 1;
      if (y > 1 && this.world.getBlock(x, y - 1, z) === B.GRASS && this._effLight(x, y, z) > 8) {
        const type = ['pig', 'cow', 'sheep', 'chicken'][(this.rng() * 4) | 0];
        const n = 2 + (this.rng() * 2 | 0);
        for (let i = 0; i < n; i++) this.spawnMob(type, x + 0.5 + (this.rng() - .5) * 3, y + 1, z + 0.5 + (this.rng() - .5) * 3);
      }
    }
  }

  _updateMobs(dt, isNight) {
    const p = this.player;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const def = m.def;
      const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, dy = p.pos.y - m.pos.y;
      const dist = Math.hypot(dx, dz);
      const dist3 = Math.hypot(dx, dy, dz);

      // despawn far hostiles
      if (def.hostile && dist > 80) { this._removeMob(i); continue; }
      if (m.pos.y < -10) { this._removeMob(i); continue; }

      // dying animation
      if (m.dying > 0) {
        m.dying += dt;
        m.model.rotation.z = Math.min(Math.PI / 2, m.dying * 4);
        m.model.position.y = m.pos.y + Math.max(0, 0.3 - m.dying * 0.5);
        if (m.dying > 0.6) {
          for (const [id, lo, hi] of def.drops) {
            const n = lo + (this.rng() * (hi - lo + 1) | 0);
            for (let k = 0; k < n; k++) this.dropItem({ id, count: 1 }, m.pos.x, m.pos.y + 0.4, m.pos.z);
          }
          if (this.onMobKill) this.onMobKill(m.type);
          this._removeMob(i);
        }
        continue;
      }

      m.hurtT = Math.max(0, m.hurtT - dt);
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.fleeT = Math.max(0, m.fleeT - dt);

      // daylight burning
      if (def.burns && !isNight && this.dayFactor > 0.85 && this.world.getSky(Math.floor(m.pos.x), Math.floor(m.pos.y + 1), Math.floor(m.pos.z)) >= 14) {
        m.burnT += dt;
        if (m.burnT > 1) {
          m.burnT = 0;
          this._hurtMob(m, 1, null);
          this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, 0xff8a2a, 4);
        }
      }

      // --- decide movement ---
      const hostileNow = def.hostile === true || (def.hostile === 'night' && (isNight || this._effLight(Math.floor(m.pos.x), Math.floor(m.pos.y), Math.floor(m.pos.z)) < 8)) || m.aggro;
      let desiredYaw = m.targetYaw, speed = 0;

      if (m.fleeT > 0) {
        desiredYaw = Math.atan2(-dx, -dz);
        speed = def.speed * 1.4;
      } else if (def.hostile && hostileNow && dist3 < 18 && !p.dead) {
        m.aggro = true;
        desiredYaw = Math.atan2(dx, dz);
        speed = def.speed;
        if (def.creeper) {
          if (dist3 < 2.8) {
            if (m.fuse < 0) { m.fuse = 1.5; this.audio.play('fuse'); }
          }
          if (m.fuse >= 0) {
            speed = 0;
            m.fuse -= dt;
            const flash = (Math.sin(m.fuse * 25) > 0);
            m.model.traverse(o => {
              if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => mt.color.setScalar(flash ? 2.2 : 1));
            });
            m.model.scale.setScalar(1 + (1.5 - m.fuse) * 0.12);
            if (m.fuse <= 0) {
              if (this.onExplosion) this.onExplosion(m.pos.x, m.pos.y + 0.6, m.pos.z, 2.6);
              this._removeMob(i);
              continue;
            }
          }
        } else if (def.ranged) {
          if (dist < 7) { desiredYaw = Math.atan2(-dx, -dz); speed = def.speed * 0.8; }
          else if (dist > 13) speed = def.speed;
          else speed = 0;
          if (dist < 15 && m.attackCd <= 0 && this._canSee(m, p)) {
            m.attackCd = 2.4;
            const ex = m.pos.x, ey = m.pos.y + def.h * 0.8, ez = m.pos.z;
            const tx = p.pos.x, ty = p.pos.y + 1.2, tz = p.pos.z;
            const d3 = Math.hypot(tx - ex, ty - ey, tz - ez);
            const sp = 18;
            this.shootArrow(ex, ey, ez, (tx - ex) / d3 * sp, (ty - ey) / d3 * sp + d3 * 0.45, (tz - ez) / d3 * sp);
          }
        } else {
          // melee
          if (dist3 < 1.6 && m.attackCd <= 0) {
            m.attackCd = 1.1;
            p.damage(def.dmg, m.type);
            const kb = 6;
            p.vel.x += dx / (dist || 1) * kb; p.vel.z += dz / (dist || 1) * kb; p.vel.y += 3;
            this.audio.play('hurt');
          }
          if (m.type === 'spider' && dist3 < 3.5 && m.onGround && m.attackCd <= 0.6 && this.rng() < 0.02) {
            m.vel.y = 7; m.vel.x += dx / (dist || 1) * 4; m.vel.z += dz / (dist || 1) * 4;
          }
        }
      } else {
        // wander
        m.stateT -= dt;
        if (m.stateT <= 0) {
          m.stateT = 2 + this.rng() * 5;
          if (this.rng() < 0.4) { m.state = 'idle'; }
          else { m.state = 'walk'; m.targetYaw = this.rng() * Math.PI * 2; }
        }
        if (m.state === 'walk') speed = def.speed * 0.5;
        desiredYaw = m.targetYaw;
      }

      // turn smoothly
      let dyaw = desiredYaw - m.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      m.yaw += dyaw * Math.min(1, 8 * dt);

      // physics
      const inW = inBlock(this.world, m, B.WATER);
      if (inW) { m.vel.y += (2.5 - m.vel.y) * Math.min(1, 4 * dt); }
      else m.vel.y -= GRAVITY * dt;
      if (m.vel.y < -50) m.vel.y = -50;
      const mvx = Math.sin(m.yaw) * speed, mvz = Math.cos(m.yaw) * speed;
      m.vel.x += (mvx - m.vel.x) * Math.min(1, (m.onGround ? 10 : 3) * dt);
      m.vel.z += (mvz - m.vel.z) * Math.min(1, (m.onGround ? 10 : 3) * dt);
      m.hitWall = false;
      const wasGround = m.onGround;
      if (!m.onGround && m.vel.y < 0 && m.fallStart === null) m.fallStart = m.pos.y;
      moveEntity(this.world, m, dt);
      if (m.onGround && !wasGround && m.fallStart !== null) {
        const fd = m.fallStart - m.pos.y - 3;
        if (fd > 0 && !inW) this._hurtMob(m, Math.floor(fd), null);
        m.fallStart = null;
      }
      if (m.onGround) m.fallStart = null;
      if (m.hitWall && m.onGround && speed > 0) m.vel.y = 8.2; // jump up blocks
      if (inW && speed > 0) m.vel.y = Math.max(m.vel.y, 2.2);

      // cactus/lava damage
      if (inBlock(this.world, m, B.LAVA)) this._hurtMob(m, 4, null);

      // --- animate ---
      const hSpeed = Math.hypot(m.vel.x, m.vel.z);
      m.walkPhase += dt * (2 + hSpeed * 3.2);
      const swing = Math.sin(m.walkPhase) * Math.min(1, hSpeed / def.speed) * 0.7;
      m.model.position.set(m.pos.x, m.pos.y, m.pos.z);
      m.model.rotation.y = m.yaw + (m.type === 'spider' || !def.hostile ? Math.PI : Math.PI);
      m.model.rotation.z = 0;
      for (const k in m.parts) {
        const part = m.parts[k];
        if (k.startsWith('leg')) {
          const n = parseInt(k.slice(3), 10);
          const sign = (n === -1 || n === 1) ? (n > 0 ? 1 : -1) : ((n % 2 === 0) ? 1 : -1);
          part.rotation.x = swing * sign;
        } else if (k.startsWith('arm')) {
          if (m.type !== 'zombie') part.rotation.x = swing * (k === 'arm-1' ? 1 : -1) * 0.8;
          else part.rotation.x = Math.PI / 2 + Math.sin(m.walkPhase * 0.7) * 0.1;
        } else if (k.startsWith('wing')) {
          part.rotation.z = (k === 'wing-1' ? 1 : -1) * (m.onGround ? 0.05 : Math.abs(Math.sin(m.walkPhase * 4)) * 0.9);
        }
      }
      // hurt tint
      const lightV = 0.25 + 0.75 * (this._effLight(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.5), Math.floor(m.pos.z)) / 15);
      if (!(def.creeper && m.fuse >= 0)) {
        m.model.traverse(o => {
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mt of mats) {
              if (m.hurtT > 0) mt.color.setRGB(lightV * 1.6, lightV * 0.4, lightV * 0.4);
              else mt.color.setScalar(lightV);
            }
          }
        });
      }
    }
  }

  _canSee(m, p) {
    const ox = m.pos.x, oy = m.pos.y + m.def.h * 0.8, oz = m.pos.z;
    const tx = p.pos.x, ty = p.pos.y + 1.2, tz = p.pos.z;
    const d = Math.hypot(tx - ox, ty - oy, tz - oz);
    const hit = this.world.raycast(ox, oy, oz, (tx - ox) / d, (ty - oy) / d, (tz - oz) / d, d);
    return !hit;
  }

  _updateItems(dt) {
    const p = this.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      it.pickupDelay = Math.max(0, it.pickupDelay - dt);
      if (it.age > 300) { this._removeItem(i); continue; }
      it.vel.y -= GRAVITY * 0.6 * dt;
      if (inBlock(this.world, it, B.WATER)) it.vel.y = Math.max(it.vel.y, 1.2);
      const f = it.onGround ? Math.pow(0.02, dt) : Math.pow(0.4, dt);
      it.vel.x *= f; it.vel.z *= f;
      // magnet toward player
      const dx = p.pos.x - it.pos.x, dy = (p.pos.y + 0.8) - it.pos.y, dz = p.pos.z - it.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 2.2 && it.pickupDelay <= 0 && !p.dead) {
        const pull = 16 / Math.max(0.4, d);
        it.vel.x += dx / d * pull * dt * 10; it.vel.y += dy / d * pull * dt * 10; it.vel.z += dz / d * pull * dt * 10;
      }
      moveEntity(this.world, it, dt);
      if (d < 0.9 * this.pickupMult && it.pickupDelay <= 0 && !p.dead && this.onPickup) {
        const leftover = this.onPickup(it.stack);
        if (leftover <= 0) { this.audio.play('pop'); this._removeItem(i); continue; }
        it.stack.count = leftover;
      }
      it.model.position.set(it.pos.x, it.pos.y + 0.15 + Math.sin(it.age * 2.2) * 0.06, it.pos.z);
      it.model.rotation.y = it.age * 1.8;
      const lv = 0.3 + 0.7 * (this._effLight(Math.floor(it.pos.x), Math.floor(it.pos.y + 0.5), Math.floor(it.pos.z)) / 15);
      it.model.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => mt.color.setScalar(lv)); });
    }
  }

  _updateArrows(dt) {
    const p = this.player;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.life <= 0) { this.scene.remove(a.model); this.arrows.splice(i, 1); continue; }
      if (a.stuck) continue;
      a.vel.y -= 18 * dt;
      const nx = a.pos.x + a.vel.x * dt, ny = a.pos.y + a.vel.y * dt, nz = a.pos.z + a.vel.z * dt;
      // block hit
      const bid = this.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      if (blockDef(bid).solid) { a.stuck = true; a.life = Math.min(a.life, 1.2); continue; }
      // player hit
      if (Math.abs(nx - p.pos.x) < 0.45 && Math.abs(nz - p.pos.z) < 0.45 && ny > p.pos.y && ny < p.pos.y + p.h && !p.dead) {
        p.damage(3, 'arrow');
        const d = Math.hypot(a.vel.x, a.vel.z) || 1;
        p.vel.x += a.vel.x / d * 4; p.vel.z += a.vel.z / d * 4; p.vel.y += 2.5;
        this.audio.play('hurt');
        this.scene.remove(a.model); this.arrows.splice(i, 1); continue;
      }
      a.pos.x = nx; a.pos.y = ny; a.pos.z = nz;
      a.model.position.set(nx, ny, nz);
      a.model.lookAt(nx + a.vel.x, ny + a.vel.y, nz + a.vel.z);
    }
  }

  // ---------- interaction ----------
  raycastMob(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null, bestT = maxDist;
    for (const m of this.mobs) {
      if (m.dying > 0) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz,
        m.pos.x - m.hw, m.pos.y, m.pos.z - m.hw,
        m.pos.x + m.hw, m.pos.y + m.h, m.pos.z + m.hw);
      if (t !== null && t < bestT) { bestT = t; best = m; }
    }
    return best ? { mob: best, dist: bestT } : null;
  }

  hitMob(m, dmg, kdx, kdz) {
    this._hurtMob(m, dmg, { x: kdx, z: kdz });
    if (!m.def.hostile) m.fleeT = 5;
    m.aggro = true;
  }

  _hurtMob(m, dmg, kb) {
    if (m.dying > 0) return;
    m.hp -= dmg;
    m.hurtT = 0.35;
    if (kb) { m.vel.x += kb.x * 7; m.vel.z += kb.z * 7; m.vel.y = 5; }
    this.audio.play(m.def.hostile ? 'mobHurt' : 'animalHurt');
    this.particles.burst(m.pos.x, m.pos.y + m.h * 0.6, m.pos.z, 0xa82a2a, 5);
    if (m.hp <= 0) { m.dying = 0.001; this.audio.play('mobDeath'); }
  }

  _removeMob(i) {
    const m = this.mobs[i];
    this.scene.remove(m.model);
    m.model.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.mobs.splice(i, 1);
  }
  _removeItem(i) {
    const it = this.items[i];
    this.scene.remove(it.model);
    this.items.splice(i, 1);
  }

  serialize() {
    return this.items.map(it => ({ s: it.stack, p: [it.pos.x, it.pos.y, it.pos.z] }));
  }
  deserialize(arr) {
    if (!arr) return;
    for (const d of arr.slice(0, 80)) this.dropItem(d.s, d.p[0], d.p[1], d.p[2], { x: 0, y: 0, z: 0 });
  }
}

// mini block model for item drops
const miniCache = new Map();
function makeMiniBlock(id) {
  let geoMat = miniCache.get(id);
  if (!geoMat) {
    const def = blockDef(id);
    const mats = [];
    for (let f = 0; f < 6; f++) {
      const t = def.tex[f];
      const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
      cv.getContext('2d').drawImage(atlasCanvas, (t % ATLAS_COLS) * TILE, ((t / ATLAS_COLS) | 0) * TILE, TILE, TILE, 0, 0, TILE, TILE);
      const tx = new THREE.CanvasTexture(cv);
      tx.magFilter = THREE.NearestFilter;
      mats.push(new THREE.MeshBasicMaterial({ map: tx, transparent: !def.opaque, alphaTest: def.opaque ? 0 : 0.3 }));
    }
    geoMat = { geo: new THREE.BoxGeometry(0.28, 0.28, 0.28), mats };
    miniCache.set(id, geoMat);
  }
  return new THREE.Mesh(geoMat.geo, geoMat.mats.map(m => m.clone()));
}

function rayAABB(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz) {
  let tmin = 0, tmax = 1e9;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return null;
    } else {
      let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
