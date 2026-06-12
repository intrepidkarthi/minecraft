// player.js — first-person player: movement, swimming, fall damage, health/hunger
"use strict";
import { B } from './blocks.js';
import { moveEntity, inBlock, headInBlock, GRAVITY } from './physics.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = { x: 0, y: 80, z: 0 };   // feet
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.hw = 0.3; this.h = 1.8; this.eye = 1.62;
    this.onGround = false;
    this.flying = false;
    this.sprinting = false;
    this.sneaking = false;

    this.hp = 20; this.maxHp = 20;
    // perk-tunable multipliers (set by progression.js; defaults match no-perk gameplay)
    this.sprintMult = 1; this.reach = 5; this.fallDmgMult = 1; this.attackBonus = 0;
    this.hunger = 20; this.saturation = 5;
    this.air = 10; this.maxAir = 10;
    this.dead = false;
    this.fallStart = null;
    this.hurtTimer = 0;       // invulnerability frames
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.exhaustion = 0;
    this.spawn = { x: 0, y: 80, z: 0 };

    this.inWater = false; this.headInWater = false; this.inLava = false;
    this.onHurt = null; this.onSound = null;
    this._airTick = 0; this._lavaTick = 0;
    this.bobPhase = 0; this.bobAmt = 0;
  }

  eyePos() { return { x: this.pos.x, y: this.pos.y + this.eye, z: this.pos.z }; }
  lookDir() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  update(dt, input) {
    if (this.dead) return;
    const w = this.world;
    this.inWater = inBlock(w, this, B.WATER);
    this.headInWater = headInBlock(w, this, this.eye, B.WATER);
    this.inLava = inBlock(w, this, B.LAVA);

    // --- desired horizontal movement ---
    let fx = 0, fz = 0;
    if (input.forward) { fx -= Math.sin(this.yaw); fz -= Math.cos(this.yaw); }
    if (input.back) { fx += Math.sin(this.yaw); fz += Math.cos(this.yaw); }
    if (input.left) { fx -= Math.cos(this.yaw); fz += Math.sin(this.yaw); }
    if (input.right) { fx += Math.cos(this.yaw); fz -= Math.sin(this.yaw); }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }

    this.sprinting = input.sprint && input.forward && !this.sneaking && this.hunger > 6;
    this.sneaking = input.sneak && !this.flying;

    let speed = 4.32;
    if (this.sprinting) speed = 5.61 * this.sprintMult;
    if (this.sneaking) speed = 1.31;
    if (this.flying) speed = input.sprint ? 16 : 10;
    if (this.inWater && !this.flying) speed *= 0.55;

    const accel = this.onGround || this.flying ? 60 : 18;
    this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel * dt / speed * (len > 0 ? 1 : 1));
    this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel * dt / speed);
    if (len === 0) {
      const f = this.onGround || this.flying ? Math.pow(0.0001, dt) : Math.pow(0.2, dt);
      this.vel.x *= f; this.vel.z *= f;
    }

    // --- vertical ---
    if (this.flying) {
      const vt = input.jump ? 9 : input.sneak ? -9 : 0;
      this.vel.y += (vt - this.vel.y) * Math.min(1, 10 * dt);
    } else if (this.inWater || this.inLava) {
      this.vel.y -= GRAVITY * 0.25 * dt;
      this.vel.y *= Math.pow(0.6, dt * 3);
      if (input.jump) this.vel.y = Math.min(this.vel.y + 24 * dt, 4.2);
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -60) this.vel.y = -60;
      if (input.jump && this.onGround) {
        this.vel.y = 8.7;
        this.onGround = false;
        this.exhaustion += 0.05;
        if (this.onSound) this.onSound('jump');
      }
    }

    // --- fall tracking ---
    const wasGround = this.onGround;
    const prevY = this.pos.y;
    if (!this.onGround && !this.flying && !this.inWater && this.vel.y < 0 && this.fallStart === null) {
      this.fallStart = prevY;
    }
    if (this.inWater || this.flying) this.fallStart = null;

    moveEntity(w, this, dt);

    if (this.onGround && !wasGround && this.fallStart !== null) {
      const dist = this.fallStart - this.pos.y;
      const dmg = Math.floor((dist - 3) * this.fallDmgMult);
      if (dmg > 0) {
        this.damage(dmg, 'fall');
        if (this.onSound) this.onSound('fall');
      }
      this.fallStart = null;
    }
    if (this.onGround) this.fallStart = null;
    else if (this.fallStart !== null) this.fallStart = Math.max(this.fallStart, this.pos.y);
    else if (!this.flying && !this.inWater && this.vel.y < 0) this.fallStart = this.pos.y;

    // --- environment damage ---
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.inLava) {
      this._lavaTick += dt;
      if (this._lavaTick > 0.5) { this._lavaTick = 0; this.damage(4, 'lava'); }
    }
    if (this.headInWater) {
      this._airTick += dt;
      if (this._airTick > 1.5) { this._airTick = 0; if (this.air > 0) this.air--; else this.damage(2, 'drown'); }
    } else { this.air = this.maxAir; this._airTick = 0; }

    // cactus contact
    const px = Math.floor(this.pos.x), py = Math.floor(this.pos.y), pz = Math.floor(this.pos.z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.getBlock(px + dx, py, pz + dz) === B.CACTUS) {
        const gx = px + dx + 0.5, gz = pz + dz + 0.5;
        if (Math.abs(this.pos.x - gx) < 0.5 + this.hw && Math.abs(this.pos.z - gz) < 0.5 + this.hw) this.damage(1, 'cactus');
      }
    }

    // --- hunger / regen ---
    if (this.sprinting) this.exhaustion += dt * 0.45;
    if (len > 0 && this.onGround) this.exhaustion += dt * 0.02;
    if (this.exhaustion > 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation--;
      else if (this.hunger > 0) this.hunger--;
    }
    if (this.hunger >= 18 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer > 3) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 1); this.exhaustion += 1.5; }
    }
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer > 4) { this.starveTimer = 0; if (this.hp > 1) this.damage(1, 'starve'); }
    }

    // --- head bob ---
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1) {
      this.bobPhase += dt * hSpeed * 1.6;
      this.bobAmt = Math.min(1, this.bobAmt + dt * 6);
    } else {
      this.bobAmt = Math.max(0, this.bobAmt - dt * 6);
    }
  }

  damage(n, cause) {
    if (this.dead || this.hurtTimer > 0 || this.flying && (cause === 'fall')) return;
    this.hp -= n;
    this.hurtTimer = 0.5;
    if (this.onHurt) this.onHurt(n, cause);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  eat(food) {
    this.hunger = Math.min(20, this.hunger + food);
    this.saturation = Math.min(this.hunger, this.saturation + food * 0.6);
  }

  respawn() {
    this.pos = { ...this.spawn };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = this.maxHp; this.hunger = 20; this.saturation = 5; this.air = this.maxAir;
    this.dead = false; this.fallStart = null;
  }
}
