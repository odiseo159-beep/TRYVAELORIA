import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { IWorld } from '../world_api';
import type { FarmPlot } from '../sim/types';
import { terrainHeight } from '../sim/world';
import { loadGltf } from './assets/loader';

const BASE = '/models/farm/fenze/';
const ASSETS = {
  fence: 'Fence',
  fence2: 'Fence2',
} as const;

type FarmAssetKey = keyof typeof ASSETS;

const templateCache = new Map<FarmAssetKey, THREE.Object3D>();
const loading = new Set<FarmAssetKey>();
const GARDEN_URL = '/models/props/custom/village_town_assets.glb';
let gardenTemplate: THREE.Object3D | null = null;
let gardenLoading = false;

function prep(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function loadFarmAsset(key: FarmAssetKey, onReady: () => void): void {
  if (templateCache.has(key) || loading.has(key)) return;
  loading.add(key);
  const name = ASSETS[key];
  const mtl = new MTLLoader();
  mtl.setPath(BASE);
  mtl.load(`${name}.mtl`, (materials) => {
    materials.preload();
    const obj = new OBJLoader();
    obj.setMaterials(materials);
    obj.setPath(BASE);
    obj.load(`${name}.obj`, (root) => {
      prep(root);
      templateCache.set(key, root);
      loading.delete(key);
      onReady();
    }, undefined, () => loading.delete(key));
  }, undefined, () => loading.delete(key));
}

function objectSourceNames(o: THREE.Object3D): string[] {
  const names: string[] = [o.name];
  const mesh = o as THREE.Mesh;
  const mat = mesh.isMesh ? mesh.material as THREE.Material | THREE.Material[] : undefined;
  if (Array.isArray(mat)) names.push(...mat.map((m) => m.name));
  else if (mat) names.push(mat.name);
  for (let p = o.parent; p; p = p.parent) names.push(p.name);
  return names;
}

function loadGardenPatch(onReady: () => void): void {
  if (gardenTemplate || gardenLoading) return;
  gardenLoading = true;
  loadGltf(GARDEN_URL).then((gltf) => {
    const root = new THREE.Group();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const names = objectSourceNames(o).join(' ');
      // Use only the vegetable rows from Nacho's village pack: cabbages read as
      // lettuce in-game, plus carrots. No house, no floor, no extra props.
      if (!/Farm_(?:Cabbage|Carrot)(?:\.|\b)/.test(names)) return;
      const clone = mesh.clone(false);
      clone.geometry = mesh.geometry.clone();
      clone.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      clone.applyMatrix4(mesh.matrixWorld);
      root.add(clone);
    });
    const box = new THREE.Box3().setFromObject(root);
    if (!root.children.length || box.isEmpty()) throw new Error('farm garden patch has no meshes');
    const center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);
    prep(root);
    gardenTemplate = root;
  }).catch((err) => console.warn('[farmstead] garden patch failed to load', err))
    .finally(() => { gardenLoading = false; onReady(); });
}

function addAsset(parent: THREE.Group, key: FarmAssetKey, x: number, z: number, rot: number, scale: number): void {
  const t = templateCache.get(key);
  if (!t) return;
  const o = t.clone(true);
  o.position.set(x, 0, z);
  o.rotation.y = rot;
  o.scale.setScalar(scale);
  parent.add(o);
}

function addBerryBush(parent: THREE.Group, x: number, z: number, seed: number): void {
  const bush = new THREE.Group();
  bush.position.set(x, 0, z);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a31, roughness: 0.9 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x1e5b24, roughness: 0.95 });
  const berryMat = new THREE.MeshStandardMaterial({ color: 0xc72b3d, roughness: 0.55, metalness: 0.02 });

  for (let i = 0; i < 5; i++) {
    const a = i * 1.256 + seed * 0.37;
    const r = i === 0 ? 0 : 0.38 + (i % 2) * 0.12;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.52 - i * 0.025, 10, 8),
      i % 2 ? leafMat : darkLeafMat,
    );
    crown.position.set(Math.cos(a) * r, 0.45 + (i % 3) * 0.08, Math.sin(a) * r);
    crown.scale.set(1.0, 0.72, 1.0);
    crown.castShadow = crown.receiveShadow = true;
    bush.add(crown);
  }

  for (let i = 0; i < 7; i++) {
    const a = seed * 0.91 + i * 2.399;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), berryMat);
    berry.position.set(Math.cos(a) * (0.28 + (i % 3) * 0.12), 0.72 + (i % 2) * 0.12, Math.sin(a) * (0.28 + ((i + 1) % 3) * 0.12));
    berry.castShadow = true;
    bush.add(berry);
  }
  parent.add(bush);
}

function addProceduralVegetablePatch(parent: THREE.Group): void {
  const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x45a846, roughness: 0.9 });
  const lettuceDark = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.95 });
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xe87924, roughness: 0.7 });
  const carrotLeafMat = new THREE.MeshStandardMaterial({ color: 0x31963b, roughness: 0.9 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b3f24, roughness: 1.0 });

  const bed = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 5.4), soilMat);
  bed.position.set(0, 0.02, 0);
  bed.receiveShadow = true;
  parent.add(bed);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = -1.8 + col * 1.2;
      const z = -1.7 + row * 0.85;
      const cabbage = new THREE.Group();
      cabbage.position.set(x, 0.12, z);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24 - i * 0.012, 8, 6), i % 2 ? lettuceMat : lettuceDark);
        const a = i * 1.257;
        leaf.position.set(Math.cos(a) * 0.12, 0.12 + (i % 3) * 0.025, Math.sin(a) * 0.12);
        leaf.scale.set(1.15, 0.45, 0.9);
        leaf.castShadow = leaf.receiveShadow = true;
        cabbage.add(leaf);
      }
      parent.add(cabbage);
    }
  }

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      const x = -2.0 + col * 1.0;
      const z = 1.25 + row * 0.75;
      const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 8), carrotMat);
      carrot.position.set(x, 0.24, z);
      carrot.rotation.x = Math.PI;
      carrot.castShadow = true;
      parent.add(carrot);
      const greens = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.35, 6), carrotLeafMat);
      greens.position.set(x, 0.43, z);
      greens.castShadow = true;
      parent.add(greens);
    }
  }
}

function buildFallbackFence(parent: THREE.Group): void {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a572f, roughness: 0.9 });
  const pieces: [number, number, number, number, number][] = [
    [0, -3.4, 6.2, 0.14, 0.35], [0, 3.4, 6.2, 0.14, 0.35],
    [-3.4, 0, 0.14, 6.2, 0.35], [3.4, 0, 0.14, 6.2, 0.35],
  ];
  for (const [x, z, w, d, h] of pieces) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    rail.position.set(x, 0.45, z);
    rail.castShadow = rail.receiveShadow = true;
    parent.add(rail);
  }
}

function addGardenPatch(parent: THREE.Group): boolean {
  if (!gardenTemplate) return false;
  const o = gardenTemplate.clone(true);
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(5.6 / Math.max(size.x, 0.001), 5.6 / Math.max(size.z, 0.001));
  o.scale.setScalar(scale);
  o.position.y = 0.02;
  parent.add(o);
  return true;
}

function buildBerryFarm(f: FarmPlot, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(f.x, terrainHeight(f.x, f.z, seed) + 0.02, f.z);
  g.rotation.y = f.facing;
  g.userData.farmId = f.id;

  // No caseta: visible vegetable patch inside the same farm footprint/fences.
  // The procedural patch guarantees lettuce/carrots immediately; the GLB patch
  // from the village pack is added once available.
  addProceduralVegetablePatch(g);
  if (!addGardenPatch(g)) {
    addBerryBush(g, -2.35, -2.35, seed + 101);
    addBerryBush(g, 2.35, -2.35, seed + 131);
  }

  buildFallbackFence(g);
  const fencePieces: [FarmAssetKey, number, number, number, number][] = [
    ['fence', 0, -3.4, 0, 1.0], ['fence', 0, 3.4, 0, 1.0],
    ['fence2', -3.4, 0, Math.PI / 2, 1.0], ['fence2', 3.4, 0, Math.PI / 2, 1.0],
  ];
  for (const [key, x, z, rot, scale] of fencePieces) addAsset(g, key, x, z, rot, scale);
  return g;
}

export class FarmsteadView {
  private group = new THREE.Group();
  private signature = '';
  private dirty = true;

  constructor(private scene: THREE.Scene, private world: IWorld, private seed: number) {
    this.group.name = 'player-vegetable-farms';
    this.scene.add(this.group);
    (Object.keys(ASSETS) as FarmAssetKey[]).forEach((key) => loadFarmAsset(key, () => { this.dirty = true; }));
    loadGardenPatch(() => { this.dirty = true; });
  }

  update(): void {
    const sig = this.world.farms.map((f) => `${f.id}:${f.x.toFixed(1)}:${f.z.toFixed(1)}:${f.facing.toFixed(2)}`).join('|');
    if (!this.dirty && sig === this.signature) return;
    this.dirty = false;
    this.signature = sig;
    this.group.clear();
    for (const farm of this.world.farms) this.group.add(buildBerryFarm(farm, this.seed));
  }
}
