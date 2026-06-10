// renderer.js — THREE scene, chunk mesh lifecycle, shaders, highlight + crack overlay
"use strict";
import * as THREE from '../vendor/three.module.js';
import { atlasCanvas, T, tileUV } from './blocks.js';
import { buildChunkGeometry } from './mesher.js';
import { CX, CZ } from './worldgen.js';
import { Sky } from './sky.js';

const VSH = `
  attribute vec2 aLight;
  attribute float aShade;
  varying vec2 vUv; varying vec2 vLight; varying float vShade; varying float vDepth;
  void main(){
    vUv = uv; vLight = aLight; vShade = aShade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

function fsh(opts) {
  return `
  precision highp float;
  uniform sampler2D map; uniform float uDay; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
  ${opts.water ? 'uniform float uTime;' : ''}
  varying vec2 vUv; varying vec2 vLight; varying float vShade; varying float vDepth;
  void main(){
    vec2 uv = vUv;
    ${opts.water ? 'uv.x += sin(uTime*0.7 + vUv.y*40.0)*0.001;' : ''}
    vec4 tex = texture2D(map, uv);
    ${opts.alphaTest ? 'if (tex.a < 0.35) discard;' : ''}
    float light = max(vLight.y, vLight.x * uDay);
    light = 0.045 + 0.955 * pow(light, 1.35);
    vec3 col = tex.rgb * vShade * light;
    float fogF = smoothstep(fogNear, fogFar, vDepth);
    col = mix(col, fogColor, fogF);
    gl_FragColor = vec4(col, ${opts.water ? ' 0.72' : 'tex.a'});
  }`;
}

export class Renderer {
  constructor(canvas, world) {
    this.world = world;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // authored colors pass through 1:1
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 1200);
    this.renderDist = 6;

    // texture atlas
    this.atlas = new THREE.CanvasTexture(atlasCanvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;

    const baseUniforms = () => ({
      map: { value: this.atlas }, uDay: { value: 1 },
      fogColor: { value: new THREE.Color(0xbcd8f5) },
      fogNear: { value: 60 }, fogFar: { value: 100 }
    });
    this.uniformSets = [];
    const mk = (opts, mat) => { this.uniformSets.push(mat.uniforms); return mat; };
    this.matOpaque = mk({}, new THREE.ShaderMaterial({
      uniforms: baseUniforms(), vertexShader: VSH, fragmentShader: fsh({ alphaTest: true })
    }));
    this.matCross = mk({}, new THREE.ShaderMaterial({
      uniforms: baseUniforms(), vertexShader: VSH, fragmentShader: fsh({ alphaTest: true }), side: THREE.DoubleSide
    }));
    this.matWater = mk({}, new THREE.ShaderMaterial({
      uniforms: Object.assign(baseUniforms(), { uTime: { value: 0 } }),
      vertexShader: VSH, fragmentShader: fsh({ water: true }),
      transparent: true, depthWrite: false
    }));

    this.sky = new Sky(this.scene);

    // block highlight (wireframe box)
    const hg = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlightMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(hg),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.65 })
    );
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // crack overlay
    this.crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    this.crackMesh = new THREE.Mesh(this.crackGeo, this.crackMat);
    this.crackMesh.visible = false;
    this.crackStage = -1;
    this.crackBaseUV = this.crackGeo.attributes.uv.array.slice();
    this.scene.add(this.crackMesh);

    this.entityGroup = new THREE.Group();
    this.scene.add(this.entityGroup);

    this._spiral = this._makeSpiral(20);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _makeSpiral(maxR) {
    const arr = [];
    for (let x = -maxR; x <= maxR; x++) for (let z = -maxR; z <= maxR; z++) arr.push([x, z, Math.sqrt(x * x + z * z)]);
    arr.sort((a, b) => a[2] - b[2]);
    return arr;
  }

  // chunk pipeline: generate → light → mesh, time-budgeted
  syncChunks(px, pz, budgetMs = 7) {
    const world = this.world;
    const pcx = Math.floor(px / CX), pcz = Math.floor(pz / CZ);
    const rd = this.renderDist;
    const t0 = performance.now();

    // 1) generate (rd+2 so lighting at rd+1 has full neighborhoods)
    for (const [dx, dz, r] of this._spiral) {
      if (r > rd + 2) break;
      const cx = pcx + dx, cz = pcz + dz;
      if (!world.chunks.has(cx + ',' + cz)) {
        world.ensureChunk(cx, cz);
        if (performance.now() - t0 > budgetMs) return;
      }
    }
    // 2) light (rd+1 so meshing at rd has lit neighborhoods)
    for (const [dx, dz, r] of this._spiral) {
      if (r > rd + 1) break;
      const c = world.chunkAt(pcx + dx, pcz + dz);
      if (c && !c.lit && world.neighborsGenerated(c.cx, c.cz)) {
        world.lightChunk(c);
        if (performance.now() - t0 > budgetMs) return;
      }
    }
    // 3) mesh
    for (const [dx, dz, r] of this._spiral) {
      if (r > rd) break;
      const c = world.chunkAt(pcx + dx, pcz + dz);
      if (c && c.lit && (c.dirty || !c.meshed) && world.neighborsLit(c.cx, c.cz)) {
        this._remesh(c);
        if (performance.now() - t0 > budgetMs * 1.5) return;
      }
    }
    // 4) unload far chunks (throttled)
    if (!this._unloadTick) this._unloadTick = 0;
    if (++this._unloadTick % 120 === 0) {
      const drop = [];
      for (const c of world.chunks.values()) {
        const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
        if (d > rd + 4) drop.push(c);
      }
      for (const c of drop) world.unload(c.cx, c.cz, (ch) => this._dispose(ch));
    }
  }

  _remesh(chunk) {
    this._dispose(chunk);
    const geos = buildChunkGeometry(this.world, chunk);
    if (geos.opaque) {
      chunk.mesh = new THREE.Mesh(geos.opaque, this.matOpaque);
      chunk.mesh.frustumCulled = true;
      this.scene.add(chunk.mesh);
    }
    if (geos.water) {
      chunk.waterMesh = new THREE.Mesh(geos.water, this.matWater);
      chunk.waterMesh.renderOrder = 10;
      this.scene.add(chunk.waterMesh);
    }
    if (geos.cross) {
      chunk.crossMesh = new THREE.Mesh(geos.cross, this.matCross);
      this.scene.add(chunk.crossMesh);
    }
    chunk.dirty = false;
    chunk.meshed = true;
  }

  _dispose(chunk) {
    for (const k of ['mesh', 'waterMesh', 'crossMesh']) {
      const m = chunk[k];
      if (m) { this.scene.remove(m); m.geometry.dispose(); chunk[k] = null; }
    }
    chunk.meshed = false;
  }

  setHighlight(hit) {
    if (!hit) { this.highlightMesh.visible = false; return; }
    this.highlightMesh.visible = true;
    this.highlightMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  setCrack(hit, progress) {
    if (!hit || progress <= 0) { this.crackMesh.visible = false; this.crackStage = -1; return; }
    const stage = Math.min(9, (progress * 10) | 0);
    if (stage !== this.crackStage) {
      this.crackStage = stage;
      const t = tileUV(T['crack_' + stage]);
      const uv = this.crackGeo.attributes.uv;
      const base = this.crackBaseUV;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, t.u0 + (t.u1 - t.u0) * base[i * 2], t.v0 + (t.v1 - t.v0) * base[i * 2 + 1]);
      }
      uv.needsUpdate = true;
    }
    this.crackMesh.visible = true;
    this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  update(timeOfDay, camPos, dt, elapsed) {
    this.sky.update(timeOfDay, camPos, dt);
    const fogFar = this.renderDist * CX * 0.95;
    for (const u of this.uniformSets) {
      u.uDay.value = this.sky.dayFactor;
      u.fogColor.value.copy(this.sky.fogColor);
      u.fogNear.value = fogFar * 0.55;
      u.fogFar.value = fogFar;
      if (u.uTime) u.uTime.value = elapsed;
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
