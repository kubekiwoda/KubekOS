/**
 * KubekCraft — Inventory, Grid Crafting, Recipe Discovery & Smelting System
 * Provides a reusable 2x2 and 3x3 shaped/shapeless recipe matching engine,
 * tool durability repair, real-time furnace smelting, and stack management.
 */

import { BLOCK_IDS, ITEM_IDS, getItemDef } from './BlockRegistry';
import type {
  ContainerState,
  CraftingRecipe,
  GameMode,
  InventorySlot,
  SmeltingRecipe,
} from './types';

export const TOTAL_INVENTORY_SLOTS = 36; // 0..8 = Hotbar, 9..35 = Main Inventory Grid
export const HOTBAR_SLOTS = 9;

const PLANK_ITEM_IDS = new Set<number>([
  BLOCK_IDS.OAK_PLANKS,
  BLOCK_IDS.BIRCH_PLANKS,
  BLOCK_IDS.DARK_PLANKS,
]);

export function isAnyPlankItem(itemId: number): boolean {
  return PLANK_ITEM_IDS.has(itemId);
}

/**
 * Recipes that allow any wood plank type (Oak, Birch, or Dark Pine) in place of OAK_PLANKS
 * so the player can progress naturally regardless of which forest biome they start in.
 */
const GENERIC_WOOD_RECIPE_IDS = new Set<string>([
  'sticks_from_oak',
  'workbench',
  'wood_pickaxe',
  'wood_axe',
  'wood_shovel',
  'wood_sword',
  'chest',
  'bookshelf',
  'wood_fence',
  'wood_door',
]);

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // ==========================================================================
  // 2x2 PERSONAL CRAFTING GRID RECIPES (Basic Materials & Early Survival)
  // ==========================================================================
  {
    id: 'oak_planks',
    name: 'Oak Wood Planks (x4)',
    category: 'MATERIALS',
    type: 'SHAPELESS',
    gridSize: 2,
    shapelessIngredients: [BLOCK_IDS.OAK_LOG],
    unlockItems: [BLOCK_IDS.OAK_LOG],
    ingredients: [{ itemId: BLOCK_IDS.OAK_LOG, count: 1 }],
    output: { itemId: BLOCK_IDS.OAK_PLANKS, count: 4 },
    requiresWorkbench: false,
    description: 'Saw 1 Amber Oak Log into 4 versatile Oak Wood Planks.',
  },
  {
    id: 'birch_planks',
    name: 'Birch Wood Planks (x4)',
    category: 'MATERIALS',
    type: 'SHAPELESS',
    gridSize: 2,
    shapelessIngredients: [BLOCK_IDS.BIRCH_LOG],
    unlockItems: [BLOCK_IDS.BIRCH_LOG],
    ingredients: [{ itemId: BLOCK_IDS.BIRCH_LOG, count: 1 }],
    output: { itemId: BLOCK_IDS.BIRCH_PLANKS, count: 4 },
    requiresWorkbench: false,
    description: 'Saw 1 Silver Birch Log into 4 Birch Wood Planks.',
  },
  {
    id: 'dark_planks',
    name: 'Dark Pine Planks (x4)',
    category: 'MATERIALS',
    type: 'SHAPELESS',
    gridSize: 2,
    shapelessIngredients: [BLOCK_IDS.DARK_LOG],
    unlockItems: [BLOCK_IDS.DARK_LOG],
    ingredients: [{ itemId: BLOCK_IDS.DARK_LOG, count: 1 }],
    output: { itemId: BLOCK_IDS.DARK_PLANKS, count: 4 },
    requiresWorkbench: false,
    description: 'Saw 1 Shadow Pine Log into 4 Dark Pine Planks.',
  },
  {
    id: 'sticks_from_oak',
    name: 'Wooden Sticks (x4)',
    category: 'MATERIALS',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [[BLOCK_IDS.OAK_PLANKS], [BLOCK_IDS.OAK_PLANKS]],
    unlockItems: [
      BLOCK_IDS.OAK_LOG,
      BLOCK_IDS.BIRCH_LOG,
      BLOCK_IDS.DARK_LOG,
      BLOCK_IDS.OAK_PLANKS,
      BLOCK_IDS.BIRCH_PLANKS,
      BLOCK_IDS.DARK_PLANKS,
    ],
    ingredients: [{ itemId: BLOCK_IDS.OAK_PLANKS, count: 2 }],
    output: { itemId: ITEM_IDS.STICK, count: 4 },
    requiresWorkbench: false,
    description: 'Carve 2 vertically stacked Wood Planks into 4 sturdy tool handle sticks.',
  },
  {
    id: 'sticks_from_birch',
    name: 'Wooden Sticks from Birch (x4)',
    category: 'MATERIALS',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [[BLOCK_IDS.BIRCH_PLANKS], [BLOCK_IDS.BIRCH_PLANKS]],
    unlockItems: [BLOCK_IDS.BIRCH_PLANKS],
    ingredients: [{ itemId: BLOCK_IDS.BIRCH_PLANKS, count: 2 }],
    output: { itemId: ITEM_IDS.STICK, count: 4 },
    requiresWorkbench: false,
    description: 'Carve 2 Birch Planks into 4 tool handle sticks.',
  },
  {
    id: 'workbench',
    name: 'Crafting Table',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
    ],
    unlockItems: [
      BLOCK_IDS.OAK_PLANKS,
      BLOCK_IDS.BIRCH_PLANKS,
      BLOCK_IDS.DARK_PLANKS,
    ],
    ingredients: [{ itemId: BLOCK_IDS.OAK_PLANKS, count: 4 }],
    output: { itemId: BLOCK_IDS.WORKBENCH, count: 1 },
    requiresWorkbench: false,
    description: 'Place in the world and right-click to unlock the 3x3 Crafting Table grid.',
  },
  {
    id: 'torches',
    name: 'Ember Torches (x4)',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [[ITEM_IDS.COAL], [ITEM_IDS.STICK]],
    unlockItems: [ITEM_IDS.COAL, ITEM_IDS.STICK],
    ingredients: [
      { itemId: ITEM_IDS.COAL, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: BLOCK_IDS.TORCH, count: 4 },
    requiresWorkbench: false,
    description: 'Place 1 Coal above 1 Stick to craft 4 bright underground torches.',
  },

  // ==========================================================================
  // 3x3 CRAFTING TABLE RECIPES — WOODEN TOOLS
  // ==========================================================================
  {
    id: 'wood_pickaxe',
    name: 'Wooden Pickaxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [null, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, ITEM_IDS.STICK, BLOCK_IDS.OAK_PLANKS],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.WOOD_PICKAXE, count: 1 },
    requiresWorkbench: true,
    description: 'Entry-level pickaxe required to harvest Cobblestone and Coal Ore.',
  },
  {
    id: 'wood_axe',
    name: 'Wooden Hatchet',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS, null],
      [BLOCK_IDS.OAK_PLANKS, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, ITEM_IDS.STICK, BLOCK_IDS.OAK_PLANKS],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.WOOD_AXE, count: 1 },
    requiresWorkbench: true,
    description: 'Chops trees and wooden blocks twice as fast.',
  },
  {
    id: 'wood_shovel',
    name: 'Wooden Spade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS],
      [ITEM_IDS.STICK],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, ITEM_IDS.STICK, BLOCK_IDS.OAK_PLANKS],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.WOOD_SHOVEL, count: 1 },
    requiresWorkbench: true,
    description: 'Digs dirt, sand, clay, and snow efficiently.',
  },
  {
    id: 'wood_sword',
    name: 'Wooden Blade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, ITEM_IDS.STICK, BLOCK_IDS.OAK_PLANKS],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: ITEM_IDS.WOOD_SWORD, count: 1 },
    requiresWorkbench: true,
    description: 'Basic melee weapon for fending off nighttime creatures.',
  },

  // ==========================================================================
  // 3x3 CRAFTING TABLE RECIPES — STONE TOOLS
  // ==========================================================================
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE],
      [null, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [
      { itemId: BLOCK_IDS.COBBLESTONE, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.STONE_PICKAXE, count: 1 },
    requiresWorkbench: true,
    description: 'Reinforced stone pickaxe capable of mining Iron and Copper Ore.',
  },
  {
    id: 'stone_axe',
    name: 'Stone Waraxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE, null],
      [BLOCK_IDS.COBBLESTONE, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [
      { itemId: BLOCK_IDS.COBBLESTONE, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.STONE_AXE, count: 1 },
    requiresWorkbench: true,
    description: 'Fast stone logging axe and melee weapon.',
  },
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.COBBLESTONE],
      [ITEM_IDS.STICK],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [
      { itemId: BLOCK_IDS.COBBLESTONE, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.STONE_SHOVEL, count: 1 },
    requiresWorkbench: true,
    description: 'Durable stone shovel.',
  },
  {
    id: 'stone_sword',
    name: 'Stone Broadsword',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.COBBLESTONE],
      [BLOCK_IDS.COBBLESTONE],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [
      { itemId: BLOCK_IDS.COBBLESTONE, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: ITEM_IDS.STONE_SWORD, count: 1 },
    requiresWorkbench: true,
    description: 'Strong stone sword dealing 6 Attack Damage.',
  },

  // ==========================================================================
  // 3x3 CRAFTING TABLE RECIPES — IRON, GOLD & CRYSTAL TOOLS + ARMOR
  // ==========================================================================
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.IRON_INGOT, ITEM_IDS.IRON_INGOT, ITEM_IDS.IRON_INGOT],
      [null, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.RAW_IRON, ITEM_IDS.IRON_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.IRON_INGOT, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.IRON_PICKAXE, count: 1 },
    requiresWorkbench: true,
    description: 'High-tier pickaxe required to mine Gold, Obsidian, and Aether Crystal Ore.',
  },
  {
    id: 'iron_axe',
    name: 'Iron Logging Axe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.IRON_INGOT, ITEM_IDS.IRON_INGOT, null],
      [ITEM_IDS.IRON_INGOT, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.RAW_IRON, ITEM_IDS.IRON_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.IRON_INGOT, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.IRON_AXE, count: 1 },
    requiresWorkbench: true,
    description: 'Heavy forged iron axe.',
  },
  {
    id: 'iron_shovel',
    name: 'Iron Excavator',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.IRON_INGOT],
      [ITEM_IDS.STICK],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.RAW_IRON, ITEM_IDS.IRON_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.IRON_INGOT, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.IRON_SHOVEL, count: 1 },
    requiresWorkbench: true,
    description: 'High-speed forged iron shovel.',
  },
  {
    id: 'iron_sword',
    name: 'Iron Knight Sword',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.IRON_INGOT],
      [ITEM_IDS.IRON_INGOT],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.RAW_IRON, ITEM_IDS.IRON_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.IRON_INGOT, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: ITEM_IDS.IRON_SWORD, count: 1 },
    requiresWorkbench: true,
    description: 'Tempered steel sword dealing 8 Attack Damage.',
  },
  {
    id: 'gold_pickaxe',
    name: 'Golden Pickaxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.GOLD_INGOT, ITEM_IDS.GOLD_INGOT, ITEM_IDS.GOLD_INGOT],
      [null, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.RAW_GOLD, ITEM_IDS.GOLD_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.GOLD_INGOT, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.GOLD_PICKAXE, count: 1 },
    requiresWorkbench: true,
    description: 'Rapid-mining golden pickaxe with 7.5x speed.',
  },
  {
    id: 'gold_axe',
    name: 'Golden Greataxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.GOLD_INGOT, ITEM_IDS.GOLD_INGOT, null],
      [ITEM_IDS.GOLD_INGOT, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.RAW_GOLD, ITEM_IDS.GOLD_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.GOLD_INGOT, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.GOLD_AXE, count: 1 },
    requiresWorkbench: true,
    description: 'Gilded high-speed logging axe.',
  },
  {
    id: 'gold_shovel',
    name: 'Golden Spade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.GOLD_INGOT],
      [ITEM_IDS.STICK],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.RAW_GOLD, ITEM_IDS.GOLD_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.GOLD_INGOT, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.GOLD_SHOVEL, count: 1 },
    requiresWorkbench: true,
    description: 'Gilded rapid excavation shovel.',
  },
  {
    id: 'gold_sword',
    name: 'Golden Sunblade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.GOLD_INGOT],
      [ITEM_IDS.GOLD_INGOT],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.RAW_GOLD, ITEM_IDS.GOLD_INGOT],
    ingredients: [
      { itemId: ITEM_IDS.GOLD_INGOT, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: ITEM_IDS.GOLD_SWORD, count: 1 },
    requiresWorkbench: true,
    description: 'Gilded blade dealing 7 Attack Damage.',
  },
  {
    id: 'crystal_pickaxe',
    name: 'Aether Crystal Pickaxe',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD],
      [null, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [
      { itemId: ITEM_IDS.CRYSTAL_SHARD, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.CRYSTAL_PICKAXE, count: 1 },
    requiresWorkbench: true,
    description: 'Ultimate resonant pickaxe with 9.0x mining speed and 800 durability.',
  },
  {
    id: 'crystal_axe',
    name: 'Aether Crystal Cleaver',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD, null],
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.STICK, null],
      [null, ITEM_IDS.STICK, null],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [
      { itemId: ITEM_IDS.CRYSTAL_SHARD, count: 3 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.CRYSTAL_AXE, count: 1 },
    requiresWorkbench: true,
    description: 'Masterwork crystal axe.',
  },
  {
    id: 'crystal_shovel',
    name: 'Aether Crystal Spade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD],
      [ITEM_IDS.STICK],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [
      { itemId: ITEM_IDS.CRYSTAL_SHARD, count: 1 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: ITEM_IDS.CRYSTAL_SHOVEL, count: 1 },
    requiresWorkbench: true,
    description: 'Masterwork crystal shovel.',
  },
  {
    id: 'crystal_sword',
    name: 'Aether Sovereign Blade',
    category: 'TOOLS',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD],
      [ITEM_IDS.CRYSTAL_SHARD],
      [ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [
      { itemId: ITEM_IDS.CRYSTAL_SHARD, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 1 },
    ],
    output: { itemId: ITEM_IDS.CRYSTAL_SWORD, count: 1 },
    requiresWorkbench: true,
    description: 'Mythic crystal blade dealing 12 Attack Damage.',
  },

  // ==========================================================================
  // ARMOR & SURVIVAL WORKSTATIONS
  // ==========================================================================
  {
    id: 'leather_tunic',
    name: 'Ranger Leather Tunic',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.LEATHER, null, ITEM_IDS.LEATHER],
      [ITEM_IDS.LEATHER, ITEM_IDS.LEATHER, ITEM_IDS.LEATHER],
    ],
    unlockItems: [ITEM_IDS.LEATHER],
    ingredients: [{ itemId: ITEM_IDS.LEATHER, count: 5 }],
    output: { itemId: ITEM_IDS.LEATHER_TUNIC, count: 1 },
    requiresWorkbench: true,
    description: 'Protective leather armor granting +6 Armor Defense.',
  },
  {
    id: 'iron_cuirass',
    name: 'Iron Vanguard Cuirass',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.IRON_INGOT, null, ITEM_IDS.IRON_INGOT],
      [ITEM_IDS.IRON_INGOT, ITEM_IDS.IRON_INGOT, ITEM_IDS.IRON_INGOT],
      [null, ITEM_IDS.IRON_INGOT, null],
    ],
    unlockItems: [ITEM_IDS.IRON_INGOT],
    ingredients: [{ itemId: ITEM_IDS.IRON_INGOT, count: 6 }],
    output: { itemId: ITEM_IDS.IRON_CUIRASS, count: 1 },
    requiresWorkbench: true,
    description: 'Heavy iron plate armor granting +14 Armor Defense.',
  },
  {
    id: 'crystal_aegis',
    name: 'Aether Crystal Aegis',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD, null, ITEM_IDS.CRYSTAL_SHARD],
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD],
      [null, ITEM_IDS.CRYSTAL_SHARD, null],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [{ itemId: ITEM_IDS.CRYSTAL_SHARD, count: 6 }],
    output: { itemId: ITEM_IDS.CRYSTAL_AEGIS, count: 1 },
    requiresWorkbench: true,
    description: 'Supreme crystalline armor granting +20 Armor Defense.',
  },
  {
    id: 'furnace',
    name: 'Smelting Furnace',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE],
      [BLOCK_IDS.COBBLESTONE, null, BLOCK_IDS.COBBLESTONE],
      [BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [{ itemId: BLOCK_IDS.COBBLESTONE, count: 8 }],
    output: { itemId: BLOCK_IDS.FURNACE, count: 1 },
    requiresWorkbench: true,
    description: 'Smelts raw ores into ingots, sand into glass, and cooks raw meat over time.',
  },
  {
    id: 'chest',
    name: 'Storage Chest',
    category: 'SURVIVAL',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS, null, BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, BLOCK_IDS.OAK_PLANKS],
    ingredients: [{ itemId: BLOCK_IDS.OAK_PLANKS, count: 8 }],
    output: { itemId: BLOCK_IDS.CHEST, count: 1 },
    requiresWorkbench: true,
    description: 'Persistent world container with 18 storage slots.',
  },

  // ==========================================================================
  // BUILDING BLOCKS & CONSUMABLE FOODS
  // ==========================================================================
  {
    id: 'bricks_block',
    name: 'Kiln Masonry Bricks (x2)',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [
      [ITEM_IDS.BRICK_ITEM, ITEM_IDS.BRICK_ITEM],
      [ITEM_IDS.BRICK_ITEM, ITEM_IDS.BRICK_ITEM],
    ],
    unlockItems: [ITEM_IDS.CLAY_BALL, ITEM_IDS.BRICK_ITEM],
    ingredients: [{ itemId: ITEM_IDS.BRICK_ITEM, count: 4 }],
    output: { itemId: BLOCK_IDS.BRICKS, count: 2 },
    requiresWorkbench: false,
    description: 'Assemble 4 fired clay bricks into 2 Masonry Brick blocks.',
  },
  {
    id: 'oak_slabs',
    name: 'Oak Half-Slabs (x6)',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [[BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS]],
    unlockItems: [BLOCK_IDS.OAK_PLANKS],
    ingredients: [{ itemId: BLOCK_IDS.OAK_PLANKS, count: 3 }],
    output: { itemId: BLOCK_IDS.OAK_SLAB, count: 6 },
    requiresWorkbench: true,
    description: 'Craft 6 half-height wooden slabs.',
  },
  {
    id: 'cobble_stairs',
    name: 'Cobblestone Stairs (x4)',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [
      [BLOCK_IDS.COBBLESTONE, null],
      [BLOCK_IDS.COBBLESTONE, BLOCK_IDS.COBBLESTONE],
    ],
    unlockItems: [BLOCK_IDS.COBBLESTONE],
    ingredients: [{ itemId: BLOCK_IDS.COBBLESTONE, count: 3 }],
    output: { itemId: BLOCK_IDS.COBBLE_STAIRS, count: 4 },
    requiresWorkbench: false,
    description: 'Craft 4 stepped cobblestone stairs.',
  },
  {
    id: 'wood_fence',
    name: 'Oak Post Fence (x4)',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, ITEM_IDS.STICK],
      [BLOCK_IDS.OAK_PLANKS, ITEM_IDS.STICK],
    ],
    unlockItems: [ITEM_IDS.STICK, BLOCK_IDS.OAK_PLANKS],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 2 },
      { itemId: ITEM_IDS.STICK, count: 2 },
    ],
    output: { itemId: BLOCK_IDS.WOOD_FENCE, count: 4 },
    requiresWorkbench: false,
    description: 'Craft 4 decorative wooden fence posts.',
  },
  {
    id: 'wood_door',
    name: 'Oak Hinged Door (x2)',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
    ],
    unlockItems: [BLOCK_IDS.WORKBENCH, BLOCK_IDS.OAK_PLANKS],
    ingredients: [{ itemId: BLOCK_IDS.OAK_PLANKS, count: 6 }],
    output: { itemId: BLOCK_IDS.WOOD_DOOR, count: 2 },
    requiresWorkbench: true,
    description: 'Craft 2 architectural entryway doors.',
  },
  {
    id: 'bookshelf',
    name: 'Scholar Bookshelf',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 3,
    pattern: [
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
      [ITEM_IDS.LEATHER, null],
      [BLOCK_IDS.OAK_PLANKS, BLOCK_IDS.OAK_PLANKS],
    ],
    unlockItems: [ITEM_IDS.LEATHER],
    ingredients: [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 4 },
      { itemId: ITEM_IDS.LEATHER, count: 1 },
    ],
    output: { itemId: BLOCK_IDS.BOOKSHELF, count: 1 },
    requiresWorkbench: true,
    description: 'Decorative library bookcase.',
  },
  {
    id: 'crystal_block',
    name: 'Refined Aether Block',
    category: 'BUILDING',
    type: 'SHAPED',
    gridSize: 2,
    pattern: [
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD],
      [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.CRYSTAL_SHARD],
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD],
    ingredients: [{ itemId: ITEM_IDS.CRYSTAL_SHARD, count: 4 }],
    output: { itemId: BLOCK_IDS.CRYSTAL_BLOCK, count: 1 },
    requiresWorkbench: false,
    description: 'Glowing block of condensed Aether Crystal.',
  },
  {
    id: 'artisan_bread',
    name: 'Golden Hearth Bread',
    category: 'SURVIVAL',
    type: 'SHAPELESS',
    gridSize: 2,
    shapelessIngredients: [
      ITEM_IDS.WILD_BERRY,
      ITEM_IDS.WILD_BERRY,
      BLOCK_IDS.GOLD_FLOWER,
    ],
    unlockItems: [ITEM_IDS.WILD_BERRY, BLOCK_IDS.GOLD_FLOWER],
    ingredients: [
      { itemId: ITEM_IDS.WILD_BERRY, count: 2 },
      { itemId: BLOCK_IDS.GOLD_FLOWER, count: 1 },
    ],
    output: { itemId: ITEM_IDS.ARTISAN_BREAD, count: 1 },
    requiresWorkbench: false,
    description: 'Combine 2 Sweet Forest Berries and 1 Sunburst Dandelion into baked bread (+6 Hunger).',
  },
  {
    id: 'crystal_fruit',
    name: 'Infused Aether Apple',
    category: 'SURVIVAL',
    type: 'SHAPELESS',
    gridSize: 2,
    shapelessIngredients: [
      ITEM_IDS.ORCHARD_APPLE,
      ITEM_IDS.CRYSTAL_SHARD,
      ITEM_IDS.CRYSTAL_SHARD,
    ],
    unlockItems: [ITEM_IDS.CRYSTAL_SHARD, ITEM_IDS.ORCHARD_APPLE],
    ingredients: [
      { itemId: ITEM_IDS.ORCHARD_APPLE, count: 1 },
      { itemId: ITEM_IDS.CRYSTAL_SHARD, count: 2 },
    ],
    output: { itemId: ITEM_IDS.CRYSTAL_FRUIT, count: 1 },
    requiresWorkbench: false,
    description: 'Supercharged fruit restoring full hunger and saturation.',
  },
];

export const INITIAL_DISCOVERED_RECIPE_IDS: string[] = [
  'oak_planks',
  'birch_planks',
  'dark_planks',
  'sticks_from_oak',
  'workbench',
];

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { inputItemId: ITEM_IDS.RAW_IRON, outputItemId: ITEM_IDS.IRON_INGOT, smeltTimeSeconds: 4 },
  { inputItemId: ITEM_IDS.RAW_COPPER, outputItemId: ITEM_IDS.COPPER_INGOT, smeltTimeSeconds: 3.5 },
  { inputItemId: ITEM_IDS.RAW_GOLD, outputItemId: ITEM_IDS.GOLD_INGOT, smeltTimeSeconds: 5 },
  { inputItemId: BLOCK_IDS.SAND, outputItemId: BLOCK_IDS.GLASS, smeltTimeSeconds: 3 },
  { inputItemId: ITEM_IDS.CLAY_BALL, outputItemId: ITEM_IDS.BRICK_ITEM, smeltTimeSeconds: 3 },
  { inputItemId: ITEM_IDS.RAW_MEAT, outputItemId: ITEM_IDS.COOKED_MEAT, smeltTimeSeconds: 3.5 },
  { inputItemId: BLOCK_IDS.OAK_LOG, outputItemId: ITEM_IDS.COAL, smeltTimeSeconds: 3.5 },
  { inputItemId: BLOCK_IDS.BIRCH_LOG, outputItemId: ITEM_IDS.COAL, smeltTimeSeconds: 3.5 },
  { inputItemId: BLOCK_IDS.DARK_LOG, outputItemId: ITEM_IDS.COAL, smeltTimeSeconds: 3.5 },
  { inputItemId: BLOCK_IDS.COBBLESTONE, outputItemId: BLOCK_IDS.STONE, smeltTimeSeconds: 3 },
];

export function findSmeltingRecipe(inputItemId: number): SmeltingRecipe | undefined {
  return SMELTING_RECIPES.find((r) => r.inputItemId === inputItemId);
}

export function getFuelBurnSeconds(itemId: number): number {
  if (itemId === ITEM_IDS.COAL) return 24;
  if (
    itemId === BLOCK_IDS.OAK_LOG ||
    itemId === BLOCK_IDS.BIRCH_LOG ||
    itemId === BLOCK_IDS.DARK_LOG
  ) {
    return 10;
  }
  if (
    itemId === BLOCK_IDS.OAK_PLANKS ||
    itemId === BLOCK_IDS.BIRCH_PLANKS ||
    itemId === BLOCK_IDS.DARK_PLANKS
  ) {
    return 6;
  }
  if (itemId === ITEM_IDS.STICK) return 3;
  return 0;
}

/**
 * Creates a fresh starting inventory for a newly created world.
 * Survival & Peaceful worlds start completely empty so the player earns every item.
 * Creative mode starts with a curated building & tool palette.
 */
export function createInitialInventory(mode: GameMode): Array<InventorySlot | null> {
  const slots: Array<InventorySlot | null> = new Array(TOTAL_INVENTORY_SLOTS).fill(null);

  if (mode === 'CREATIVE') {
    const starterCreative: InventorySlot[] = [
      { itemId: BLOCK_IDS.GRASS, count: 64 },
      { itemId: BLOCK_IDS.STONE, count: 64 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 64 },
      { itemId: BLOCK_IDS.BRICKS, count: 64 },
      { itemId: BLOCK_IDS.GLASS, count: 64 },
      { itemId: BLOCK_IDS.TORCH, count: 64 },
      { itemId: BLOCK_IDS.CRYSTAL_BLOCK, count: 64 },
      { itemId: BLOCK_IDS.OAK_LOG, count: 64 },
      { itemId: ITEM_IDS.CRYSTAL_PICKAXE, count: 1, durability: 800 },
      { itemId: BLOCK_IDS.COBBLESTONE, count: 64 },
      { itemId: BLOCK_IDS.SANDSTONE, count: 64 },
      { itemId: BLOCK_IDS.BIRCH_PLANKS, count: 64 },
      { itemId: BLOCK_IDS.DARK_PLANKS, count: 64 },
      { itemId: BLOCK_IDS.OAK_SLAB, count: 64 },
      { itemId: BLOCK_IDS.COBBLE_STAIRS, count: 64 },
      { itemId: BLOCK_IDS.WOOD_FENCE, count: 64 },
      { itemId: BLOCK_IDS.WOOD_DOOR, count: 64 },
      { itemId: BLOCK_IDS.BOOKSHELF, count: 64 },
      { itemId: BLOCK_IDS.WORKBENCH, count: 16 },
      { itemId: BLOCK_IDS.FURNACE, count: 16 },
      { itemId: BLOCK_IDS.CHEST, count: 16 },
      { itemId: BLOCK_IDS.OBSIDIAN, count: 64 },
      { itemId: BLOCK_IDS.RED_FLOWER, count: 64 },
      { itemId: BLOCK_IDS.GLOW_MUSHROOM, count: 64 },
      { itemId: ITEM_IDS.CRYSTAL_SWORD, count: 1, durability: 800 },
      { itemId: ITEM_IDS.COOKED_MEAT, count: 32 },
    ];
    for (let i = 0; i < starterCreative.length && i < TOTAL_INVENTORY_SLOTS; i++) {
      slots[i] = { ...starterCreative[i]! };
    }
  }

  return slots;
}

export function countItemInInventory(
  slots: Array<InventorySlot | null>,
  itemId: number,
  allowAnyPlankForOak = false
): number {
  let total = 0;
  for (const s of slots) {
    if (!s) continue;
    if (s.itemId === itemId) {
      total += s.count;
    } else if (
      allowAnyPlankForOak &&
      itemId === BLOCK_IDS.OAK_PLANKS &&
      isAnyPlankItem(s.itemId)
    ) {
      total += s.count;
    }
  }
  return total;
}

export function addItemToInventory(
  slots: Array<InventorySlot | null>,
  itemId: number,
  count: number,
  durability?: number
): { updatedSlots: Array<InventorySlot | null>; remaining: number } {
  const next = slots.map((s) => (s ? { ...s } : null));
  const def = getItemDef(itemId);
  const maxStack = def.maxStack || 64;
  let left = count;

  // Pass 1: Merge into existing non-full stacks if stackable
  if (maxStack > 1) {
    for (let i = 0; i < next.length && left > 0; i++) {
      const slot = next[i];
      if (slot && slot.itemId === itemId && slot.count < maxStack) {
        const space = maxStack - slot.count;
        const add = Math.min(space, left);
        slot.count += add;
        left -= add;
      }
    }
  }

  // Pass 2: Place into empty slots
  for (let i = 0; i < next.length && left > 0; i++) {
    if (!next[i]) {
      const add = Math.min(maxStack, left);
      next[i] = {
        itemId,
        count: add,
        durability: durability ?? def.maxDurability,
      };
      left -= add;
    }
  }

  return { updatedSlots: next, remaining: left };
}

export function consumeItemFromInventory(
  slots: Array<InventorySlot | null>,
  itemId: number,
  count: number,
  allowAnyPlankForOak = false
): Array<InventorySlot | null> | null {
  if (countItemInInventory(slots, itemId, allowAnyPlankForOak) < count) return null;
  const next = slots.map((s) => (s ? { ...s } : null));
  let toRemove = count;

  for (let i = 0; i < next.length && toRemove > 0; i++) {
    const slot = next[i];
    if (!slot) continue;
    const matches =
      slot.itemId === itemId ||
      (allowAnyPlankForOak && itemId === BLOCK_IDS.OAK_PLANKS && isAnyPlankItem(slot.itemId));
    if (matches) {
      const take = Math.min(slot.count, toRemove);
      slot.count -= take;
      toRemove -= take;
      if (slot.count <= 0) {
        next[i] = null;
      }
    }
  }

  return next;
}

export function canCraftRecipe(
  slots: Array<InventorySlot | null>,
  recipe: CraftingRecipe,
  hasWorkbenchAccess = true
): boolean {
  if (recipe.requiresWorkbench && !hasWorkbenchAccess) {
    return false;
  }
  const allowAnyPlank = GENERIC_WOOD_RECIPE_IDS.has(recipe.id);
  for (const ing of recipe.ingredients) {
    if (countItemInInventory(slots, ing.itemId, allowAnyPlank) < ing.count) {
      return false;
    }
  }
  return true;
}

export function executeCraftRecipe(
  slots: Array<InventorySlot | null>,
  recipe: CraftingRecipe,
  hasWorkbenchAccess = true
): Array<InventorySlot | null> | null {
  if (!canCraftRecipe(slots, recipe, hasWorkbenchAccess)) return null;
  let working: Array<InventorySlot | null> | null = slots.map((s) => (s ? { ...s } : null));
  const allowAnyPlank = GENERIC_WOOD_RECIPE_IDS.has(recipe.id);

  for (const ing of recipe.ingredients) {
    working = consumeItemFromInventory(working, ing.itemId, ing.count, allowAnyPlank);
    if (!working) return null;
  }

  const outDef = getItemDef(recipe.output.itemId);
  const added = addItemToInventory(
    working,
    recipe.output.itemId,
    recipe.output.count,
    outDef.maxDurability
  );

  if (added.remaining > 0) return null; // Inventory full
  return added.updatedSlots;
}

// ============================================================================
// 2x2 AND 3x3 CRAFTING GRID MATCHING ENGINE
// ============================================================================

export interface CraftingGridMatchResult {
  recipe?: CraftingRecipe;
  output: InventorySlot;
  isRepair?: boolean;
}

/**
 * Trims empty outer rows and columns from a 2D item ID matrix so shaped recipes
 * match regardless of where they are positioned inside the 2x2 or 3x3 grid.
 */
function trimMatrix(matrix: Array<Array<number | null>>): Array<Array<number | null>> {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  let minRow = rows;
  let maxRow = -1;
  let minCol = cols;
  let maxCol = -1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = matrix[r]?.[c] ?? null;
      if (val !== null && val !== BLOCK_IDS.AIR) {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }

  if (maxRow < minRow || maxCol < minCol) {
    return [];
  }

  const trimmed: Array<Array<number | null>> = [];
  for (let r = minRow; r <= maxRow; r++) {
    const rowSlice: Array<number | null> = [];
    for (let c = minCol; c <= maxCol; c++) {
      rowSlice.push(matrix[r]?.[c] ?? null);
    }
    trimmed.push(rowSlice);
  }
  return trimmed;
}

function mirrorMatrixHorizontally(
  matrix: Array<Array<number | null>>
): Array<Array<number | null>> {
  return matrix.map((row) => [...row].reverse());
}

function matricesMatch(
  gridMat: Array<Array<number | null>>,
  recipeMat: Array<Array<number | null>>,
  allowAnyPlank: boolean
): boolean {
  if (gridMat.length !== recipeMat.length) return false;
  const cols = gridMat[0]?.length ?? 0;
  if (cols !== (recipeMat[0]?.length ?? 0)) return false;

  for (let r = 0; r < gridMat.length; r++) {
    for (let c = 0; c < cols; c++) {
      const gId = gridMat[r]?.[c] ?? null;
      const pId = recipeMat[r]?.[c] ?? null;
      if (gId === null && pId === null) continue;
      if (gId === null || pId === null) return false;
      if (gId === pId) continue;
      if (allowAnyPlank && pId === BLOCK_IDS.OAK_PLANKS && isAnyPlankItem(gId)) {
        continue;
      }
      return false;
    }
  }
  return true;
}

/**
 * Evaluates a 2x2 (length 4) or 3x3 (length 9) crafting grid and returns the matched
 * recipe output or tool repair output, or `null` if the arrangement is invalid.
 */
export function matchCraftingGrid(
  gridSlots: Array<InventorySlot | null>,
  gridDim: 2 | 3
): CraftingGridMatchResult | null {
  const expectedLength = gridDim * gridDim;
  const matrix: Array<Array<number | null>> = [];
  const occupiedSlots: InventorySlot[] = [];

  for (let r = 0; r < gridDim; r++) {
    const row: Array<number | null> = [];
    for (let c = 0; c < gridDim; c++) {
      const idx = r * gridDim + c;
      const slot = idx < expectedLength ? gridSlots[idx] ?? null : null;
      if (slot && slot.count > 0 && slot.itemId !== BLOCK_IDS.AIR) {
        row.push(slot.itemId);
        occupiedSlots.push(slot);
      } else {
        row.push(null);
      }
    }
    matrix.push(row);
  }

  if (occupiedSlots.length === 0) {
    return null;
  }

  // 1. Check Tool / Armor Durability Repair (2 identical durability items in any slots)
  if (occupiedSlots.length === 2) {
    const first = occupiedSlots[0]!;
    const second = occupiedSlots[1]!;
    if (first.itemId === second.itemId) {
      const def = getItemDef(first.itemId);
      if (def.maxDurability && def.maxDurability > 0) {
        const dur1 = first.durability ?? def.maxDurability;
        const dur2 = second.durability ?? def.maxDurability;
        const bonus = Math.max(1, Math.floor(def.maxDurability * 0.1));
        const repairedDur = Math.min(def.maxDurability, dur1 + dur2 + bonus);
        return {
          output: {
            itemId: first.itemId,
            count: 1,
            durability: repairedDur,
          },
          isRepair: true,
        };
      }
    }
  }

  const trimmedGrid = trimMatrix(matrix);
  if (trimmedGrid.length === 0) return null;

  // 2. Check Shaped Recipes (exact match first, then generic plank fallback)
  for (const allowPlankFallback of [false, true]) {
    for (const recipe of CRAFTING_RECIPES) {
      const reqDim = recipe.gridSize ?? (recipe.requiresWorkbench ? 3 : 2);
      if (reqDim > gridDim) continue;
      if (recipe.type !== 'SHAPED' || !recipe.pattern) continue;
      if (allowPlankFallback && !GENERIC_WOOD_RECIPE_IDS.has(recipe.id)) continue;

      const trimmedPattern = trimMatrix(recipe.pattern);
      const mirroredPattern = mirrorMatrixHorizontally(trimmedPattern);

      if (
        matricesMatch(trimmedGrid, trimmedPattern, allowPlankFallback) ||
        matricesMatch(trimmedGrid, mirroredPattern, allowPlankFallback)
      ) {
        const outDef = getItemDef(recipe.output.itemId);
        return {
          recipe,
          output: {
            itemId: recipe.output.itemId,
            count: recipe.output.count,
            durability: outDef.maxDurability,
          },
        };
      }
    }
  }

  // 3. Check Shapeless Recipes
  const gridItemIds = occupiedSlots.map((s) => s.itemId).sort((a, b) => a - b);
  for (const recipe of CRAFTING_RECIPES) {
    const reqDim = recipe.gridSize ?? (recipe.requiresWorkbench ? 3 : 2);
    if (reqDim > gridDim) continue;
    if (recipe.type !== 'SHAPELESS' || !recipe.shapelessIngredients) continue;
    if (recipe.shapelessIngredients.length !== gridItemIds.length) continue;

    const reqIds = [...recipe.shapelessIngredients].sort((a, b) => a - b);
    let allMatch = true;
    for (let i = 0; i < reqIds.length; i++) {
      if (reqIds[i] !== gridItemIds[i]) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      const outDef = getItemDef(recipe.output.itemId);
      return {
        recipe,
        output: {
          itemId: recipe.output.itemId,
          count: recipe.output.count,
          durability: outDef.maxDurability,
        },
      };
    }
  }

  return null;
}

/**
 * Consumes 1 item from each occupied slot in the crafting grid when a crafted output
 * is collected by the player.
 */
export function consumeCraftingGridIngredients(
  gridSlots: Array<InventorySlot | null>
): Array<InventorySlot | null> {
  return gridSlots.map((slot) => {
    if (!slot) return null;
    if (slot.count <= 1) return null;
    return {
      ...slot,
      count: slot.count - 1,
    };
  });
}

/**
 * Safely returns any items currently sitting in the crafting grid back into the player's
 * inventory (e.g., when closing the inventory modal or switching recipes).
 */
export function returnGridItemsToInventory(
  inventory: Array<InventorySlot | null>,
  gridSlots: Array<InventorySlot | null>
): {
  updatedInventory: Array<InventorySlot | null>;
  leftoverSlots: Array<InventorySlot | null>;
} {
  let workingInv = inventory.map((s) => (s ? { ...s } : null));
  const leftovers: Array<InventorySlot | null> = new Array(gridSlots.length).fill(null);

  for (let i = 0; i < gridSlots.length; i++) {
    const s = gridSlots[i];
    if (!s || s.count <= 0) continue;
    const res = addItemToInventory(workingInv, s.itemId, s.count, s.durability);
    workingInv = res.updatedSlots;
    if (res.remaining > 0) {
      leftovers[i] = { ...s, count: res.remaining };
    }
  }

  return { updatedInventory: workingInv, leftoverSlots: leftovers };
}

/**
 * Attempts to populate a 2x2 or 3x3 crafting grid with 1 set of ingredients for `recipe`
 * taken from the player's inventory (after returning any existing grid items).
 * Never creates free items — if the player lacks the required ingredients, returns `placed: false`.
 */
export function populateCraftingGridFromInventory(
  inventory: Array<InventorySlot | null>,
  currentGrid: Array<InventorySlot | null>,
  gridDim: 2 | 3,
  recipe: CraftingRecipe
): {
  placed: boolean;
  updatedInventory: Array<InventorySlot | null>;
  updatedGrid: Array<InventorySlot | null>;
} {
  const reqDim = recipe.gridSize ?? (recipe.requiresWorkbench ? 3 : 2);
  if (reqDim > gridDim) {
    return { placed: false, updatedInventory: inventory, updatedGrid: currentGrid };
  }

  // First return any items currently in the grid back to working inventory
  const returned = returnGridItemsToInventory(inventory, currentGrid);
  if (returned.leftoverSlots.some((s) => s !== null)) {
    return { placed: false, updatedInventory: inventory, updatedGrid: currentGrid };
  }

  let workingInv = returned.updatedInventory;
  if (!canCraftRecipe(workingInv, recipe, gridDim === 3)) {
    return {
      placed: false,
      updatedInventory: returned.updatedInventory,
      updatedGrid: new Array(gridDim * gridDim).fill(null),
    };
  }

  const nextGrid: Array<InventorySlot | null> = new Array(gridDim * gridDim).fill(null);
  const allowAnyPlank = GENERIC_WOOD_RECIPE_IDS.has(recipe.id);

  const takeOneMatchingFromInventory = (targetItemId: number): InventorySlot | null => {
    for (let i = 0; i < workingInv.length; i++) {
      const slot = workingInv[i];
      if (!slot || slot.count <= 0) continue;
      const matches =
        slot.itemId === targetItemId ||
        (allowAnyPlank &&
          targetItemId === BLOCK_IDS.OAK_PLANKS &&
          isAnyPlankItem(slot.itemId));
      if (matches) {
        const picked: InventorySlot = {
          itemId: slot.itemId,
          count: 1,
          durability: slot.durability,
        };
        slot.count -= 1;
        if (slot.count <= 0) {
          workingInv[i] = null;
        }
        return picked;
      }
    }
    return null;
  };

  if (recipe.type === 'SHAPED' && recipe.pattern) {
    for (let r = 0; r < recipe.pattern.length && r < gridDim; r++) {
      const row = recipe.pattern[r]!;
      for (let c = 0; c < row.length && c < gridDim; c++) {
        const itemId = row[c];
        if (itemId !== null && itemId !== undefined) {
          const taken = takeOneMatchingFromInventory(itemId);
          if (!taken) {
            return {
              placed: false,
              updatedInventory: returned.updatedInventory,
              updatedGrid: new Array(gridDim * gridDim).fill(null),
            };
          }
          nextGrid[r * gridDim + c] = taken;
        }
      }
    }
  } else if (recipe.type === 'SHAPELESS' && recipe.shapelessIngredients) {
    for (let i = 0; i < recipe.shapelessIngredients.length && i < nextGrid.length; i++) {
      const itemId = recipe.shapelessIngredients[i]!;
      const taken = takeOneMatchingFromInventory(itemId);
      if (!taken) {
        return {
          placed: false,
          updatedInventory: returned.updatedInventory,
          updatedGrid: new Array(gridDim * gridDim).fill(null),
        };
      }
      nextGrid[i] = taken;
    }
  }

  return {
    placed: true,
    updatedInventory: workingInv,
    updatedGrid: nextGrid,
  };
}

// ============================================================================
// REAL-TIME FURNACE SMELTING ENGINE
// ============================================================================

export function tickFurnaceContainer(
  container: ContainerState,
  dt: number
): {
  updated: ContainerState;
  completedOutputItemId: number | null;
  changed: boolean;
} {
  if (container.type !== 'FURNACE' || dt <= 0) {
    return { updated: container, completedOutputItemId: null, changed: false };
  }

  const slots = container.slots.map((s) => (s ? { ...s } : null));
  const input = slots[0] ?? null;
  const fuel = slots[1] ?? null;
  const output = slots[2] ?? null;

  let fuelRemaining = container.fuelRemaining ?? 0;
  let maxFuelTime = container.maxFuelTime ?? (fuelRemaining > 0 ? fuelRemaining : 0);
  let smeltProgress = container.smeltProgress ?? 0;
  let completedOutputItemId: number | null = null;
  let changed = false;

  const recipe = input ? findSmeltingRecipe(input.itemId) : undefined;
  const outputMaxStack = recipe ? getItemDef(recipe.outputItemId).maxStack || 64 : 64;
  const canFitOutput =
    Boolean(recipe) &&
    (!output || (output.itemId === recipe!.outputItemId && output.count < outputMaxStack));

  // Burn existing active fuel over time
  if (fuelRemaining > 0) {
    fuelRemaining = Math.max(0, fuelRemaining - dt);
    changed = true;
  }

  // Ignite next fuel item if needed and valid recipe + output space exist
  if (fuelRemaining <= 0 && canFitOutput && fuel && fuel.count > 0) {
    const burnSecs = getFuelBurnSeconds(fuel.itemId);
    if (burnSecs > 0) {
      fuel.count -= 1;
      if (fuel.count <= 0) {
        slots[1] = null;
      }
      fuelRemaining = burnSecs;
      maxFuelTime = burnSecs;
      changed = true;
    }
  }

  // Advance or decay smelting progress
  if (canFitOutput && recipe && fuelRemaining > 0) {
    smeltProgress += dt / Math.max(0.5, recipe.smeltTimeSeconds);
    changed = true;

    if (smeltProgress >= 1.0) {
      smeltProgress -= 1.0;
      input!.count -= 1;
      if (input!.count <= 0) {
        slots[0] = null;
      }

      if (slots[2]) {
        slots[2].count += 1;
      } else {
        slots[2] = { itemId: recipe.outputItemId, count: 1 };
      }

      completedOutputItemId = recipe.outputItemId;
      // Reset progress if no more input remains
      if (!slots[0]) {
        smeltProgress = 0;
      }
    }
  } else if (smeltProgress > 0) {
    smeltProgress = Math.max(0, smeltProgress - dt * 0.5);
    changed = true;
  }

  if (!changed) {
    return { updated: container, completedOutputItemId: null, changed: false };
  }

  return {
    updated: {
      ...container,
      slots,
      smeltProgress,
      fuelRemaining,
      maxFuelTime,
    },
    completedOutputItemId,
    changed: true,
  };
}

// ============================================================================
// RECIPE DISCOVERY PROGRESSION
// ============================================================================

export function discoverRecipesFromItems(
  itemIds: number[],
  currentDiscovered: string[]
): {
  updatedDiscovered: string[];
  newlyUnlocked: CraftingRecipe[];
} {
  const knownSet = new Set<string>([
    ...INITIAL_DISCOVERED_RECIPE_IDS,
    ...currentDiscovered,
  ]);
  const newlyUnlocked: CraftingRecipe[] = [];

  for (const itemId of itemIds) {
    for (const recipe of CRAFTING_RECIPES) {
      if (knownSet.has(recipe.id)) continue;
      if (recipe.unlockItems?.includes(itemId)) {
        knownSet.add(recipe.id);
        newlyUnlocked.push(recipe);
      }
    }
  }

  return {
    updatedDiscovered: Array.from(knownSet),
    newlyUnlocked,
  };
}
