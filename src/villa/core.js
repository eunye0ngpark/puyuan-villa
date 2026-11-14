import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const F1 = 0.55;
export const F2 = 4.15;
export const WALL_H = 3.45;

export function seededRandom(seed = 20261112) {
  let value = seed;
  return () => {
    value |= 0; value = value + 0x6D2B79F5 | 0;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function worldUV(geometry, scale = 1) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, p.getX(i) / scale, p.getZ(i) / scale);
    else if (nx >= nz) uv.setXY(i, p.getZ(i) / scale, p.getY(i) / scale);
    else uv.setXY(i, p.getX(i) / scale, p.getY(i) / scale);
  }
  uv.needsUpdate = true;
  return geometry;
}

export class ModelBatch {
  constructor(groups, materials) {
    this.groups = groups;
    this.materials = materials;
    this.buckets = new Map();
    this.count = 0;
  }
  addGeometry(group, material, geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    if (geometry.index) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    geometry.applyMatrix4(matrix);
    const key = `${group}|${material}`;
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(geometry);
    this.count++;
  }
  box(group, material, position, size, options = {}) {
    const [w, h, d] = size;
    const bevel = Math.min(options.bevel ?? 0, w * .24, h * .24, d * .24);
    let geometry = bevel > 0
      ? new RoundedBoxGeometry(w, h, d, options.segments ?? 2, bevel)
      : new THREE.BoxGeometry(w, h, d);
    if (options.worldUV !== false) worldUV(geometry, options.uvScale ?? 1);
    this.addGeometry(group, material, geometry, position, [options.rx ?? 0, options.ry ?? 0, options.rz ?? 0]);
  }
  cylinder(group, material, position, radius, height, options = {}) {
    const geometry = new THREE.CylinderGeometry(options.radiusTop ?? radius, radius, height, options.segments ?? 20, 1, options.openEnded ?? false);
    this.addGeometry(group, material, geometry, position, [options.rx ?? 0, options.ry ?? 0, options.rz ?? 0]);
  }
  sphere(group, material, position, scale, options = {}) {
    const geometry = new THREE.SphereGeometry(1, options.segments ?? 18, options.rings ?? 12);
    this.addGeometry(group, material, geometry, position, [options.rx ?? 0, options.ry ?? 0, options.rz ?? 0], scale);
  }
  rod(group, material, start, end, radius = .025, segments = 12) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const delta = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), segments);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    const matrix = new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5), quaternion, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    const key = `${group}|${material}`;
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(geometry);
    this.count++;
  }
  torus(group, material, position, radius, tube, options = {}) {
    const geometry = new THREE.TorusGeometry(radius, tube, 10, 32, options.arc ?? Math.PI * 2);
    this.addGeometry(group, material, geometry, position, [options.rx ?? 0, options.ry ?? 0, options.rz ?? 0]);
  }
  flush() {
    for (const [key, geometries] of this.buckets) {
      const [groupName, materialName] = key.split('|');
      const normalized = geometries.map(g => g.index ? g.toNonIndexed() : g);
      const merged = mergeGeometries(normalized, false);
      normalized.forEach((g, i) => { if (g !== geometries[i]) g.dispose(); });
      if (!merged) throw new Error(`无法合批 ${key}`);
      const material = this.materials[materialName];
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${groupName}_${materialName}`;
      mesh.castShadow = !material.transparent && !materialName.includes('emissive');
      mesh.receiveShadow = true;
      if (material.transparent) mesh.renderOrder = 3;
      this.groups[groupName].add(mesh);
      geometries.forEach(g => g.dispose());
    }
    this.buckets.clear();
  }
}

async function loadTexture(loader, name, color = false) {
  const texture = await loader.loadAsync(`/textures/${name}.jpg`);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export async function createMaterials() {
  const loader = new THREE.TextureLoader();
  const sets = {};
  await Promise.all(['wood_floor', 'marble_01', 'plastered_wall_04', 'fabric_pattern_07', 'aerial_grass_rock', 'concrete_floor_02'].map(async name => {
    const [map, normalMap, roughnessMap] = await Promise.all([
      loadTexture(loader, `${name}_diff_1k`, true),
      loadTexture(loader, `${name}_nor_gl_1k`),
      loadTexture(loader, `${name}_rough_1k`),
    ]);
    sets[name] = { map, normalMap, roughnessMap };
  }));
  const standard = (color, roughness = .5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const pbr = (set, extra = {}) => new THREE.MeshStandardMaterial({ ...sets[set], roughness: 1, ...extra });
  const textile = (color) => {
    const material = pbr('fabric_pattern_07', { color, normalScale: new THREE.Vector2(.32, .32) });
    material.map = null;
    return material;
  };
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1024;
  screenCanvas.height = 576;
  const context = screenCanvas.getContext('2d');
  const sky = context.createLinearGradient(0, 0, 0, 576);
  sky.addColorStop(0, '#71847f');
  sky.addColorStop(.52, '#a8aaa0');
  sky.addColorStop(1, '#263d3b');
  context.fillStyle = sky;
  context.fillRect(0, 0, 1024, 576);
  const mountainRandom = seededRandom(417);
  for (let layer = 0; layer < 5; layer++) {
    const baseline = 265 + layer * 58;
    context.beginPath();
    context.moveTo(0, 576);
    context.lineTo(0, baseline);
    for (let x = 0; x <= 1024; x += 48) {
      const y = baseline - mountainRandom() * (115 - layer * 13) - Math.sin(x * .008 + layer) * 32;
      context.lineTo(x, y);
    }
    context.lineTo(1024, 576);
    context.closePath();
    context.fillStyle = ['#7d8d86', '#687d76', '#506b64', '#38564f', '#203e39'][layer];
    context.globalAlpha = .72 + layer * .055;
    context.fill();
  }
  context.globalAlpha = 1;
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;
  return {
    oak: pbr('wood_floor', { color: 0xc8b9a7, normalScale: new THREE.Vector2(.38, .38) }),
    walnut: standard(0x49352a, .34),
    darkWood: standard(0x211c19, .4),
    paleWood: standard(0x9d8061, .42),
    marble: pbr('marble_01', { color: 0xd8d2c5, normalScale: new THREE.Vector2(.22, .22) }),
    limestone: pbr('marble_01', { color: 0xb9ae99, roughness: .82, normalScale: new THREE.Vector2(.35, .35) }),
    plaster: pbr('plastered_wall_04', { color: 0xe0dacf, normalScale: new THREE.Vector2(.32, .32) }),
    fabric: textile(0xb8b0a1),
    fabricDark: textile(0x59635c),
    fabricRust: textile(0x875f4c),
    grass: pbr('aerial_grass_rock', { color: 0x70805a, normalScale: new THREE.Vector2(.65, .65) }),
    paving: pbr('concrete_floor_02', { color: 0xaaa99f, normalScale: new THREE.Vector2(.5, .5) }),
    bronze: standard(0x8c6a3f, .28, .78),
    blackMetal: standard(0x202423, .3, .7),
    steel: standard(0x9ba3a3, .24, .85),
    white: standard(0xe6e3dc, .32),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xe9e5dc, roughness: .18, clearcoat: .35 }),
    jade: new THREE.MeshPhysicalMaterial({ color: 0x536e63, roughness: .23, clearcoat: .45 }),
    clay: standard(0x8b6351, .72),
    paper: standard(0xded4bc, .9),
    bookRed: standard(0x703c34, .65),
    bookGreen: standard(0x3d5248, .65),
    bookBlue: standard(0x384b58, .65),
    black: standard(0x141818, .38),
    rubber: standard(0x262827, .86),
    leaf: standard(0x355a36, .72, 0, { side: THREE.DoubleSide }),
    leafLight: standard(0x64734a, .68, 0, { side: THREE.DoubleSide }),
    soil: standard(0x29251d, 1),
    water: new THREE.MeshPhysicalMaterial({ color: 0x749c9d, roughness: .12, metalness: .05, transparent: true, opacity: .72, transmission: .18, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfd5d3, roughness: .08, metalness: 0, transparent: true, opacity: .24, transmission: .5, thickness: .02, depthWrite: false, side: THREE.DoubleSide }),
    mirror: new THREE.MeshPhysicalMaterial({ color: 0xbcc7c4, roughness: .06, metalness: .92 }),
    screen: standard(0x182a2b, .22, .15, { emissive: 0x183d42, emissiveIntensity: .55 }),
    display: new THREE.MeshBasicMaterial({ map: screenTexture, color: 0xc5cec8 }),
    emissiveWarm: standard(0xffd6a0, .3, 0, { emissive: 0xffb65e, emissiveIntensity: 2.2 }),
    emissiveCool: standard(0x8ccbd0, .3, 0, { emissive: 0x318c9b, emissiveIntensity: 1.8 }),
    redLight: standard(0xe89578, .3, 0, { emissive: 0xb84b32, emissiveIntensity: 1.5 }),
  };
}

export class DetailLedger {
  constructor() { this.rooms = {}; }
  add(room, label, position = null) {
    if (!this.rooms[room]) this.rooms[room] = [];
    if (this.rooms[room].length >= 50) throw new Error(`${room} 超过 50 项：${label}`);
    this.rooms[room].push({ index: this.rooms[room].length + 1, label, position });
  }
  validate(roomIds) {
    const invalid = roomIds.map(id => ({ id, count: this.rooms[id]?.length ?? 0 })).filter(item => item.count !== 50);
    if (invalid.length) throw new Error(`房间细节数量校验失败：${invalid.map(item => `${item.id}=${item.count}`).join('，')}；每间要求恰好 50 项`);
    return this.rooms;
  }
}
