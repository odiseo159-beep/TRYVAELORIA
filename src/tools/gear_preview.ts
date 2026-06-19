import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CharacterVisual } from '../render/characters/visual';
import { assetsReady } from '../render/assets/preload';
import type { PlayerClass } from '../sim/types';

type GearDef = {
  id: string;
  label: string;
  url: string;
  icon?: string;
  target: 'hand';
  defaults: GearTransform;
  classes: PlayerClass[];
};
type GearTransform = { scale: number; px: number; py: number; pz: number; rx: number; ry: number; rz: number };

const BASE = '/models/gear/armaduras-etc';
const ALL: PlayerClass[] = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
const mk = (id: string, label: string, defaults: GearTransform, classes: PlayerClass[]): GearDef => ({
  id, label, target: 'hand', classes,
  url: `${BASE}/fbx/${id}.fbx`,
  icon: `${BASE}/icons/${id.replace('Sword_big', 'Sword_Big')}.png`,
  defaults,
});

const W = (scale = 1.0): GearTransform => ({ scale, px: 0.02, py: 0.02, pz: 0.04, rx: 0, ry: Math.PI, rz: -Math.PI / 2 });
// Bow preview uses the hunter/ranger hand basis instead of the generic sword basis.
const BOW: GearTransform = { scale: 0.012, px: -0.050, py: 0.085, pz: -0.045, rx: -0.15, ry: Math.PI, rz: 0 };

const WEAPONS: GearDef[] = [
  mk('none', 'Sin arma', W(), ALL),
  mk('Sword', 'Sword', W(0.012), ['warrior', 'paladin']),
  mk('Sword_big', 'Sword Big', W(0.014), ['warrior']),
  mk('Sword_Golden', 'Sword Golden', W(0.012), ['warrior', 'paladin']),
  mk('Sword_big_Golden', 'Sword Big Golden', W(0.014), ['warrior']),
  // Daggers need a 180º roll so the thick cutting edge faces down and the flat side faces up in-hand.
  mk('Dagger', 'Dagger', { ...W(0.016), rx: Math.PI }, ['rogue']),
  mk('Dagger_Golden', 'Dagger Golden', { ...W(0.016), rx: Math.PI }, ['rogue']),
  mk('Axe_Double', 'Axe Double', W(0.013), ['warrior', 'shaman']),
  mk('Axe_Double_Golden', 'Axe Double Golden', W(0.013), ['warrior', 'shaman']),
  mk('Hammer_Double', 'Hammer Double', W(0.013), ['warrior', 'paladin', 'shaman']),
  mk('Hammer_Double_Golden', 'Hammer Double Golden', W(0.013), ['warrior', 'paladin', 'shaman']),
  mk('Bow_Wooden', 'Bow Wooden', BOW, ['hunter']),
];

const state = {
  cls: 'warrior' as PlayerClass,
  weapon: WEAPONS[1],
  weaponT: { ...WEAPONS[1].defaults },
};

const canvas = document.querySelector<HTMLCanvasElement>('#gear-canvas')!;
const panel = document.querySelector<HTMLElement>('#stagePanel')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const weaponSelect = document.querySelector<HTMLSelectElement>('#weaponSelect')!;
const classSelect = document.querySelector<HTMLSelectElement>('#classSelect')!;
const thumbs = document.querySelector<HTMLElement>('#thumbs')!;
const weaponControls = document.querySelector<HTMLElement>('#weaponControls')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09080b);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 1.45, 4.0);
camera.lookAt(0, 1.05, 0);
scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x332615, 0.65));
const key = new THREE.DirectionalLight(0xffedc4, 3.0); key.position.set(2.5, 5, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc9ff, 1.2); fill.position.set(-4, 2, 2); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.0, 64), new THREE.MeshStandardMaterial({ color: 0x242018, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

const heroGroup = new THREE.Group();
scene.add(heroGroup);
let visual: CharacterVisual | null = null;
let weaponObj: THREE.Object3D | null = null;
const fbxCache = new Map<string, Promise<THREE.Object3D>>();
const loader = new FBXLoader();
const clock = new THREE.Clock();
let dragging = false, prevX = 0;

function fbx(url: string): Promise<THREE.Object3D> {
  let p = fbxCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    fbxCache.set(url, p);
  }
  return p;
}

function prepGear(root: THREE.Object3D): THREE.Object3D {
  const g = root.clone(true);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (Array.isArray(m.material)) m.material = m.material.map((mat) => mat.clone());
      else m.material = m.material.clone();
    }
  });
  const box = new THREE.Box3().setFromObject(g);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    g.position.sub(center);
  }
  return g;
}

function findBone(): THREE.Object3D {
  if (!visual) return heroGroup;
  const root = visual.root;
  const names = ['WeaponR', 'Weapon.R', 'Fist1R', 'Fist1.R', 'Fist2R', 'Fist2.R', 'HandR', 'Hand.R', 'mixamorigRightHand', 'RightHand'];
  for (const n of names) {
    const b = root.getObjectByName(n) ?? root.getObjectByName(n.replace(/[.[\]:]/g, ''));
    if (b) return b;
  }
  return visual.root;
}

function hideAuthoredWeapons(root: THREE.Object3D, hidden: boolean): void {
  const re = /weapon|sword|dagger|bow|axe|mace|hammer|staff/i;
  root.traverse((o) => {
    if (re.test(o.name)) o.visible = !hidden;
  });
}

function applyTransform(obj: THREE.Object3D | null, t: GearTransform): void {
  if (!obj) return;
  obj.position.set(t.px, t.py, t.pz);
  obj.rotation.set(t.rx, t.ry, t.rz);
  obj.scale.setScalar(t.scale);
}

function weaponsForClass(cls: PlayerClass): GearDef[] {
  return WEAPONS.filter((w) => w.classes.includes(cls));
}

async function setGear(def: GearDef): Promise<void> {
  weaponObj?.removeFromParent();
  weaponObj = null;
  if (visual) hideAuthoredWeapons(visual.root, def.id !== 'none');
  if (def.id === 'none') { status('Sin arma.'); return; }
  status(`Cargando ${def.label}…`);
  try {
    const obj = prepGear(await fbx(def.url));
    findBone().add(obj);
    weaponObj = obj;
    applyTransform(obj, state.weaponT);
    status(`${def.label} cargado. Ajusta sliders si hace falta.`);
  } catch (err) {
    console.error(err);
    status(`Error cargando ${def.label}. Mira consola.`);
  }
}

function status(text: string): void { statusEl.textContent = text; }

async function setClass(cls: PlayerClass): Promise<void> {
  state.cls = cls;
  weaponObj?.removeFromParent(); weaponObj = null;
  if (visual) { heroGroup.remove(visual.root); visual.dispose(); visual = null; }
  visual = new CharacterVisual(`player_${cls}`, 0xffffff);
  visual.setIdleClip('Idle');
  heroGroup.add(visual.root);
  heroGroup.position.set(0, 0, 0);
  const allowed = weaponsForClass(cls);
  if (!allowed.includes(state.weapon)) {
    state.weapon = allowed.find((w) => w.id !== 'none') ?? allowed[0];
    state.weaponT = { ...state.weapon.defaults };
  }
  fillSelect(weaponSelect, allowed);
  weaponSelect.value = state.weapon.id;
  buildControls();
  buildThumbs();
  await setGear(state.weapon);
}

function fillSelect(sel: HTMLSelectElement, defs: GearDef[]): void {
  sel.innerHTML = '';
  for (const d of defs) {
    const o = document.createElement('option'); o.value = d.id; o.textContent = d.label; sel.appendChild(o);
  }
}

function makeSlider(parent: HTMLElement, label: string, obj: GearTransform, key: keyof GearTransform, min: number, max: number, step: number, onChange: () => void): void {
  const row = document.createElement('div'); row.className = 'row';
  const lab = document.createElement('span'); lab.textContent = label;
  const input = document.createElement('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(obj[key]);
  const out = document.createElement('output'); out.value = Number(obj[key]).toFixed(2);
  input.oninput = () => { (obj[key] as number) = Number(input.value); out.value = Number(obj[key]).toFixed(2); onChange(); };
  row.append(lab, input, out); parent.appendChild(row);
}

function buildControls(): void {
  weaponControls.innerHTML = '';
  makeSlider(weaponControls, 'scale', state.weaponT, 'scale', 0.001, 0.08, 0.001, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'pos x', state.weaponT, 'px', -1.2, 1.2, 0.01, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'pos y', state.weaponT, 'py', -1.2, 1.8, 0.01, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'pos z', state.weaponT, 'pz', -1.2, 1.2, 0.01, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'rot x', state.weaponT, 'rx', -3.14, 3.14, 0.01, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'rot y', state.weaponT, 'ry', -3.14, 3.14, 0.01, () => applyTransform(weaponObj, state.weaponT));
  makeSlider(weaponControls, 'rot z', state.weaponT, 'rz', -3.14, 3.14, 0.01, () => applyTransform(weaponObj, state.weaponT));
}

function buildThumbs(): void {
  thumbs.innerHTML = '';
  for (const d of weaponsForClass(state.cls).filter((x) => x.id !== 'none')) {
    const div = document.createElement('div'); div.className = 'thumb';
    if (d.icon) div.style.backgroundImage = `url(${d.icon})`;
    const span = document.createElement('span'); span.textContent = d.label.replace(' Golden', ' G'); div.appendChild(span);
    div.onclick = () => {
      weaponSelect.value = d.id; weaponSelect.dispatchEvent(new Event('change'));
    };
    thumbs.appendChild(div);
  }
}

function syncSize(): void {
  const w = Math.max(1, panel.clientWidth), h = Math.max(1, panel.clientHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  visual?.update(dt, { speed: 0, moving: false, backwards: false, dead: false, casting: false, swimming: false, sitting: false }, true);
  renderer.render(scene, camera);
}

canvas.addEventListener('mousedown', (e) => { dragging = true; prevX = e.clientX; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => { if (!dragging) return; heroGroup.rotation.y += (e.clientX - prevX) * 0.01; prevX = e.clientX; });
window.addEventListener('resize', syncSize);

fillSelect(weaponSelect, weaponsForClass(state.cls)); buildControls(); buildThumbs(); syncSize();
weaponSelect.value = state.weapon.id;
classSelect.onchange = () => void setClass(classSelect.value as PlayerClass);
weaponSelect.onchange = () => { const d = WEAPONS.find((x) => x.id === weaponSelect.value)!; state.weapon = d; state.weaponT = { ...d.defaults }; buildControls(); void setGear(d); };
document.querySelector<HTMLButtonElement>('#resetWeapon')!.onclick = () => { state.weaponT = { ...state.weapon.defaults }; buildControls(); applyTransform(weaponObj, state.weaponT); };

status('Precargando personajes…');
assetsReady((done, total) => status(`Precargando personajes ${done}/${total}…`))
  .then(async () => { await setClass(state.cls); status('Listo. Cada clase muestra solo sus armas.'); animate(); })
  .catch((err) => { console.error(err); status(`Error preloading personajes: ${String(err)}`); animate(); });
