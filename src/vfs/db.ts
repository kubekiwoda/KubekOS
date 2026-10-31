/**
 * KubekOS IndexedDB Persistence Layer (Dexie.js)
 * Manages schema versioning, safe migrations, and storage tables for VFS, Calendar, and Settings.
 */

import Dexie, { type Table } from 'dexie';
import type { VfsNode } from '@/types/os';

export interface CalendarEventRecord {
  id: string;
  title: string;
  dateIso: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: 'WORK' | 'PERSONAL' | 'SYSTEM';
  notes: string;
  createdAt: number;
}

export interface KeyValueSettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface KubekCraftWorldRecord {
  id: string;
  name: string;
  seed: string;
  numericSeed: number;
  saveVersion: number;
  gameMode: 'SURVIVAL' | 'CREATIVE' | 'PEACEFUL';
  difficulty: 'PEACEFUL' | 'EASY' | 'NORMAL' | 'HARD';
  terrainType: 'STANDARD' | 'AMPLIFIED' | 'FLAT' | 'ISLANDS';
  generateCaves: boolean;
  generateStructures: boolean;
  keepInventory: boolean;
  worldTime: number; // 0..24000 ticks (6000 = noon, 18000 = midnight)
  dayCount: number;
  weather: 'CLEAR' | 'RAIN' | 'SNOW';
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    maxHealth: number;
    hunger: number;
    saturation: number;
    armor: number;
    isFlying: boolean;
    selectedHotbarSlot: number;
    spawnPoint: { x: number; y: number; z: number };
  };
  inventory: Array<{ itemId: number; count: number; durability?: number } | null>;
  armorSlot: { itemId: number; count: number; durability?: number } | null;
  discoveredRecipes?: string[];
  containers: Record<
    string,
    {
      type: 'CHEST' | 'FURNACE';
      slots: Array<{ itemId: number; count: number; durability?: number } | null>;
      smeltProgress?: number;
      fuelRemaining?: number;
      maxFuelTime?: number;
    }
  >;
  createdAt: number;
  updatedAt: number;
}

export interface KubekCraftChunkDeltaRecord {
  id: string; // `${worldId}:${cx}:${cz}`
  worldId: string;
  cx: number;
  cz: number;
  edits: Array<[number, number]>; // [localIndex, blockId]
  updatedAt: number;
}

export class KubekOsDatabase extends Dexie {
  public vfsNodes!: Table<VfsNode, string>;
  public calendarEvents!: Table<CalendarEventRecord, string>;
  public kvSettings!: Table<KeyValueSettingRecord, string>;
  public kubekcraftWorlds!: Table<KubekCraftWorldRecord, string>;
  public kubekcraftChunks!: Table<KubekCraftChunkDeltaRecord, string>;

  constructor() {
    super('KubekOS_PersistentDB');

    this.version(1).stores({
      vfsNodes: 'id, &path, parentPath, name, type, isTrashed',
      calendarEvents: 'id, dateIso, category',
      kvSettings: 'key',
    });

    this.version(2).stores({
      vfsNodes: 'id, &path, parentPath, name, type, isTrashed',
      calendarEvents: 'id, dateIso, category',
      kvSettings: 'key',
      kubekcraftWorlds: 'id, name, updatedAt, createdAt',
      kubekcraftChunks: 'id, worldId, [worldId+cx+cz]',
    });
  }
}

export const osDb = new KubekOsDatabase();
