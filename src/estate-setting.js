// Mid- and long-distance grounds of the villa. All distances are metres.
// Each crown is made from branches carrying small textured leaf sprays in 3D.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const smooth = THREE.MathUtils.smoothstep;
const mix = THREE.MathUtils.lerp;

function randomStream(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function hash(x, z) {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise(x, z) {
  const i = Math.floor(x), k = Math.floor(z);
  const tx = smooth(x - i, 0, 1), tz = smooth(z - k, 0, 1);
  return mix(mix(hash(i, k), hash(i + 1, k), tx),
    mix(hash(i, k + 1), hash(i + 1, k + 1), tx), tz);
}

// Irregular, overlapping foothills; a low saddle opens the view to the south.
function elevation(x, z) {
  const r = Math.hypot(x, z);
  const edge = Math.max(Math.abs(x) - 28, Math.abs(z) - 24);
  const relief = smooth(edge, 1, 19);
  const slow = noise(x * .015 + 1.5, z * .017 - .36);
  const fast = noise(x * .048 - 3.8, z * .048);
  const direction = Math.atan2(x, z);
  const saddle = .68 - .22 * Math.cos(direction - .15) + .18 * Math.cos(2 * direction + 1.8);
  const hills = smooth(r, 38, 130) * (5 + slow * 16 + fast * 2.1);
  const crestDistance = 164 + 18 * Math.sin(direction * 3) + 12 * Math.sin(direction * 5 + 1.2);
  const ridge = Math.exp(-((r - crestDistance) ** 2) / 970) * (24 + slow * 40 + fast * 3) * saddle;
  const roll = relief * (slow * 1.4 + fast * .45);
  return -.08 + roll + hills * saddle + ridge;
}

function groundCover(x, z) {
  return noise(x * .043 + 17, z * .039 + 6) * .64 + noise(x * .12, z * .12 + 2) * .36;
}

function land() {
  const segments = 176;
  const rings = 76;
  const positions = [], colors = [], coords = [], faces = [];
  const meadow = new THREE.Color(0x929567), woods = new THREE.Color(0x44573e);
  const color = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * TAU;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const edge = Math.min(27.95 / Math.abs(dx), 23.95 / Math.abs(dz));
      const radius = edge + (295 - edge) * (j / rings) ** 1.3;
      const x = dx * radius, z = dz * radius;
      const shade = groundCover(x, z);
      const distance = smooth(radius, 45, 120);
      const coverage = smooth(shade + distance * .06, .2, .77);
      color.copy(meadow).lerp(woods, coverage);
      color.multiplyScalar(.80 + .23 * noise(x * .08, z * .08));
      positions.push(x, elevation(x, z), z);
      colors.push(color.r, color.g, color.b);
      coords.push(x / 2.4, z / 2.4);
      if (j < rings && i < segments) {
        const a = j * (segments + 1) + i, b = a + segments + 1;
        faces.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  // A tiny, seamless stippled ground texture gives the open meadow a readable
  // surface immediately beyond the enclosure, and naturally mips away in haze.
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = randomStream(617);
  for (let j = 0; j < data.length; j += 4) {
    const v = Math.round(181 + random() * 65);
    data[j] = v; data[j + 1] = v; data[j + 2] = v; data[j + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map, vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.name = 'Meadow and foothills';
  return mesh;
}

function paintSprays() {
  const random = randomStream(8304);
  // Four distinct atlas cells. Each one is an irregular fan of twigs carrying
  // many individual leaves rather than an outline painted around a solid blob.
  const canvas = document.createElement('canvas');
  const cell = 160;
  canvas.width = canvas.height = 2 * cell;
  const ctx = canvas.getContext('2d');
  for (let tile = 0; tile < 4; tile++) {
    ctx.save();
    ctx.translate((tile % 2) * cell, Math.floor(tile / 2) * cell);
    ctx.beginPath(); ctx.rect(1, 1, cell - 2, cell - 2); ctx.clip();
    const twigs = [];
    const root = { x: 80 + (random() - .5) * 15, y: 147 };
    for (let a = 0; a < 19; a++) {
      const angle = -.93 + a / 18 * 1.86 + (random() - .5) * .19;
      const len = (77 + random() * 50) * (1 - Math.abs(angle) * .18);
      const tx = root.x + Math.sin(angle) * len;
      const ty = root.y - Math.cos(angle) * len;
      const attach = .17 + random() * .37;
      const sx = root.x + (tx - root.x) * attach * .55;
      const sy = root.y + (ty - root.y) * attach;
      twigs.push({sx, sy, tx, ty, angle, shade: .82 + random() * .22});
    }
    for (const s of twigs) {
      ctx.strokeStyle = '#716e50';
      ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(root.x, root.y); ctx.lineTo(s.sx, s.sy); ctx.lineTo(s.tx, s.ty); ctx.stroke();
      for (let j = 0; j < 14; j++) {
        const t = .13 + .84 * (j + random()) / 14;
        const w = Math.sin(t * Math.PI) * 12 + 3.0;
        const sprig = (j % 2 ? 1 : -1) * (2 + random() * w);
        const px = mix(s.sx, s.tx, t);
        const py = mix(s.sy, s.ty, t);
        const lx = px + Math.cos(s.angle) * sprig;
        const ly = py + Math.sin(s.angle) * sprig - 4 - random() * 4;
        ctx.lineWidth = .65;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lx, ly); ctx.stroke();
        for (let k = 0; k < 5; k++) {
          const lt = (k + .5) / 5;
          const x = mix(px, lx, lt) + (random() - .5) * 6;
          const y = mix(py, ly, lt) + (random() - .5) * 6;
          const len = 2.15 + random() * 2.25;
          const tone = (139 + random() * 89) * s.shade * (.85 + .15 * t);
          ctx.fillStyle = 'rgb(' + Math.round(tone) + ',' + Math.round(tone * 1.025) + ',' + Math.round(tone * .89) + ')';
          ctx.beginPath();
          ctx.ellipse(x, y, len, len * (.33 + .15 * random()), -1.3 + random() * 2.6, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function woodland() {
  const rand = randomStream(37107);
  const stems = [], points = [], normals = [], uv = [], colours = [], index = [];
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const c = new THREE.Color();
  const palette = [0x6b8152, 0x617950, 0x677851, 0x788652, 0x69815f, 0x566e51, 0x606f40].map(x => new THREE.Color(x));
  const position = new THREE.Vector3(), scaling = new THREE.Vector3();

  function limb(a, b, r) {
    dir.subVectors(b, a);
    const len = dir.length();
    rotation.setFromUnitVectors(up, dir.normalize());
    position.copy(a).lerp(b, .5);
    scaling.set(r, len, r);
    stems.push(matrix.compose(position, rotation, scaling).clone());
  }

  // A spray bends away from its supporting twig. Its two-sided surface uses
  // a crown normal, allowing light to follow the volume through all rotations.
  function spray(cx, cy, cz, width, length, yaw, lean, base, tint) {
    const vx = Math.cos(yaw), vz = Math.sin(yaw), hx = -vz, hz = vx;
    const tile = Math.floor(rand() * 4);
    const u0 = (tile % 2) * .5, v0 = (1 - Math.floor(tile / 2)) * .5;
    const offset = points.length / 3;
    for (let i = 0; i < 4; i++) {
      const top = i > 1 ? 1 : 0;
      const side = (i % 2 ? .5 : -.5) * width;
      const t = top - .5;
      points.push(cx + side * hx + t * vx * length * lean,
        cy + t * length * Math.sqrt(1 - lean * lean),
        cz + side * hz + t * vz * length * lean);
      dir.set(vx * (.48 + .22 * top) + hx * side / width * .21,
        .85 + .35 * top, vz * (.48 + .22 * top) + hz * side / width * .21).normalize();
      normals.push(dir.x, dir.y, dir.z);
      uv.push(u0 + (i % 2 ? .497 : .003), v0 + (top ? .497 : .003));
      c.copy(base).multiplyScalar(tint * (.78 + top * .22));
      colours.push(c.r, c.g, c.b);
    }
    // Explicit back faces retain the same upper-hemisphere illumination.
    index.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3,
      offset + 2, offset + 1, offset, offset + 3, offset + 1, offset + 2);
  }

  function tree(x, z, h, distance) {
    const bottom = elevation(x, z) - .06;
    const center = new THREE.Vector3(x, bottom, z);
    const fork = new THREE.Vector3(x + (rand() - .5) * h * .10, bottom + .39 * h, z + (rand() - .5) * h * .10);
    const head = new THREE.Vector3(fork.x + (rand() - .5) * h * .17, bottom + h * .88, fork.z + (rand() - .5) * h * .17);
    limb(center, fork, .018 * h);
    limb(fork, head, .011 * h);
    const base = palette[Math.floor(rand() * palette.length)];
    const branches = distance < 95 ? 11 : 8;
    const sprays = distance < 95 ? 4 : 3;
    const phase = rand() * TAU, spread = .19 + rand() * .115;
    const tip = new THREE.Vector3(), start = new THREE.Vector3();
    const size = h * (.20 + .55 / branches);
    for (let j = 0; j < branches; j++) {
      const k = (j + .2) / branches;
      const a = phase + j * 2.39996 + (rand() - .5) * .63;
      const reach = h * spread * Math.pow(1 - k, .46) * (.82 + rand() * .36);
      start.copy(fork).lerp(head, k * .82);
      tip.set(start.x + Math.cos(a) * reach, bottom + h * (.58 + .39 * k + .09 * rand()), start.z + Math.sin(a) * reach);
      if (distance < 95) limb(start, tip, h * (.007 - k * .004));
      for (let t = 0; t < sprays; t++) {
        const bearing = a + t * 2.399 + (rand() - .5) * .8;
        const w = size * (1.04 + rand() * .53);
        const lean = .3 + .64 * rand();
        const out = (t ? .26 : .05) * w;
        spray(tip.x + Math.cos(bearing) * out, tip.y + (rand() - .45) * w * .35,
          tip.z + Math.sin(bearing) * out, w, w * (.74 + rand() * .29), bearing, lean, base,
          .77 + .23 * k + rand() * .24);
      }
    }
  }

  // Poisson-like jitter within cells and noise-based thinning leave genuine
  // clearings. The open south approach also keeps low camera views unobstructed.
  const cell = 6.25;
  for (let iz = -29; iz <= 29; iz++) {
    for (let ix = -29; ix <= 29; ix++) {
      const x = (ix + .12 + .76 * rand()) * cell, z = (iz + .12 + .76 * rand()) * cell;
      const r = Math.hypot(x, z);
      if (r > 173 || (Math.abs(x) < 34 && Math.abs(z) < 31)) continue;
      if (z > 13 && r < 53) continue;
      const density = smooth(groundCover(x, z), .31, .71) * .82;
      if (rand() > density) continue;
      const height = 4.5 + 4.6 * noise(.085 * x, .085 * z) + rand() * 3.3;
      tree(x, z, height, r);
    }
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.49, 1, 1, 5, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x645c48 }), stems.length);
  stems.forEach((m, i) => trunks.setMatrixAt(i, m));
  trunks.instanceMatrix.needsUpdate = true;
  trunks.name = 'Woodland branches';
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  const foliage = new THREE.Mesh(g, new THREE.MeshLambertMaterial({
    map: paintSprays(), alphaTest: .30, alphaToCoverage: true, vertexColors: true,
  }));
  foliage.name = 'Woodland foliage';
  return [trunks, foliage];
}

export function createEstateSetting() {
  const setting = new THREE.Group();
  setting.name = '菩园 · 院外山林';
  setting.add(land(), ...woodland());
  return setting;
}
