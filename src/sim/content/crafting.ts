import type { PlayerClass } from '../types';

export const FISH_ITEM_IDS = [
  'fish_clownfish', 'fish_blue_tang', 'fish_goldfish', 'fish_koi', 'fish_puffer',
  'fish_royal_gramma', 'fish_red_snapper', 'fish_tuna', 'fish_swordfish',
  'fish_anglerfish', 'fish_shark',
];

export const CRAFTING_TABLE_TEMPLATE = 'crafting_table';
export const NORMAL_WEAPON_COST = { wood: 10, fish: 10 };
export const GOLDEN_WEAPON_COST = { wood: 200, fish: 200 };

export const CLASS_CRAFT_WEAPON: Record<PlayerClass, string> = {
  warrior: 'crafted_warrior_big_sword',
  paladin: 'crafted_paladin_hammer',
  hunter: 'crafted_hunter_bow',
  rogue: 'crafted_rogue_dagger',
  priest: 'crafted_priest_staff',
  shaman: 'crafted_shaman_axe',
  mage: 'crafted_mage_staff',
  warlock: 'crafted_warlock_staff',
  druid: 'crafted_druid_staff',
};

export const CLASS_GOLDEN_WEAPON: Record<PlayerClass, string> = {
  warrior: 'golden_warrior_big_sword',
  paladin: 'golden_paladin_hammer',
  hunter: 'golden_hunter_bow',
  rogue: 'golden_rogue_dagger',
  priest: 'golden_priest_staff',
  shaman: 'golden_shaman_axe',
  mage: 'golden_mage_staff',
  warlock: 'golden_warlock_staff',
  druid: 'golden_druid_staff',
};
