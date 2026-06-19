// Tutorial dungeon resource spots in instance-local coordinates.
// Plain data shared by sim, HUD prompts and renderer.

export const TUTORIAL_LAKE = { x: -9, z: 42, r: 5.8 };
export const TUTORIAL_TREE = { x: 10, z: 58, r: 0.75 };
export const TUTORIAL_TREE_KEY = 'tutorial_tree';

export function tutorialLocal(x: number, z: number, ox: number, oz: number): { x: number; z: number } {
  return { x: x - ox, z: z - oz };
}

export function isInTutorialLakeLocal(x: number, z: number): boolean {
  return Math.hypot(x - TUTORIAL_LAKE.x, z - TUTORIAL_LAKE.z) <= TUTORIAL_LAKE.r;
}

export function distanceToTutorialLakeLocal(x: number, z: number): number {
  return Math.max(0, Math.hypot(x - TUTORIAL_LAKE.x, z - TUTORIAL_LAKE.z) - TUTORIAL_LAKE.r);
}
