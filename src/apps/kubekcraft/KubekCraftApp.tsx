/**
 * KubekCraft — Full-Featured 3D Voxel Sandbox Survival Game for KubekOS
 * Complete integration of Three.js chunk rendering, procedural biomes & caves,
 * survival mechanics, crafting, creatures, synthesized audio, and IndexedDB persistence.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Box,
  Download,
  Edit3,
  FolderOpen,
  Gamepad2,
  Info,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useWindowStore } from '@/wm/windowStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { KubekCraftAudioManager } from './AudioManager';
import {
  BLOCK_IDS,
  calculateBlockBreakDuration,
  canHarvestBlockDrop,
  getBlockDrops,
  getItemDef,
} from './BlockRegistry';
import { ChunkManager } from './ChunkManager';
import {
  INITIAL_DISCOVERED_RECIPE_IDS,
  addItemToInventory,
  createInitialInventory,
  discoverRecipesFromItems,
  executeCraftRecipe,
  tickFurnaceContainer,
} from './CraftingManager';
import { EntityManager } from './EntityManager';
import { EnvironmentSkyManager } from './EnvironmentSky';
import { InGameHUD, InventoryAndCraftingModal } from './GameUI';
import {
  PLAYER_EYE_HEIGHT_CROUCH,
  PLAYER_EYE_HEIGHT_NORMAL,
  raycastVoxel,
  stepPlayerPhysics,
  wouldBlockOverlapPlayer,
  type MovementInputState,
  type PlayerKinematics,
} from './PlayerPhysics';
import { TerrainGenerator } from './TerrainGenerator';
import {
  DEFAULT_KUBEKCRAFT_SETTINGS,
  createNewWorldRecord,
  deleteSavedWorld,
  exportWorldToBundleJson,
  importWorldFromBundleJson,
  listSavedWorlds,
  loadGameSettings,
  loadWorldWithChunks,
  renameSavedWorld,
  saveGameSettings,
  saveWorldState,
} from './WorldSaveManager';
import type { KubekCraftWorldRecord } from '@/vfs/db';
import type {
  BiomeId,
  ContainerState,
  CraftingRecipe,
  DifficultyLevel,
  GameMode,
  GraphicsPreset,
  InventorySlot,
  KeyBindings,
  KubekCraftSettings,
  PickupToast,
  RaycastHitResult,
  TerrainType,
  WeatherType,
} from './types';

type ScreenState =
  | 'MAIN_MENU'
  | 'WORLD_SELECT'
  | 'CREATE_WORLD'
  | 'LOADING'
  | 'IN_GAME'
  | 'SETTINGS'
  | 'CREDITS';

const LOADING_TIPS = [
  'Craft a Wooden Pickaxe from Oak Planks and Sticks to harvest Cobblestone and Coal.',
  'Place Ember Torches underground to illuminate dark caverns and deter Shadow Stalkers.',
  'Smelt Raw Iron and Raw Gold inside a Furnace using Coal or Wood as fuel.',
  'Right-click with Apples, Berries, or Roasted Steak in hand to restore Hunger.',
  'In Creative Mode, double-tap Spacebar to toggle free 3D flight!',
];

export interface KubekCraftAppProps {
  windowId?: string;
}

export const KubekCraftApp: React.FC<KubekCraftAppProps> = ({ windowId }) => {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const windows = useWindowStore((s) => s.windows);
  const pushNotification = useNotificationStore((s) => s.pushNotification);

  const hostWindow = windows.find((w) =>
    windowId ? w.id === windowId : w.appId === 'kubekcraft'
  );
  const isWindowFocused = hostWindow?.isFocused ?? true;
  const isWindowMinimized = hostWindow?.mode === 'MINIMIZED';

  // Navigation & Menu States
  const [screen, setScreen] = useState<ScreenState>('MAIN_MENU');
  const [returnScreenAfterSettings, setReturnScreenAfterSettings] =
    useState<ScreenState>('MAIN_MENU');
  const [savedWorlds, setSavedWorlds] = useState<KubekCraftWorldRecord[]>([]);
  const [settings, setSettings] = useState<KubekCraftSettings>(DEFAULT_KUBEKCRAFT_SETTINGS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTip, setLoadingTip] = useState(LOADING_TIPS[0]!);

  // World Creation Form States
  const [newWorldName, setNewWorldName] = useState('Aurora Valley');
  const [newWorldSeed, setNewWorldSeed] = useState('KUBEK-2026');
  const [newGameMode, setNewGameMode] = useState<GameMode>('SURVIVAL');
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>('NORMAL');
  const [newTerrainType, setNewTerrainType] = useState<TerrainType>('STANDARD');
  const [newGenCaves, setNewGenCaves] = useState(true);
  const [newGenStructures, setNewGenStructures] = useState(true);
  const [newKeepInventory, setNewKeepInventory] = useState(true);

  // Rename World Inline State
  const [renamingWorldId, setRenamingWorldId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindings | null>(null);

  // In-Game Live React States
  const [activeWorld, setActiveWorld] = useState<KubekCraftWorldRecord | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [deathReason, setDeathReason] = useState('You perished in the wild.');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [discoveredRecipes, setDiscoveredRecipes] = useState<string[]>(
    INITIAL_DISCOVERED_RECIPE_IDS
  );
  const [activeContainerKey, setActiveContainerKey] = useState<string | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [saturation, setSaturation] = useState(10);
  const [inventory, setInventory] = useState<Array<InventorySlot | null>>(() =>
    createInitialInventory('SURVIVAL')
  );
  const [armorSlot, setArmorSlot] = useState<InventorySlot | null>(null);
  const [containers, setContainers] = useState<Record<string, ContainerState>>({});
  const [selectedHotbarSlot, setSelectedHotbarSlot] = useState(0);
  const [miningProgress, setMiningProgress] = useState(0);
  const [targetedBlockId, setTargetedBlockId] = useState<number | null>(null);
  const [playerCoords, setPlayerCoords] = useState({ x: 8, y: 28, z: 8 });
  const [currentBiome, setCurrentBiome] = useState<BiomeId>('PLAINS');
  const [timeLabel, setTimeLabel] = useState('12:00');
  const [dayCount, setDayCount] = useState(1);
  const [weather, setWeather] = useState<WeatherType>('CLEAR');
  const [fps, setFps] = useState(60);
  const [isFlying, setIsFlying] = useState(false);
  const [inWater, setInWater] = useState(false);
  const [pickupToasts, setPickupToasts] = useState<PickupToast[]>([]);

  // Engine Mutable Refs for 60fps loop without React re-render overhead
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<KubekCraftAudioManager | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const terrainGenRef = useRef<TerrainGenerator | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const skyManagerRef = useRef<EnvironmentSkyManager | null>(null);

  const playerRef = useRef<PlayerKinematics>({
    x: 8.5,
    y: 28,
    z: 8.5,
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
  });

  const inputRef = useRef<MovementInputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    crouch: false,
  });

  const mouseButtonsRef = useRef({ leftDown: false, rightDown: false });
  const raycastHitRef = useRef<RaycastHitResult | null>(null);
  const miningTargetKeyRef = useRef<string | null>(null);
  const miningElapsedRef = useRef(0);
  const worldTimeRef = useRef(6000);
  const dayCountRef = useRef(1);
  const weatherRef = useRef<WeatherType>('CLEAR');
  const lastSpaceTapRef = useRef(0);

  // Synced refs for game loop access
  const activeWorldRef = useRef<KubekCraftWorldRecord | null>(null);
  activeWorldRef.current = activeWorld;
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;
  const armorSlotRef = useRef(armorSlot);
  armorSlotRef.current = armorSlot;
  const containersRef = useRef(containers);
  containersRef.current = containers;
  const discoveredRecipesRef = useRef(discoveredRecipes);
  discoveredRecipesRef.current = discoveredRecipes;
  const selectedSlotRef = useRef(selectedHotbarSlot);
  selectedSlotRef.current = selectedHotbarSlot;
  const healthRef = useRef(health);
  healthRef.current = health;
  const hungerRef = useRef(hunger);
  hungerRef.current = hunger;
  const saturationRef = useRef(saturation);
  saturationRef.current = saturation;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isInventoryOpenRef = useRef(isInventoryOpen);
  isInventoryOpenRef.current = isInventoryOpen;
  const isDeadRef = useRef(isDead);
  isDeadRef.current = isDead;
  const isMountedRef = useRef(true);

  // Initialize Audio Manager & Load Saved Worlds + Settings
  useEffect(() => {
    isMountedRef.current = true;
    const audio = new KubekCraftAudioManager();
    audioRef.current = audio;

    void (async () => {
      const [loadedSettings, worlds] = await Promise.all([
        loadGameSettings(),
        listSavedWorlds(),
      ]);
      if (!isMountedRef.current) return;
      setSettings(loadedSettings);
      setSavedWorlds(worlds);
      audio.configure({
        masterVolume: loadedSettings.masterVolume,
        sfxVolume: loadedSettings.sfxVolume,
        musicVolume: loadedSettings.musicVolume,
        muted: loadedSettings.muted,
      });
    })();

    return () => {
      isMountedRef.current = false;
      audio.stopAll();
    };
  }, []);

  const refreshWorldList = useCallback(async () => {
    const worlds = await listSavedWorlds();
    if (isMountedRef.current) {
      setSavedWorlds(worlds);
    }
  }, []);

  const showBanner = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const updateSettings = useCallback((partial: Partial<KubekCraftSettings>) => {
    setSettings((prev) => {
      const next: KubekCraftSettings = { ...prev, ...partial };
      if (partial.graphicsPreset && partial.graphicsPreset !== 'CUSTOM') {
        if (partial.graphicsPreset === 'LOW') {
          next.renderDistance = 2;
          next.shadowsEnabled = false;
          next.ambientParticles = false;
        } else if (partial.graphicsPreset === 'MEDIUM') {
          next.renderDistance = 3;
          next.shadowsEnabled = false;
          next.ambientParticles = true;
        } else if (partial.graphicsPreset === 'HIGH') {
          next.renderDistance = 4;
          next.shadowsEnabled = true;
          next.ambientParticles = true;
        }
      }
      audioRef.current?.configure({
        masterVolume: next.masterVolume,
        sfxVolume: next.sfxVolume,
        musicVolume: next.musicVolume,
        muted: next.muted,
      });
      void saveGameSettings(next);
      return next;
    });
  }, []);

  // Persist current world state to IndexedDB + VFS
  const persistCurrentWorld = useCallback(
    async (notify = false) => {
      const w = activeWorldRef.current;
      const cm = chunkManagerRef.current;
      if (!w || !cm) return;

      const p = playerRef.current;
      const armorDef = armorSlotRef.current
        ? getItemDef(armorSlotRef.current.itemId)
        : null;

      const updated: KubekCraftWorldRecord = {
        ...w,
        worldTime: Math.round(worldTimeRef.current),
        dayCount: dayCountRef.current,
        weather: weatherRef.current,
        player: {
          ...w.player,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          pitch: p.pitch,
          health: healthRef.current,
          maxHealth: 20,
          hunger: hungerRef.current,
          saturation: saturationRef.current,
          armor: armorDef?.armorDefense ?? 0,
          isFlying: p.isFlying,
          selectedHotbarSlot: selectedSlotRef.current,
        },
        inventory: inventoryRef.current,
        armorSlot: armorSlotRef.current,
        discoveredRecipes: discoveredRecipesRef.current,
        containers: containersRef.current,
        updatedAt: Date.now(),
      };

      const deltas = cm.exportModifiedChunkDeltas();
      await saveWorldState(updated, deltas);
      if (!isMountedRef.current) return;
      setActiveWorld(updated);
      await refreshWorldList();

      if (notify && isMountedRef.current) {
        showBanner(`Saved world "${updated.name}" (${deltas.length} modified chunks)`);
      }
    },
    [refreshWorldList, showBanner]
  );

  // Auto-pause when KubekOS window loses focus or is minimized
  useEffect(() => {
    if (screen !== 'IN_GAME') return;
    if (!isWindowFocused || isWindowMinimized) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      setIsPaused(true);
      void persistCurrentWorld(false);
    }
  }, [isWindowFocused, isWindowMinimized, screen, persistCurrentWorld]);

  // Launch a world into the 3D engine
  const launchWorldSession = useCallback(
    async (worldId: string) => {
      setLoadingTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]!);
      setLoadingProgress(20);
      setScreen('LOADING');

      const bundle = await loadWorldWithChunks(worldId);
      if (!bundle) {
        showBanner('Could not load world from storage.');
        setScreen('WORLD_SELECT');
        return;
      }

      setLoadingProgress(65);
      const { world } = bundle;
      setActiveWorld(world);
      setHealth(world.player.health);
      setHunger(world.player.hunger);
      setSaturation(world.player.saturation);
      setInventory(
        world.inventory?.length === 36
          ? world.inventory
          : createInitialInventory(world.gameMode)
      );
      setArmorSlot(world.armorSlot ?? null);
      setDiscoveredRecipes(
        world.discoveredRecipes ?? [...INITIAL_DISCOVERED_RECIPE_IDS]
      );
      setContainers(world.containers ?? {});
      setSelectedHotbarSlot(world.player.selectedHotbarSlot ?? 0);
      setDayCount(world.dayCount ?? 1);
      setWeather(world.weather ?? 'CLEAR');
      setIsFlying(Boolean(world.player.isFlying));
      setIsPaused(false);
      setIsDead(false);
      setIsInventoryOpen(false);
      setIsWorkbenchOpen(false);
      setActiveContainerKey(null);

      worldTimeRef.current = world.worldTime ?? 6000;
      dayCountRef.current = world.dayCount ?? 1;
      weatherRef.current = world.weather ?? 'CLEAR';

      playerRef.current = {
        x: world.player.x,
        y: world.player.y,
        z: world.player.z,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: world.player.yaw ?? 0,
        pitch: world.player.pitch ?? 0,
        onGround: false,
        inWater: false,
        isSprinting: false,
        isCrouching: false,
        isFlying: Boolean(world.player.isFlying),
        fallDistance: 0,
        stepDistanceAccum: 0,
      };

      setLoadingProgress(100);
      setTimeout(() => {
        setScreen('IN_GAME');
        audioRef.current?.startAmbientLoop();
      }, 180);
    },
    [showBanner]
  );

  const handleCreateAndLaunchWorld = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    audioRef.current?.playUiClick();
    const created = await createNewWorldRecord({
      name: newWorldName,
      seed: newWorldSeed,
      gameMode: newGameMode,
      difficulty: newDifficulty,
      terrainType: newTerrainType,
      generateCaves: newGenCaves,
      generateStructures: newGenStructures,
      keepInventory: newKeepInventory,
    });
    await refreshWorldList();
    await launchWorldSession(created.id);
  };

  // Damage & Death Handling
  const applyPlayerDamage = useCallback(
    (rawDamage: number, reason: string) => {
      const w = activeWorldRef.current;
      if (!w || w.gameMode === 'CREATIVE' || isDeadRef.current) return;

      const armorDef = armorSlotRef.current
        ? getItemDef(armorSlotRef.current.itemId)
        : null;
      const defense = armorDef?.armorDefense ?? 0;
      const reduction = Math.min(0.75, defense * 0.035);
      const finalDamage = Math.max(1, Math.round(rawDamage * (1 - reduction)));

      audioRef.current?.playDamageHit();
      const nextHp = Math.max(0, healthRef.current - finalDamage);
      healthRef.current = nextHp;
      setHealth(nextHp);

      if (nextHp <= 0) {
        setDeathReason(reason);
        setIsDead(true);
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        // Drop inventory items if keepInventory is false
        if (!w.keepInventory && entityManagerRef.current) {
          const p = playerRef.current;
          for (const slot of inventoryRef.current) {
            if (slot) {
              entityManagerRef.current.spawnDroppedItem(
                slot.itemId,
                slot.count,
                p.x,
                p.y,
                p.z,
                slot.durability,
                1.0
              );
            }
          }
          const empty = new Array(36).fill(null);
          setInventory(empty);
        }
      }
    },
    []
  );

  const handleRespawn = () => {
    const w = activeWorldRef.current;
    if (!w) return;
    const sp = w.player.spawnPoint;
    const safeY = terrainGenRef.current
      ? terrainGenRef.current.getSpawnHeight(Math.floor(sp.x), Math.floor(sp.z))
      : sp.y;

    playerRef.current.x = sp.x;
    playerRef.current.y = safeY;
    playerRef.current.z = sp.z;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.vz = 0;
    playerRef.current.fallDistance = 0;

    setHealth(20);
    setHunger(20);
    setSaturation(10);
    setIsDead(false);
    showBanner('Respawned at World Spawn Point');
  };

  // Unlock recipes associated with newly obtained items
  const checkAndUnlockRecipes = useCallback(
    (itemIds: number[]) => {
      if (itemIds.length === 0) return;
      const res = discoverRecipesFromItems(itemIds, discoveredRecipesRef.current);
      if (res.newlyUnlocked.length > 0) {
        discoveredRecipesRef.current = res.updatedDiscovered;
        setDiscoveredRecipes(res.updatedDiscovered);
        const firstRecipe = res.newlyUnlocked[0]!;
        showBanner(
          res.newlyUnlocked.length === 1
            ? `New Recipe Unlocked: ${firstRecipe.name}`
            : `Unlocked ${res.newlyUnlocked.length} New Crafting Recipes!`
        );
      }
    },
    [showBanner]
  );

  // Add item to player inventory with toast notification & recipe discovery
  const giveItemToPlayer = useCallback(
    (itemId: number, count: number, durability?: number): boolean => {
      const res = addItemToInventory(inventoryRef.current, itemId, count, durability);
      if (res.remaining === count) return false;

      const addedCount = count - res.remaining;
      inventoryRef.current = res.updatedSlots;
      setInventory(res.updatedSlots);
      audioRef.current?.playPickupPop();

      const def = getItemDef(itemId);
      setPickupToasts((prev) => [
        ...prev.filter((t) => Date.now() - t.timestamp < 3500),
        {
          id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemId,
          name: def.name,
          count: addedCount,
          timestamp: Date.now(),
        },
      ]);

      checkAndUnlockRecipes([itemId]);
      return true;
    },
    [checkAndUnlockRecipes]
  );

  // Break currently targeted block (or explicit block coords)
  const breakBlockAt = useCallback(
    (bx: number, by: number, bz: number) => {
      const cm = chunkManagerRef.current;
      const w = activeWorldRef.current;
      if (!cm || !w) return false;

      const blockId = cm.getBlock(bx, by, bz);
      if (blockId === BLOCK_IDS.AIR || blockId === BLOCK_IDS.BEDROCK) return false;

      const blockDef = getItemDef(blockId);
      const changed = cm.setBlock(bx, by, bz, BLOCK_IDS.AIR);
      if (!changed) return false;

      audioRef.current?.playBlockSound(blockDef.soundCategory ?? 'STONE', 'BREAK');

      // Remove container if broken
      const cKey = `${bx},${by},${bz}`;
      if (containersRef.current[cKey]) {
        const cState = containersRef.current[cKey]!;
        for (const s of cState.slots) {
          if (s && entityManagerRef.current) {
            entityManagerRef.current.spawnDroppedItem(
              s.itemId,
              s.count,
              bx + 0.5,
              by + 0.2,
              bz + 0.5,
              s.durability
            );
          }
        }
        const nextC = { ...containersRef.current };
        delete nextC[cKey];
        setContainers(nextC);
      }

      if (w.gameMode !== 'CREATIVE') {
        const slotIdx = selectedSlotRef.current;
        const held = inventoryRef.current[slotIdx];
        const heldItemId = held?.itemId ?? null;

        // Enforce tool & resource tier requirements for block drops
        if (!canHarvestBlockDrop(blockId, heldItemId)) {
          showBanner(
            `No drop! ${blockDef.name} requires a Tier ${blockDef.minToolTier ?? 1} ${
              blockDef.preferredTool ?? 'PICKAXE'
            }.`
          );
        } else {
          const drops = getBlockDrops(blockId, heldItemId);
          for (const drop of drops) {
            if (drop.itemId > 0 && drop.count > 0) {
              const pickedImmediately = giveItemToPlayer(drop.itemId, drop.count);
              if (!pickedImmediately && entityManagerRef.current) {
                entityManagerRef.current.spawnDroppedItem(
                  drop.itemId,
                  drop.count,
                  bx + 0.5,
                  by + 0.25,
                  bz + 0.5
                );
              }
            }
          }
        }

        // Decrement held tool durability
        if (held) {
          const heldDef = getItemDef(held.itemId);
          if (heldDef.maxDurability) {
            const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
            const curDur = (nextInv[slotIdx]!.durability ?? heldDef.maxDurability) - 1;
            if (curDur <= 0) {
              nextInv[slotIdx] = null;
              showBanner(`Your ${heldDef.name} broke!`);
            } else {
              nextInv[slotIdx]!.durability = curDur;
            }
            inventoryRef.current = nextInv;
            setInventory(nextInv);
          }
        }
      }

      return true;
    },
    [giveItemToPlayer, showBanner]
  );

  // Place block or interact with block / eat food / equip armor on right-click
  const handleRightClickAction = useCallback(() => {
    const cm = chunkManagerRef.current;
    const w = activeWorldRef.current;
    if (!cm || !w) return;

    const hit = raycastHitRef.current;
    if (hit) {
      const targetDef = getItemDef(hit.blockId);
      // Check interactive workstations & containers
      if (targetDef.interactiveType === 'CRAFTING_TABLE') {
        if (document.pointerLockElement) document.exitPointerLock?.();
        setActiveContainerKey(null);
        setIsWorkbenchOpen(true);
        setIsInventoryOpen(true);
        return;
      }
      if (
        targetDef.interactiveType === 'CHEST' ||
        targetDef.interactiveType === 'FURNACE'
      ) {
        const cKey = `${hit.blockX},${hit.blockY},${hit.blockZ}`;
        if (!containersRef.current[cKey]) {
          const newContainer: ContainerState = {
            type: targetDef.interactiveType === 'FURNACE' ? 'FURNACE' : 'CHEST',
            slots: new Array(targetDef.interactiveType === 'FURNACE' ? 3 : 18).fill(null),
            smeltProgress: 0,
            fuelRemaining: 0,
            maxFuelTime: 0,
          };
          setContainers((prev) => ({ ...prev, [cKey]: newContainer }));
        }
        if (document.pointerLockElement) document.exitPointerLock?.();
        setIsWorkbenchOpen(false);
        setActiveContainerKey(cKey);
        setIsInventoryOpen(true);
        return;
      }
    }

    const slotIdx = selectedSlotRef.current;
    const held = inventoryRef.current[slotIdx];
    if (!held) return;

    const heldDef = getItemDef(held.itemId);

    // Eating food
    if (heldDef.category === 'FOOD' && heldDef.foodRestore) {
      if (hungerRef.current < 20 || w.gameMode === 'CREATIVE') {
        const nextHunger = Math.min(20, hungerRef.current + heldDef.foodRestore);
        const nextSat = Math.min(
          20,
          saturationRef.current + (heldDef.saturationRestore ?? 2)
        );
        setHunger(nextHunger);
        setSaturation(nextSat);
        audioRef.current?.playPickupPop();

        if (w.gameMode !== 'CREATIVE') {
          const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
          nextInv[slotIdx]!.count -= 1;
          if (nextInv[slotIdx]!.count <= 0) nextInv[slotIdx] = null;
          inventoryRef.current = nextInv;
          setInventory(nextInv);
        }
        showBanner(`Ate ${heldDef.name} (+${heldDef.foodRestore} Hunger)`);
      }
      return;
    }

    // Equip armor directly on right-click
    if (heldDef.category === 'ARMOR') {
      const prevArmor = armorSlotRef.current;
      const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
      nextInv[slotIdx] = prevArmor;
      setArmorSlot(held);
      setInventory(nextInv);
      audioRef.current?.playCraftChime();
      showBanner(`Equipped ${heldDef.name}`);
      return;
    }

    // Place block at adjacent raycast coordinate
    if (heldDef.isBlock && hit) {
      const { placeX, placeY, placeZ } = hit;
      if (
        heldDef.collidable &&
        wouldBlockOverlapPlayer(placeX, placeY, placeZ, playerRef.current)
      ) {
        return;
      }

      const placed = cm.setBlock(placeX, placeY, placeZ, heldDef.id);
      if (placed) {
        audioRef.current?.playBlockSound(heldDef.soundCategory ?? 'STONE', 'PLACE');
        if (w.gameMode !== 'CREATIVE') {
          const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
          nextInv[slotIdx]!.count -= 1;
          if (nextInv[slotIdx]!.count <= 0) nextInv[slotIdx] = null;
          inventoryRef.current = nextInv;
          setInventory(nextInv);
        }
      }
    }
  }, [showBanner]);

  // Drop 1 item from selected hotbar slot (Key Q)
  const dropItemFromSlot = useCallback((slotIndex: number) => {
    const slot = inventoryRef.current[slotIndex];
    if (!slot || !entityManagerRef.current) return;

    const p = playerRef.current;
    const fx = -Math.sin(p.yaw) * 1.4;
    const fz = -Math.cos(p.yaw) * 1.4;

    entityManagerRef.current.spawnDroppedItem(
      slot.itemId,
      1,
      p.x + fx,
      p.y + 1.1,
      p.z + fz,
      slot.durability,
      1.2
    );

    const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
    nextInv[slotIndex]!.count -= 1;
    if (nextInv[slotIndex]!.count <= 0) nextInv[slotIndex] = null;
    inventoryRef.current = nextInv;
    setInventory(nextInv);
  }, []);

  // ==========================================================================
  // CORE THREE.JS 3D ENGINE LIFECYCLE (Runs when screen === 'IN_GAME')
  // ==========================================================================
  useEffect(() => {
    if (screen !== 'IN_GAME' || !activeWorld) return;
    const container = viewportContainerRef.current;
    if (!container) return;

    let disposed = false;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      settingsRef.current.fov,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      220
    );
    camera.rotation.order = 'YXZ';

    // 2. WebGL Renderer with graceful fallback for headless test environments
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(
        Math.max(320, container.clientWidth),
        Math.max(240, container.clientHeight)
      );
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      // Fallback placeholder canvas if headless environment lacks WebGL context
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.className = 'w-full h-full block';
      container.innerHTML = '';
      container.appendChild(fallbackCanvas);
    }

    // 3. Sky, Terrain, Chunk & Entity Managers
    const skyManager = new EnvironmentSkyManager(scene);
    skyManagerRef.current = skyManager;

    const terrainGen = new TerrainGenerator({
      numericSeed: activeWorld.numericSeed,
      terrainType: activeWorld.terrainType,
      generateCaves: activeWorld.generateCaves,
      generateStructures: activeWorld.generateStructures,
    });
    terrainGenRef.current = terrainGen;

    const chunkManager = new ChunkManager(terrainGen);
    chunkManagerRef.current = chunkManager;
    scene.add(chunkManager.sceneGroup);

    const entityManager = new EntityManager();
    entityManagerRef.current = entityManager;
    scene.add(entityManager.sceneGroup);

    // Load persisted chunk edits & prebuild spawn area immediately
    void loadWorldWithChunks(activeWorld.id).then((loaded) => {
      if (disposed || !loaded) return;
      chunkManager.loadSavedChunkDeltas(loaded.chunks);
      chunkManager.prebuildSpawnArea(playerRef.current.x, playerRef.current.z, 2);

      // Spawn initial wildlife around player
      const sx = Math.floor(playerRef.current.x) + 5;
      const sz = Math.floor(playerRef.current.z) - 4;
      const sy = terrainGen.sampleColumnInfo(sx, sz).height + 1;
      entityManager.spawnCreature('MEADOW_SHEEP', sx + 0.5, sy, sz + 0.5);
      entityManager.spawnCreature('FOREST_HOPPER', sx - 4.5, sy, sz + 3.5);
    });

    // 4. Target Block Wireframe Selection Highlight Box
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const highlightMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
    });
    const highlightMesh = new THREE.LineSegments(boxEdges, highlightMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);

    // 5. First-Person Right-Hand Viewmodel attached to Camera
    const handGroup = new THREE.Group();
    const handGeom = new THREE.BoxGeometry(0.22, 0.22, 0.55);
    const handMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const handMesh = new THREE.Mesh(handGeom, handMat);
    handMesh.position.set(0.38, -0.32, -0.52);
    handMesh.rotation.set(0.15, -0.2, 0);
    handGroup.add(handMesh);
    camera.add(handGroup);
    scene.add(camera);

    // 6. ResizeObserver for Window Resizing / Maximizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, entry.contentRect.width);
        const h = Math.max(160, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer?.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // 7. Pointer Lock & Mouse Look / Drag Look Handlers
    let isDraggingLook = false;
    let lastDragX = 0;
    let lastDragY = 0;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === container;
      setIsPointerLocked(locked);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPausedRef.current || isInventoryOpenRef.current || isDeadRef.current) return;
      const sens = settingsRef.current.mouseSensitivity;
      const invert = settingsRef.current.invertMouseY ? -1 : 1;

      if (document.pointerLockElement === container) {
        playerRef.current.yaw -= e.movementX * sens;
        playerRef.current.pitch = Math.max(
          -Math.PI / 2 + 0.05,
          Math.min(Math.PI / 2 - 0.05, playerRef.current.pitch - e.movementY * sens * invert)
        );
      } else if (isDraggingLook) {
        const dx = e.clientX - lastDragX;
        const dy = e.clientY - lastDragY;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        playerRef.current.yaw -= dx * sens * 1.4;
        playerRef.current.pitch = Math.max(
          -Math.PI / 2 + 0.05,
          Math.min(Math.PI / 2 - 0.05, playerRef.current.pitch - dy * sens * 1.4 * invert)
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (isPausedRef.current || isInventoryOpenRef.current || isDeadRef.current) return;
      if (e.button === 0) {
        mouseButtonsRef.current.leftDown = true;
        isDraggingLook = true;
        lastDragX = e.clientX;
        lastDragY = e.clientY;

        // Check melee attack on creature first
        const eyeY =
          playerRef.current.y +
          (playerRef.current.isCrouching
            ? PLAYER_EYE_HEIGHT_CROUCH
            : PLAYER_EYE_HEIGHT_NORMAL);
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(
          new THREE.Euler(playerRef.current.pitch, playerRef.current.yaw, 0, 'YXZ')
        );
        const held = inventoryRef.current[selectedSlotRef.current];
        const heldDef = held ? getItemDef(held.itemId) : null;
        const atk = heldDef?.attackDamage ?? 2;

        const hitMob = entityManager.tryAttackCreatureOnRay(
          playerRef.current.x,
          eyeY,
          playerRef.current.z,
          dir.x,
          dir.y,
          dir.z,
          atk
        );
        if (hitMob) {
          audioRef.current?.playDamageHit();
        }
      } else if (e.button === 2) {
        mouseButtonsRef.current.rightDown = true;
        handleRightClickAction();
      } else if (e.button === 1) {
        // Middle mouse Pick Block
        e.preventDefault();
        const hit = raycastHitRef.current;
        if (hit) {
          const existingIdx = inventoryRef.current.findIndex(
            (s) => s && s.itemId === hit.blockId
          );
          if (existingIdx >= 0 && existingIdx < 9) {
            setSelectedHotbarSlot(existingIdx);
          } else if (activeWorldRef.current?.gameMode === 'CREATIVE') {
            const nextInv = inventoryRef.current.map((s) => (s ? { ...s } : null));
            nextInv[selectedSlotRef.current] = { itemId: hit.blockId, count: 64 };
            setInventory(nextInv);
          }
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseButtonsRef.current.leftDown = false;
        isDraggingLook = false;
        miningElapsedRef.current = 0;
        setMiningProgress(0);
      } else if (e.button === 2) {
        mouseButtonsRef.current.rightDown = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (isPausedRef.current || isInventoryOpenRef.current || isDeadRef.current) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      setSelectedHotbarSlot((prev) => (prev + delta + 9) % 9);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const kb = settingsRef.current.keyBindings;

      if (e.code === 'Escape') {
        e.preventDefault();
        if (isInventoryOpenRef.current) {
          setIsInventoryOpen(false);
          setIsWorkbenchOpen(false);
          setActiveContainerKey(null);
        } else {
          setIsPaused((p) => !p);
          if (document.pointerLockElement) document.exitPointerLock?.();
        }
        return;
      }

      if (e.code === kb.inventory) {
        e.preventDefault();
        if (!isPausedRef.current && !isDeadRef.current) {
          setIsInventoryOpen((open) => {
            if (!open && document.pointerLockElement) {
              document.exitPointerLock?.();
            }
            setIsWorkbenchOpen(false);
            setActiveContainerKey(null);
            return !open;
          });
        }
        return;
      }

      if (e.code === 'F5') {
        e.preventDefault();
        void persistCurrentWorld(true);
        return;
      }

      if (isPausedRef.current || isInventoryOpenRef.current || isDeadRef.current) return;

      // Hotbar keys 1..9
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 9) {
          setSelectedHotbarSlot(num - 1);
          return;
        }
      }

      if (e.code === kb.drop) {
        e.preventDefault();
        dropItemFromSlot(selectedSlotRef.current);
        return;
      }

      if (e.code === kb.forward || e.code === 'ArrowUp') inputRef.current.forward = true;
      if (e.code === kb.backward || e.code === 'ArrowDown') inputRef.current.backward = true;
      if (e.code === kb.left || e.code === 'ArrowLeft') inputRef.current.left = true;
      if (e.code === kb.right || e.code === 'ArrowRight') inputRef.current.right = true;
      if (e.code === kb.sprint || e.code === 'ShiftRight') inputRef.current.sprint = true;
      if (e.code === kb.crouch || e.code === 'KeyC') inputRef.current.crouch = true;

      if (e.code === kb.jump) {
        e.preventDefault();
        if (!inputRef.current.jump && activeWorldRef.current?.gameMode === 'CREATIVE') {
          const now = performance.now();
          if (now - lastSpaceTapRef.current < 320) {
            playerRef.current.isFlying = !playerRef.current.isFlying;
            setIsFlying(playerRef.current.isFlying);
          }
          lastSpaceTapRef.current = now;
        }
        inputRef.current.jump = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const kb = settingsRef.current.keyBindings;
      if (e.code === kb.forward || e.code === 'ArrowUp') inputRef.current.forward = false;
      if (e.code === kb.backward || e.code === 'ArrowDown') inputRef.current.backward = false;
      if (e.code === kb.left || e.code === 'ArrowLeft') inputRef.current.left = false;
      if (e.code === kb.right || e.code === 'ArrowRight') inputRef.current.right = false;
      if (e.code === kb.jump) inputRef.current.jump = false;
      if (e.code === kb.sprint || e.code === 'ShiftRight') inputRef.current.sprint = false;
      if (e.code === kb.crouch || e.code === 'KeyC') inputRef.current.crouch = false;
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 8. Main Simulation & Render Loop
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;
    let hungerDrainAccum = 0;
    let healthRegenAccum = 0;
    let weatherCycleAccum = 0;
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const animate = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      frameCounter++;
      if (now - fpsTimer >= 500) {
        setFps(Math.round((frameCounter * 1000) / (now - fpsTimer)));
        frameCounter = 0;
        fpsTimer = now;
      }

      if (!isPausedRef.current && !isDeadRef.current) {
        const p = playerRef.current;

        // Step Player Physics
        const activeInput: MovementInputState = isInventoryOpenRef.current
          ? {
              forward: false,
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: false,
              crouch: false,
            }
          : inputRef.current;

        const physOut = stepPlayerPhysics(p, activeInput, dt, (wx, wy, wz) =>
          chunkManager.getBlock(wx, wy, wz)
        );

        if (physOut.landedFallDamage > 0) {
          applyPlayerDamage(physOut.landedFallDamage, 'You fell from a high cliff.');
        }

        if (physOut.footstepTriggered) {
          const underBlock = chunkManager.getBlock(
            Math.floor(p.x),
            Math.floor(p.y - 0.2),
            Math.floor(p.z)
          );
          const underDef = getItemDef(underBlock);
          audioRef.current?.playBlockSound(underDef.soundCategory ?? 'GRASS', 'STEP');
        }

        // Update Camera Position & Rotation
        const eyeH = p.isCrouching ? PLAYER_EYE_HEIGHT_CROUCH : PLAYER_EYE_HEIGHT_NORMAL;
        camera.position.set(p.x, p.y + eyeH, p.z);
        camera.rotation.y = p.yaw;
        camera.rotation.x = p.pitch;
        if (camera.fov !== settingsRef.current.fov) {
          camera.fov = settingsRef.current.fov;
          camera.updateProjectionMatrix();
        }

        // Stream chunks around player
        chunkManager.updateStreaming(
          p.x,
          p.z,
          settingsRef.current.renderDistance,
          2
        );

        // Advance Day/Night Cycle (20 ticks per second -> 20 minute full day)
        worldTimeRef.current += dt * 22;
        if (worldTimeRef.current >= 24000) {
          worldTimeRef.current -= 24000;
          dayCountRef.current += 1;
          setDayCount(dayCountRef.current);
        }

        // Dynamic Weather Transitions
        weatherCycleAccum += dt;
        if (weatherCycleAccum >= 95) {
          weatherCycleAccum = 0;
          const col = terrainGen.sampleColumnInfo(Math.floor(p.x), Math.floor(p.z));
          const r = Math.random();
          const nextW: WeatherType =
            r < 0.72
              ? 'CLEAR'
              : col.biome === 'SNOWY_TUNDRA' || col.biome === 'MOUNTAINS'
                ? 'SNOW'
                : col.biome === 'DESERT'
                  ? 'CLEAR'
                  : 'RAIN';
          weatherRef.current = nextW;
          setWeather(nextW);
        }

        const skyOut = skyManager.update(
          dt,
          worldTimeRef.current,
          weatherRef.current,
          p.x,
          p.y,
          p.z,
          settingsRef.current.renderDistance,
          settingsRef.current.ambientParticles
        );

        // Update Entities & Drops
        entityManager.update(
          dt,
          p.x,
          p.y,
          p.z,
          skyOut.isNight,
          activeWorldRef.current?.gameMode ?? 'SURVIVAL',
          activeWorldRef.current?.difficulty ?? 'NORMAL',
          (wx, wy, wz) => chunkManager.getBlock(wx, wy, wz),
          (wx, wz) => terrainGen.sampleColumnInfo(wx, wz),
          (dmg, attackerName) =>
            applyPlayerDamage(dmg, `Slain by a ${attackerName}.`),
          (itemId, count, dur) => giveItemToPlayer(itemId, count, dur)
        );

        // Real-Time Furnace Smelting Tick across all active furnaces in world
        const curContainers = containersRef.current;
        const containerKeys = Object.keys(curContainers);
        if (containerKeys.length > 0) {
          let anyFurnaceChanged = false;
          const nextContainers: Record<string, ContainerState> = { ...curContainers };
          for (const cKey of containerKeys) {
            const c = curContainers[cKey];
            if (c && c.type === 'FURNACE') {
              const res = tickFurnaceContainer(c, dt);
              if (res.changed) {
                nextContainers[cKey] = res.updated;
                anyFurnaceChanged = true;
              }
              if (res.completedOutputItemId !== null) {
                audioRef.current?.playCraftChime();
                const outDef = getItemDef(res.completedOutputItemId);
                showBanner(`Furnace smelted ${outDef.name}!`);
                checkAndUnlockRecipes([res.completedOutputItemId]);
              }
            }
          }
          if (anyFurnaceChanged) {
            containersRef.current = nextContainers;
            setContainers(nextContainers);
          }
        }

        // Survival Hunger & Regeneration
        const mode = activeWorldRef.current?.gameMode ?? 'SURVIVAL';
        if (mode !== 'CREATIVE') {
          const activityRate = p.isSprinting ? 2.2 : 0.7;
          hungerDrainAccum += dt * activityRate;
          if (hungerDrainAccum >= 28) {
            hungerDrainAccum = 0;
            if (saturationRef.current > 0) {
              setSaturation((s) => Math.max(0, s - 1));
            } else if (hungerRef.current > 0) {
              setHunger((h) => Math.max(0, h - 1));
            } else if (healthRef.current > 2) {
              applyPlayerDamage(1, 'Starved in the wilderness.');
            }
          }

          if (hungerRef.current >= 16 && healthRef.current < 20) {
            healthRegenAccum += dt;
            if (healthRegenAccum >= 4.0) {
              healthRegenAccum = 0;
              setHealth((hp) => Math.min(20, hp + 1));
            }
          }
        }

        // Raycast Block Target & Mining Progress
        const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
        const hit = raycastVoxel(
          camera.position.x,
          camera.position.y,
          camera.position.z,
          lookDir.x,
          lookDir.y,
          lookDir.z,
          6.0,
          (wx, wy, wz) => chunkManager.getBlock(wx, wy, wz)
        );
        raycastHitRef.current = hit;

        if (hit) {
          highlightMesh.visible = true;
          highlightMesh.position.set(
            hit.blockX + 0.5,
            hit.blockY + 0.5,
            hit.blockZ + 0.5
          );

          if (mouseButtonsRef.current.leftDown && !isInventoryOpenRef.current) {
            const targetKey = `${hit.blockX},${hit.blockY},${hit.blockZ}`;
            if (miningTargetKeyRef.current !== targetKey) {
              miningTargetKeyRef.current = targetKey;
              miningElapsedRef.current = 0;
            }
            const held = inventoryRef.current[selectedSlotRef.current];
            const breakDuration = calculateBlockBreakDuration(
              hit.blockId,
              held?.itemId ?? null,
              mode === 'CREATIVE'
            );
            miningElapsedRef.current += dt;
            const prog = Math.min(1, miningElapsedRef.current / breakDuration);
            setMiningProgress(prog);

            if (miningElapsedRef.current >= breakDuration) {
              miningElapsedRef.current = 0;
              setMiningProgress(0);
              breakBlockAt(hit.blockX, hit.blockY, hit.blockZ);
            }
          }
        } else {
          highlightMesh.visible = false;
          miningTargetKeyRef.current = null;
          if (miningElapsedRef.current > 0) {
            miningElapsedRef.current = 0;
            setMiningProgress(0);
          }
        }

        // Animate first-person right hand viewmodel
        const heldSlot = inventoryRef.current[selectedSlotRef.current];
        const heldDef = heldSlot ? getItemDef(heldSlot.itemId) : null;
        handMat.color.set(
          heldDef?.palette?.top[0] ?? heldDef?.iconColors?.primary ?? '#38bdf8'
        );
        const swingOffset = mouseButtonsRef.current.leftDown
          ? Math.sin(now * 0.025) * 0.28
          : 0;
        const walkBob =
          p.onGround && Math.hypot(p.vx, p.vz) > 0.2
            ? Math.sin(now * 0.01) * 0.03
            : 0;
        handMesh.position.set(0.38, -0.32 + walkBob, -0.52 - swingOffset * 0.3);
        handMesh.rotation.x = 0.15 - swingOffset;

        // Periodic React HUD telemetry sync (every 150ms)
        hudSyncAccum += dt;
        if (hudSyncAccum >= 0.15) {
          hudSyncAccum = 0;
          const bx = Math.floor(p.x);
          const by = Math.floor(p.y);
          const bz = Math.floor(p.z);
          setPlayerCoords({ x: bx, y: by, z: bz });
          setCurrentBiome(terrainGen.sampleColumnInfo(bx, bz).biome);
          setTimeLabel(skyOut.timeLabel);
          setTargetedBlockId(hit?.blockId ?? null);
          setInWater(p.inWater);
        }
      }

      renderer?.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    // 9. Autosave Interval
    const autosaveMs = Math.max(10, settingsRef.current.autosaveIntervalSec) * 1000;
    const autosaveTimer = setInterval(() => {
      if (!isPausedRef.current) {
        void persistCurrentWorld(false);
      }
    }, autosaveMs);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearInterval(autosaveTimer);
      resizeObserver.disconnect();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (document.pointerLockElement === container) {
        document.exitPointerLock?.();
      }

      chunkManager.disposeAll();
      entityManager.disposeAll();
      skyManager.dispose();
      boxEdges.dispose();
      highlightMat.dispose();
      handGeom.dispose();
      handMat.dispose();
      renderer?.dispose();
    };
  }, [
    screen,
    activeWorld?.id,
    applyPlayerDamage,
    breakBlockAt,
    checkAndUnlockRecipes,
    dropItemFromSlot,
    giveItemToPlayer,
    handleRightClickAction,
    persistCurrentWorld,
    showBanner,
  ]);

  // Listen for key rebinding in Settings
  useEffect(() => {
    if (!rebindingKey) return;
    const onBindKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateSettings({
        keyBindings: {
          ...settingsRef.current.keyBindings,
          [rebindingKey]: e.code,
        },
      });
      setRebindingKey(null);
    };
    window.addEventListener('keydown', onBindKey, true);
    return () => window.removeEventListener('keydown', onBindKey, true);
  }, [rebindingKey, updateSettings]);

  // Handle World Export Download
  const handleExportWorld = async (worldId: string, worldName: string) => {
    try {
      const jsonStr = await exportWorldToBundleJson(worldId);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${worldName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.kubekworld.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushNotification({
        title: 'KubekCraft World Exported',
        message: `Downloaded "${worldName}" bundle JSON.`,
        sourceAppId: 'kubekcraft',
      });
    } catch (err) {
      showBanner(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Handle World Import Upload
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importWorldFromBundleJson(text);
      await refreshWorldList();
      showBanner(`Imported world "${imported.name}" successfully!`);
    } catch (err) {
      showBanner(err instanceof Error ? err.message : 'Invalid world file.');
    } finally {
      e.target.value = '';
    }
  };

  // Execute crafting recipe from modal
  const handleCraftRecipe = (recipe: CraftingRecipe, times = 1) => {
    let working = inventory;
    let craftedAny = false;
    for (let i = 0; i < times; i++) {
      const next = executeCraftRecipe(working, recipe);
      if (!next) break;
      working = next;
      craftedAny = true;
    }
    if (craftedAny) {
      setInventory(working);
      audioRef.current?.playCraftChime();
      showBanner(`Crafted ${recipe.name}`);
    }
  };

  return (
    <div
      data-testid="app-kubekcraft"
      onContextMenu={(e) => e.preventDefault()}
      style={{ fontSize: `${Math.round(settings.uiScale * 100)}%` }}
      className="relative w-full h-full bg-[#040711] text-slate-100 overflow-hidden select-none flex flex-col"
    >
      {/* Hidden File Input for World Bundle Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={(e) => void handleImportFileChange(e)}
        className="hidden"
      />

      {/* Top Floating Status Banner */}
      {statusMessage && (
        <div
          data-testid="kubekcraft-status-banner"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-cyan-500 text-slate-950 font-semibold text-xs shadow-[0_0_30px_rgba(6,182,212,0.6)] pointer-events-none"
        >
          {statusMessage}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. MAIN MENU SCREEN                                                  */}
      {/* ==================================================================== */}
      {screen === 'MAIN_MENU' && (
        <div
          data-testid="kubekcraft-main-menu"
          className="relative flex-1 flex flex-col items-center justify-between p-8 overflow-y-auto"
          style={{
            background:
              'radial-gradient(circle at 50% 25%, rgba(6, 182, 212, 0.22), rgba(15, 23, 42, 0.92) 60%, #03060d 100%)',
          }}
        >
          {/* Animated Floating Voxel Background Accents */}
          <div className="absolute inset-0 pointer-events-none opacity-25 obsidian-grid-overlay" />

          {/* Header & Title Logo */}
          <div className="relative z-10 text-center space-y-3 mt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono uppercase">
              <Box className="w-3.5 h-3.5" />
              <span>KubekOS Native 3D Voxel Sandbox Engine • v1.0</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 drop-shadow-[0_10px_25px_rgba(6,182,212,0.35)]">
              KUBEKCRAFT
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Explore procedural biomes, delve into subterranean crystal caverns, craft tools, build structures, and survive the night.
            </p>
          </div>

          {/* Primary Menu Actions */}
          <div className="relative z-10 w-full max-w-md flex flex-col gap-2.5 my-6">
            <button
              type="button"
              data-testid="kubekcraft-menu-quick-play"
              onClick={() => {
                audioRef.current?.playUiClick();
                if (savedWorlds.length > 0) {
                  void launchWorldSession(savedWorlds[0]!.id);
                } else {
                  setScreen('CREATE_WORLD');
                }
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.4)] cursor-pointer transition-transform active:scale-98"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                {savedWorlds.length > 0
                  ? `Continue "${savedWorlds[0]!.name}"`
                  : 'Play — Create New Voxel World'}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="kubekcraft-menu-create-world"
                onClick={() => {
                  audioRef.current?.playUiClick();
                  setScreen('CREATE_WORLD');
                }}
                className="py-3 px-4 rounded-xl bg-[#0b1326]/90 hover:bg-[#13203d] border border-white/[0.12] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Create New World</span>
              </button>

              <button
                type="button"
                data-testid="kubekcraft-menu-load-worlds"
                onClick={() => {
                  audioRef.current?.playUiClick();
                  void refreshWorldList();
                  setScreen('WORLD_SELECT');
                }}
                className="py-3 px-4 rounded-xl bg-[#0b1326]/90 hover:bg-[#13203d] border border-white/[0.12] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <span>Singleplayer Worlds ({savedWorlds.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                data-testid="kubekcraft-menu-settings"
                onClick={() => {
                  setReturnScreenAfterSettings('MAIN_MENU');
                  setScreen('SETTINGS');
                }}
                className="py-2.5 px-3 rounded-xl bg-[#090f1d] hover:bg-[#111c35] border border-white/[0.08] text-xs text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                data-testid="kubekcraft-menu-credits"
                onClick={() => setScreen('CREDITS')}
                className="py-2.5 px-3 rounded-xl bg-[#090f1d] hover:bg-[#111c35] border border-white/[0.08] text-xs text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>Credits</span>
              </button>

              <button
                type="button"
                data-testid="kubekcraft-menu-exit"
                onClick={() => {
                  if (hostWindow) closeWindow(hostWindow.id);
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Exit to OS</span>
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="relative z-10 w-full flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-white/[0.08] pt-3">
            <span>IndexedDB Chunk Persistence Ready</span>
            <span>Three.js WebGL Voxel Engine</span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. CREATE NEW WORLD SCREEN                                           */}
      {/* ==================================================================== */}
      {screen === 'CREATE_WORLD' && (
        <div
          data-testid="kubekcraft-create-world-screen"
          className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-[#050914]"
        >
          <form
            onSubmit={(e) => void handleCreateAndLaunchWorld(e)}
            className="w-full max-w-xl rounded-2xl bg-[#080f20] border border-white/[0.12] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>Create New Voxel World</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Configure deterministic seed, survival rules, and terrain generator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScreen('MAIN_MENU')}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-slate-300 cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">World Name</label>
                <input
                  type="text"
                  data-testid="kubekcraft-world-name-input"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  placeholder="My KubekCraft World"
                  className="w-full px-3 py-2 rounded-xl bg-[#050914] border border-white/[0.14] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">World Seed</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    data-testid="kubekcraft-world-seed-input"
                    value={newWorldSeed}
                    onChange={(e) => setNewWorldSeed(e.target.value)}
                    placeholder="Random Seed"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#050914] border border-white/[0.14] font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    title="Generate Random Seed"
                    onClick={() =>
                      setNewWorldSeed(
                        `KUBEK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
                      )
                    }
                    className="px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">Game Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['SURVIVAL', 'CREATIVE', 'PEACEFUL'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-testid={`kubekcraft-mode-${m.toLowerCase()}`}
                      onClick={() => setNewGameMode(m)}
                      className={`py-2 rounded-xl font-semibold text-[11px] cursor-pointer ${
                        newGameMode === m
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-[#050914] border border-white/10 text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">Difficulty</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['PEACEFUL', 'EASY', 'NORMAL', 'HARD'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDifficulty(d)}
                      className={`py-2 rounded-xl font-semibold text-[10px] cursor-pointer ${
                        newDifficulty === d
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-[#050914] border border-white/10 text-slate-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-slate-300 font-medium">World Generation Style</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['STANDARD', 'AMPLIFIED', 'ISLANDS', 'FLAT'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTerrainType(t)}
                      className={`py-2 rounded-xl font-semibold text-xs cursor-pointer ${
                        newTerrainType === t
                          ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200'
                          : 'bg-[#050914] border border-white/10 text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newGenCaves}
                  onChange={(e) => setNewGenCaves(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Underground Caves</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newGenStructures}
                  onChange={(e) => setNewGenStructures(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Flora & Ores</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newKeepInventory}
                  onChange={(e) => setNewKeepInventory(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Keep Inventory</span>
              </label>
            </div>

            <div className="pt-3 border-t border-white/[0.08] flex justify-end gap-2">
              <button
                type="submit"
                data-testid="kubekcraft-confirm-create-world"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg"
              >
                Generate & Enter World
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. SINGLEPLAYER WORLD LIST & IMPORT/EXPORT MANAGER                   */}
      {/* ==================================================================== */}
      {screen === 'WORLD_SELECT' && (
        <div
          data-testid="kubekcraft-world-select-screen"
          className="flex-1 flex flex-col p-6 gap-4 bg-[#050914] overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Saved Voxel Worlds</h2>
              <p className="text-xs text-slate-400">
                Worlds are stored persistently in IndexedDB with chunk-level deltas.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Import World JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('CREATE_WORLD')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New World</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('MAIN_MENU')}
                className="px-3 py-2 rounded-xl bg-white/[0.06] text-slate-300 cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {savedWorlds.length === 0 ? (
              <div className="h-56 rounded-2xl border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                <Gamepad2 className="w-8 h-8 text-cyan-400" />
                <span>No worlds created yet. Create a new world or import a save file!</span>
              </div>
            ) : (
              savedWorlds.map((w) => (
                <div
                  key={w.id}
                  data-testid={`kubekcraft-world-item-${w.id}`}
                  className="p-4 rounded-2xl bg-[#091122] border border-white/[0.1] flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    {renamingWorldId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-400 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await renameSavedWorld(w.id, renameValue);
                            setRenamingWorldId(null);
                            await refreshWorldList();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-400 text-slate-950 text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{w.name}</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                          {w.gameMode}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.07] text-slate-300 font-mono text-[10px]">
                          Seed: {w.seed}
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 font-mono">
                      Day {w.dayCount} • Pos ({Math.round(w.player.x)}, {Math.round(w.player.y)},{' '}
                      {Math.round(w.player.z)}) • Last played:{' '}
                      {new Date(w.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      data-testid={`kubekcraft-load-world-${w.id}`}
                      onClick={() => void launchWorldSession(w.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Play</span>
                    </button>
                    <button
                      type="button"
                      title="Rename World"
                      onClick={() => {
                        setRenamingWorldId(w.id);
                        setRenameValue(w.name);
                      }}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Export World Bundle JSON"
                      onClick={() => void handleExportWorld(w.id, w.name)}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-emerald-300 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete World"
                      onClick={async () => {
                        await deleteSavedWorld(w.id);
                        await refreshWorldList();
                        showBanner(`Deleted world "${w.name}"`);
                      }}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. LOADING SCREEN                                                    */}
      {/* ==================================================================== */}
      {screen === 'LOADING' && (
        <div
          data-testid="kubekcraft-loading-screen"
          className="flex-1 flex flex-col items-center justify-center p-8 bg-[#040711] text-center space-y-5"
        >
          <Box className="w-12 h-12 text-cyan-400 animate-spin" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              Generating Procedural Voxel Chunks & Underground Caverns...
            </h2>
            <p className="text-xs text-slate-400">{loadingTip}</p>
          </div>
          <div className="w-72 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
            <div
              style={{ width: `${loadingProgress}%` }}
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-150"
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. SETTINGS SCREEN (Graphics, Audio, Controls & World Seed)          */}
      {/* ==================================================================== */}
      {screen === 'SETTINGS' && (
        <div
          data-testid="kubekcraft-settings-screen"
          className="flex-1 overflow-y-auto p-6 bg-[#050914] flex justify-center"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#080f20] border border-white/[0.12] p-6 space-y-6 text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  KubekCraft Engine & Controls Settings
                </h2>
                {activeWorld && (
                  <p className="text-[11px] font-mono text-cyan-300 mt-0.5">
                    Active World: "{activeWorld.name}" • Seed: {activeWorld.seed}
                  </p>
                )}
              </div>
              <button
                type="button"
                data-testid="kubekcraft-settings-back-btn"
                onClick={() => setScreen(returnScreenAfterSettings)}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Graphics & Performance */}
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase text-cyan-400">
                Graphics & Chunk Streaming
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH', 'CUSTOM'] as GraphicsPreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateSettings({ graphicsPreset: p })}
                    className={`py-2 rounded-xl font-semibold cursor-pointer ${
                      settings.graphicsPreset === p
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-[#050914] border border-white/10 text-slate-300'
                    }`}
                  >
                    Preset: {p}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Render Distance</span>
                    <strong className="text-cyan-300">{settings.renderDistance} Chunks</strong>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={settings.renderDistance}
                    onChange={(e) =>
                      updateSettings({
                        graphicsPreset: 'CUSTOM',
                        renderDistance: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Field of View (FOV)</span>
                    <strong className="text-cyan-300">{settings.fov}°</strong>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={105}
                    value={settings.fov}
                    onChange={(e) => updateSettings({ fov: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Mouse Sensitivity</span>
                    <strong className="text-cyan-300">
                      {Math.round(settings.mouseSensitivity * 10000)}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={45}
                    value={Math.round(settings.mouseSensitivity * 10000)}
                    onChange={(e) =>
                      updateSettings({ mouseSensitivity: Number(e.target.value) / 10000 })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showFps}
                    onChange={(e) => updateSettings({ showFps: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Show FPS Counter</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCoordinates}
                    onChange={(e) => updateSettings({ showCoordinates: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Show Coordinates</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ambientParticles}
                    onChange={(e) => updateSettings({ ambientParticles: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Weather Particles</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#050914] border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.invertMouseY}
                    onChange={(e) => updateSettings({ invertMouseY: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Invert Mouse Y</span>
                </label>
              </div>
            </div>

            {/* Audio Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-cyan-400">
                  Synthesized Sound Engine
                </span>
                <button
                  type="button"
                  onClick={() => updateSettings({ muted: !settings.muted })}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.08] text-slate-200 cursor-pointer"
                >
                  {settings.muted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Audio Active</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1">
                  <div className="flex justify-between">
                    <span>Master Volume</span>
                    <strong>{Math.round(settings.masterVolume * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.masterVolume * 100)}
                    onChange={(e) =>
                      updateSettings({ masterVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1">
                  <div className="flex justify-between">
                    <span>Sound Effects</span>
                    <strong>{Math.round(settings.sfxVolume * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.sfxVolume * 100)}
                    onChange={(e) =>
                      updateSettings({ sfxVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div className="p-3 rounded-xl bg-[#050914] border border-white/10 space-y-1">
                  <div className="flex justify-between">
                    <span>Ambient Synth</span>
                    <strong>{Math.round(settings.musicVolume * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.musicVolume * 100)}
                    onChange={(e) =>
                      updateSettings({ musicVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Keybindings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-cyan-400">
                  Configurable Key Bindings (Click to Rebind)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      keyBindings: { ...DEFAULT_KUBEKCRAFT_SETTINGS.keyBindings },
                    })
                  }
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Reset Default Keys
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(settings.keyBindings) as Array<keyof KeyBindings>).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRebindingKey(k)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer ${
                      rebindingKey === k
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#050914] border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="capitalize">{k}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/10 text-white">
                      {rebindingKey === k ? 'Press Key...' : settings.keyBindings[k]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. CREDITS SCREEN                                                    */}
      {/* ==================================================================== */}
      {screen === 'CREDITS' && (
        <div
          data-testid="kubekcraft-credits-screen"
          className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050914] text-center space-y-5"
        >
          <div className="max-w-lg p-6 rounded-2xl bg-[#091122] border border-white/[0.12] space-y-4 text-xs">
            <h2 className="text-xl font-bold text-cyan-300">KubekCraft — Credits & Architecture</h2>
            <p className="text-slate-300 leading-relaxed">
              Designed and engineered natively for <strong>KubekOS</strong>. Powered by Three.js WebGL chunk meshing, deterministic multi-octave Simplex/Perlin procedural terrain generation, synthesized Web Audio API sound design, and Dexie.js IndexedDB persistence.
            </p>
            <div className="grid grid-cols-2 gap-2 text-left font-mono text-[11px] text-slate-400 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-950">• 45+ Blocks & Ores</div>
              <div className="p-2.5 rounded-xl bg-slate-950">• 35+ Tools, Foods & Armor</div>
              <div className="p-2.5 rounded-xl bg-slate-950">• 8 Procedural Biomes</div>
              <div className="p-2.5 rounded-xl bg-slate-950">• Chunk Delta Persistence</div>
            </div>
            <button
              type="button"
              onClick={() => setScreen('MAIN_MENU')}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer"
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. ACTIVE 3D GAME VIEWPORT, HUD, INVENTORY, PAUSE & DEATH OVERLAYS   */}
      {/* ==================================================================== */}
      {screen === 'IN_GAME' && activeWorld && (
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* Three.js WebGL Canvas Container */}
          <div
            ref={viewportContainerRef}
            data-testid="kubekcraft-3d-viewport"
            onClick={() => {
              if (!isPaused && !isInventoryOpen && !isDead) {
                try {
                  viewportContainerRef.current?.requestPointerLock?.();
                } catch {
                  // Ignore if pointer lock is unsupported in headless browser
                }
              }
            }}
            className="w-full h-full cursor-crosshair"
          />

          {/* In-Game HUD Overlay */}
          <InGameHUD
            health={health}
            maxHealth={20}
            hunger={hunger}
            armor={armorSlot ? getItemDef(armorSlot.itemId).armorDefense ?? 0 : 0}
            gameMode={activeWorld.gameMode}
            isFlying={isFlying}
            inWater={inWater}
            inventory={inventory}
            selectedHotbarSlot={selectedHotbarSlot}
            onSelectHotbarSlot={(idx) => setSelectedHotbarSlot(idx)}
            miningProgress={miningProgress}
            targetedBlockId={targetedBlockId}
            playerCoords={playerCoords}
            biome={currentBiome}
            timeLabel={timeLabel}
            dayCount={dayCount}
            weather={weather}
            fps={fps}
            showFps={settings.showFps}
            showCoordinates={settings.showCoordinates}
            showBiome={settings.showBiome}
            isPointerLocked={isPointerLocked}
            pickupToasts={pickupToasts}
            onRequestPointerLock={() => {
              try {
                viewportContainerRef.current?.requestPointerLock?.();
              } catch {
                // Ignore
              }
            }}
            onOpenInventory={() => {
              if (document.pointerLockElement) document.exitPointerLock?.();
              setIsWorkbenchOpen(false);
              setActiveContainerKey(null);
              setIsInventoryOpen(true);
            }}
            onQuickSave={() => void persistCurrentWorld(true)}
            onOpenPauseMenu={() => {
              if (document.pointerLockElement) document.exitPointerLock?.();
              setIsPaused(true);
            }}
          />

          {/* Automated / Accessibility Quick Action Bar at Bottom-Left */}
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              data-testid="kubekcraft-mine-target-btn"
              title="Mine Targeted Block (Left Click)"
              onClick={() => {
                const hit = raycastHitRef.current;
                if (hit) {
                  breakBlockAt(hit.blockX, hit.blockY, hit.blockZ);
                } else {
                  // Mine block directly in front/below player if no raycast hit
                  const p = playerRef.current;
                  const bx = Math.floor(p.x - Math.sin(p.yaw));
                  const by = Math.floor(p.y);
                  const bz = Math.floor(p.z - Math.cos(p.yaw));
                  if (!breakBlockAt(bx, by, bz)) {
                    breakBlockAt(Math.floor(p.x), Math.floor(p.y - 1), Math.floor(p.z));
                  }
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-[#060b17]/85 hover:bg-cyan-500/20 border border-white/10 text-[10px] font-mono text-slate-300 cursor-pointer"
            >
              Mine Block
            </button>
            <button
              type="button"
              data-testid="kubekcraft-place-target-btn"
              title="Place Selected Block / Use Item (Right Click)"
              onClick={() => {
                if (raycastHitRef.current) {
                  handleRightClickAction();
                } else {
                  const cm = chunkManagerRef.current;
                  const held = inventoryRef.current[selectedSlotRef.current];
                  if (cm && held && getItemDef(held.itemId).isBlock) {
                    const p = playerRef.current;
                    const px = Math.floor(p.x - Math.sin(p.yaw) * 2);
                    const py = Math.floor(p.y);
                    const pz = Math.floor(p.z - Math.cos(p.yaw) * 2);
                    if (cm.setBlock(px, py, pz, held.itemId)) {
                      if (activeWorld.gameMode !== 'CREATIVE') {
                        const nextInv = inventoryRef.current.map((s) =>
                          s ? { ...s } : null
                        );
                        nextInv[selectedSlotRef.current]!.count -= 1;
                        if (nextInv[selectedSlotRef.current]!.count <= 0) {
                          nextInv[selectedSlotRef.current] = null;
                        }
                        inventoryRef.current = nextInv;
                        setInventory(nextInv);
                      }
                    }
                  }
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-[#060b17]/85 hover:bg-cyan-500/20 border border-white/10 text-[10px] font-mono text-slate-300 cursor-pointer"
            >
              Place / Use
            </button>
          </div>

          {/* Inventory, Crafting & Container Modal */}
          {isInventoryOpen && (
            <InventoryAndCraftingModal
              inventory={inventory}
              armorSlot={armorSlot}
              gameMode={activeWorld.gameMode}
              isWorkbenchOpen={isWorkbenchOpen}
              discoveredRecipes={discoveredRecipes}
              activeContainerKey={activeContainerKey}
              activeContainer={
                activeContainerKey ? containers[activeContainerKey] ?? null : null
              }
              onUpdateInventory={(nextSlots, nextArmor) => {
                inventoryRef.current = nextSlots;
                setInventory(nextSlots);
                if (nextArmor !== undefined) setArmorSlot(nextArmor);
                const ownedIds = nextSlots
                  .filter((s): s is InventorySlot => Boolean(s && s.itemId > 0))
                  .map((s) => s.itemId);
                checkAndUnlockRecipes(ownedIds);
              }}
              onUpdateContainer={(key, nextState) => {
                setContainers((prev) => ({ ...prev, [key]: nextState }));
              }}
              onCraftRecipe={handleCraftRecipe}
              onCraftGridOutput={(outputSlot, recipe) => {
                audioRef.current?.playCraftChime();
                const outDef = getItemDef(outputSlot.itemId);
                showBanner(
                  recipe
                    ? `Crafted ${recipe.name}`
                    : `Repaired ${outDef.name} (${outputSlot.durability} Durability)`
                );
                checkAndUnlockRecipes([outputSlot.itemId]);
              }}
              onDropSlotItem={dropItemFromSlot}
              onClose={() => {
                setIsInventoryOpen(false);
                setIsWorkbenchOpen(false);
                setActiveContainerKey(null);
              }}
            />
          )}

          {/* Pause Menu Overlay */}
          {isPaused && !isDead && (
            <div
              data-testid="kubekcraft-pause-overlay"
              className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm rounded-2xl bg-[#080f20] border border-white/[0.14] p-6 space-y-3 text-center shadow-2xl">
                <h2 className="text-lg font-bold text-white">Game Paused</h2>
                <p className="text-xs text-slate-400 font-mono">
                  {activeWorld.name} • Seed: {activeWorld.seed}
                </p>

                <div className="space-y-2 pt-2 text-xs">
                  <button
                    type="button"
                    data-testid="kubekcraft-resume-btn"
                    onClick={() => setIsPaused(false)}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Resume Game
                  </button>

                  <button
                    type="button"
                    onClick={() => void persistCurrentWorld(true)}
                    className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-emerald-300 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save World Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextMode: GameMode =
                        activeWorld.gameMode === 'SURVIVAL'
                          ? 'CREATIVE'
                          : activeWorld.gameMode === 'CREATIVE'
                            ? 'PEACEFUL'
                            : 'SURVIVAL';
                      setActiveWorld({ ...activeWorld, gameMode: nextMode });
                      showBanner(`Switched Game Mode to ${nextMode}`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
                  >
                    Mode: {activeWorld.gameMode} (Click to Cycle)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnScreenAfterSettings('IN_GAME');
                      setScreen('SETTINGS');
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
                  >
                    Settings & Keybindings
                  </button>

                  <button
                    type="button"
                    data-testid="kubekcraft-save-and-quit-btn"
                    onClick={() => {
                      void persistCurrentWorld(false);
                      setIsPaused(false);
                      setScreen('MAIN_MENU');
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold cursor-pointer"
                  >
                    Save & Quit to Title
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Death Screen Overlay */}
          {isDead && (
            <div
              data-testid="kubekcraft-death-overlay"
              className="absolute inset-0 z-50 bg-rose-950/85 backdrop-blur-md flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm rounded-2xl bg-[#14070c] border border-rose-500/40 p-6 space-y-4 text-center shadow-2xl">
                <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
                <div>
                  <h2 className="text-2xl font-black text-rose-200">YOU DIED</h2>
                  <p className="text-xs text-rose-300/80 mt-1">{deathReason}</p>
                </div>

                <div className="space-y-2 pt-2 text-xs">
                  <button
                    type="button"
                    data-testid="kubekcraft-respawn-btn"
                    onClick={handleRespawn}
                    className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Respawn at Spawn Point</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      handleRespawn();
                      await persistCurrentWorld(false);
                      setScreen('MAIN_MENU');
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    Return to Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
