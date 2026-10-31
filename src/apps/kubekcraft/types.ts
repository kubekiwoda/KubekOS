/**
 * KubekCraft — Core Type Definitions
 * Comprehensive typing for blocks, items, tools, crafting, chunks, biomes,
 * entities, survival stats, audio, world persistence, and game settings.
 */

export type GameMode = 'SURVIVAL' | 'CREATIVE' | 'PEACEFUL';
export type DifficultyLevel = 'PEACEFUL' | 'EASY' | 'NORMAL' | 'HARD';
export type TerrainType = 'STANDARD' | 'AMPLIFIED' | 'FLAT' | 'ISLANDS';
export type WeatherType = 'CLEAR' | 'RAIN' | 'SNOW';
export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'CUSTOM';

export type BiomeId =
  | 'PLAINS'
  | 'FOREST'
  | 'DESERT'
  | 'MOUNTAINS'
  | 'SNOWY_TUNDRA'
  | 'BEACH'
  | 'OCEAN'
  | 'RIVER';

export type ItemCategory =
  | 'BLOCK'
  | 'TOOL'
  | 'MATERIAL'
  | 'FOOD'
  | 'ARMOR'
  | 'SPECIAL';

export type ToolType = 'NONE' | 'PICKAXE' | 'AXE' | 'SHOVEL' | 'SWORD';
export type ToolTier = 0 | 1 | 2 | 3 | 4; // 0=Hand, 1=Wood, 2=Stone, 3=Iron, 4=Crystal

export type BlockShape =
  | 'CUBE'
  | 'CROSS' // Flowers, tall grass, mushrooms, torches
  | 'LIQUID'
  | 'SLAB'
  | 'STAIRS'
  | 'FENCE'
  | 'DOOR';

export type SoundCategory =
  | 'GRASS'
  | 'DIRT'
  | 'STONE'
  | 'WOOD'
  | 'SAND'
  | 'GLASS'
  | 'WATER'
  | 'CRYSTAL';

export interface BlockFacePalette {
  top: string[]; // Primary + detail colors for procedural 16x16 pixel art
  bottom: string[];
  side: string[];
  pattern:
    | 'GRASS_SIDE'
    | 'DIRT'
    | 'STONE'
    | 'COBBLESTONE'
    | 'SAND'
    | 'GRAVEL'
    | 'CLAY'
    | 'SNOW'
    | 'ICE'
    | 'WATER'
    | 'BEDROCK'
    | 'LOG_SIDE'
    | 'LOG_TOP'
    | 'LEAVES'
    | 'PLANKS'
    | 'ORE'
    | 'BRICKS'
    | 'GLASS'
    | 'CRAFTING_TOP'
    | 'CRAFTING_SIDE'
    | 'FURNACE_FRONT'
    | 'CHEST_FRONT'
    | 'FLOWER'
    | 'MUSHROOM'
    | 'TORCH'
    | 'BOOKSHELF'
    | 'OBSIDIAN'
    | 'CRYSTAL_BLOCK';
}

export interface ItemDefinition {
  id: number;
  key: string;
  name: string;
  description: string;
  category: ItemCategory;
  maxStack: number;
  isBlock: boolean;

  // Block-specific properties
  transparent?: boolean;
  solid?: boolean;
  collidable?: boolean;
  liquid?: boolean;
  climbable?: boolean;
  lightLevel?: number; // 0..15
  breakTime?: number; // seconds with bare hands
  preferredTool?: ToolType;
  minToolTier?: ToolTier;
  dropItemId?: number;
  dropCount?: number;
  shape?: BlockShape;
  soundCategory?: SoundCategory;
  interactiveType?: 'CRAFTING_TABLE' | 'CHEST' | 'FURNACE' | 'DOOR';
  palette?: BlockFacePalette;

  // Tool/Weapon properties
  toolType?: ToolType;
  toolTier?: ToolTier;
  miningSpeedMultiplier?: number;
  maxDurability?: number;
  attackDamage?: number;

  // Food properties
  foodRestore?: number;
  saturationRestore?: number;

  // Armor properties
  armorDefense?: number;

  // Icon rendering colors for non-block items
  iconColors?: {
    primary: string;
    secondary: string;
    accent?: string;
    shape:
      | 'PICKAXE'
      | 'AXE'
      | 'SHOVEL'
      | 'SWORD'
      | 'STICK'
      | 'INGOT'
      | 'ORE_CHUNK'
      | 'CRYSTAL'
      | 'FOOD_BERRY'
      | 'FOOD_MEAT'
      | 'FOOD_BREAD'
      | 'ARMOR'
      | 'FEATHER'
      | 'COAL';
  };
}

export interface InventorySlot {
  itemId: number;
  count: number;
  durability?: number;
}

export interface CraftingIngredient {
  itemId: number;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'BUILDING' | 'TOOLS' | 'SURVIVAL' | 'MATERIALS';
  type?: 'SHAPED' | 'SHAPELESS';
  gridSize?: 2 | 3;
  pattern?: Array<Array<number | null>>;
  shapelessIngredients?: number[];
  unlockItems?: number[];
  ingredients: CraftingIngredient[];
  output: {
    itemId: number;
    count: number;
  };
  requiresWorkbench?: boolean;
  description: string;
}

export interface SmeltingRecipe {
  inputItemId: number;
  outputItemId: number;
  smeltTimeSeconds: number;
}

export interface ContainerState {
  type: 'CHEST' | 'FURNACE';
  slots: Array<InventorySlot | null>;
  smeltProgress?: number; // 0..1
  fuelRemaining?: number; // seconds left
  maxFuelTime?: number; // total burn duration of current fuel item
}

export type CreatureType =
  | 'MEADOW_SHEEP'
  | 'FOREST_HOPPER'
  | 'SKYWING_BIRD'
  | 'SHADOW_STALKER'
  | 'FROST_RUNNER'
  | 'VOID_SENTINEL';

export interface CreatureEntity {
  id: string;
  type: CreatureType;
  name: string;
  hostile: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  health: number;
  maxHealth: number;
  speed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  aiState: 'IDLE' | 'ROAM' | 'CHASE' | 'FLEE' | 'ATTACK';
  stateTimer: number;
  targetYaw: number;
  hurtTimer: number;
  animPhase: number;
  onGround: boolean;
}

export interface DroppedItemEntity {
  id: string;
  itemId: number;
  count: number;
  durability?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  createdAt: number;
  pickupDelay: number;
}

export interface KeyBindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  sprint: string;
  crouch: string;
  inventory: string;
  drop: string;
}

export interface KubekCraftSettings {
  graphicsPreset: GraphicsPreset;
  renderDistance: number; // 2 to 6 chunks radius
  shadowsEnabled: boolean;
  ambientParticles: boolean;
  fov: number;
  mouseSensitivity: number;
  invertMouseY: boolean;
  uiScale: number;
  showFps: boolean;
  showCoordinates: boolean;
  showBiome: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  autosaveIntervalSec: number;
  keyBindings: KeyBindings;
}

export interface PickupToast {
  id: string;
  itemId: number;
  name: string;
  count: number;
  timestamp: number;
}

export interface RaycastHitResult {
  blockX: number;
  blockY: number;
  blockZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  placeX: number;
  placeY: number;
  placeZ: number;
  blockId: number;
  distance: number;
}
