import * as THREE from 'three';

// The last twig of each branch carries a painted spray. Its leaves, veins and
// stems have transparent gaps, so a crown keeps its silhouette at close range.
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COLS = 4;
const CELL = 256;
const tiles = { maple: 0, canopy: 4, pine: 8, shrub: 10, fern: 12, plume: 14 };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const between = (r, a, b) => a + (b - a) * r();
const horizontal = (angle, length, rise) => v(Math.cos(angle) * length, rise, Math.sin(angle) * length);
const shade = (color, amount) => new THREE.Color(color).multiplyScalar(amount);

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let a = Math.imul(state ^ (state >>> 15), state | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

function stroke(ctx, x1, y1, x2, y2, width, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

const leafPaint = {
  maple: [['#734934', '#aa6b48'], ['#846343', '#ae8959'], ['#66503a', '#967650'], ['#7b4036', '#a16547']],
  canopy: [['#435738', '#738054'], ['#405439', '#6a8156'], ['#566841', '#8a955b'], ['#516545', '#7b9268']],
  shrub: [['#3d563c', '#778659'], ['#506742', '#8d9b68'], ['#495f39', '#799253']],
};

// Leaves use their petiole as the origin, with the tip locally facing upward.
function paintLeaf(ctx, kind, x, y, angle, length, r) {
  const palette = leafPaint[kind];
  const [shadow, light] = palette[Math.floor(r() * palette.length)];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const width = length * between(r, .29, .47);
  const color = ctx.createLinearGradient(-width, 0, width * .75, -length * .2);
  color.addColorStop(0, shadow);
  color.addColorStop(.5, shadow);
  color.addColorStop(.53, light);
  color.addColorStop(1, shadow);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (kind === 'maple') {
    for (const [px, py] of [[-.48,-.1],[-.87,-.38],[-.4,-.29],[-.74,-.78],[-.24,-.54],[-.07,-1.05],[.15,-.58],[.63,-.88],[.39,-.36],[.89,-.48],[.58,-.17],[.31,-.12]]) {
      ctx.lineTo(px * length * .9, py * length);
    }
  } else {
    ctx.bezierCurveTo(-width * .5, -length * .05, -width, -length * .42, -width * .3, -length * .73);
    ctx.lineTo(0, -length);
    ctx.bezierCurveTo(width * .15, -length * .76, width * 1.25, -length * .37, 0, 0);
  }
  ctx.closePath();
  ctx.fill();
  stroke(ctx, 0, 0, -.02 * length, -.91 * length, .32, light);
  ctx.restore();
}

function broadSpray(ctx, kind, r) {
  const tiers = kind === 'maple' ? 5 : 6;
  const turn = between(r, -.7, .7);
  const woody = kind === 'maple' ? '#66543a' : '#56623c';
  const centers = Array.from({length: tiers + 1}, (_, i) => {
    const t = i / tiers;
    return [64 + Math.sin(t * 2.4 + turn) * t * 9, 125 - 108 * t];
  });
  for (let j = 1; j <= tiers; j++) {
    const a = centers[j - 1], b = centers[j];
    stroke(ctx, ...a, ...b, 1.65 - j / tiers, woody);
    for (const sign of [-1, 1]) {
      const ax = a[0] + (b[0] - a[0]) * .5;
      const ay = a[1] - between(r, 2, 10);
      const reach = (20 + 18 * Math.sin(Math.PI * (j - .45) / tiers)) * between(r, .83, 1.1);
      const end = [ax + sign * reach, ay - between(r, 6, 20)];
      stroke(ctx, ax, ay, ...end, 1.0, woody);
      for (const [step, direction] of [[.36, -.2], [.59, 1.35], [.9, .68]]) {
        const x = ax + (end[0] - ax) * step;
        const y = ay + (end[1] - ay) * step;
        const tilt = sign * (direction + between(r, -.35, .35));
        paintLeaf(ctx, kind, x, y, tilt, between(r, 8, kind === 'maple' ? 13.2 : 16), r);
      }
    }
  }
  const end = centers[tiers];
  paintLeaf(ctx, kind, ...end, between(r, -.45, .45), 12, r);
}

function pineSpray(ctx, r) {
  const tones = ['#38523d', '#465c47', '#586d50', '#6f7e58', '#829266'];
  for (const [dx, length] of [[-42,59], [38,64], [-27,92], [25,89], [4,107]]) {
    const startY = length > 95 ? 124 : between(r, 94, 122);
    const endX = 64 + dx;
    stroke(ctx, 64, startY, endX, startY - length, 1.9, '#695940');
    for (let i = 0; i < 73; i++) {
      const t = between(r, .24, .99);
      const x = 64 + dx * t, y = startY - length * t;
      const span = Math.sin(t * Math.PI * .93) * 16 + 4;
      const tipX = x + between(r, -span, span) + dx * .09;
      stroke(ctx, x, y, tipX, y - between(r, 6, 15), between(r, .45, 1.12), tones[Math.floor(r() * tones.length)]);
    }
  }
}

function fernSpray(ctx, r) {
  const sx = between(r, -7, 7);
  for (let i = 1; i < 21; i++) {
    const t = i / 21;
    const x = 64 + sx * t, y = 124 - t * 119;
    const reach = Math.pow(Math.sin(Math.PI * Math.pow(t, .7)), .76) * 53;
    for (const sign of [-1, 1]) {
      const dx = sign * reach * between(r, .88, 1.04);
      const lift = reach * .36;
      stroke(ctx, x, y, x + dx, y - lift, .75, '#718258');
      for (let j = 1; j < 14; j++) {
        const u = j / 14, width = (1 - u) * 6 + .7;
        const cx = x + dx * u, cy = y - lift * u;
        ctx.fillStyle = (i + j) % 3 ? '#516d44' : '#698552';
        ctx.beginPath();
        ctx.moveTo(cx - dx * .1, cy + lift * .1);
        ctx.lineTo(cx + sign * 4.2, cy - width);
        ctx.lineTo(cx + sign * 2.7, cy);
        ctx.lineTo(cx + sign * 4, cy + width * .5);
        ctx.fill();
      }
    }
  }
  stroke(ctx, 64, 124, 64 + sx, 4, 1.2, '#849463');
}

function plume(ctx, r) {
  stroke(ctx, 60, 126, 68, 8, 1.1, '#b39870');
  const tones = ['#b79b76', '#ceba94', '#c5ae88', '#ddccaa'];
  for (let i = 0; i < 330; i++) {
    const t = r(), x = 60 + t * 8, y = 121 - t * 108;
    const w = Math.sin(Math.PI * t) * 41 + 2;
    stroke(ctx, x, y, x + between(r, -w, w), y - between(r, 7, 19), between(r, .65, 1.7), tones[i % 4]);
  }
}

function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = COLS * CELL;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const r = seeded(2137 + i * 173);
    ctx.save();
    ctx.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL);
    ctx.scale(CELL / 128, CELL / 128);
    ctx.beginPath(); ctx.rect(1, 1, 126, 126); ctx.clip();
    ctx.lineCap = 'round';
    if (i < 8) broadSpray(ctx, i < 4 ? 'maple' : 'canopy', r);
    else if (i < 10) pineSpray(ctx, r);
    else if (i < 12) broadSpray(ctx, 'shrub', r);
    else if (i < 14) fernSpray(ctx, r);
    else plume(ctx, r);
    ctx.restore();
  }
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.name = 'Garden twig and frond studies';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}

class Batch {
  constructor() {
    this.positions = []; this.colors = []; this.uvs = []; this.indices = [];
  }
  vertex(p, color, u = 0, vv = 0) {
    const index = this.positions.length / 3;
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(color.r, color.g, color.b);
    this.uvs.push(u, vv);
    return index;
  }
  mesh(material, name) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
}

// The section stays perpendicular to the bent limb. Ridges at the base flare
// out into the soil and blend into the rounder upper trunk.
function limb(batch, points, radii, color, sides = 5, fluted = false) {
  const axis = points.at(-1).clone().sub(points[0]).normalize();
  const ref = Math.abs(axis.y) > .86 ? v(1, 0, 0) : UP;
  const start = batch.positions.length / 3;
  for (let j = 0; j < points.length; j++) {
    const tangent = points[Math.min(j + 1, points.length - 1)].clone().sub(points[Math.max(j - 1, 0)]).normalize();
    const u = ref.clone().cross(tangent).normalize();
    const w = tangent.clone().cross(u);
    for (let k = 0; k < sides; k++) {
      const angle = k / sides * TAU;
      const ridge = Math.cos(angle * 3 + j * .25) * .5 + .5;
      const radius = radii[j] * (1 + (fluted ? .23 / (j + 1) : .05) * ridge);
      const p = points[j].clone().addScaledVector(u, Math.cos(angle) * radius).addScaledVector(w, Math.sin(angle) * radius);
      batch.vertex(p, color.clone().multiplyScalar(.83 + .23 * ridge));
      if (j) {
        const a = start + (j - 1) * sides + k;
        const b = start + (j - 1) * sides + (k + 1) % sides;
        batch.indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
}

function pointAlong(points, t) {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (points.length - 1);
  const k = Math.min(Math.floor(f), points.length - 2);
  return points[k].clone().lerp(points[k + 1], f - k);
}

// A strip follows a curved midrib. Rolling the strip makes neighbouring leaf
// sprays present distinct angles to the sky without turning toward the camera.
function spray(batch, tile, origin, angle, length, spread, rise, droop, roll, tint) {
  const a = horizontal(angle, 1, 0);
  const w = horizontal(angle + Math.PI / 2, Math.cos(roll), Math.sin(roll));
  const first = batch.positions.length / 3;
  const u0 = (tile % COLS) / COLS;
  const v0 = 1 - (Math.floor(tile / COLS) + 1) / COLS;
  for (let j = 0; j < 4; j++) {
    const t = j / 3;
    const center = origin.clone().addScaledVector(a, length * t);
    center.y += rise * t - droop * t * t;
    for (const edge of [-1, 1]) {
      const p = center.clone().addScaledVector(w, spread * edge * .5);
      batch.vertex(p, tint, u0 + ((edge + 1) / 2 * .99 + .005) / COLS, v0 + (t * .99 + .005) / COLS);
    }
    if (j) {
      const k = first + (j - 1) * 2;
      batch.indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
}

function leafyTwigs(batch, kind, origin, angle, size, shadeLevel, r) {
  const count = kind === 'pine' ? 6 : 5;
  for (let j = 0; j < count; j++) {
    const dir = angle + (j - (count - 1) / 2) * .72 + between(r, -.5, .5);
    const s = size * between(r, .7, 1.2);
    const tint = shade(0xffffff, shadeLevel * between(r, .8, 1.2));
    const tile = tiles[kind] + Math.floor(r() * (kind === 'maple' || kind === 'canopy' ? 4 : 2));
    const pine = kind === 'pine';
    spray(batch, tile, origin, dir, s * between(r, .73, 1), s * (pine ? .76 : .85),
      s * between(r, pine ? .48 : .12, pine ? 1.23 : .88), s * (pine ? .12 : between(r, .22, .65)), between(r, -.92, .92), tint);
  }
}

function broadTree(b, kind, base, h, r) {
  const maple = kind === 'maple', trunks = maple ? 3 : 2;
  const bark = new THREE.Color(maple ? '#776b59' : '#675e4d');
  const phase = r() * TAU;
  const crownScale = between(r, .85, 1.18);
  for (let k = 0; k < trunks; k++) {
    const az = phase + k * TAU / trunks + between(r, -.3, .3);
    const stemHeight = h * (k ? between(r, .62, .85) : .91);
    const lean = h * between(r, maple ? .105 : .035, maple ? .25 : .16);
    const start = base.clone().add(horizontal(az, k ? h * .012 : 0, -.018));
    const stem = [0, .12, .35, .57, .79, 1].map(t => start.clone()
      .add(horizontal(az + .45 * Math.sin(t * 4), lean * Math.pow(t, 1.3), stemHeight * t)));
    const girth = h * (k ? .012 : maple ? .019 : .028);
    limb(b.wood, stem, [1.45, .89, .68, .49, .28, .055].map(n => n * girth), bark, 10, true);
    // Buttress roots fade below grade, avoiding a cut-off trunk at eye level.
    for (let i = 0; i < (k ? 2 : 5); i++) {
      const dir = az + i * GOLDEN_ANGLE;
      const root = [start.clone().add(v(0, h * .043, 0)), start.clone().add(horizontal(dir, girth * 1.3, girth * .56)), start.clone().add(horizontal(dir, girth * between(r, 2.8, 4.7), -.015))];
      limb(b.wood, root, [girth * .63, girth * .37, .003], bark, 6);
    }
    const limbs = maple ? 7 : 10;
    for (let i = 0; i < limbs; i++) {
      const t = (.29 + .67 * (i + r() * .5) / limbs);
      const dir = az + i * GOLDEN_ANGLE + between(r, -.5, .5);
      const attachment = pointAlong(stem, t);
      const reach = h * (maple ? .29 : .31) * crownScale * (.55 + .5 * Math.sin(Math.PI * t)) * between(r, .74, 1.19);
      const rise = h * (1 - t) * between(r, .19, .42);
      const bend = between(r, -.48, .48);
      const arm = [attachment, attachment.clone().add(horizontal(dir + bend, reach * .32, rise * .3)),
        attachment.clone().add(horizontal(dir, reach * .64, rise * .67)), attachment.clone().add(horizontal(dir - bend * .3, reach, rise))];
      limb(b.wood, arm, [.013, .0092, .0052, .0017].map(n => n * h * (1.12 - t * .62)), bark, 7);
      for (let j = 0; j < 5; j++) {
        const u = .22 + j * .175;
        const side = j % 2 ? -1 : 1;
        const a2 = dir + side * between(r, .49, 1.12);
        const p = pointAlong(arm, u);
        const extension = reach * between(r, .32, .61);
        const dy = h * between(r, .02, .115) * (1 - .38 * t);
        const sec = [p, p.clone().add(horizontal(a2 + side * .19, extension * .48, dy * .41)), p.clone().add(horizontal(a2, extension, dy))];
        limb(b.wood, sec, [h * .0047, h * .0027, h * .0008], bark, 5);
        for (let m = 0; m < 4; m++) {
          const pos = pointAlong(sec, between(r, .15 + .2 * m, .35 + .2 * m));
          const a3 = a2 + (m % 2 ? -1 : 1) * between(r, .47, 1.25);
          const tip = pos.clone().add(horizontal(a3, h * between(r, .034, .088), h * between(r, .006, .067)));
          limb(b.wood, [pos, tip], [h * .0018, h * .00052], bark, 4);
          const light = .78 + .31 * Math.max(0, (tip.y - base.y) / h);
          leafyTwigs(b.leaves, kind, tip, a3, h * between(r, .085, .13), light, r);
        }
      }
    }
    leafyTwigs(b.leaves, kind, stem.at(-1), az, h * .1, 1.05, r);
  }
}

function pineTree(b, base, h, r) {
  const bark = new THREE.Color('#6b5846');
  const az = r() * TAU;
  const trunk = [0, .15, .31, .48, .66, .81, .94].map(t => base.clone()
    .add(horizontal(az + Math.sin(t * 12) * .72, h * (.16 * t + .03 * Math.sin(t * 10)), h * t)));
  limb(b.wood, trunk, [.049, .033, .026, .022, .016, .009, .002].map(n => n * h), bark, 12, true);
  for (let i = 0; i < 12; i++) {
    const t = .23 + i * .063 + r() * .032;
    const pos = pointAlong(trunk, t), dir = az + i * GOLDEN_ANGLE + between(r, -.38, .38);
    const reach = h * (.16 + .29 * (1 - t)) * between(r, .84, 1.27);
    const arm = [pos, pos.clone().add(horizontal(dir + .17, reach * .3, h * .045)), pos.clone().add(horizontal(dir - .12, reach * .67, h * .011)), pos.clone().add(horizontal(dir, reach, h * .067))];
    limb(b.wood, arm, [.018, .013, .009, .002].map(n => n * h * (1.2 - t * .48)), bark, 8);
    for (let j = 0; j < 7; j++) {
      const a2 = dir + (j % 2 ? -1 : 1) * between(r, .57, 1.27);
      const p = pointAlong(arm, .25 + j * .115);
      const tip = p.clone().add(horizontal(a2, reach * between(r, .26, .47), h * between(r, .035, .077)));
      limb(b.wood, [p, p.clone().lerp(tip, .55).add(v(0, -h * .014, 0)), tip], [h * .005, h * .0032, h * .001], bark, 5);
      for (let k = 0; k < 4; k++) {
        const a3 = a2 + (k - 1.5) * 1.1 + r() * .25;
        const end = tip.clone().add(horizontal(a3, h * between(r, .018, .073), h * between(r, 0, .039)));
        limb(b.wood, [tip, end], [h * .002, h * .0007], bark, 4);
        leafyTwigs(b.leaves, 'pine', end, a3, h * between(r, .052, .09), .9 + t * .14, r);
      }
    }
  }
  leafyTwigs(b.leaves, 'pine', trunk.at(-1), az, h * .1, 1.04, r);
}

function shrub(b, p, h, r) {
  const bark = new THREE.Color('#776d4f');
  const phase = r() * TAU;
  for (let k = 0; k < 10; k++) {
    const angle = phase + k * GOLDEN_ANGLE + r() * .6;
    const radius = h * between(r, .2, .65), rise = h * between(r, .43, .84);
    const stem = [p, p.clone().add(horizontal(angle, radius * .36, rise * .47)), p.clone().add(horizontal(angle, radius, rise))];
    limb(b.wood, stem, [h * .012, h * .007, h * .002], bark, 5);
    for (let j = 0; j < 4; j++) {
      const origin = pointAlong(stem, .34 + j * .2);
      const dir = angle + (j % 2 ? -1 : 1) * between(r, .3, 1.4);
      leafyTwigs(b.leaves, 'shrub', origin, dir, h * between(r, .22, .4), .86 + j * .04, r);
    }
  }
}

function fern(b, p, h, r) {
  const phase = r() * TAU;
  for (let j = 0; j < 16; j++) {
    const u = j / 15, angle = phase + j * GOLDEN_ANGLE + r() * .4;
    spray(b.leaves, tiles.fern + (j % 2), p, angle, h * between(r, .65, 1.35) * (1 - .55 * u),
      h * between(r, .32, .47), h * (1.8 + u * .45), h * (1.62 - .38 * u), between(r, -.43, .43), shade(0xffffff, between(r, .85, 1.18)));
  }
}

function grass(b, p, h, r) {
  const tones = ['#606a48', '#748054', '#8a8c60', '#a49a70', '#6f8056', '#777e54'];
  const phase = r() * TAU;
  for (let j = 0; j < 44; j++) {
    const angle = phase + j * GOLDEN_ANGLE + r() * .4;
    const spread = h * between(r, .18, .72), height = h * between(r, .37, .88);
    const start = p.clone().add(horizontal(angle, h * between(r, 0, .09), 0));
    const half = h * between(r, .009, .019);
    const first = b.blades.positions.length / 3;
    const tint = new THREE.Color(tones[j % tones.length]);
    const side = horizontal(angle + Math.PI / 2, half, 0);
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const center = start.clone().add(horizontal(angle + .14 * t, spread * t * t, height * (1.91 * t - 1.09 * t * t)));
      const color = tint.clone().multiplyScalar(.65 + .44 * t);
      const width = Math.pow(1 - t, .64);
      b.blades.vertex(center.clone().addScaledVector(side, -width), color);
      b.blades.vertex(center.clone().addScaledVector(side, width), color);
      if (k) {
        const n = first + (k - 1) * 2;
        b.blades.indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
  }
  for (let j = 0; j < 5; j++) {
    const dir = phase + j * GOLDEN_ANGLE;
    const end = p.clone().add(horizontal(dir, h * between(r, .15, .45), h * between(r, .67, .88)));
    limb(b.wood, [p, p.clone().lerp(end, .55).add(v(0, h * .07, 0)), end], [h * .005, h * .0035, h * .002], new THREE.Color('#998a60'), 3);
    spray(b.leaves, tiles.plume + j % 2, end, dir, h * between(r, .09, .17), h * .073, h * between(r, .17, .31), h * .061, r() - .5, shade(0xffffff, between(r, .9, 1.17)));
  }
}

export function createPlanting() {
  // Neighbouring plants share three draw calls. Separate spatial batches let
  // the renderer skip entire out-of-view beds in interior and ground-level views.
  const beds = new Map();
  function bedAt(x, z) {
    const k = `${Math.floor(x / 21)},${Math.floor(z / 21)}`;
    if (!beds.has(k)) beds.set(k, { wood: new Batch(), leaves: new Batch(), blades: new Batch() });
    return beds.get(k);
  }
  function plantSeed(x, z, seed) {
    return seeded(seed ?? Math.imul(Math.round(x * 137), 9349) ^ Math.round(z * 1777));
  }
  return {
    tree(kind, x, y, z, height, seed) {
      const b = bedAt(x, z), p = v(x, y, z), r = plantSeed(x, z, seed);
      if (kind === 'pine') pineTree(b, p, height, r);
      else broadTree(b, kind === 'maple' ? 'maple' : 'canopy', p, height, r);
    },
    underplant(kind, x, y, z, height, seed) {
      const b = bedAt(x, z), p = v(x, y, z), r = plantSeed(x, z, seed);
      const build = { shrub, grass, fern }[kind];
      if (build) build(b, p, height, r);
    },
    finish() {
      const group = new THREE.Group();
      group.name = 'Garden planting';
      const materials = {
        wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97 }),
        blades: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: THREE.DoubleSide }),
        leaves: new THREE.MeshStandardMaterial({ vertexColors: true, map: createAtlas(), alphaTest: .26, side: THREE.DoubleSide, roughness: .82 }),
      };
      for (const [k, b] of beds) {
        for (const type of Object.keys(materials)) {
          if (b[type].indices.length) group.add(b[type].mesh(materials[type], `${type} ${k}`));
        }
      }
      beds.clear();
      return group;
    },
  };
}
