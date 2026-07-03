// physics.js — shared AABB voxel collision + entity movement
"use strict";
import { B, blockDef } from './blocks.js';

// entity: { pos:{x,y,z} (feet center), vel:{x,y,z}, hw (half width), h (height), onGround }
export function moveEntity(world, e, dt) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z)) * dt / 0.4));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    moveAxis(world, e, e.vel.x * sdt, 0);
    moveAxis(world, e, e.vel.y * sdt, 1);
    moveAxis(world, e, e.vel.z * sdt, 2);
  }
}

function solidAt(world, x, y, z) {
  return blockDef(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))).solid;
}

export function collides(world, e, px, py, pz) {
  const x0 = Math.floor(px - e.hw), x1 = Math.floor(px + e.hw - 1e-7);
  const y0 = Math.floor(py), y1 = Math.floor(py + e.h - 1e-7);
  const z0 = Math.floor(pz - e.hw), z1 = Math.floor(pz + e.hw - 1e-7);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (blockDef(world.getBlock(x, y, z)).solid) return true;
  }
  return false;
}

function moveAxis(world, e, d, axis) {
  if (d === 0) return;
  let nx = e.pos.x, ny = e.pos.y, nz = e.pos.z;
  if (axis === 0) nx += d; else if (axis === 1) ny += d; else nz += d;
  if (!collides(world, e, nx, ny, nz)) {
    e.pos.x = nx; e.pos.y = ny; e.pos.z = nz;
    if (axis === 1) e.onGround = false;
    return;
  }
  // snap to block boundary
  if (axis === 1) {
    if (d < 0) {
      e.pos.y = Math.floor(ny) + 1 + 1e-5;
      e.onGround = true;
    } else {
      e.pos.y = Math.floor(ny + e.h) - e.h - 1e-5;
    }
    e.vel.y = 0;
  } else if (axis === 0) {
    e.pos.x = d > 0 ? Math.floor(nx + e.hw) - e.hw - 1e-5 : Math.floor(nx - e.hw) + 1 + e.hw + 1e-5;
    e.vel.x = 0;
    e.hitWall = true;
  } else {
    e.pos.z = d > 0 ? Math.floor(nz + e.hw) - e.hw - 1e-5 : Math.floor(nz - e.hw) + 1 + e.hw + 1e-5;
    e.vel.z = 0;
    e.hitWall = true;
  }
}

export function inBlock(world, e, blockId) {
  const x0 = Math.floor(e.pos.x - e.hw), x1 = Math.floor(e.pos.x + e.hw - 1e-7);
  const y0 = Math.floor(e.pos.y), y1 = Math.floor(e.pos.y + e.h - 1e-7);
  const z0 = Math.floor(e.pos.z - e.hw), z1 = Math.floor(e.pos.z + e.hw - 1e-7);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (world.getBlock(x, y, z) === blockId) return true;
  }
  return false;
}

export function headInBlock(world, e, eyeY, blockId) {
  return world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y + eyeY), Math.floor(e.pos.z)) === blockId;
}

export const GRAVITY = 32;
