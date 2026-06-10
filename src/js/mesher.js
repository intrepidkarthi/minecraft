// mesher.js — chunk geometry with smooth lighting + ambient occlusion
"use strict";
import * as THREE from '../vendor/three.module.js';
import { B, blockDef, isOpaque, tileUV } from './blocks.js';
import { CX, CY, CZ, idx } from './worldgen.js';

// faces: dir, 4 corners (CCW from outside), tangent axes for AO sampling, shade
// corner order chosen so uv = (0,0),(1,0),(1,1),(0,1)
const FACES = [
  { // +x (east)
    dir: [1, 0, 0], shade: 0.6, texIdx: 0,
    corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    U: [0, 0, -1], V: [0, 1, 0]
  },
  { // -x (west)
    dir: [-1, 0, 0], shade: 0.6, texIdx: 1,
    corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    U: [0, 0, 1], V: [0, 1, 0]
  },
  { // +y (top)
    dir: [0, 1, 0], shade: 1.0, texIdx: 2,
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    U: [1, 0, 0], V: [0, 0, -1]
  },
  { // -y (bottom)
    dir: [0, -1, 0], shade: 0.5, texIdx: 3,
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    U: [1, 0, 0], V: [0, 0, 1]
  },
  { // +z (south)
    dir: [0, 0, 1], shade: 0.8, texIdx: 4,
    corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    U: [1, 0, 0], V: [0, 1, 0]
  },
  { // -z (north)
    dir: [0, 0, -1], shade: 0.8, texIdx: 5,
    corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    U: [-1, 0, 0], V: [0, 1, 0]
  }
];

class GeoBuf {
  constructor() { this.pos = []; this.uv = []; this.light = []; this.shade = []; this.index = []; this.vcount = 0; }
  quad(p, uvs, lights, shades, flip) {
    const b = this.vcount;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.light.push(lights[i][0], lights[i][1]);
      this.shade.push(shades[i]);
    }
    if (flip) this.index.push(b + 1, b + 2, b + 3, b + 1, b + 3, b);
    else this.index.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.vcount += 4;
  }
  toGeometry() {
    if (this.vcount === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aLight', new THREE.Float32BufferAttribute(this.light, 2));
    g.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shade, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

export function buildChunkGeometry(world, chunk) {
  const cx = chunk.cx, cz = chunk.cz;
  // cache 3x3 chunk neighborhood for fast access
  const hood = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    hood[(dx + 1) * 3 + (dz + 1)] = world.chunkAt(cx + dx, cz + dz);
  }
  const gb = (lx, y, lz) => { // local coords, may go ±16 out of chunk
    if (y < 0) return B.BEDROCK; if (y >= CY) return B.AIR;
    let hx = 1, hz = 1, x = lx, z = lz;
    if (lx < 0) { hx = 0; x = lx + CX; } else if (lx >= CX) { hx = 2; x = lx - CX; }
    if (lz < 0) { hz = 0; z = lz + CZ; } else if (lz >= CZ) { hz = 2; z = lz - CZ; }
    const c = hood[hx * 3 + hz];
    return c ? c.blocks[idx(x, y, z)] : B.AIR;
  };
  const gl = (lx, y, lz) => { // [sky, blk]
    if (y >= CY) return [15, 0]; if (y < 0) return [0, 0];
    let hx = 1, hz = 1, x = lx, z = lz;
    if (lx < 0) { hx = 0; x = lx + CX; } else if (lx >= CX) { hx = 2; x = lx - CX; }
    if (lz < 0) { hz = 0; z = lz + CZ; } else if (lz >= CZ) { hz = 2; z = lz - CZ; }
    const c = hood[hx * 3 + hz];
    if (!c) return [15, 0];
    const i = idx(x, y, z);
    return [c.sky[i], c.blk[i]];
  };

  const opaq = new GeoBuf(), water = new GeoBuf(), cross = new GeoBuf();
  const bx = cx * CX, bz = cz * CZ;

  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) for (let y = 0; y < CY; y++) {
    const id = chunk.blocks[idx(x, y, z)];
    if (id === B.AIR) continue;
    const def = blockDef(id);

    // ---- cross blocks (plants, torch) ----
    if (def.cross) {
      const t = tileUV(def.tex[0]);
      const [sky, blk] = gl(x, y, z);
      const L = [sky / 15, blk / 15];
      const lights = [L, L, L, L], shades = [1, 1, 1, 1];
      const x0 = bx + x, z0 = bz + z;
      const u = { a: [t.u0, t.v0], b: [t.u1, t.v0], c: [t.u1, t.v1], d: [t.u0, t.v1] };
      const o = 0.146; // inset so cross fits block
      cross.quad(
        [[x0 + o, y, z0 + o], [x0 + 1 - o, y, z0 + 1 - o], [x0 + 1 - o, y + 1, z0 + 1 - o], [x0 + o, y + 1, z0 + o]],
        [u.a, u.b, u.c, u.d], lights, shades, false);
      cross.quad(
        [[x0 + o, y, z0 + 1 - o], [x0 + 1 - o, y, z0 + o], [x0 + 1 - o, y + 1, z0 + o], [x0 + o, y + 1, z0 + 1 - o]],
        [u.a, u.b, u.c, u.d], lights, shades, false);
      continue;
    }

    const isWater = id === B.WATER;
    const isLava = id === B.LAVA;
    const target = isWater ? water : opaq;

    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
      const nid = gb(nx, ny, nz);
      // visibility test
      if (isWater) {
        if (nid === B.WATER) continue;
        if (isOpaque(nid)) continue;
      } else if (isLava) {
        if (nid === B.LAVA) continue;
        if (isOpaque(nid)) continue;
      } else {
        if (isOpaque(nid)) continue;
        if (nid === id && (id === B.GLASS || id === B.ICE)) continue;
        if (isWater || nid === B.WATER) { /* render against water */ }
      }

      const t = tileUV(def.tex[face.texIdx]);
      const uvs = [[t.u0, t.v0], [t.u1, t.v0], [t.u1, t.v1], [t.u0, t.v1]];
      const lights = [], shades = [];
      const ao = [];

      for (let v = 0; v < 4; v++) {
        const c = face.corners[v];
        // corner offsets perpendicular to the face normal
        const px = face.dir[0] !== 0 ? 0 : (c[0] === 1 ? 1 : -1);
        const py = face.dir[1] !== 0 ? 0 : (c[1] === 1 ? 1 : -1);
        const pz = face.dir[2] !== 0 ? 0 : (c[2] === 1 ? 1 : -1);
        // base cell = neighbor in face direction
        const baseX = nx, baseY = ny, baseZ = nz;
        // the two side cells + corner cell (zero out the normal axis)
        let s1x = baseX, s1y = baseY, s1z = baseZ, s2x = baseX, s2y = baseY, s2z = baseZ;
        if (face.dir[1] !== 0) { s1x += px; s2z += pz; }       // horizontal face → sides along x,z
        else if (face.dir[0] !== 0) { s1y += py; s2z += pz; }
        else { s1x += px; s2y += py; }
        const cx2 = baseX + (face.dir[0] !== 0 ? 0 : px), cy2 = baseY + (face.dir[1] !== 0 ? 0 : py), cz2 = baseZ + (face.dir[2] !== 0 ? 0 : pz);

        const o1 = isOpaque(gb(s1x, s1y, s1z)) ? 1 : 0;
        const o2 = isOpaque(gb(s2x, s2y, s2z)) ? 1 : 0;
        const oc = isOpaque(gb(cx2, cy2, cz2)) ? 1 : 0;
        const aoV = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
        ao.push(aoV);

        // smooth light: average non-opaque sample cells
        let sSum = 0, bSum = 0, n = 0;
        const samples = [[baseX, baseY, baseZ], [s1x, s1y, s1z], [s2x, s2y, s2z], [cx2, cy2, cz2]];
        for (const s of samples) {
          if (isOpaque(gb(s[0], s[1], s[2]))) continue;
          const lv = gl(s[0], s[1], s[2]);
          sSum += lv[0]; bSum += lv[1]; n++;
        }
        if (n === 0) { lights.push([0, 0]); }
        else lights.push([sSum / (n * 15), bSum / (n * 15)]);
        const aoF = 0.42 + 0.58 * (aoV / 3);
        shades.push(face.shade * (isWater || isLava || def.cross ? 1 : aoF));
      }

      // positions (water top surface lowered)
      const pos = [];
      for (let v = 0; v < 4; v++) {
        const c = face.corners[v];
        let yy = y + c[1];
        if (isWater && c[1] === 1 && gb(x, y + 1, z) !== B.WATER) yy = y + 0.875;
        pos.push([bx + x + c[0], yy, bz + z + c[2]]);
      }
      const flip = (ao[0] + ao[2]) < (ao[1] + ao[3]);
      target.quad(pos, uvs, lights, shades, flip);
    }
  }

  return {
    opaque: opaq.toGeometry(),
    water: water.toGeometry(),
    cross: cross.toGeometry()
  };
}
