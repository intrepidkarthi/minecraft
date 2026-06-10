// world.js — chunk storage, block access, flood-fill lighting (sky + block), raycast
"use strict";
import { B, blockDef, isOpaque } from './blocks.js';
import { WorldGen, CX, CY, CZ, idx, SEA } from './worldgen.js';

const key = (cx, cz) => cx + ',' + cz;

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(CX * CY * CZ);
    this.sky = new Uint8Array(CX * CY * CZ);
    this.blk = new Uint8Array(CX * CY * CZ);
    this.lit = false;
    this.dirty = false;       // needs remesh
    this.mesh = null; this.waterMesh = null; this.crossMesh = null;
    this.meshed = false;
  }
}

// light attenuation cost for passing through a block
function lightCost(id) {
  if (id === B.WATER || id === B.ICE) return 3;
  if (id === B.OAK_LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES) return 2;
  return 1;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.gen = new WorldGen(seed);
    this.chunks = new Map();
    this.edits = new Map();        // "x,y,z" -> block id (persisted)
    this.containers = new Map();   // "x,y,z" -> {type:'chest'|'furnace', ...state}
    this.onChunkDirty = null;      // hook for renderer
  }

  // ---------- chunk management ----------
  chunkAt(cx, cz) { return this.chunks.get(key(cx, cz)) || null; }

  ensureChunk(cx, cz) {
    const k = key(cx, cz);
    let c = this.chunks.get(k);
    if (c) return c;
    c = new Chunk(cx, cz);
    this.gen.generate(cx, cz, c.blocks);
    // apply player edits
    const bx = cx * CX, bz = cz * CZ;
    for (const [ek, id] of this.edits) {
      const p = ek.split(',');
      const x = +p[0], y = +p[1], z = +p[2];
      if (x >= bx && x < bx + CX && z >= bz && z < bz + CZ && y >= 0 && y < CY) {
        c.blocks[idx(x - bx, y, z - bz)] = id;
      }
    }
    this.chunks.set(k, c);
    return c;
  }

  neighborsGenerated(cx, cz) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!this.chunks.has(key(cx + dx, cz + dz))) return false;
    }
    return true;
  }
  neighborsLit(cx, cz) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.chunkAt(cx + dx, cz + dz);
      if (!c || !c.lit) return false;
    }
    return true;
  }

  unload(cx, cz, disposeFn) {
    const k = key(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return;
    if (disposeFn) disposeFn(c);
    this.chunks.delete(k);
  }

  // ---------- block access (world coords) ----------
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CY) return B.AIR;
    const c = this.chunks.get(key(Math.floor(x / CX), Math.floor(z / CZ)));
    if (!c) return B.AIR;
    return c.blocks[idx(x - c.cx * CX, y, z - c.cz * CZ)];
  }
  getSky(x, y, z) {
    if (y >= CY) return 15;
    if (y < 0) return 0;
    const c = this.chunks.get(key(Math.floor(x / CX), Math.floor(z / CZ)));
    if (!c) return 15;
    return c.sky[idx(x - c.cx * CX, y, z - c.cz * CZ)];
  }
  getBlk(x, y, z) {
    if (y < 0 || y >= CY) return 0;
    const c = this.chunks.get(key(Math.floor(x / CX), Math.floor(z / CZ)));
    if (!c) return 0;
    return c.blk[idx(x - c.cx * CX, y, z - c.cz * CZ)];
  }
  _setLightArr(arr, x, y, z, v) {
    if (y < 0 || y >= CY) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return false;
    const i = idx(x - cx * CX, y, z - cz * CZ);
    c[arr][i] = v;
    this._markDirtyAround(c, x - cx * CX, z - cz * CZ);
    return true;
  }
  _markDirtyAround(c, lx, lz) {
    c.dirty = true;
    if (lx === 0) this._dirtyN(c.cx - 1, c.cz);
    if (lx === CX - 1) this._dirtyN(c.cx + 1, c.cz);
    if (lz === 0) this._dirtyN(c.cx, c.cz - 1);
    if (lz === CZ - 1) this._dirtyN(c.cx, c.cz + 1);
  }
  _dirtyN(cx, cz) { const n = this.chunkAt(cx, cz); if (n && n.meshed) n.dirty = true; }

  surfaceY(x, z) {
    for (let y = CY - 1; y > 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR && blockDef(b).solid) return y;
    }
    return SEA;
  }

  // ---------- lighting ----------
  // initial lighting for one chunk (requires 3x3 neighbors generated)
  lightChunk(chunk) {
    const bx = chunk.cx * CX, bz = chunk.cz * CZ;
    const skyQ = [];
    const blkQ = [];
    // skylight columns
    for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
      let y = CY - 1;
      for (; y >= 0; y--) {
        const id = chunk.blocks[idx(x, y, z)];
        if (isOpaque(id)) break;
        if (lightCost(id) > 1) break; // water/leaves stop full sky column
        chunk.sky[idx(x, y, z)] = 15;
      }
      // seed BFS from full-sky cells (they may spread sideways/down through water)
      for (let yy = CY - 1; yy > y; yy--) skyQ.push(bx + x, yy, bz + z, 15);
    }
    // block light emitters
    for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) for (let y = 0; y < CY; y++) {
      const l = blockDef(chunk.blocks[idx(x, y, z)]).light;
      if (l > 0) { chunk.blk[idx(x, y, z)] = l; blkQ.push(bx + x, y, bz + z, l); }
    }
    // pull light in from already-lit neighbors across borders
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const n = this.chunkAt(chunk.cx + dx, chunk.cz + dz);
      if (!n || !n.lit) continue;
      const nbx = n.cx * CX, nbz = n.cz * CZ;
      // border cells of neighbor facing us
      if (dx !== 0 && dz === 0) {
        const lx = dx === 1 ? 0 : CX - 1;
        for (let z = 0; z < CZ; z++) for (let y = 0; y < CY; y++) {
          const s = n.sky[idx(lx, y, z)]; if (s > 1) skyQ.push(nbx + lx, y, nbz + z, s);
          const b = n.blk[idx(lx, y, z)]; if (b > 1) blkQ.push(nbx + lx, y, nbz + z, b);
        }
      } else if (dz !== 0 && dx === 0) {
        const lz = dz === 1 ? 0 : CZ - 1;
        for (let x = 0; x < CX; x++) for (let y = 0; y < CY; y++) {
          const s = n.sky[idx(x, y, lz)]; if (s > 1) skyQ.push(nbx + x, y, nbz + lz, s);
          const b = n.blk[idx(x, y, lz)]; if (b > 1) blkQ.push(nbx + x, y, nbz + lz, b);
        }
      }
    }
    this._spread(skyQ, 'sky', true);
    this._spread(blkQ, 'blk', false);
    chunk.lit = true;
    chunk.dirty = true;
  }

  // BFS spread. q = flat [x,y,z,level,...]
  _spread(q, arr, isSky) {
    let head = 0;
    const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    while (head < q.length) {
      const x = q[head], y = q[head + 1], z = q[head + 2], lv = q[head + 3];
      head += 4;
      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= CY) continue;
        const cx = Math.floor(nx / CX), cz = Math.floor(nz / CZ);
        const c = this.chunks.get(key(cx, cz));
        if (!c) continue;
        const i = idx(nx - cx * CX, ny, nz - cz * CZ);
        const id = c.blocks[i];
        if (isOpaque(id)) continue;
        let nl;
        if (isSky && d === 3 && lv === 15 && lightCost(id) === 1) nl = 15; // sky falls straight down
        else nl = lv - lightCost(id);
        if (nl <= 0) continue;
        if (c[arr][i] >= nl) continue;
        c[arr][i] = nl;
        this._markDirtyAround(c, nx - cx * CX, nz - cz * CZ);
        q.push(nx, ny, nz, nl);
      }
      if (head > 65536 && head === q.length) { q.length = 0; head = 0; }
    }
    q.length = 0;
  }

  // light removal BFS (standard two-queue algorithm)
  _unspread(x, y, z, oldLevel, arr, isSky) {
    const removeQ = [x, y, z, oldLevel];
    const addQ = [];
    let head = 0;
    const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    while (head < removeQ.length) {
      const qx = removeQ[head], qy = removeQ[head + 1], qz = removeQ[head + 2], lv = removeQ[head + 3];
      head += 4;
      for (let d = 0; d < 6; d++) {
        const nx = qx + DIRS[d][0], ny = qy + DIRS[d][1], nz = qz + DIRS[d][2];
        if (ny < 0 || ny >= CY) continue;
        const cx = Math.floor(nx / CX), cz = Math.floor(nz / CZ);
        const c = this.chunks.get(key(cx, cz));
        if (!c) continue;
        const i = idx(nx - cx * CX, ny, nz - cz * CZ);
        const nl = c[arr][i];
        if (nl === 0) continue;
        const downSpecial = isSky && d === 3 && lv === 15; // we fed straight-down column
        if (nl < lv || downSpecial) {
          c[arr][i] = 0;
          this._markDirtyAround(c, nx - cx * CX, nz - cz * CZ);
          removeQ.push(nx, ny, nz, downSpecial ? 15 : nl);
        } else if (nl >= lv) {
          addQ.push(nx, ny, nz, nl);
        }
      }
    }
    this._spread(addQ, arr, isSky);
  }

  // ---------- block editing ----------
  setBlock(x, y, z, id, recordEdit = true) {
    if (y < 0 || y >= CY) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return false;
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = idx(lx, y, lz);
    const oldId = c.blocks[i];
    if (oldId === id) return false;
    const oldDef = blockDef(oldId), newDef = blockDef(id);
    c.blocks[i] = id;
    if (recordEdit) this.edits.set(x + ',' + y + ',' + z, id);

    // --- block light updates ---
    const oldEmit = oldDef.light, newEmit = newDef.light;
    const curBlk = c.blk[i];
    if (oldEmit > 0 || (newDef.opaque && curBlk > 0)) {
      c.blk[i] = 0;
      this._unspread(x, y, z, curBlk || oldEmit, 'blk', false);
    }
    if (newEmit > 0) {
      c.blk[i] = newEmit;
      this._spread([x, y, z, newEmit], 'blk', false);
    } else if (!newDef.opaque && oldDef.opaque) {
      // opened a gap: pull block light from neighbors
      const q = [];
      this._pullNeighbors(x, y, z, 'blk', q);
      this._spread(q, 'blk', false);
    }

    // --- skylight updates ---
    if (newDef.opaque || lightCost(id) > 1) {
      const curSky = c.sky[i];
      if (curSky > 0) {
        c.sky[i] = 0;
        this._unspread(x, y, z, curSky, 'sky', true);
      }
    } else if (oldDef.opaque || lightCost(oldId) > 1) {
      // recompute the column above-sky path then spread
      const q = [];
      // does this cell see the sky?
      let open = true;
      for (let yy = y + 1; yy < CY; yy++) {
        const ab = this.getBlock(x, yy, z);
        if (isOpaque(ab) || lightCost(ab) > 1) { open = false; break; }
      }
      if (open) {
        // restore full column downward
        for (let yy = y; yy >= 0; yy--) {
          const bid = this.getBlock(x, yy, z);
          if (isOpaque(bid) || lightCost(bid) > 1) break;
          this._setLightArr('sky', x, yy, z, 15);
          q.push(x, yy, z, 15);
        }
      }
      this._pullNeighbors(x, y, z, 'sky', q);
      this._spread(q, 'sky', true);
    }

    this._markDirtyAround(c, lx, lz);
    // sand/gravel gravity
    this._gravity(x, y + 1, z);
    if (id === B.SAND || id === B.GRAVEL) this._gravity(x, y, z);
    if (this.onChunkDirty) this.onChunkDirty();
    return true;
  }

  _pullNeighbors(x, y, z, arr, q) {
    const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const d of DIRS) {
      const nx = x + d[0], ny = y + d[1], nz = z + d[2];
      const v = arr === 'sky' ? this.getSky(nx, ny, nz) : this.getBlk(nx, ny, nz);
      if (v > 1) q.push(nx, ny, nz, v);
    }
  }

  _gravity(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id !== B.SAND && id !== B.GRAVEL) return;
    let ny = y;
    while (ny > 0) {
      const below = this.getBlock(x, ny - 1, z);
      if (below === B.AIR || below === B.WATER || blockDef(below).replaceable) ny--;
      else break;
    }
    if (ny !== y) {
      this.setBlock(x, y, z, B.AIR);
      this.setBlock(x, ny, z, id);
    }
  }

  // ---------- raycast (voxel DDA) ----------
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dx || 1e-9)), tDeltaY = Math.abs(1 / (dy || 1e-9)), tDeltaZ = Math.abs(1 / (dz || 1e-9));
    let tMaxX = tDeltaX * (dx > 0 ? (x + 1 - ox) : (ox - x));
    let tMaxY = tDeltaY * (dy > 0 ? (y + 1 - oy) : (oy - y));
    let tMaxZ = tDeltaZ * (dz > 0 ? (z + 1 - oz) : (oz - z));
    let face = [0, 0, 0];
    let t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER && id !== B.LAVA) {
        return { x, y, z, id, face, dist: t };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      } else {
        if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      }
    }
    return null;
  }
}
