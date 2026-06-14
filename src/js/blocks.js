// blocks.js — block registry + procedural 16x16 texture atlas (Minecraft-style pixel art)
"use strict";
import { mulberry32 } from './noise.js';

export const TILE = 16, ATLAS_COLS = 16, ATLAS_ROWS = 16;
export const ATLAS_W = TILE * ATLAS_COLS, ATLAS_H = TILE * ATLAS_ROWS;

// ---------------------------------------------------------------- atlas paint
export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_W; atlasCanvas.height = ATLAS_H;
const actx = atlasCanvas.getContext('2d', { willReadFrequently: true });

let nextTile = 0;
export const T = {}; // name -> tile index

function reg(name) { T[name] = nextTile++; return T[name]; }

function painter(idx, fn) {
  const tx = (idx % ATLAS_COLS) * TILE, ty = ((idx / ATLAS_COLS) | 0) * TILE;
  const img = actx.createImageData(TILE, TILE);
  const d = img.data;
  const rng = mulberry32(0x9e3779b9 ^ idx);
  const px = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const o = (y * TILE + x) * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
  };
  const hexp = (x, y, hex, a = 255) => px(x, y, (hex >> 16) & 255, (hex >> 8) & 255, hex & 255, a);
  fn({ px, hex: hexp, rng, d });
  actx.putImageData(img, tx, ty);
}

// color helpers
function vary(hex, rng, amt) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = 1 + (rng() * 2 - 1) * amt;
  const c = (v) => Math.max(0, Math.min(255, (v * f) | 0));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
function noiseFill(p, base, amt = 0.12) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.hex(x, y, vary(base, p.rng, amt));
}
function speckle(p, colors, n, size = 1) {
  for (let i = 0; i < n; i++) {
    const x = (p.rng() * 16) | 0, y = (p.rng() * 16) | 0;
    const c = colors[(p.rng() * colors.length) | 0];
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) p.hex(x + dx, y + dy, c);
  }
}
function oreTex(idx, oreColors, bright) {
  painter(idx, p => {
    noiseFill(p, 0x7e7e7e, 0.10);
    speckle(p, [0x6f6f6f, 0x8a8a8a], 24);
    // 3-4 ore clusters
    const n = 3 + (p.rng() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const cx = 2 + (p.rng() * 12) | 0, cy = 2 + (p.rng() * 12) | 0;
      p.hex(cx, cy, bright); p.hex(cx + 1, cy, oreColors[0]); p.hex(cx, cy + 1, oreColors[0]);
      p.hex(cx + 1, cy + 1, oreColors[1] || oreColors[0]);
      if (p.rng() > .5) p.hex(cx - 1, cy, oreColors[1] || oreColors[0]);
      if (p.rng() > .5) p.hex(cx, cy - 1, bright);
    }
  });
}
function logSide(idx, bark, barkDark, barkLight) {
  painter(idx, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const stripe = (x + ((p.rng() * 1.6) | 0)) % 4;
      p.hex(x, y, stripe === 0 ? barkDark : (stripe === 2 && p.rng() > .6 ? barkLight : vary(bark, p.rng, .07)));
    }
  });
}
function logTop(idx, bark, ringDark, ringLight) {
  painter(idx, p => {
    noiseFill(p, bark, .06);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 6.5) {
        const ring = ((r | 0) % 2 === 0);
        p.hex(x, y, vary(ring ? ringLight : ringDark, p.rng, .05));
      }
    }
  });
}
function planks(idx, base, dark, light) {
  painter(idx, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = vary(base, p.rng, .06);
      if (y % 4 === 3) c = dark;                       // horizontal seams
      const off = ((y / 4) | 0) % 2 === 0 ? 4 : 12;     // staggered vertical seams
      if (x === off && y % 4 !== 3) c = dark;
      if (y % 4 === 0 && p.rng() > .8) c = light;
      p.hex(x, y, c);
    }
  });
}
function leaves(idx, base, dark, light) {
  painter(idx, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = p.rng();
      if (r > 0.94) { p.px(x, y, 0, 0, 0, 0); continue; } // tiny holes
      p.hex(x, y, r > .75 ? light : r < .2 ? dark : vary(base, p.rng, .1));
    }
  });
}

// ------------------------------------------------- tile definitions (painted)
reg('stone'); painter(T.stone, p => { noiseFill(p, 0x7e7e7e, .09); speckle(p, [0x6b6b6b, 0x8f8f8f, 0x757575], 30, 2); });
reg('dirt'); painter(T.dirt, p => { noiseFill(p, 0x866043, .14); speckle(p, [0x6e4a2f, 0x9b7350, 0x5d3f28], 26, 1); });
reg('grass_top'); painter(T.grass_top, p => { noiseFill(p, 0x7cb84e, .12); speckle(p, [0x68a93f, 0x8fc763, 0x5f9c39], 34); });
reg('grass_side'); painter(T.grass_side, p => {
  noiseFill(p, 0x866043, .14); speckle(p, [0x6e4a2f, 0x9b7350], 18);
  for (let x = 0; x < 16; x++) {
    const dep = 2 + ((p.rng() * 3) | 0);
    for (let y = 0; y < dep; y++) p.hex(x, y, vary(y === dep - 1 ? 0x5f9c39 : 0x7cb84e, p.rng, .1));
  }
});
reg('snow_side'); painter(T.snow_side, p => {
  noiseFill(p, 0x866043, .14);
  for (let x = 0; x < 16; x++) { const dep = 2 + ((p.rng() * 2) | 0); for (let y = 0; y < dep; y++) p.hex(x, y, vary(0xeef4f7, p.rng, .03)); }
});
reg('snow'); painter(T.snow, p => { noiseFill(p, 0xf2f7fa, .03); speckle(p, [0xe2ecf2, 0xffffff], 18); });
reg('ice'); painter(T.ice, p => { noiseFill(p, 0x9ec7f7, .05); speckle(p, [0xbcd9fb, 0x86b4ee], 14, 2); });
reg('sand'); painter(T.sand, p => { noiseFill(p, 0xdcd0a2, .07); speckle(p, [0xcfc191, 0xe8debc, 0xc6b787], 28); });
reg('sandstone'); painter(T.sandstone, p => {
  noiseFill(p, 0xd8cb9d, .05);
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) p.hex(x, y + 3, 0xbfb083);
});
reg('gravel'); painter(T.gravel, p => { noiseFill(p, 0x8b8580, .12); speckle(p, [0x6f6a66, 0xa39d97, 0x57534f, 0x9d958d], 42, 2); });
reg('bedrock'); painter(T.bedrock, p => { noiseFill(p, 0x444444, .25); speckle(p, [0x222222, 0x666666, 0x111111], 40, 2); });
reg('cobble'); painter(T.cobble, p => {
  noiseFill(p, 0x828282, .08);
  // stone lumps
  for (let i = 0; i < 7; i++) {
    const cx = (p.rng() * 14) | 0, cy = (p.rng() * 14) | 0, s = 3 + (p.rng() * 3 | 0);
    const c = vary(0x8e8e8e, p.rng, .15);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (x === 0 || y === 0) p.hex(cx + x, cy + y, 0x5c5c5c); else p.hex(cx + x, cy + y, vary(c, p.rng, .06));
    }
  }
});
reg('mossy_cobble'); painter(T.mossy_cobble, p => {
  noiseFill(p, 0x828282, .08);
  for (let i = 0; i < 7; i++) {
    const cx = (p.rng() * 14) | 0, cy = (p.rng() * 14) | 0, s = 3 + (p.rng() * 3 | 0);
    const mossy = p.rng() > .5;
    const c = mossy ? 0x6a8a4a : vary(0x8e8e8e, p.rng, .15);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (x === 0 || y === 0) p.hex(cx + x, cy + y, 0x55604a); else p.hex(cx + x, cy + y, vary(c, p.rng, .08));
    }
  }
});
reg('oak_log'); logSide(T.oak_log, 0x6b5232, 0x4a3a20, 0x7d6240);
reg('oak_log_top'); logTop(T.oak_log_top, 0x6b5232, 0xa3824f, 0xc2a86b);
reg('oak_planks'); planks(T.oak_planks, 0xa3824f, 0x6e552f, 0xb89465);
reg('oak_leaves'); leaves(T.oak_leaves, 0x4a8a2e, 0x36691f, 0x5ea63c);
reg('birch_log'); painter(T.birch_log, p => {
  noiseFill(p, 0xe7e2d2, .04);
  for (let i = 0; i < 9; i++) {
    const x = (p.rng() * 14) | 0, y = (p.rng() * 15) | 0, w = 2 + (p.rng() * 3 | 0);
    for (let k = 0; k < w; k++) p.hex(x + k, y, 0x33312a);
  }
});
reg('birch_log_top'); logTop(T.birch_log_top, 0xe7e2d2, 0xcbb98a, 0xe3d6ad);
reg('birch_planks'); planks(T.birch_planks, 0xd0c191, 0x9a8c61, 0xe0d3a6);
reg('birch_leaves'); leaves(T.birch_leaves, 0x6fa852, 0x55883c, 0x88c069);
reg('spruce_log'); logSide(T.spruce_log, 0x4a3623, 0x342414, 0x5c4630);
reg('spruce_log_top'); logTop(T.spruce_log_top, 0x4a3623, 0x7a5c36, 0x96744a);
reg('spruce_planks'); planks(T.spruce_planks, 0x7a5c36, 0x523c20, 0x8d6c42);
reg('spruce_leaves'); leaves(T.spruce_leaves, 0x2e5b34, 0x224527, 0x3d7245);
reg('water'); painter(T.water, p => { noiseFill(p, 0x3f66d6, .06); speckle(p, [0x4f7ae8, 0x3458b8], 16, 2); });
reg('lava'); painter(T.lava, p => {
  noiseFill(p, 0xd45a12, .15); speckle(p, [0xf7a429, 0xffd54a, 0xa83b0a], 30, 2);
});
reg('coal_ore'); oreTex(T.coal_ore, [0x2b2b2b, 0x1c1c1c], 0x3d3d3d);
reg('iron_ore'); oreTex(T.iron_ore, [0xd8af93, 0xb78a6c], 0xe8c5a8);
reg('gold_ore'); oreTex(T.gold_ore, [0xfcdb4a, 0xd9b32a], 0xfff08a);
reg('diamond_ore'); oreTex(T.diamond_ore, [0x4fd8e0, 0x2fb3c7], 0x9af2f5);
reg('redstone_ore'); oreTex(T.redstone_ore, [0xc4180f, 0x8f0d07], 0xff3b2e);
reg('glass'); painter(T.glass, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  for (let i = 0; i < 16; i++) { p.hex(i, 0, 0xd8eef2); p.hex(i, 15, 0xd8eef2); p.hex(0, i, 0xd8eef2); p.hex(15, i, 0xd8eef2); }
  p.hex(3, 2, 0xeaf7fa, 180); p.hex(4, 3, 0xeaf7fa, 180); p.hex(2, 3, 0xeaf7fa, 160); p.hex(5, 4, 0xeaf7fa, 120);
});
reg('bricks'); painter(T.bricks, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = (y / 4) | 0;
    const off = row % 2 ? 4 : 0;
    const seamY = y % 4 === 3, seamX = (x + off) % 8 === 7;
    p.hex(x, y, (seamY || seamX) ? 0xb0a9a3 : vary(0x9c5040, p.rng, .09));
  }
});
reg('stone_bricks'); painter(T.stone_bricks, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = (y / 8) | 0;
    const off = row % 2 ? 0 : 8;
    const seamY = y % 8 === 7, seamX = (x + off) % 8 === 7;
    p.hex(x, y, (seamY || seamX) ? 0x575757 : vary(0x8a8a8a, p.rng, .07));
  }
});
reg('obsidian'); painter(T.obsidian, p => { noiseFill(p, 0x17131f, .3); speckle(p, [0x2c2440, 0x3b2f56, 0x0c0a12], 22, 1); });
reg('glowstone'); painter(T.glowstone, p => { noiseFill(p, 0xd9a334, .12); speckle(p, [0xffd96b, 0xfff0a8, 0xb27a1c], 34, 2); });
reg('wool'); painter(T.wool, p => { noiseFill(p, 0xe8e8e8, .05); speckle(p, [0xd8d8d8, 0xf6f6f6], 26, 2); });
reg('bookshelf'); painter(T.bookshelf, p => {
  noiseFill(p, 0xa3824f, .06);
  const cols = [0xa83232, 0x3261a8, 0x3f8a3a, 0xc7a23a, 0x7a3fa0];
  for (const ys of [1, 9]) {
    for (let x = 1; x < 15;) {
      const w = 1 + (p.rng() * 2 | 0), c = cols[(p.rng() * cols.length) | 0];
      for (let k = 0; k < w && x < 15; k++, x++) for (let y = ys; y < ys + 6; y++) p.hex(x, y, vary(c, p.rng, .08));
      if (p.rng() > .7) x++; // gap
    }
    for (let x = 0; x < 16; x++) { p.hex(x, ys - 1, 0x6e552f); p.hex(x, ys + 6, 0x6e552f); }
  }
});
reg('crafting_top'); painter(T.crafting_top, p => {
  planksPaint(p, 0xa3824f, 0x6e552f, 0xb89465);
  for (let i = 1; i < 15; i++) { p.hex(i, 5, 0x5c4626); p.hex(i, 10, 0x5c4626); p.hex(5, i, 0x5c4626); p.hex(10, i, 0x5c4626); }
});
reg('crafting_side'); painter(T.crafting_side, p => {
  planksPaint(p, 0xa3824f, 0x6e552f, 0xb89465);
  // tools silhouette
  for (let y = 2; y < 8; y++) p.hex(4, y, 0x8a8a8a);
  p.hex(3, 2, 0x8a8a8a); p.hex(5, 2, 0x8a8a8a);
  for (let y = 3; y < 9; y++) p.hex(11, y, 0x6b4a2a);
  p.hex(10, 3, 0xc0c0c0); p.hex(11, 2, 0xc0c0c0); p.hex(12, 3, 0xc0c0c0);
});
function planksPaint(p, base, dark, light) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = vary(base, p.rng, .06);
    if (y % 4 === 3) c = dark;
    const off = ((y / 4) | 0) % 2 === 0 ? 4 : 12;
    if (x === off && y % 4 !== 3) c = dark;
    p.hex(x, y, c);
  }
}
reg('furnace_front'); painter(T.furnace_front, p => {
  noiseFill(p, 0x7e7e7e, .08); speckle(p, [0x6b6b6b, 0x8f8f8f], 20);
  for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) p.hex(x, y, 0x1c1c1c);
  for (let x = 3; x < 13; x++) p.hex(x, 7, 0x4a4a4a);
});
reg('furnace_front_lit'); painter(T.furnace_front_lit, p => {
  noiseFill(p, 0x7e7e7e, .08);
  for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) {
    const r = p.rng();
    p.hex(x, y, r > .6 ? 0xffb52e : r > .3 ? 0xe8641c : 0xa8330c);
  }
  for (let x = 3; x < 13; x++) p.hex(x, 7, 0x4a4a4a);
});
reg('furnace_side'); painter(T.furnace_side, p => { noiseFill(p, 0x7e7e7e, .08); speckle(p, [0x6b6b6b, 0x8f8f8f, 0x757575], 26, 2); for (let x = 0; x < 16; x++) { p.hex(x, 0, 0x5e5e5e); p.hex(x, 15, 0x565656); } });
reg('furnace_top'); painter(T.furnace_top, p => { noiseFill(p, 0x747474, .07); speckle(p, [0x636363, 0x858585], 24, 2); });
reg('chest_front'); painter(T.chest_front, p => {
  noiseFill(p, 0x9a6b35, .07);
  for (let x = 0; x < 16; x++) { p.hex(x, 0, 0x5c3e1c); p.hex(x, 15, 0x5c3e1c); p.hex(x, 7, 0x5c3e1c); }
  for (let y = 0; y < 16; y++) { p.hex(0, y, 0x5c3e1c); p.hex(15, y, 0x5c3e1c); }
  for (let y = 5; y < 10; y++) for (let x = 6; x < 10; x++) p.hex(x, y, 0x8f8f8f);
  p.hex(7, 7, 0x4a4a4a); p.hex(8, 7, 0x4a4a4a);
});
reg('chest_side'); painter(T.chest_side, p => {
  noiseFill(p, 0x9a6b35, .07);
  for (let x = 0; x < 16; x++) { p.hex(x, 0, 0x5c3e1c); p.hex(x, 15, 0x5c3e1c); p.hex(x, 7, 0x5c3e1c); }
  for (let y = 0; y < 16; y++) { p.hex(0, y, 0x5c3e1c); p.hex(15, y, 0x5c3e1c); }
});
reg('chest_top'); painter(T.chest_top, p => {
  noiseFill(p, 0xa3742e + 0x60000, .07);
  for (let i = 0; i < 16; i++) { p.hex(i, 0, 0x5c3e1c); p.hex(i, 15, 0x5c3e1c); p.hex(0, i, 0x5c3e1c); p.hex(15, i, 0x5c3e1c); }
});
reg('door'); painter(T.door, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = vary(0x8a5a2e, p.rng, .05);
    if (x === 0 || x === 15 || y === 0 || y === 15) c = 0x5e3d1c;   // frame
    p.hex(x, y, c);
  }
  const panel = (y0, y1) => {
    for (let x = 3; x <= 12; x++) { p.hex(x, y0, 0x5e3d1c); p.hex(x, y1, 0x5e3d1c); }
    for (let y = y0; y <= y1; y++) { p.hex(3, y, 0x5e3d1c); p.hex(12, y, 0x5e3d1c); }
  };
  panel(2, 6); panel(9, 13);
  p.hex(11, 8, 0x3a2410); p.hex(11, 7, 0xd9c27a);                   // knob
});
reg('door_open'); painter(T.door_open, p => {
  // a narrow strip of door (swung open against the wall); rest transparent
  for (let y = 1; y < 15; y++) for (let x = 1; x <= 4; x++) p.hex(x, y, vary(0x8a5a2e, p.rng, .05));
  for (let y = 1; y < 15; y++) { p.hex(1, y, 0x5e3d1c); p.hex(4, y, 0x5e3d1c); }
  p.hex(3, 8, 0xd9c27a);
});
reg('cactus_side'); painter(T.cactus_side, p => {
  noiseFill(p, 0x3a7a26, .08);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x += 4) { p.hex(x, y, 0x57a33b); if (p.rng() > .8) p.hex(x + 2, y, 0x2c5e1d); }
});
reg('cactus_top'); painter(T.cactus_top, p => { noiseFill(p, 0x57a33b, .07); for (let i = 0; i < 16; i++) { p.hex(i, 0, 0x2c5e1d); p.hex(i, 15, 0x2c5e1d); p.hex(0, i, 0x2c5e1d); p.hex(15, i, 0x2c5e1d); } });
reg('pumpkin_side'); painter(T.pumpkin_side, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const rib = x % 5 === 0;
    p.hex(x, y, rib ? 0xb0560f : vary(0xd9731a, p.rng, .07));
  }
});
reg('pumpkin_top'); painter(T.pumpkin_top, p => {
  noiseFill(p, 0xc9680f, .08);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) p.hex(x, y, 0x6b8a2a);
});
reg('pumpkin_face'); painter(T.pumpkin_face, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.hex(x, y, x % 5 === 0 ? 0xb0560f : vary(0xd9731a, p.rng, .07));
  // jack-o-lantern face
  for (const [x, y] of [[3, 5], [4, 5], [3, 6], [4, 6], [11, 5], [12, 5], [11, 6], [12, 6], [7, 7], [8, 8], [7, 8]]) p.hex(x, y, 0x2b1505);
  for (let x = 4; x < 12; x++) p.hex(x, 11, 0x2b1505);
  p.hex(3, 10, 0x2b1505); p.hex(12, 10, 0x2b1505); p.hex(6, 12, 0x2b1505); p.hex(9, 12, 0x2b1505);
});
reg('torch'); painter(T.torch, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  for (let y = 6; y < 16; y++) { p.hex(7, y, 0x6b4a2a); p.hex(8, y, 0x8a6238); }
  p.hex(7, 5, 0xffdf6b); p.hex(8, 5, 0xffdf6b); p.hex(7, 4, 0xffb52e); p.hex(8, 4, 0xffb52e); p.hex(7, 3, 0xe8641c); p.hex(8, 3, 0xff8c2e);
});
reg('tall_grass'); painter(T.tall_grass, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  for (let i = 0; i < 9; i++) {
    const x = 1 + (p.rng() * 14) | 0, h = 5 + (p.rng() * 9) | 0;
    const c = vary(0x68a93f, p.rng, .15);
    for (let y = 15; y > 15 - h; y--) p.hex(x + ((15 - y) > h - 3 && p.rng() > .6 ? 1 : 0), y, c);
  }
});
reg('dandelion'); painter(T.dandelion, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  for (let y = 8; y < 16; y++) p.hex(7, y, 0x3f7a2a);
  p.hex(6, 10, 0x3f7a2a); p.hex(8, 11, 0x3f7a2a);
  for (const [x, y] of [[6, 5], [7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [7, 4], [7, 7], [5, 5], [9, 6]]) p.hex(x, y, 0xf7d62a);
  p.hex(7, 5, 0xfff09a);
});
reg('poppy'); painter(T.poppy, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  for (let y = 8; y < 16; y++) p.hex(7, y, 0x3f7a2a);
  p.hex(6, 11, 0x3f7a2a); p.hex(8, 10, 0x3f7a2a);
  for (const [x, y] of [[6, 4], [7, 4], [8, 4], [6, 5], [7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [7, 3]]) p.hex(x, y, 0xc41818);
  p.hex(7, 5, 0x2b1505);
});
reg('dead_bush'); painter(T.dead_bush, p => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
  const br = (x, y, dx, dy, n, c) => { for (let i = 0; i < n; i++) p.hex(x + dx * i, y - dy * i, c); };
  br(7, 15, 0, 1, 6, 0x8a6238);
  br(7, 12, -1, 1, 4, 0x7a5430); br(7, 11, 1, 1, 5, 0x8a6238); br(7, 13, 1, 1, 3, 0x6b4a2a); br(7, 10, -1, 1, 3, 0x8a6238);
});
// crack overlay tiles (10 stages)
for (let s = 0; s < 10; s++) {
  const idx = reg('crack_' + s);
  painter(idx, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, 0, 0, 0, 0);
    const rng = p.rng;
    const cracks = 2 + s;
    for (let i = 0; i < cracks; i++) {
      let x = (rng() * 16) | 0, y = (rng() * 16) | 0;
      const len = 3 + s + (rng() * 4 | 0);
      for (let k = 0; k < len; k++) {
        p.px(x, y, 20, 16, 12, 200);
        x += (rng() * 3 | 0) - 1; y += (rng() * 3 | 0) - 1;
        x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
      }
    }
  });
}

// ------------------------------------------------------------ block registry
// face order for tex: [+x, -x, +y(top), -y(bottom), +z, -z]
function faces(top, bottom, side) { return [side, side, top, bottom, side, side]; }
function all(t) { return [t, t, t, t, t, t]; }

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, OAK_PLANKS: 5, OAK_LOG: 6, OAK_LEAVES: 7,
  SAND: 8, WATER: 9, BEDROCK: 10, COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14,
  REDSTONE_ORE: 15, GRAVEL: 16, SNOWY_GRASS: 17, SNOW: 18, ICE: 19, CACTUS: 20, SANDSTONE: 21,
  BIRCH_LOG: 22, BIRCH_LEAVES: 23, SPRUCE_LOG: 24, SPRUCE_LEAVES: 25, CRAFTING: 26, FURNACE: 27,
  FURNACE_LIT: 28, TORCH: 29, GLASS: 30, BRICKS: 31, STONE_BRICKS: 32, GLOWSTONE: 33,
  TALL_GRASS: 34, DANDELION: 35, POPPY: 36, DEAD_BUSH: 37, OBSIDIAN: 38, LAVA: 39,
  MOSSY_COBBLE: 40, WOOL: 41, PUMPKIN: 42, BIRCH_PLANKS: 43, SPRUCE_PLANKS: 44, BOOKSHELF: 45, CHEST: 46,
  DOOR: 47, DOOR_OPEN: 48
};

// def: name, tex(6), solid(collision), opaque(light blocking/face culling), cross, translucent,
//      hardness(sec base, -1 unbreakable), tool, minTier(-1 none/0 wood..), drop {id,count} (null = self), light
const D = [];
function def(id, name, tex, opt = {}) {
  D[id] = Object.assign({
    id, name, tex, solid: true, opaque: true, cross: false, translucent: false,
    hardness: 1, tool: null, minTier: -1, drop: undefined, light: 0, replaceable: false, sound: 'stone'
  }, opt);
}
def(B.AIR, 'Air', null, { solid: false, opaque: false, hardness: 0, replaceable: true });
def(B.GRASS, 'Grass Block', faces(T.grass_top, T.dirt, T.grass_side), { hardness: .6, tool: 'shovel', drop: { id: B.DIRT, count: 1 }, sound: 'grass' });
def(B.DIRT, 'Dirt', all(T.dirt), { hardness: .5, tool: 'shovel', sound: 'gravel' });
def(B.STONE, 'Stone', all(T.stone), { hardness: 1.5, tool: 'pickaxe', minTier: 0, drop: { id: B.COBBLE, count: 1 } });
def(B.COBBLE, 'Cobblestone', all(T.cobble), { hardness: 2, tool: 'pickaxe', minTier: 0 });
def(B.OAK_PLANKS, 'Oak Planks', all(T.oak_planks), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.OAK_LOG, 'Oak Log', faces(T.oak_log_top, T.oak_log_top, T.oak_log), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.OAK_LEAVES, 'Oak Leaves', all(T.oak_leaves), { opaque: false, hardness: .2, drop: 'leaves_oak', sound: 'grass' });
def(B.SAND, 'Sand', all(T.sand), { hardness: .5, tool: 'shovel', sound: 'sand' });
def(B.WATER, 'Water', all(T.water), { solid: false, opaque: false, translucent: true, hardness: -1, replaceable: true });
def(B.BEDROCK, 'Bedrock', all(T.bedrock), { hardness: -1 });
def(B.COAL_ORE, 'Coal Ore', all(T.coal_ore), { hardness: 3, tool: 'pickaxe', minTier: 0, drop: { item: 'coal', count: 1 } });
def(B.IRON_ORE, 'Iron Ore', all(T.iron_ore), { hardness: 3, tool: 'pickaxe', minTier: 1 });
def(B.GOLD_ORE, 'Gold Ore', all(T.gold_ore), { hardness: 3, tool: 'pickaxe', minTier: 2 });
def(B.DIAMOND_ORE, 'Diamond Ore', all(T.diamond_ore), { hardness: 3, tool: 'pickaxe', minTier: 2, drop: { item: 'diamond', count: 1 } });
def(B.REDSTONE_ORE, 'Redstone Ore', all(T.redstone_ore), { hardness: 3, tool: 'pickaxe', minTier: 2, drop: { item: 'redstone', count: 4 } });
def(B.GRAVEL, 'Gravel', all(T.gravel), { hardness: .6, tool: 'shovel', sound: 'gravel' });
def(B.SNOWY_GRASS, 'Snowy Grass', faces(T.snow, T.dirt, T.snow_side), { hardness: .6, tool: 'shovel', drop: { id: B.DIRT, count: 1 }, sound: 'snow' });
def(B.SNOW, 'Snow Block', all(T.snow), { hardness: .2, tool: 'shovel', sound: 'snow' });
def(B.ICE, 'Ice', all(T.ice), { translucent: true, opaque: false, hardness: .5, tool: 'pickaxe', drop: { id: 0, count: 0 } });
def(B.CACTUS, 'Cactus', faces(T.cactus_top, T.cactus_top, T.cactus_side), { opaque: false, hardness: .4, sound: 'wood' });
def(B.SANDSTONE, 'Sandstone', all(T.sandstone), { hardness: .8, tool: 'pickaxe', minTier: 0 });
def(B.BIRCH_LOG, 'Birch Log', faces(T.birch_log_top, T.birch_log_top, T.birch_log), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.BIRCH_LEAVES, 'Birch Leaves', all(T.birch_leaves), { opaque: false, hardness: .2, drop: 'leaves_birch', sound: 'grass' });
def(B.SPRUCE_LOG, 'Spruce Log', faces(T.spruce_log_top, T.spruce_log_top, T.spruce_log), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.SPRUCE_LEAVES, 'Spruce Leaves', all(T.spruce_leaves), { opaque: false, hardness: .2, drop: 'leaves_spruce', sound: 'grass' });
def(B.CRAFTING, 'Crafting Table', [T.crafting_side, T.crafting_side, T.crafting_top, T.oak_planks, T.crafting_side, T.crafting_side], { hardness: 2.5, tool: 'axe', sound: 'wood' });
def(B.FURNACE, 'Furnace', [T.furnace_side, T.furnace_side, T.furnace_top, T.furnace_top, T.furnace_front, T.furnace_side], { hardness: 3.5, tool: 'pickaxe', minTier: 0 });
def(B.FURNACE_LIT, 'Furnace', [T.furnace_side, T.furnace_side, T.furnace_top, T.furnace_top, T.furnace_front_lit, T.furnace_side], { hardness: 3.5, tool: 'pickaxe', minTier: 0, light: 13, drop: { id: B.FURNACE, count: 1 } });
def(B.TORCH, 'Torch', all(T.torch), { solid: false, opaque: false, cross: true, hardness: .05, light: 14, sound: 'wood' });
def(B.GLASS, 'Glass', all(T.glass), { opaque: false, translucent: false, hardness: .3, drop: { id: 0, count: 0 }, sound: 'glass' });
def(B.BRICKS, 'Bricks', all(T.bricks), { hardness: 2, tool: 'pickaxe', minTier: 0 });
def(B.STONE_BRICKS, 'Stone Bricks', all(T.stone_bricks), { hardness: 1.5, tool: 'pickaxe', minTier: 0 });
def(B.GLOWSTONE, 'Glowstone', all(T.glowstone), { hardness: .3, light: 15, sound: 'glass' });
def(B.TALL_GRASS, 'Grass', all(T.tall_grass), { solid: false, opaque: false, cross: true, hardness: .01, drop: { id: 0, count: 0 }, replaceable: true, sound: 'grass' });
def(B.DANDELION, 'Dandelion', all(T.dandelion), { solid: false, opaque: false, cross: true, hardness: .01, sound: 'grass' });
def(B.POPPY, 'Poppy', all(T.poppy), { solid: false, opaque: false, cross: true, hardness: .01, sound: 'grass' });
def(B.DEAD_BUSH, 'Dead Bush', all(T.dead_bush), { solid: false, opaque: false, cross: true, hardness: .01, drop: { id: 0, count: 0 }, sound: 'grass' });
def(B.OBSIDIAN, 'Obsidian', all(T.obsidian), { hardness: 35, tool: 'pickaxe', minTier: 4 });
def(B.LAVA, 'Lava', all(T.lava), { solid: false, opaque: false, hardness: -1, light: 15, replaceable: true });
def(B.MOSSY_COBBLE, 'Mossy Cobblestone', all(T.mossy_cobble), { hardness: 2, tool: 'pickaxe', minTier: 0 });
def(B.WOOL, 'Wool', all(T.wool), { hardness: .8, sound: 'cloth' });
def(B.PUMPKIN, 'Pumpkin', [T.pumpkin_side, T.pumpkin_side, T.pumpkin_top, T.pumpkin_top, T.pumpkin_face, T.pumpkin_side], { hardness: 1, tool: 'axe', sound: 'wood' });
def(B.BIRCH_PLANKS, 'Birch Planks', all(T.birch_planks), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.SPRUCE_PLANKS, 'Spruce Planks', all(T.spruce_planks), { hardness: 2, tool: 'axe', sound: 'wood' });
def(B.BOOKSHELF, 'Bookshelf', faces(T.oak_planks, T.oak_planks, T.bookshelf), { hardness: 1.5, tool: 'axe', drop: { id: B.OAK_PLANKS, count: 3 }, sound: 'wood' });
def(B.CHEST, 'Chest', [T.chest_side, T.chest_side, T.chest_top, T.chest_top, T.chest_front, T.chest_side], { hardness: 2.5, tool: 'axe', sound: 'wood' });
def(B.DOOR, 'Door', all(T.door), { opaque: false, hardness: 2, tool: 'axe', drop: { id: B.DOOR, count: 1 }, sound: 'wood' });
def(B.DOOR_OPEN, 'Door', all(T.door_open), { solid: false, opaque: false, cross: true, hardness: 2, tool: 'axe', drop: { id: B.DOOR, count: 1 }, sound: 'wood' });

export const BLOCKS = D;
export function blockDef(id) { return D[id] || D[0]; }
export function isSolid(id) { const b = D[id]; return b ? b.solid : false; }
export function isOpaque(id) { const b = D[id]; return b ? b.opaque : false; }

// uv rect for tile index (with half-pixel inset to stop bleeding)
export function tileUV(t) {
  const inset = 0.02 / ATLAS_COLS;
  const u0 = (t % ATLAS_COLS) / ATLAS_COLS + inset;
  const v0r = ((t / ATLAS_COLS) | 0) / ATLAS_ROWS + inset;
  const u1 = u0 + 1 / ATLAS_COLS - inset * 2;
  const v1r = v0r + 1 / ATLAS_ROWS - inset * 2;
  // flip v (canvas y-down → gl y-up)
  return { u0, v0: 1 - v1r, u1, v1: 1 - v0r };
}
