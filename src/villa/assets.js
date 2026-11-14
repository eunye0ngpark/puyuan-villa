import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

async function loadTemplates() {
  const loadModule = path => import(/* @vite-ignore */ path);
  const [{ createAsset: createSofa }, { createAsset: createHotel }, { createAsset: createTree }, { createAsset: createOlive }] = await Promise.all([
    loadModule('/assets/sofa/asset.mjs'),
    loadModule('/assets/hotel/asset.mjs'),
    loadModule('/assets/tree/asset.mjs'),
    loadModule('/assets/olive/asset.mjs'),
  ]);
  const [sofa, hotel, tree, olive, gateGltf] = await Promise.all([
    createSofa(THREE, { states: 'lazy', sharedResources: true }),
    createHotel(THREE, { states: 'lazy', sharedResources: true }),
    createTree(THREE, { states: 'lazy', sharedResources: true }),
    createOlive(THREE, { states: 'lazy', sharedResources: true }),
    new GLTFLoader().loadAsync('/models/moon_gate.glb'),
  ]);
  return { sofa, hotel, tree, olive, gate: gateGltf.scene };
}

function prepare(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) material.map.anisotropy = 8;
      if (material.transparent) {
        object.castShadow = false;
        material.depthWrite = false;
      }
      if ('roughness' in material && material.roughness < .12) material.roughness = .18;
    }
  });
}

function sliceGeometry(geometry, start, count) {
  const sliced = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const array = attribute.array.slice(start * attribute.itemSize, (start + count) * attribute.itemSize);
    sliced.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
  }
  return sliced;
}

function geometryPieces(mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (materials.length === 1 || !geometry.groups.length) return [{ geometry, material: materials[0] }];
  const pieces = [];
  for (const group of geometry.groups) {
    const material = materials[group.materialIndex];
    if (!material || group.count === 0) continue;
    pieces.push({ geometry: sliceGeometry(geometry, group.start, group.count), material });
  }
  geometry.dispose();
  return pieces;
}

function attributeSignature(geometry) {
  return Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`)
    .sort()
    .join(',');
}

// 将每类资产烘焙成少量“同材质、同属性”网格；实例放置仍由独立父组控制。
function optimizeAsset(root, include = () => true) {
  root.updateMatrixWorld(true);
  const optimized = new THREE.Group();
  optimized.name = `${root.name || 'asset'}_batched`;
  const buckets = new Map();
  root.traverse(object => {
    if (!object.isMesh || !include(object)) return;
    if (object.isInstancedMesh || object.isSkinnedMesh) {
      const copy = object.clone();
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(object.matrixWorld);
      optimized.add(copy);
      return;
    }
    for (const { geometry, material } of geometryPieces(object)) {
      if (!material) { geometry.dispose(); continue; }
      geometry.applyMatrix4(object.matrixWorld);
      const key = `${material.uuid}|${attributeSignature(geometry)}|${object.castShadow ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, { material, castShadow: object.castShadow, geometries: [] });
      buckets.get(key).geometries.push(geometry);
    }
  });
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach(geometry => geometry.dispose());
    if (!merged) throw new Error(`资产合批失败：${optimized.name}`);
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = true;
    if (bucket.material.transparent) mesh.renderOrder = 3;
    optimized.add(mesh);
  }
  return optimized;
}

export async function placeAssets(placements, groups) {
  const loaded = await loadTemplates();
  const templates = {};
  const bounds = {};
  const metrics = [];
  for (const [type, root] of Object.entries(loaded)) {
    prepare(root);
    templates[type] = optimizeAsset(root, type === 'hotel' ? object => object.name.startsWith('bed_') : () => true);
    templates[type].updateMatrixWorld(true);
    bounds[type] = new THREE.Box3().setFromObject(templates[type]);
  }
  for (const descriptor of placements) {
    const template = templates[descriptor.type];
    if (!template) throw new Error(`未知资产类型 ${descriptor.type}`);
    const root = template.clone(true);
    const placement = new THREE.Group();
    placement.name = `${descriptor.type}_${descriptor.room ?? 'site'}`;
    placement.userData.room = descriptor.room ?? null;
    placement.add(root);
    const box = bounds[descriptor.type];
    const size = box.getSize(new THREE.Vector3());
    const scale = descriptor.width ? descriptor.width / size.x : descriptor.height / size.y;
    placement.scale.setScalar(scale);
    placement.rotation.y = descriptor.yaw ?? 0;
    placement.position.set(descriptor.position[0], descriptor.position[1] - box.min.y * scale, descriptor.position[2]);
    groups[descriptor.group].add(placement);
    placement.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(placement);
    let meshes = 0;
    placement.traverse(object => { if (object.isMesh) meshes++; });
    metrics.push({ type: descriptor.type, room: descriptor.room ?? null, size: worldBox.getSize(new THREE.Vector3()).toArray(), position: placement.position.toArray(), scale, meshes });
  }
  return metrics;
}
