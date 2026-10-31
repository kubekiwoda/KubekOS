/**
 * KubekCraft — World Persistence, Chunk Delta Storage & Import/Export Manager
 * Uses IndexedDB (osDb.kubekcraftWorlds & osDb.kubekcraftChunks) + KubekOS VFS mirror.
 */

import { osDb, type KubekCraftChunkDeltaRecord, type KubekCraftWorldRecord } from '@/vfs/db';
import { useVfsStore } from '@/vfs/vfsStore';
import {
  INITIAL_DISCOVERED_RECIPE_IDS,
  createInitialInventory,
  discoverRecipesFromItems,
} from './CraftingManager';
import { hashSeedString } from './Noise';
import { TerrainGenerator } from './TerrainGenerator';
import type { DifficultyLevel, GameMode, KubekCraftSettings, TerrainType } from './types';

export const CURRENT_SAVE_VERSION = 2;
const SETTINGS_KV_KEY = 'kubekcraft_user_settings_v1';

export const DEFAULT_KUBEKCRAFT_SETTINGS: KubekCraftSettings = {
  graphicsPreset: 'HIGH',
  renderDistance: 3,
  shadowsEnabled: true,
  ambientParticles: true,
  fov: 75,
  mouseSensitivity: 0.0022,
  invertMouseY: false,
  uiScale: 1.0,
  showFps: true,
  showCoordinates: true,
  showBiome: true,
  masterVolume: 0.75,
  musicVolume: 0.45,
  sfxVolume: 0.85,
  muted: false,
  autosaveIntervalSec: 20,
  keyBindings: {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    sprint: 'ShiftLeft',
    crouch: 'ControlLeft',
    inventory: 'KeyE',
    drop: 'KeyQ',
  },
};

export interface ExportedKubekCraftWorldBundle {
  format: 'KUBEKCRAFT_WORLD_BUNDLE';
  saveVersion: number;
  exportedAt: string;
  world: KubekCraftWorldRecord;
  chunks: Array<{ cx: number; cz: number; edits: Array<[number, number]> }>;
}

export async function loadGameSettings(): Promise<KubekCraftSettings> {
  try {
    const rec = await osDb.kvSettings.get(SETTINGS_KV_KEY);
    if (rec && typeof rec.value === 'object' && rec.value !== null) {
      return {
        ...DEFAULT_KUBEKCRAFT_SETTINGS,
        ...(rec.value as Partial<KubekCraftSettings>),
        keyBindings: {
          ...DEFAULT_KUBEKCRAFT_SETTINGS.keyBindings,
          ...((rec.value as Partial<KubekCraftSettings>).keyBindings ?? {}),
        },
      };
    }
  } catch {
    // Fallback to defaults
  }
  return { ...DEFAULT_KUBEKCRAFT_SETTINGS };
}

export async function saveGameSettings(settings: KubekCraftSettings): Promise<void> {
  try {
    await osDb.kvSettings.put({
      key: SETTINGS_KV_KEY,
      value: settings,
      updatedAt: Date.now(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export async function listSavedWorlds(): Promise<KubekCraftWorldRecord[]> {
  try {
    const all = await osDb.kubekcraftWorlds.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function createNewWorldRecord(params: {
  name: string;
  seed?: string;
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  terrainType: TerrainType;
  generateCaves: boolean;
  generateStructures: boolean;
  keepInventory: boolean;
}): Promise<KubekCraftWorldRecord> {
  const cleanName = params.name.trim() || `New Frontier ${Math.floor(Math.random() * 900 + 100)}`;
  const seedStr =
    params.seed && params.seed.trim().length > 0
      ? params.seed.trim()
      : `KUBEK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const numericSeed = hashSeedString(seedStr);

  const tempGen = new TerrainGenerator({
    numericSeed,
    terrainType: params.terrainType,
    generateCaves: params.generateCaves,
    generateStructures: params.generateStructures,
  });

  // Find a safe land spawn near (8, 8)
  let spawnX = 8.5;
  let spawnZ = 8.5;
  for (let r = 0; r <= 48; r += 8) {
    const col = tempGen.sampleColumnInfo(r, r);
    if (col.biome !== 'OCEAN' && col.biome !== 'RIVER') {
      spawnX = r + 0.5;
      spawnZ = r + 0.5;
      break;
    }
  }
  const spawnY = tempGen.getSpawnHeight(Math.floor(spawnX), Math.floor(spawnZ));

  const now = Date.now();
  const id = `world_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const record: KubekCraftWorldRecord = {
    id,
    name: cleanName,
    seed: seedStr,
    numericSeed,
    saveVersion: CURRENT_SAVE_VERSION,
    gameMode: params.gameMode,
    difficulty: params.difficulty,
    terrainType: params.terrainType,
    generateCaves: params.generateCaves,
    generateStructures: params.generateStructures,
    keepInventory: params.keepInventory,
    worldTime: 6000, // Start at bright morning/noon
    dayCount: 1,
    weather: 'CLEAR',
    player: {
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      yaw: 0,
      pitch: 0,
      health: 20,
      maxHealth: 20,
      hunger: 20,
      saturation: 10,
      armor: 0,
      isFlying: false,
      selectedHotbarSlot: 0,
      spawnPoint: { x: spawnX, y: spawnY, z: spawnZ },
    },
    inventory: createInitialInventory(params.gameMode),
    armorSlot: null,
    discoveredRecipes: [...INITIAL_DISCOVERED_RECIPE_IDS],
    containers: {},
    createdAt: now,
    updatedAt: now,
  };

  await osDb.kubekcraftWorlds.put(record);
  await syncWorldSummaryToVfs(record);
  return record;
}

export async function saveWorldState(
  world: KubekCraftWorldRecord,
  chunkDeltas: Array<{ cx: number; cz: number; edits: Array<[number, number]> }>
): Promise<void> {
  const now = Date.now();
  const updatedWorld: KubekCraftWorldRecord = {
    ...world,
    saveVersion: CURRENT_SAVE_VERSION,
    updatedAt: now,
  };

  await osDb.kubekcraftWorlds.put(updatedWorld);

  if (chunkDeltas.length > 0) {
    const records: KubekCraftChunkDeltaRecord[] = chunkDeltas.map((d) => ({
      id: `${world.id}:${d.cx}:${d.cz}`,
      worldId: world.id,
      cx: d.cx,
      cz: d.cz,
      edits: d.edits,
      updatedAt: now,
    }));
    await osDb.kubekcraftChunks.bulkPut(records);
  }

  await syncWorldSummaryToVfs(updatedWorld);
}

export async function loadWorldWithChunks(worldId: string): Promise<{
  world: KubekCraftWorldRecord;
  chunks: Array<{ cx: number; cz: number; edits: Array<[number, number]> }>;
} | null> {
  const world = await osDb.kubekcraftWorlds.get(worldId);
  if (!world) return null;

  const chunkRecords = await osDb.kubekcraftChunks.where('worldId').equals(worldId).toArray();
  return {
    world: migrateWorldRecord(world),
    chunks: chunkRecords.map((c) => ({
      cx: c.cx,
      cz: c.cz,
      edits: c.edits,
    })),
  };
}

export async function renameSavedWorld(worldId: string, newName: string): Promise<void> {
  const world = await osDb.kubekcraftWorlds.get(worldId);
  if (!world) return;
  const clean = newName.trim();
  if (!clean) return;
  world.name = clean;
  world.updatedAt = Date.now();
  await osDb.kubekcraftWorlds.put(world);
  await syncWorldSummaryToVfs(world);
}

export async function deleteSavedWorld(worldId: string): Promise<void> {
  await osDb.kubekcraftWorlds.delete(worldId);
  await osDb.kubekcraftChunks.where('worldId').equals(worldId).delete();
}

export async function exportWorldToBundleJson(worldId: string): Promise<string> {
  const loaded = await loadWorldWithChunks(worldId);
  if (!loaded) {
    throw new Error('World not found in database.');
  }
  const bundle: ExportedKubekCraftWorldBundle = {
    format: 'KUBEKCRAFT_WORLD_BUNDLE',
    saveVersion: CURRENT_SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    world: loaded.world,
    chunks: loaded.chunks,
  };
  return JSON.stringify(bundle, null, 2);
}

export async function importWorldFromBundleJson(
  jsonText: string
): Promise<KubekCraftWorldRecord> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON file. Could not parse KubekCraft world bundle.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { format?: string }).format !== 'KUBEKCRAFT_WORLD_BUNDLE'
  ) {
    throw new Error('Unrecognized file format. Expected KUBEKCRAFT_WORLD_BUNDLE.');
  }

  const bundle = parsed as ExportedKubekCraftWorldBundle;
  if (typeof bundle.saveVersion === 'number' && bundle.saveVersion > CURRENT_SAVE_VERSION) {
    throw new Error(
      `Unsupported save version v${bundle.saveVersion} (current runtime supports up to v${CURRENT_SAVE_VERSION}).`
    );
  }

  if (!bundle.world || typeof bundle.world.name !== 'string') {
    throw new Error('Corrupted world metadata in imported file.');
  }

  const now = Date.now();
  const newId = `world_imp_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const migrated = migrateWorldRecord({
    ...bundle.world,
    id: newId,
    name: `${bundle.world.name} (Imported)`,
    updatedAt: now,
  });

  await saveWorldState(migrated, Array.isArray(bundle.chunks) ? bundle.chunks : []);
  return migrated;
}

export function migrateWorldRecord(raw: KubekCraftWorldRecord): KubekCraftWorldRecord {
  const ownedItemIds = (raw.inventory ?? [])
    .filter((s): s is NonNullable<typeof s> => Boolean(s && s.itemId > 0))
    .map((s) => s.itemId);
  const discovered = discoverRecipesFromItems(
    ownedItemIds,
    raw.discoveredRecipes ?? INITIAL_DISCOVERED_RECIPE_IDS
  ).updatedDiscovered;

  const rawContainers = raw.containers ?? {};
  const migratedContainers: KubekCraftWorldRecord['containers'] = {};
  for (const [key, c] of Object.entries(rawContainers)) {
    migratedContainers[key] = {
      ...c,
      smeltProgress: typeof c.smeltProgress === 'number' ? c.smeltProgress : 0,
      fuelRemaining: typeof c.fuelRemaining === 'number' ? c.fuelRemaining : 0,
      maxFuelTime:
        typeof c.maxFuelTime === 'number'
          ? c.maxFuelTime
          : typeof c.fuelRemaining === 'number' && c.fuelRemaining > 0
            ? c.fuelRemaining
            : 0,
    };
  }

  return {
    ...raw,
    saveVersion: CURRENT_SAVE_VERSION,
    gameMode: raw.gameMode ?? 'SURVIVAL',
    difficulty: raw.difficulty ?? 'NORMAL',
    terrainType: raw.terrainType ?? 'STANDARD',
    generateCaves: raw.generateCaves ?? true,
    generateStructures: raw.generateStructures ?? true,
    keepInventory: raw.keepInventory ?? false,
    worldTime: typeof raw.worldTime === 'number' ? raw.worldTime : 6000,
    dayCount: typeof raw.dayCount === 'number' ? raw.dayCount : 1,
    weather: raw.weather ?? 'CLEAR',
    discoveredRecipes: discovered,
    containers: migratedContainers,
  };
}

async function syncWorldSummaryToVfs(world: KubekCraftWorldRecord): Promise<void> {
  try {
    const vfs = useVfsStore.getState();
    const dirPath = '/KubekOS/Documents/KubekCraft';
    if (!vfs.getNode(dirPath)) {
      await vfs.createDirectory('/KubekOS/Documents', 'KubekCraft');
    }
    const safeFileName = `${world.id}.json`;
    const summaryJson = JSON.stringify(
      {
        id: world.id,
        name: world.name,
        seed: world.seed,
        gameMode: world.gameMode,
        difficulty: world.difficulty,
        dayCount: world.dayCount,
        playerPosition: {
          x: Math.round(world.player.x),
          y: Math.round(world.player.y),
          z: Math.round(world.player.z),
        },
        updatedAt: new Date(world.updatedAt).toISOString(),
      },
      null,
      2
    );
    await vfs.writeFile(`${dirPath}/${safeFileName}`, summaryJson);
  } catch {
    // Non-fatal VFS mirror error
  }
}
