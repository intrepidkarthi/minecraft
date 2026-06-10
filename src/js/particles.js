// particles.js — billboarded particle quads (block break, hits, explosions, flames)
"use strict";
import * as THREE from '../vendor/three.module.js';
import { atlasCanvas, TILE, ATLAS_COLS, blockDef } from './blocks.js';
import { GRAVITY } from './physics.js';

const MAX = 350;

// average color of an atlas tile (for block particles)
const tileColorCache = new Map();
export function tileColor(t) {
  if (tileColorCache.has(t)) return tileColorCache.get(t);
  const c = atlasCanvas.getContext('2d', { willReadFrequently: true });
  const d = c.getImageData((t % ATLAS_COLS) * TILE, ((t / ATLAS_COLS) | 0) * TILE, TILE, TILE).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 100) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  n = n || 1;
  const col = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  tileColorCache.set(t, col);
  return col;
}

export class Particles {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(0.09, 0.09);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.instanceColor = this.colors;
    scene.add(this.mesh);
    this.parts = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  spawn(x, y, z, color, opts = {}) {
    if (this.parts.length >= MAX) this.parts.shift();
    const sp = opts.speed || 2.5;
    this.parts.push({
      x, y, z,
      vx: (Math.random() - .5) * sp + (opts.vx || 0),
      vy: Math.random() * sp * 0.9 + (opts.vy || 1),
      vz: (Math.random() - .5) * sp + (opts.vz || 0),
      life: opts.life || (0.4 + Math.random() * 0.5),
      grav: opts.grav !== undefined ? opts.grav : 0.45,
      scale: opts.scale || (0.7 + Math.random() * 0.8),
      r: ((color >> 16) & 255) / 255 * (0.7 + Math.random() * 0.4),
      g: ((color >> 8) & 255) / 255 * (0.7 + Math.random() * 0.4),
      b: (color & 255) / 255 * (0.7 + Math.random() * 0.4)
    });
  }

  burst(x, y, z, color, n, opts) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - .5) * .5, y + (Math.random() - .5) * .5, z + (Math.random() - .5) * .5, color, opts);
  }

  blockBreak(x, y, z, blockId) {
    const def = blockDef(blockId);
    if (!def.tex) return;
    const col = tileColor(def.tex[2]);
    for (let i = 0; i < 14; i++) {
      this.spawn(x + Math.random(), y + Math.random(), z + Math.random(), col, { speed: 3 });
    }
  }

  explosion(x, y, z) {
    for (let i = 0; i < 40; i++) {
      this.spawn(x, y, z, i % 3 === 0 ? 0xffc24a : i % 3 === 1 ? 0x8a8a8a : 0x4a4a4a,
        { speed: 9, vy: 2, life: 0.6 + Math.random() * 0.7, grav: 0.2, scale: 1.6 + Math.random() * 2 });
    }
  }

  update(dt, camera) {
    camera.getWorldQuaternion(this._q);
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= GRAVITY * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this._s.setScalar(p.scale * Math.min(1, p.life * 4));
      this._m.compose(new THREE.Vector3(p.x, p.y, p.z), this._q, this._s);
      this.mesh.setMatrixAt(n, this._m);
      this.colors.setXYZ(n, p.r, p.g, p.b);
      n++;
    }
    for (let i = n; i < MAX; i++) this.mesh.setMatrixAt(i, this._zero);
    this.mesh.count = MAX;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
  }
}
