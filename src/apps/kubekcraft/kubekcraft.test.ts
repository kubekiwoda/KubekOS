import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  BLOCK_IDS,
  ITEM_IDS,
  calculateBlockBreakDuration,
  canHarvestBlockDrop,
  getBlockDrops,
  getItemDef,
  isCollidableBlock,
  isOpaqueCube,
} from './BlockRegistry';
import { hashSeedString } from './Noise';
import { TerrainGenerator } from './TerrainGenerator';
import { ChunkManager } from './ChunkManager';
import { buildChunkGeometry } from './ChunkMesher';
import {
  raycastVoxel,
  stepPlayerPhysics,
  wouldBlockOverlapPlayer,
  type PlayerKinematics,
} from './PlayerPhysics';
import {
  CRAFTING_RECIPES,
  addItemToInventory,
  canCraftRecipe,
  consumeCraftingGridIngredients,
  countItemInInventory,
  createInitialInventory,
  discoverRecipesFromItems,
  executeCraftRecipe,
  findSmeltingRecipe,
  matchCraftingGrid,
  populateCraftingGridFromInventory,
  returnGridItemsToInventory,
  tickFurnaceContainer,
} from './CraftingManager';
import {
  CURRENT_SAVE_VERSION,
  createNewWorldRecord,
  deleteSavedWorld,
  exportWorldToBundleJson,
  importWorldFromBundleJson,
  listSavedWorlds,
  loadWorldWithChunks,
  migrateWorldRecord,
  renameSavedWorld,
  saveWorldState,
} from './WorldSaveManager';
import { KubekCraftApp } from './KubekCraftApp';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useWindowStore } from '@/wm/windowStore';
import type { ContainerState, InventorySlot } from './types';

describe('KubekCraft — 3D Voxel Sandbox Engine & KubekOS Integration', () => {
  beforeEach(() => {
    useWindowStore.getState().closeAllWindows();
  });

  it('registers KubekCraft in the KubekOS Application Registry under GAMES category', () => {
    const manifest = useAppRegistryStore.getState().getManifest('kubekcraft');
    expect(manifest).toBeDefined();
    expect(manifest?.name).toBe('KubekCraft');
    expect(manifest?.category).toBe('GAMES');
    expect(manifest?.description).toBe(
      'Explore, build, survive and create your own voxel worlds in a fully interactive 3D sandbox.'
    );

    const winId = useWindowStore.getState().openWindow('kubekcraft');
    expect(winId).toBeTruthy();
    expect(useWindowStore.getState().activeWindowId).toBe(winId);
  });

  it('produces deterministic terrain, biomes, and underground chunks from a seed', () => {
    const seedNum = hashSeedString('KUBEK-SEED-ALPHA');
    const genA = new TerrainGenerator({
      numericSeed: seedNum,
      terrainType: 'STANDARD',
      generateCaves: true,
      generateStructures: true,
    });
    const genB = new TerrainGenerator({
      numericSeed: seedNum,
      terrainType: 'STANDARD',
      generateCaves: true,
      generateStructures: true,
    });

    const colA = genA.sampleColumnInfo(24, -18);
    const colB = genB.sampleColumnInfo(24, -18);
    expect(colA).toEqual(colB);

    const chunkA = genA.generateChunkData(0, 0);
    const chunkB = genB.generateChunkData(0, 0);
    expect(chunkA.length).toBe(16 * 64 * 16);
    expect(Array.from(chunkA)).toEqual(Array.from(chunkB));

    // Verify bedrock floor at y=0
    expect(chunkA[0]).toBe(BLOCK_IDS.BEDROCK);
  });

  it('calculates block mining durations and enforces tool tier requirements for drops', () => {
    const stoneDef = getItemDef(BLOCK_IDS.STONE);
    expect(stoneDef.preferredTool).toBe('PICKAXE');
    expect(isCollidableBlock(BLOCK_IDS.STONE)).toBe(true);
    expect(isOpaqueCube(BLOCK_IDS.STONE)).toBe(true);
    expect(isCollidableBlock(BLOCK_IDS.WATER)).toBe(false);

    const handTime = calculateBlockBreakDuration(BLOCK_IDS.STONE, null, false);
    const woodPickTime = calculateBlockBreakDuration(
      BLOCK_IDS.STONE,
      ITEM_IDS.WOOD_PICKAXE,
      false
    );
    const crystalPickTime = calculateBlockBreakDuration(
      BLOCK_IDS.STONE,
      ITEM_IDS.CRYSTAL_PICKAXE,
      false
    );
    const creativeTime = calculateBlockBreakDuration(BLOCK_IDS.STONE, null, true);

    expect(woodPickTime).toBeLessThan(handTime);
    expect(crystalPickTime).toBeLessThan(woodPickTime);
    expect(creativeTime).toBe(0.05);

    // Tool & Resource Tier Enforcement
    // 1. Bare hands can harvest Wood Logs, Dirt, Leaves, Sand — but NOT Stone or Ores
    expect(canHarvestBlockDrop(BLOCK_IDS.OAK_LOG, null)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.DIRT, null)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.STONE, null)).toBe(false);
    expect(getBlockDrops(BLOCK_IDS.STONE, null)).toEqual([]);
    expect(canHarvestBlockDrop(BLOCK_IDS.COAL_ORE, null)).toBe(false);

    // 2. Wooden Pickaxe (tier 1) harvests Stone & Coal Ore, but NOT Copper/Iron/Gold/Crystal
    expect(canHarvestBlockDrop(BLOCK_IDS.STONE, ITEM_IDS.WOOD_PICKAXE)).toBe(true);
    expect(getBlockDrops(BLOCK_IDS.STONE, ITEM_IDS.WOOD_PICKAXE)).toEqual([
      { itemId: BLOCK_IDS.COBBLESTONE, count: 1 },
    ]);
    expect(canHarvestBlockDrop(BLOCK_IDS.COAL_ORE, ITEM_IDS.WOOD_PICKAXE)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.COPPER_ORE, ITEM_IDS.WOOD_PICKAXE)).toBe(false);
    expect(canHarvestBlockDrop(BLOCK_IDS.IRON_ORE, ITEM_IDS.WOOD_PICKAXE)).toBe(false);

    // 3. Stone Pickaxe (tier 2) harvests Copper & Iron Ore, but NOT Gold or Crystal Ore
    expect(canHarvestBlockDrop(BLOCK_IDS.COPPER_ORE, ITEM_IDS.STONE_PICKAXE)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.IRON_ORE, ITEM_IDS.STONE_PICKAXE)).toBe(true);
    expect(getBlockDrops(BLOCK_IDS.IRON_ORE, ITEM_IDS.STONE_PICKAXE)).toEqual([
      { itemId: ITEM_IDS.RAW_IRON, count: 1 },
    ]);
    expect(canHarvestBlockDrop(BLOCK_IDS.GOLD_ORE, ITEM_IDS.STONE_PICKAXE)).toBe(false);
    expect(canHarvestBlockDrop(BLOCK_IDS.CRYSTAL_ORE, ITEM_IDS.STONE_PICKAXE)).toBe(false);

    // 4. Iron Pickaxe (tier 3) harvests Gold Ore, Obsidian & Crystal Ore
    expect(canHarvestBlockDrop(BLOCK_IDS.GOLD_ORE, ITEM_IDS.IRON_PICKAXE)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.CRYSTAL_ORE, ITEM_IDS.IRON_PICKAXE)).toBe(true);
    expect(canHarvestBlockDrop(BLOCK_IDS.OBSIDIAN, ITEM_IDS.IRON_PICKAXE)).toBe(true);
  });

  it('starts new Survival and Peaceful worlds with a completely empty inventory while Creative retains starter items', () => {
    const survivalInv = createInitialInventory('SURVIVAL');
    expect(survivalInv).toHaveLength(36);
    expect(survivalInv.every((slot) => slot === null)).toBe(true);

    const peacefulInv = createInitialInventory('PEACEFUL');
    expect(peacefulInv).toHaveLength(36);
    expect(peacefulInv.every((slot) => slot === null)).toBe(true);

    const creativeInv = createInitialInventory('CREATIVE');
    expect(creativeInv).toHaveLength(36);
    expect(creativeInv.some((slot) => slot !== null)).toBe(true);
  });

  it('matches 2x2 and 3x3 shaped, shapeless, translated, and mirrored recipes and rejects invalid arrangements', () => {
    // 1. Shapeless 2x2: 1 Oak Log in any slot -> 4 Oak Planks
    const logInBottomRight: Array<InventorySlot | null> = [
      null,
      null,
      null,
      { itemId: BLOCK_IDS.OAK_LOG, count: 2 },
    ];
    const planksMatch = matchCraftingGrid(logInBottomRight, 2);
    expect(planksMatch?.output).toEqual({ itemId: BLOCK_IDS.OAK_PLANKS, count: 4 });

    // Consume 1 ingredient from grid
    const afterConsume = consumeCraftingGridIngredients(logInBottomRight);
    expect(afterConsume[3]?.count).toBe(1);

    // 2. Shaped 2x2: 2 Planks vertically in left or right column -> 4 Sticks
    const sticksRightCol: Array<InventorySlot | null> = [
      null,
      { itemId: BLOCK_IDS.BIRCH_PLANKS, count: 1 },
      null,
      { itemId: BLOCK_IDS.BIRCH_PLANKS, count: 1 },
    ];
    const sticksMatch = matchCraftingGrid(sticksRightCol, 2);
    expect(sticksMatch?.output).toEqual({ itemId: ITEM_IDS.STICK, count: 4 });

    // 3. Invalid 2x2: 2 Planks horizontally -> null
    const invalidHorizontalPlanks: Array<InventorySlot | null> = [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      null,
      null,
    ];
    expect(matchCraftingGrid(invalidHorizontalPlanks, 2)).toBeNull();

    // 4. Shaped 2x2: 4 Planks -> 1 Crafting Table (WORKBENCH)
    const workbenchGrid: Array<InventorySlot | null> = [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
    ];
    expect(matchCraftingGrid(workbenchGrid, 2)?.output).toEqual({
      itemId: BLOCK_IDS.WORKBENCH,
      count: 1,
    });

    // 5. Shaped 3x3: Wooden Pickaxe
    const woodPickGrid: Array<InventorySlot | null> = [
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      { itemId: BLOCK_IDS.OAK_PLANKS, count: 1 },
      null,
      { itemId: ITEM_IDS.STICK, count: 1 },
      null,
      null,
      { itemId: ITEM_IDS.STICK, count: 1 },
      null,
    ];
    const pickMatch = matchCraftingGrid(woodPickGrid, 3);
    expect(pickMatch?.output.itemId).toBe(ITEM_IDS.WOOD_PICKAXE);
    expect(pickMatch?.output.durability).toBe(60);

    // 6. Mirrored 3x3: Stone Axe facing right vs left
    const mirroredStoneAxeGrid: Array<InventorySlot | null> = [
      null,
      { itemId: BLOCK_IDS.COBBLESTONE, count: 1 },
      { itemId: BLOCK_IDS.COBBLESTONE, count: 1 },
      null,
      { itemId: ITEM_IDS.STICK, count: 1 },
      { itemId: BLOCK_IDS.COBBLESTONE, count: 1 },
      null,
      { itemId: ITEM_IDS.STICK, count: 1 },
      null,
    ];
    expect(matchCraftingGrid(mirroredStoneAxeGrid, 3)?.output.itemId).toBe(
      ITEM_IDS.STONE_AXE
    );

    // 7. Tool Durability Repair: 2 damaged Wooden Pickaxes -> 1 repaired Wooden Pickaxe
    const repairGrid: Array<InventorySlot | null> = [
      { itemId: ITEM_IDS.WOOD_PICKAXE, count: 1, durability: 20 },
      null,
      { itemId: ITEM_IDS.WOOD_PICKAXE, count: 1, durability: 25 },
      null,
    ];
    const repairMatch = matchCraftingGrid(repairGrid, 2);
    expect(repairMatch?.isRepair).toBe(true);
    expect(repairMatch?.output.itemId).toBe(ITEM_IDS.WOOD_PICKAXE);
    expect(repairMatch?.output.durability).toBe(51); // 20 + 25 + 10% of 60 (6)
  });

  it('completes the full early-game survival progression from empty inventory to Iron & Gold tools', () => {
    let inv = createInitialInventory('SURVIVAL');
    expect(inv.every((s) => s === null)).toBe(true);

    // Step 1: Punch tree -> collect 3 Oak Logs
    inv = addItemToInventory(inv, BLOCK_IDS.OAK_LOG, 3).updatedSlots;

    // Step 2: Convert 3 Oak Logs -> 12 Oak Planks in 2x2 grid
    const planksRecipe = CRAFTING_RECIPES.find((r) => r.id === 'oak_planks')!;
    for (let i = 0; i < 3; i++) {
      const pop = populateCraftingGridFromInventory(inv, [null, null, null, null], 2, planksRecipe);
      expect(pop.placed).toBe(true);
      const match = matchCraftingGrid(pop.updatedGrid, 2);
      expect(match?.output.itemId).toBe(BLOCK_IDS.OAK_PLANKS);
      inv = addItemToInventory(
        pop.updatedInventory,
        match!.output.itemId,
        match!.output.count
      ).updatedSlots;
    }
    expect(countItemInInventory(inv, BLOCK_IDS.OAK_PLANKS)).toBe(12);

    // Step 3: Craft 4 Sticks (2 Planks in 2x2) & 1 Crafting Table (4 Planks in 2x2)
    const sticksRecipe = CRAFTING_RECIPES.find((r) => r.id === 'sticks_from_oak')!;
    const workbenchRecipe = CRAFTING_RECIPES.find((r) => r.id === 'workbench')!;
    inv = executeCraftRecipe(inv, sticksRecipe, false)!;
    inv = executeCraftRecipe(inv, workbenchRecipe, false)!;
    expect(countItemInInventory(inv, ITEM_IDS.STICK)).toBe(4);
    expect(countItemInInventory(inv, BLOCK_IDS.WORKBENCH)).toBe(1);

    // Step 4: Wooden Pickaxe requires 3x3 Crafting Table (cannot craft in 2x2)
    const woodPickRecipe = CRAFTING_RECIPES.find((r) => r.id === 'wood_pickaxe')!;
    expect(canCraftRecipe(inv, woodPickRecipe, false)).toBe(false);
    expect(canCraftRecipe(inv, woodPickRecipe, true)).toBe(true);
    inv = executeCraftRecipe(inv, woodPickRecipe, true)!;
    expect(countItemInInventory(inv, ITEM_IDS.WOOD_PICKAXE)).toBe(1);

    // Step 5: Mine 11 Stone & 2 Coal Ore using Wooden Pickaxe -> 11 Cobblestone & 2 Coal
    for (let i = 0; i < 11; i++) {
      const drops = getBlockDrops(BLOCK_IDS.STONE, ITEM_IDS.WOOD_PICKAXE);
      inv = addItemToInventory(inv, drops[0]!.itemId, drops[0]!.count).updatedSlots;
    }
    for (let i = 0; i < 2; i++) {
      const drops = getBlockDrops(BLOCK_IDS.COAL_ORE, ITEM_IDS.WOOD_PICKAXE);
      inv = addItemToInventory(inv, drops[0]!.itemId, drops[0]!.count).updatedSlots;
    }

    // Step 6: Craft Furnace (8 Cobblestone) & Stone Pickaxe (3 Cobblestone + 2 Sticks) in 3x3
    const furnaceRecipe = CRAFTING_RECIPES.find((r) => r.id === 'furnace')!;
    const stonePickRecipe = CRAFTING_RECIPES.find((r) => r.id === 'stone_pickaxe')!;
    inv = executeCraftRecipe(inv, furnaceRecipe, true)!;
    inv = executeCraftRecipe(inv, stonePickRecipe, true)!;
    expect(countItemInInventory(inv, BLOCK_IDS.FURNACE)).toBe(1);
    expect(countItemInInventory(inv, ITEM_IDS.STONE_PICKAXE)).toBe(1);

    // Step 7: Mine 3 Iron Ore with Stone Pickaxe -> 3 Raw Iron, and smelt in Furnace over time
    let furnaceState: ContainerState = {
      type: 'FURNACE',
      slots: [
        { itemId: ITEM_IDS.RAW_IRON, count: 3 },
        { itemId: ITEM_IDS.COAL, count: 1 },
        null,
      ],
      smeltProgress: 0,
      fuelRemaining: 0,
      maxFuelTime: 0,
    };

    // Simulate 13 seconds of furnace smelting (Raw Iron takes 4s each; 1 Coal burns for 24s)
    for (let step = 0; step < 26; step++) {
      furnaceState = tickFurnaceContainer(furnaceState, 0.5).updated;
    }
    expect(furnaceState.slots[0]).toBeNull();
    expect(furnaceState.slots[2]).toEqual({ itemId: ITEM_IDS.IRON_INGOT, count: 3 });
    expect(furnaceState.fuelRemaining).toBeGreaterThan(0);

    // Step 8: Collect 3 Iron Ingots & more Sticks -> craft Iron Pickaxe
    inv = addItemToInventory(inv, ITEM_IDS.IRON_INGOT, 3).updatedSlots;
    inv = executeCraftRecipe(inv, sticksRecipe, true)!;
    const ironPickRecipe = CRAFTING_RECIPES.find((r) => r.id === 'iron_pickaxe')!;
    inv = executeCraftRecipe(inv, ironPickRecipe, true)!;
    expect(countItemInInventory(inv, ITEM_IDS.IRON_PICKAXE)).toBe(1);

    // Verify recipe discovery unlocked Iron recipes
    const disc = discoverRecipesFromItems([ITEM_IDS.IRON_INGOT], []);
    expect(disc.updatedDiscovered).toContain('iron_pickaxe');
    expect(disc.updatedDiscovered).toContain('iron_cuirass');
  });

  it('builds culled chunk geometry and tracks modified chunk deltas accurately', () => {
    const gen = new TerrainGenerator({
      numericSeed: 424242,
      terrainType: 'FLAT',
      generateCaves: false,
      generateStructures: false,
    });
    const cm = new ChunkManager(gen);

    cm.prebuildSpawnArea(8, 8, 1);
    expect(cm.getLoadedChunkCount()).toBeGreaterThan(0);

    // Flat world has surface at y=24
    expect(cm.getBlock(8, 24, 8)).toBe(BLOCK_IDS.GRASS);
    expect(cm.getBlock(8, 25, 8)).toBe(BLOCK_IDS.AIR);

    // Place a block at (8, 25, 8) and break (8, 24, 8)
    expect(cm.setBlock(8, 25, 8, BLOCK_IDS.BRICKS)).toBe(true);
    expect(cm.getBlock(8, 25, 8)).toBe(BLOCK_IDS.BRICKS);

    expect(cm.setBlock(8, 24, 8, BLOCK_IDS.AIR)).toBe(true);
    expect(cm.getBlock(8, 24, 8)).toBe(BLOCK_IDS.AIR);

    const deltas = cm.exportModifiedChunkDeltas();
    expect(deltas.length).toBe(1);
    expect(deltas[0]?.edits.length).toBe(2);

    const buffers = buildChunkGeometry(0, 0, (wx, wy, wz) => cm.getBlock(wx, wy, wz));
    expect(buffers.opaqueGeometry).not.toBeNull();

    cm.disposeAll();
  });

  it('simulates player physics, collision, and 3D DDA block raycasting', () => {
    const getBlock = (_wx: number, wy: number, _wz: number) =>
      wy <= 10 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR;

    const player: PlayerKinematics = {
      x: 5.5,
      y: 12.0,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: false,
      inWater: false,
      isSprinting: false,
      isCrouching: false,
      isFlying: false,
      fallDistance: 0,
      stepDistanceAccum: 0,
    };

    // Step physics until player lands on y=11 (top of stone at y=10)
    for (let i = 0; i < 30; i++) {
      stepPlayerPhysics(
        player,
        {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: true,
          crouch: false,
        },
        0.05,
        getBlock
      );
    }

    expect(player.onGround).toBe(true);
    expect(player.y).toBeCloseTo(11.0, 1);
    expect(player.z).toBeLessThan(5.5); // Moved forward along -Z

    // Check overlap prevention for placing block inside player
    expect(
      wouldBlockOverlapPlayer(
        Math.floor(player.x),
        Math.floor(player.y),
        Math.floor(player.z),
        player
      )
    ).toBe(true);

    // Raycast straight down from eye height
    const hit = raycastVoxel(player.x, player.y + 1.56, player.z, 0, -1, 0, 5, getBlock);
    expect(hit).not.toBeNull();
    expect(hit?.blockY).toBe(10);
    expect(hit?.placeY).toBe(11);
    expect(hit?.blockId).toBe(BLOCK_IDS.STONE);
  });

  it('creates, saves, loads, migrates v1->v2 worlds, exports, imports, and deletes worlds in IndexedDB', async () => {
    const world = await createNewWorldRecord({
      name: 'Persistence Test World',
      seed: 'TEST-SEED-99',
      gameMode: 'SURVIVAL',
      difficulty: 'NORMAL',
      terrainType: 'STANDARD',
      generateCaves: true,
      generateStructures: true,
      keepInventory: true,
    });

    expect(world.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(world.inventory.every((s) => s === null)).toBe(true);

    // Verify v1 -> v2 migration preserves existing saved inventory and populates discoveredRecipes
    const legacyV1World = {
      ...world,
      saveVersion: 1,
      inventory: [
        { itemId: ITEM_IDS.IRON_INGOT, count: 4 },
        ...new Array(35).fill(null),
      ],
      discoveredRecipes: undefined,
    };
    const migrated = migrateWorldRecord(legacyV1World);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.inventory[0]?.itemId).toBe(ITEM_IDS.IRON_INGOT);
    expect(migrated.discoveredRecipes).toContain('iron_pickaxe');

    // Return grid items helper preserves stacks without loss
    const gridReturn = returnGridItemsToInventory(migrated.inventory, [
      { itemId: BLOCK_IDS.OAK_LOG, count: 2 },
      null,
      null,
      null,
    ]);
    expect(countItemInInventory(gridReturn.updatedInventory, BLOCK_IDS.OAK_LOG)).toBe(2);
    expect(findSmeltingRecipe(ITEM_IDS.RAW_IRON)?.outputItemId).toBe(ITEM_IDS.IRON_INGOT);

    await saveWorldState(
      {
        ...world,
        player: { ...world.player, x: 42.5, y: 31, z: -19.5, health: 16 },
      },
      [{ cx: 0, cz: 0, edits: [[120, BLOCK_IDS.TORCH]] }]
    );

    const loaded = await loadWorldWithChunks(world.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.world.player.x).toBe(42.5);
    expect(loaded?.world.player.health).toBe(16);
    expect(loaded?.chunks).toHaveLength(1);
    expect(loaded?.chunks[0]?.edits[0]).toEqual([120, BLOCK_IDS.TORCH]);

    await renameSavedWorld(world.id, 'Renamed Frontier');
    const worldsAfterRename = await listSavedWorlds();
    expect(worldsAfterRename.find((w) => w.id === world.id)?.name).toBe('Renamed Frontier');

    // Export & Re-import
    const exportedJson = await exportWorldToBundleJson(world.id);
    const importedWorld = await importWorldFromBundleJson(exportedJson);
    expect(importedWorld.name).toContain('Renamed Frontier');
    expect(importedWorld.seed).toBe('TEST-SEED-99');

    // Cleanup test worlds
    await deleteSavedWorld(world.id);
    await deleteSavedWorld(importedWorld.id);
  });

  it('renders KubekCraftApp UI, creates a Survival world with empty inventory, uses 2x2 crafting grid, saves, and disposes cleanly', async () => {
    // Provide ResizeObserver stub for JSDOM
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    const { unmount } = render(React.createElement(KubekCraftApp));

    // 1. Main Menu renders
    expect(screen.getByTestId('kubekcraft-main-menu')).toBeInTheDocument();

    // 2. Navigate to Create New World
    fireEvent.click(screen.getByTestId('kubekcraft-menu-create-world'));
    expect(screen.getByTestId('kubekcraft-create-world-screen')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('kubekcraft-world-name-input'), {
      target: { value: 'UI Integration World' },
    });
    fireEvent.change(screen.getByTestId('kubekcraft-world-seed-input'), {
      target: { value: 'SEED-UI-2026' },
    });
    fireEvent.click(screen.getByTestId('kubekcraft-confirm-create-world'));

    // 3. Wait for 3D Viewport and HUD to mount
    await waitFor(
      () => {
        expect(screen.getByTestId('kubekcraft-3d-viewport')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    expect(screen.getByTestId('kubekcraft-hotbar')).toBeInTheDocument();

    // 4. Mine a block & open Inventory and 2x2 Personal Crafting Grid
    fireEvent.click(screen.getByTestId('kubekcraft-mine-target-btn'));
    fireEvent.click(screen.getByTestId('kubekcraft-open-inventory-btn'));
    expect(screen.getByTestId('kubekcraft-inventory-modal')).toBeInTheDocument();
    expect(screen.getByTestId('kubekcraft-crafting-grid-2x2')).toBeInTheDocument();
    expect(screen.getByTestId('kubekcraft-craft-result-slot')).toBeInTheDocument();

    // Close Inventory
    fireEvent.click(screen.getByTestId('kubekcraft-close-inventory-btn'));

    // 5. Pause, Save & Quit to Main Menu
    fireEvent.click(screen.getByTestId('kubekcraft-pause-btn'));
    expect(screen.getByTestId('kubekcraft-pause-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('kubekcraft-save-and-quit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('kubekcraft-main-menu')).toBeInTheDocument();
    });

    // 6. Unmount cleanly (disposing resources)
    unmount();
  });
});
