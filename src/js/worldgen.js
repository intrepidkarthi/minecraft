// worldgen.js — biomes, terrain shaping, caves, ores, trees, decoration
"use strict";
import { Simplex2, Value3, hash2, mulberry32 } from './noise.js';
import { B } from './blocks.js';

export const CX = 16, CY = 128, CZ = 16;
export const SEA = 61;
export const idx = (x, y, z) => ((x << 4) | z) * CY + y;

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, BIRCH: 4, DESERT: 5, TAIGA: 6, SNOWY: 7, MOUNTAINS: 8 };

export class WorldGen {
  constructor(seed) {
    this.seed = seed | 0;
    this.nCont = new Simplex2(seed ^ 0x1a2b3c);
    this.nHill = new Simplex2(seed ^ 0x4d5e6f);
    this.nMt = new Simplex2(seed ^ 0x7a8b9c);
    this.nTemp = new Simplex2(seed ^ 0xdeadbe);
    this.nHum = new Simplex2(seed ^ 0xbeefca);
    this.nCheese = new Value3(seed ^ 0x123457);
    this.nNoodle = new Value3(seed ^ 0xabcdef);
    this.heightCache = new Map();
  }

  // ---- terrain shape ----
  heightAt(x, z) {
    const key = x + ',' + z;
    const c = this.heightCache.get(key);
    if (c !== undefined) return c;
    const cont = this.nCont.fbm(x / 850, z / 850, 4);
    const hill = this.nHill.fbm(x / 120, z / 120, 3);
    const m = this.nMt.ridged(x / 360, z / 360, 4);          // ~0..1
    let h = 55 + (cont + 0.32) * 24 + hill * 6;
    // Mountains: rarer (higher threshold) and shorter (smaller amplitude) so they
    // read as scenery on the horizon, not walls boxing the player in at spawn.
    const mt = Math.max(0, m - 0.72) / 0.28;
    h += mt * mt * 34;
    h = Math.max(4, Math.min(CY - 10, h)) | 0;
    if (this.heightCache.size > 60000) this.heightCache.clear();
    this.heightCache.set(key, h);
    return h;
  }

  biomeAt(x, z) {
    const h = this.heightAt(x, z);
    const m = this.nMt.ridged(x / 360, z / 360, 4);
    if (h < SEA - 1) return BIOME.OCEAN;
    if (h <= SEA + 1) return BIOME.BEACH;
    if (m > 0.78 || h > 92) return BIOME.MOUNTAINS;
    const temp = this.nTemp.fbm(x / 750, z / 750, 3) - Math.max(0, h - 72) * 0.012;
    const hum = this.nHum.fbm(x / 680, z / 680, 3);
    if (temp < -0.32) return hum > -0.05 ? BIOME.TAIGA : BIOME.SNOWY;
    if (temp > 0.38 && hum < 0.02) return BIOME.DESERT;
    if (hum > 0.12) return temp > 0.18 ? BIOME.BIRCH : BIOME.FOREST;
    return BIOME.PLAINS;
  }

  carved(x, y, z, surface) {
    if (y <= 3 || y > surface - 5) return false;
    const cheese = this.nCheese.fbm(x / 105, y / 60, z / 105, 3);
    if (cheese > 0.56) return true;
    const a = this.nNoodle.fbm(x / 68, y / 38, z / 68, 2);
    const b = this.nNoodle.fbm(x / 68 + 113.7, y / 38 + 41.2, z / 68 + 77.9, 2);
    return Math.abs(a) < 0.052 && Math.abs(b) < 0.052;
  }

  // ---- main chunk fill ----
  generate(cx, cz, blocks) {
    const bx = cx * CX, bz = cz * CZ;
    const surf = new Int16Array(CX * CZ);
    const biom = new Uint8Array(CX * CZ);
    for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
      const wx = bx + x, wz = bz + z;
      const h = this.heightAt(wx, wz);
      const bio = this.biomeAt(wx, wz);
      surf[x * CZ + z] = h; biom[x * CZ + z] = bio;
      for (let y = 0; y < CY; y++) {
        let id = B.AIR;
        if (y === 0) id = B.BEDROCK;
        else if (y <= 2 && hash2(this.seed, wx * 7 + y, wz * 13) < 0.7) id = B.BEDROCK;
        else if (y <= h) {
          if (this.carved(wx, y, wz, h)) {
            id = y <= 10 ? B.LAVA : B.AIR;
          } else if (y === h) {
            id = this.surfaceBlock(bio, y);
          } else if (y >= h - 3) {
            id = this.subSurface(bio);
          } else {
            id = B.STONE;
          }
        } else if (y <= SEA) {
          id = (bio === BIOME.SNOWY || bio === BIOME.TAIGA) && y === SEA ? B.ICE : B.WATER;
        }
        blocks[idx(x, y, z)] = id;
      }
      // gravel/sand patches on ocean floor
      if (h < SEA - 1 && hash2(this.seed ^ 77, wx, wz) < 0.3) {
        blocks[idx(x, h, z)] = hash2(this.seed ^ 78, wx, wz) < 0.5 ? B.GRAVEL : B.SAND;
      }
    }
    this.ores(cx, cz, blocks, surf);
    this.decorate(cx, cz, blocks, surf, biom);
  }

  surfaceBlock(bio, y) {
    switch (bio) {
      case BIOME.OCEAN: return B.GRAVEL;
      case BIOME.BEACH: case BIOME.DESERT: return B.SAND;
      case BIOME.SNOWY: case BIOME.TAIGA: return B.SNOWY_GRASS;
      case BIOME.MOUNTAINS: return y > 99 ? B.SNOW : y > 86 ? B.STONE : B.GRASS;
      default: return B.GRASS;
    }
  }
  subSurface(bio) {
    switch (bio) {
      case BIOME.BEACH: case BIOME.DESERT: return B.SANDSTONE;
      case BIOME.OCEAN: return B.GRAVEL;
      case BIOME.MOUNTAINS: return B.STONE;
      default: return B.DIRT;
    }
  }

  // ---- ores (deterministic per chunk) ----
  ores(cx, cz, blocks, surf) {
    const rng = mulberry32(this.seed ^ (cx * 341873128 + cz * 132897987));
    const vein = (id, count, minY, maxY, size) => {
      for (let v = 0; v < count; v++) {
        let x = (rng() * CX) | 0, z = (rng() * CZ) | 0;
        let y = minY + (rng() * (maxY - minY)) | 0;
        const n = (size[0] + rng() * (size[1] - size[0])) | 0;
        for (let i = 0; i < n; i++) {
          if (x >= 0 && x < CX && z >= 0 && z < CZ && y > 0 && y < CY) {
            const o = idx(x, y, z);
            if (blocks[o] === B.STONE) blocks[o] = id;
          }
          x += (rng() * 3 | 0) - 1; y += (rng() * 3 | 0) - 1; z += (rng() * 3 | 0) - 1;
        }
      }
    };
    vein(B.COAL_ORE, 13, 5, 100, [6, 13]);
    vein(B.IRON_ORE, 8, 5, 58, [4, 9]);
    vein(B.GOLD_ORE, 3, 5, 30, [3, 7]);
    vein(B.REDSTONE_ORE, 6, 5, 15, [4, 8]);
    vein(B.DIAMOND_ORE, 2, 5, 14, [3, 7]);
    // dirt + gravel pockets
    vein(B.DIRT, 6, 20, 90, [8, 16]);
    vein(B.GRAVEL, 4, 10, 70, [6, 12]);
  }

  // ---- trees + plants (margin trick: deterministic per world column) ----
  decorate(cx, cz, blocks, surf, biom) {
    const bx = cx * CX, bz = cz * CZ;
    const put = (wx, y, wz, id, soft = false) => {
      const x = wx - bx, z = wz - bz;
      if (x < 0 || x >= CX || z < 0 || z >= CZ || y < 0 || y >= CY) return;
      const o = idx(x, y, z);
      if (soft && blocks[o] !== B.AIR) return;
      blocks[o] = id;
    };
    for (let x = -3; x < CX + 3; x++) for (let z = -3; z < CZ + 3; z++) {
      const wx = bx + x, wz = bz + z;
      const inChunk = x >= 0 && x < CX && z >= 0 && z < CZ;
      const h = inChunk ? surf[x * CZ + z] : this.heightAt(wx, wz);
      const bio = inChunk ? biom[x * CZ + z] : this.biomeAt(wx, wz);
      if (h <= SEA) continue;
      // confirm surface not carved away
      if (inChunk && blocks[idx(x, h, z)] === B.AIR) continue;
      const r = hash2(this.seed ^ 0x51f15e, wx, wz);
      const r2 = hash2(this.seed ^ 0x77aa11, wx, wz);

      let treeChance = 0, kind = 'oak';
      switch (bio) {
        // Tree canopies are 5×5, so even "1/42" reads as a closed forest. These
        // lower rates make woods scattered and very buildable, with open ground.
        case BIOME.FOREST: treeChance = 1 / 110; kind = r2 < 0.85 ? 'oak' : 'birch'; break;
        case BIOME.BIRCH: treeChance = 1 / 120; kind = r2 < 0.7 ? 'birch' : 'oak'; break;
        case BIOME.PLAINS: treeChance = 1 / 420; kind = 'oak'; break;
        case BIOME.TAIGA: treeChance = 1 / 120; kind = 'spruce'; break;
        case BIOME.SNOWY: treeChance = 1 / 220; kind = 'spruce'; break;
        case BIOME.MOUNTAINS: treeChance = h < 86 ? 1 / 120 : 0; kind = 'spruce'; break;
        case BIOME.DESERT: treeChance = 1 / 160; kind = 'cactus'; break;
      }
      // keep an open clearing right around spawn so the first view is wide open
      const sc = this.spawnClear;
      const nearSpawn = sc && Math.abs(wx - sc.x) < 20 && Math.abs(wz - sc.z) < 20;
      if (r < treeChance && !nearSpawn) {
        this.tree(kind, wx, h, wz, put, hash2(this.seed ^ 0x9999, wx, wz));
        continue;
      }
      if (!inChunk) continue;
      // small plants (only inside chunk; single column)
      const above = idx(x, h + 1, z);
      if (blocks[above] !== B.AIR) continue;
      if (bio === BIOME.PLAINS || bio === BIOME.FOREST || bio === BIOME.BIRCH) {
        if (r2 < 0.10) blocks[above] = B.TALL_GRASS;
        else if (r2 < 0.115) blocks[above] = r < 0.5 ? B.DANDELION : B.POPPY;
        else if (bio === BIOME.PLAINS && r2 > 0.9985) blocks[above] = B.PUMPKIN;
      } else if (bio === BIOME.DESERT && r2 < 0.012) {
        blocks[above] = B.DEAD_BUSH;
      } else if (bio === BIOME.TAIGA && r2 < 0.05) {
        blocks[above] = B.TALL_GRASS;
      }
    }
  }

  tree(kind, wx, h, wz, put, r) {
    if (kind === 'cactus') {
      const ht = 1 + (r * 3 | 0);
      for (let i = 1; i <= ht; i++) put(wx, h + i, wz, B.CACTUS);
      return;
    }
    if (kind === 'spruce') {
      const trunk = 6 + (r * 4 | 0);
      for (let i = 1; i <= trunk; i++) put(wx, h + i, wz, B.SPRUCE_LOG);
      let rad = 0;
      for (let y = trunk + 1; y >= 3; y--) {
        rad = (trunk + 1 - y) % 2 === 0 ? 1 : 2;
        if (y > trunk - 1) rad = 1;
        if (y === trunk + 1) { put(wx, h + y, wz, B.SPRUCE_LEAVES, true); continue; }
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 1) continue;
          if (dx === 0 && dz === 0) continue;
          put(wx + dx, h + y, wz + dz, B.SPRUCE_LEAVES, true);
        }
      }
      return;
    }
    // oak / birch
    const log = kind === 'birch' ? B.BIRCH_LOG : B.OAK_LOG;
    const leaf = kind === 'birch' ? B.BIRCH_LEAVES : B.OAK_LEAVES;
    const trunk = (kind === 'birch' ? 5 : 4) + (r * 3 | 0);
    for (let i = 1; i <= trunk; i++) put(wx, h + i, wz, log);
    for (let dy = -2; dy <= 1; dy++) {
      const y = h + trunk + dy;
      const rad = dy < 0 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && dy <= 0) continue; // trunk
        if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
          if (dy >= 0) continue;
          if (hash2(this.seed, wx * 31 + dx + dy * 7, wz * 17 + dz) < 0.4) continue;
        }
        put(wx + dx, y, wz + dz, leaf, true);
      }
    }
    put(wx, h + trunk + 1, wz, leaf, true);
  }

  // find a good spawn near origin — an open, FLAT plains spot so the player can
  // see the world around them instead of staring at a cliff or a wall of trees.
  // Scores candidates by local flatness; a clear winner ends the search early.
  findSpawn() {
    // how bumpy the ground is in a small disc around a column (the "steps" metric)
    const spread = (x, z) => {
      let mn = Infinity, mx = -Infinity;
      for (let dx = -8; dx <= 8; dx += 2) for (let dz = -8; dz <= 8; dz += 2) {
        const hh = this.heightAt(x + dx, z + dz);
        if (hh < mn) mn = hh; if (hh > mx) mx = hh;
      }
      return mx - mn;
    };
    let best = null, bestScore = Infinity;
    for (let r = 1; r <= 56; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = a * Math.PI / 6;
        const x = Math.round(Math.cos(ang) * r * 6), z = Math.round(Math.sin(ang) * r * 6);
        const h = this.heightAt(x, z);
        if (h <= SEA + 1) continue;
        const bio = this.biomeAt(x, z);
        if (bio === BIOME.MOUNTAINS) continue;
        const flat = spread(x, z);
        // lower is better: reward flat ground, prefer plains, mild distance penalty
        const score = flat * 3 + (bio === BIOME.PLAINS ? 0 : 28) + r * 0.4;
        if (score < bestScore) { bestScore = score; best = { x: x + 0.5, y: h + 2, z: z + 0.5 }; }
        // a flat plains clearing a little out from origin is ideal — take it
        if (bio === BIOME.PLAINS && flat <= 4 && r >= 2) {
          this.spawnClear = { x, z };
          return best;
        }
      }
    }
    if (best) this.spawnClear = { x: Math.floor(best.x), z: Math.floor(best.z) };
    return best || { x: 0.5, y: this.heightAt(0, 0) + 2, z: 0.5 };
  }
}
