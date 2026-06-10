// sky.js — day/night cycle: gradient dome, sun, moon, stars, clouds
"use strict";
import * as THREE from '../vendor/three.module.js';
import { mulberry32 } from './noise.js';

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpC(out, a, b, t) { out.r = lerp(a.r, b.r, t); out.g = lerp(a.g, b.g, t); out.b = lerp(a.b, b.b, t); return out; }

const DAY_ZEN = new THREE.Color(0x6da3f5), DAY_HOR = new THREE.Color(0xbcd8f5);
const NIGHT_ZEN = new THREE.Color(0x050a18), NIGHT_HOR = new THREE.Color(0x0d1426);
const SET_HOR = new THREE.Color(0xf5995c), SET_ZEN = new THREE.Color(0x4a6db5);

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // gradient dome
    this.zen = new THREE.Color(); this.hor = new THREE.Color();
    const domeGeo = new THREE.SphereGeometry(900, 24, 12);
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { cZen: { value: this.zen }, cHor: { value: this.hor } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 cZen; uniform vec3 cHor;
        void main(){ float h = pow(1.0 - max(vDir.y, 0.0), 2.2); gl_FragColor = vec4(mix(cZen, cHor, h), 1.0); }`
    });
    this.dome = new THREE.Mesh(domeGeo, this.domeMat);
    this.dome.renderOrder = -100;
    this.group.add(this.dome);

    // celestial pivot (rotates east→west)
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 32;
    let c = sunCanvas.getContext('2d');
    c.fillStyle = '#fdf2bf'; c.fillRect(4, 4, 24, 24);
    c.fillStyle = '#ffe680'; c.fillRect(7, 7, 18, 18);
    const sunTex = new THREE.CanvasTexture(sunCanvas); sunTex.magFilter = THREE.NearestFilter;
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    this.sun.position.set(700, 0, 0); this.sun.rotation.y = -Math.PI / 2; // starts at eastern horizon
    this.sun.renderOrder = -90;
    this.pivot.add(this.sun);

    const moonCanvas = document.createElement('canvas'); moonCanvas.width = moonCanvas.height = 32;
    c = moonCanvas.getContext('2d');
    c.fillStyle = '#dfe5ec'; c.fillRect(6, 6, 20, 20);
    c.fillStyle = '#b9c2cd'; c.fillRect(10, 10, 12, 12); c.fillStyle = '#cfd8e2'; c.fillRect(8, 14, 6, 8);
    const moonTex = new THREE.CanvasTexture(moonCanvas); moonTex.magFilter = THREE.NearestFilter;
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(56, 56),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    this.moon.position.set(-700, 0, 0); this.moon.rotation.y = Math.PI / 2;
    this.moon.renderOrder = -90;
    this.pivot.add(this.moon);

    // stars
    const rng = mulberry32(99);
    const starPos = [];
    for (let i = 0; i < 420; i++) {
      const t = rng() * Math.PI * 2, p = Math.acos(2 * rng() - 1);
      const r = 850;
      starPos.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
    }
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -95;
    this.pivot.add(this.stars);

    // clouds — blocky pattern, slowly drifting
    const cl = document.createElement('canvas'); cl.width = cl.height = 64;
    const cc = cl.getContext('2d');
    const crng = mulberry32(7);
    cc.clearRect(0, 0, 64, 64);
    cc.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < 26; i++) {
      const x = (crng() * 64) | 0, y = (crng() * 64) | 0, w = 4 + (crng() * 10) | 0, h = 3 + (crng() * 6) | 0;
      cc.fillRect(x, y, w, h);
      if (crng() > .4) cc.fillRect(x + 2, y - 2, w - 3, 2);
      if (crng() > .4) cc.fillRect(x + 1, y + h, w - 2, 2);
    }
    this.cloudTex = new THREE.CanvasTexture(cl);
    this.cloudTex.magFilter = THREE.NearestFilter;
    this.cloudTex.wrapS = this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudTex.repeat.set(3, 3);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false, side: THREE.DoubleSide });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 148;
    this.clouds.renderOrder = -80;
    scene.add(this.clouds);

    this.fogColor = new THREE.Color();
    this.dayFactor = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0);
  }

  // t: 0 = sunrise(6:00), .25 = noon, .5 = sunset, .75 = midnight
  update(t, camPos, dt) {
    const ang = t * Math.PI * 2; // rotation of celestial pivot (x→y)
    this.pivot.rotation.z = ang;
    const sunE = Math.sin(ang); // sun elevation: 0 sunrise, 1 noon, -1 midnight
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0);

    // day factor: skylight multiplier
    const dl = THREE.MathUtils.clamp(sunE * 2.2 + 0.5, 0.16, 1);
    this.dayFactor = dl;

    // sky colors
    const dayAmt = THREE.MathUtils.clamp(sunE * 2.6 + 0.55, 0, 1);
    lerpC(this.zen, NIGHT_ZEN, DAY_ZEN, dayAmt);
    lerpC(this.hor, NIGHT_HOR, DAY_HOR, dayAmt);
    // sunset/sunrise tint near horizon
    const setAmt = Math.max(0, 1 - Math.abs(sunE) * 4.5) * (dayAmt > 0.05 ? 1 : 0);
    if (setAmt > 0) {
      lerpC(this.hor, this.hor, SET_HOR, setAmt * 0.85);
      lerpC(this.zen, this.zen, SET_ZEN, setAmt * 0.4);
    }
    this.fogColor.copy(this.hor);

    this.starMat.opacity = THREE.MathUtils.clamp(0.9 - dayAmt * 1.6, 0, 0.9);
    this.cloudMat.opacity = 0.5 + dayAmt * 0.38;
    this.cloudMat.color.setScalar(0.25 + dayAmt * 0.75);

    // follow camera
    this.group.position.copy(camPos);
    this.clouds.position.x = camPos.x; this.clouds.position.z = camPos.z;
    this.cloudTex.offset.x += dt * 0.0016;
    this.cloudTex.offset.x += (camPos.x - (this._lastX || camPos.x)) * 0.00018;
    this.cloudTex.offset.y -= (camPos.z - (this._lastZ || camPos.z)) * 0.00018;
    this._lastX = camPos.x; this._lastZ = camPos.z;
  }
}
