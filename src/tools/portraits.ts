// Dev tool: renders a head-framed portrait of each player class's character
// model (with its manifest tint) to a transparent PNG, used as the unit-frame
// portrait. Driven offline by puppeteer (window.renderPortrait per class).
import * as THREE from 'three';
import { CharacterVisual } from '../render/characters/visual';
import { assetsReady } from '../render/assets/preload';

const ANIM = { speed: 0, moving: false, backwards: false, dead: false, casting: false, swimming: false, sitting: false };

const canvas = document.querySelector('#cv') as HTMLCanvasElement;
const SIZE = 320;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7280, 1.35));
const key = new THREE.DirectionalLight(0xfff4e2, 2.9); key.position.set(2.5, 4, 5); scene.add(key);
const fill = new THREE.DirectionalLight(0xdfeaff, 1.0); fill.position.set(-3, 1.5, 2.5); scene.add(fill);
const face = new THREE.DirectionalLight(0xfff6ea, 1.5); face.position.set(0, 1.5, 6); scene.add(face); // straight at the face
const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);

let current: CharacterVisual | null = null;

// yaw: model rotation (π usually turns the face toward the camera); dist/lift
// let puppeteer fine-tune the head framing without a code change.
(window as Window & typeof globalThis & { renderPortrait?: unknown }).renderPortrait = async (
  cls: string, yaw = Math.PI, dist = 0.62, lift = 0.0,
): Promise<string> => {
  if (current) { current.root.removeFromParent(); current = null; }
  const v = new CharacterVisual(`player_${cls}`, 0xffffff);
  current = v;
  v.setIdleClip('Idle');
  v.root.rotation.y = yaw;
  scene.add(v.root);
  for (let i = 0; i < 30; i++) { v.update(0.033, ANIM, true); await new Promise((r) => requestAnimationFrame(r)); }

  let headY = 1.6;
  let head: THREE.Object3D | null = null;
  const boneNames: string[] = [];
  v.root.traverse((o) => { if ((o as THREE.Bone).isBone) boneNames.push(o.name); if (!head && /head/i.test(o.name)) head = o; });
  const box = new THREE.Box3().setFromObject(v.root);
  const hp = new THREE.Vector3();
  if (head) { (head as THREE.Object3D).getWorldPosition(hp); headY = hp.y; }
  else { hp.set(0, box.max.y - (box.max.y - box.min.y) * 0.1, 0); headY = hp.y; }
  // aim at the FACE (a bit above the head bone, which sits at the skull base)
  const tx = hp.x, ty = hp.y + lift, tz = hp.z;
  console.log(`[portrait] ${cls} headBone=${head ? (head as THREE.Object3D).name : 'NONE'} head=(${hp.x.toFixed(2)},${hp.y.toFixed(2)},${hp.z.toFixed(2)}) bbox.y=[${box.min.y.toFixed(2)},${box.max.y.toFixed(2)}]`);
  cam.position.set(tx, ty, tz + dist);
  cam.lookAt(tx, ty, tz);
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};

assetsReady().then(() => { (window as Window & { portraitReady?: boolean }).portraitReady = true; });
