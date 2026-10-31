/**
 * KubekCraft — Polished HUD, 2x2 & 3x3 Grid Crafting, Recipe Book, Chest & Furnace UI
 * Designed to match the KubekOS Obsidian Aurora aesthetic while delivering an
 * authentic, responsive voxel sandbox survival interface.
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Backpack,
  BookOpen,
  Box,
  CloudRain,
  CloudSnow,
  Compass,
  Flame,
  Grid,
  Hammer,
  Heart,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  BLOCK_IDS,
  ITEM_REGISTRY_LIST,
  canHarvestBlockDrop,
  getItemDef,
} from './BlockRegistry';
import {
  CRAFTING_RECIPES,
  HOTBAR_SLOTS,
  SMELTING_RECIPES,
  addItemToInventory,
  canCraftRecipe,
  consumeCraftingGridIngredients,
  countItemInInventory,
  findSmeltingRecipe,
  getFuelBurnSeconds,
  isAnyPlankItem,
  matchCraftingGrid,
  populateCraftingGridFromInventory,
  returnGridItemsToInventory,
} from './CraftingManager';
import { getItemIconDataUrl } from './TextureAtlas';
import type {
  BiomeId,
  ContainerState,
  CraftingRecipe,
  GameMode,
  InventorySlot,
  ItemCategory,
  PickupToast,
  WeatherType,
} from './types';

// ============================================================================
// REUSABLE ITEM SLOT COMPONENT
// ============================================================================

export interface ItemSlotViewProps {
  slot: InventorySlot | null;
  ghostItemId?: number | null;
  selected?: boolean;
  hotkeyLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  testId?: string;
}

export const ItemSlotView: React.FC<ItemSlotViewProps> = ({
  slot,
  ghostItemId = null,
  selected = false,
  hotkeyLabel,
  size = 'md',
  onClick,
  onContextMenu,
  onMouseEnter,
  testId,
}) => {
  const def = slot ? getItemDef(slot.itemId) : ghostItemId ? getItemDef(ghostItemId) : null;
  const iconUrl = slot
    ? getItemIconDataUrl(slot.itemId)
    : ghostItemId
      ? getItemIconDataUrl(ghostItemId)
      : '';
  const maxDur = def?.maxDurability ?? 0;
  const curDur = slot?.durability ?? maxDur;
  const durRatio = maxDur > 0 ? Math.max(0, Math.min(1, curDur / maxDur)) : 1;

  const sizeClass =
    size === 'lg' ? 'w-13 h-13' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      }}
      onMouseEnter={onMouseEnter}
      title={def ? `${def.name} — ${def.description}` : 'Empty Slot'}
      className={`relative ${sizeClass} rounded-xl flex items-center justify-center transition-all select-none cursor-pointer ${
        selected
          ? 'bg-cyan-500/25 border-2 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)] scale-105 z-10'
          : 'bg-[#090f1e]/90 hover:bg-[#111a30] border border-white/[0.12]'
      }`}
    >
      {hotkeyLabel && (
        <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-400 leading-none">
          {hotkeyLabel}
        </span>
      )}

      {slot && iconUrl && (
        <img
          src={iconUrl}
          alt={def?.name ?? 'Item'}
          className="w-7 h-7 object-contain pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {!slot && ghostItemId && iconUrl && (
        <img
          src={iconUrl}
          alt={def?.name ?? 'Recipe Guide'}
          className="w-6 h-6 object-contain pointer-events-none opacity-35 grayscale-[20%]"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {slot && slot.count > 1 && (
        <span className="absolute bottom-0.5 right-1 text-[10px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none">
          {slot.count}
        </span>
      )}

      {slot && maxDur > 0 && curDur < maxDur && (
        <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-950 rounded-full overflow-hidden">
          <div
            style={{ width: `${Math.round(durRatio * 100)}%` }}
            className={`h-full ${
              durRatio > 0.5
                ? 'bg-emerald-400'
                : durRatio > 0.25
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
            }`}
          />
        </div>
      )}
    </button>
  );
};

// ============================================================================
// IN-GAME HEADS-UP DISPLAY (HUD)
// ============================================================================

export interface InGameHudProps {
  health: number;
  maxHealth: number;
  hunger: number;
  armor: number;
  gameMode: GameMode;
  isFlying: boolean;
  inWater: boolean;
  inventory: Array<InventorySlot | null>;
  selectedHotbarSlot: number;
  onSelectHotbarSlot: (slotIndex: number) => void;
  miningProgress: number; // 0..1
  targetedBlockId: number | null;
  playerCoords: { x: number; y: number; z: number };
  biome: BiomeId;
  timeLabel: string;
  dayCount: number;
  weather: WeatherType;
  fps: number;
  showFps: boolean;
  showCoordinates: boolean;
  showBiome: boolean;
  isPointerLocked: boolean;
  pickupToasts: PickupToast[];
  onRequestPointerLock: () => void;
  onOpenInventory: () => void;
  onQuickSave: () => void;
  onOpenPauseMenu: () => void;
}

export const InGameHUD: React.FC<InGameHudProps> = ({
  health,
  maxHealth,
  hunger,
  armor,
  gameMode,
  isFlying,
  inWater,
  inventory,
  selectedHotbarSlot,
  onSelectHotbarSlot,
  miningProgress,
  targetedBlockId,
  playerCoords,
  biome,
  timeLabel,
  dayCount,
  weather,
  fps,
  showFps,
  showCoordinates,
  showBiome,
  isPointerLocked,
  pickupToasts,
  onRequestPointerLock,
  onOpenInventory,
  onQuickSave,
  onOpenPauseMenu,
}) => {
  const heldSlot = inventory[selectedHotbarSlot] ?? null;
  const heldDef = heldSlot ? getItemDef(heldSlot.itemId) : null;
  const targetedDef =
    targetedBlockId && targetedBlockId !== BLOCK_IDS.AIR ? getItemDef(targetedBlockId) : null;

  const canHarvestTarget =
    targetedDef && gameMode !== 'CREATIVE'
      ? canHarvestBlockDrop(targetedDef.id, heldSlot?.itemId ?? null)
      : true;

  const heldDurabilityLow =
    heldSlot &&
    heldDef?.maxDurability &&
    (heldSlot.durability ?? heldDef.maxDurability) <=
      Math.max(5, Math.floor(heldDef.maxDurability * 0.1));

  const isLowHunger = gameMode !== 'CREATIVE' && hunger <= 6;

  const heartsCount = 10;
  const hungerCount = 10;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 select-none overflow-hidden">
      {/* Top Bar: Telemetry & Quick Actions */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Telemetry Badge */}
        <div className="flex flex-wrap items-center gap-2 bg-[#060b17]/85 backdrop-blur-md border border-white/[0.12] px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-200 shadow-lg">
          {showCoordinates && (
            <span data-testid="kubekcraft-coords" className="flex items-center gap-1 text-cyan-300">
              <Compass className="w-3.5 h-3.5" />
              <span>
                XYZ: {playerCoords.x} / {playerCoords.y} / {playerCoords.z}
              </span>
            </span>
          )}
          {showBiome && (
            <span className="px-2 py-0.5 rounded-md bg-white/[0.07] text-emerald-300">
              {biome.replace('_', ' ')}
            </span>
          )}
          <span className="flex items-center gap-1 text-amber-300">
            {weather === 'RAIN' ? (
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            ) : weather === 'SNOW' ? (
              <CloudSnow className="w-3.5 h-3.5 text-slate-200" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              Day {dayCount} • {timeLabel}
            </span>
          </span>
          {showFps && (
            <span className="text-slate-400 border-l border-white/10 pl-2">{fps} FPS</span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase">
            {gameMode}
          </span>
          {isFlying && (
            <span className="px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-300">
              FLIGHT
            </span>
          )}
          {inWater && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-300">
              SWIMMING
            </span>
          )}
        </div>

        {/* Target Block Inspector Pill */}
        {targetedDef && (
          <div className="bg-[#060b17]/90 backdrop-blur-md border border-white/[0.14] px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xl">
            <img
              src={getItemIconDataUrl(targetedDef.id)}
              alt={targetedDef.name}
              className="w-5 h-5"
              style={{ imageRendering: 'pixelated' }}
            />
            <div>
              <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
                <span>{targetedDef.name}</span>
                {targetedDef.interactiveType && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                    Right-Click to Open
                  </span>
                )}
              </div>
              <div
                className={`text-[10px] font-mono ${
                  canHarvestTarget ? 'text-slate-400' : 'text-rose-400 font-semibold'
                }`}
              >
                {!canHarvestTarget
                  ? `Requires Tier ${targetedDef.minToolTier} ${targetedDef.preferredTool} to harvest!`
                  : targetedDef.preferredTool
                    ? `Tool: ${targetedDef.preferredTool}`
                    : 'Breakable by Hand'}
                {miningProgress > 0 && ` • ${Math.round(miningProgress * 100)}%`}
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Quick Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            data-testid="kubekcraft-open-inventory-btn"
            onClick={onOpenInventory}
            className="px-2.5 py-1.5 rounded-xl bg-[#060b17]/85 hover:bg-[#0f172a] border border-white/[0.12] text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Backpack className="w-3.5 h-3.5 text-cyan-400" />
            <span>Inventory [E]</span>
          </button>
          <button
            type="button"
            data-testid="kubekcraft-quick-save-btn"
            onClick={onQuickSave}
            className="px-2.5 py-1.5 rounded-xl bg-[#060b17]/85 hover:bg-[#0f172a] border border-white/[0.12] text-[11px] text-emerald-300 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            data-testid="kubekcraft-pause-btn"
            onClick={onOpenPauseMenu}
            className="px-2.5 py-1.5 rounded-xl bg-[#060b17]/85 hover:bg-[#0f172a] border border-white/[0.12] text-[11px] text-slate-200 cursor-pointer"
          >
            Pause [Esc]
          </button>
        </div>
      </div>

      {/* Center Crosshair & Mining Progress Ring */}
      <div className="relative self-center flex items-center justify-center">
        {!isPointerLocked && (
          <button
            type="button"
            data-testid="kubekcraft-engage-mouse-btn"
            onClick={onRequestPointerLock}
            className="pointer-events-auto mb-16 px-4 py-2 rounded-xl bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-[0_0_25px_rgba(6,182,212,0.5)] cursor-pointer transition-transform hover:scale-105"
          >
            Click Viewport to Lock Mouse & Look Around (WASD + Mouse)
          </button>
        )}

        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="w-4 h-[2px] bg-white/90 shadow-[0_0_4px_#000]" />
          <div className="h-4 w-[2px] bg-white/90 shadow-[0_0_4px_#000] absolute" />
          {miningProgress > 0 && (
            <svg className="absolute inset-0 w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={canHarvestTarget ? '#22d3ee' : '#f43f5e'}
                strokeWidth="3"
                strokeDasharray={`${miningProgress * 75.4} 75.4`}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Bottom HUD: Warnings, Survival Bars, Hotbar, and Pickup Toasts */}
      <div className="relative flex flex-col items-center gap-1.5">
        {/* Item Pickup Toast Notifications */}
        {pickupToasts.length > 0 && (
          <div className="absolute bottom-20 right-2 flex flex-col gap-1 items-end">
            {pickupToasts.slice(-4).map((t) => (
              <div
                key={t.id}
                className="px-2.5 py-1 rounded-lg bg-[#060b17]/90 border border-cyan-500/30 text-[11px] text-slate-100 flex items-center gap-1.5 shadow-lg"
              >
                <img
                  src={getItemIconDataUrl(t.itemId)}
                  alt={t.name}
                  className="w-4 h-4"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span>+{t.count}</span>
                <span className="text-cyan-300 font-medium">{t.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Gameplay Warning Pills (Low Durability / Low Hunger) */}
        {(heldDurabilityLow || isLowHunger) && (
          <div className="flex items-center gap-2">
            {heldDurabilityLow && heldDef && (
              <span
                data-testid="kubekcraft-low-durability-warning"
                className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono text-amber-200 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>
                  Low Durability: {heldDef.name} ({heldSlot?.durability} uses left)
                </span>
              </span>
            )}
            {isLowHunger && (
              <span
                data-testid="kubekcraft-low-hunger-warning"
                className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-[10px] font-mono text-rose-200 flex items-center gap-1"
              >
                <Flame className="w-3 h-3 text-rose-400" />
                <span>Hungry! Eat Berries, Apples, Bread, or Cooked Meat</span>
              </span>
            )}
          </div>
        )}

        {/* Selected Item Name Banner */}
        <div className="h-5 flex items-center justify-center">
          {heldDef ? (
            <span className="px-3 py-0.5 rounded-full bg-[#060b17]/85 border border-white/10 text-[11px] font-medium text-slate-100 shadow">
              {heldDef.name}
              {heldDef.attackDamage ? ` (${heldDef.attackDamage} ATK)` : ''}
              {heldDef.foodRestore ? ` (+${heldDef.foodRestore} Food - Right Click)` : ''}
              {heldDef.maxDurability && heldSlot?.durability !== undefined
                ? ` • ${heldSlot.durability}/${heldDef.maxDurability}`
                : ''}
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-[#060b17]/60 text-[10px] font-mono text-slate-400">
              Empty Hand — Punch trees to gather Wood Logs
            </span>
          )}
        </div>

        {/* Survival Health, Armor & Hunger Bars */}
        {gameMode !== 'CREATIVE' && (
          <div className="flex items-center justify-between w-[416px] max-w-full px-1">
            {/* Hearts */}
            <div className="flex items-center gap-0.5" title={`Health: ${health}/${maxHealth}`}>
              {Array.from({ length: heartsCount }).map((_, idx) => {
                const heartHp = (idx + 1) * 2;
                const full = health >= heartHp;
                const half = !full && health >= heartHp - 1;
                return (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 ${
                      full
                        ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]'
                        : half
                          ? 'text-rose-400 fill-rose-400/50'
                          : 'text-slate-700 fill-slate-900/80'
                    }`}
                  />
                );
              })}
              {armor > 0 && (
                <span className="ml-2 flex items-center gap-0.5 text-[11px] font-mono text-cyan-300">
                  <Shield className="w-3.5 h-3.5 fill-cyan-400/30" />
                  {armor}
                </span>
              )}
            </div>

            {/* Hunger */}
            <div className="flex items-center gap-0.5" title={`Hunger: ${hunger}/20`}>
              {Array.from({ length: hungerCount }).map((_, idx) => {
                const unit = (idx + 1) * 2;
                const full = hunger >= unit;
                const half = !full && hunger >= unit - 1;
                return (
                  <Flame
                    key={idx}
                    className={`w-4 h-4 ${
                      full
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]'
                        : half
                          ? 'text-amber-300 fill-amber-400/40'
                          : 'text-slate-700 fill-slate-900/80'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        <div
          data-testid="kubekcraft-hotbar"
          className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#050914]/90 backdrop-blur-xl border border-white/[0.15] shadow-[0_12px_40px_rgba(0,0,0,0.85)]"
        >
          {Array.from({ length: HOTBAR_SLOTS }).map((_, idx) => (
            <ItemSlotView
              key={idx}
              testId={`kubekcraft-hotbar-slot-${idx}`}
              slot={inventory[idx] ?? null}
              selected={selectedHotbarSlot === idx}
              hotkeyLabel={String(idx + 1)}
              onClick={() => onSelectHotbarSlot(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INVENTORY, 2x2 / 3x3 CRAFTING GRID, RECIPE BOOK, CHEST & FURNACE MODAL
// ============================================================================

export interface InventoryModalProps {
  inventory: Array<InventorySlot | null>;
  armorSlot: InventorySlot | null;
  gameMode: GameMode;
  isWorkbenchOpen?: boolean;
  discoveredRecipes?: string[];
  activeContainerKey: string | null;
  activeContainer: ContainerState | null;
  onUpdateInventory: (
    nextSlots: Array<InventorySlot | null>,
    nextArmor?: InventorySlot | null
  ) => void;
  onUpdateContainer: (key: string, nextState: ContainerState) => void;
  onCraftRecipe: (recipe: CraftingRecipe, times: number) => void;
  onCraftGridOutput?: (outputSlot: InventorySlot, recipe?: CraftingRecipe) => void;
  onDropSlotItem: (slotIndex: number) => void;
  onClose: () => void;
}

export const InventoryAndCraftingModal: React.FC<InventoryModalProps> = ({
  inventory,
  armorSlot,
  gameMode,
  isWorkbenchOpen = false,
  discoveredRecipes = [],
  activeContainerKey,
  activeContainer,
  onUpdateInventory,
  onUpdateContainer,
  onCraftGridOutput,
  onDropSlotItem,
  onClose,
}) => {
  const gridDim: 2 | 3 = isWorkbenchOpen ? 3 : 2;
  const gridSlotCount = gridDim * gridDim;

  const [activeTab, setActiveTab] = useState<'CRAFTING' | 'CREATIVE' | 'CONTAINER'>(
    activeContainer ? 'CONTAINER' : 'CRAFTING'
  );
  const [craftingGrid, setCraftingGrid] = useState<Array<InventorySlot | null>>(() =>
    new Array(gridSlotCount).fill(null)
  );
  const [cursorSlot, setCursorSlot] = useState<InventorySlot | null>(null);
  const [recipeCategory, setRecipeCategory] = useState<
    'ALL' | 'BUILDING' | 'TOOLS' | 'SURVIVAL' | 'MATERIALS'
  >('ALL');
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedPreviewRecipe, setSelectedPreviewRecipe] = useState<CraftingRecipe | null>(
    null
  );

  // Creative catalog search & category filter
  const [creativeSearch, setCreativeSearch] = useState('');
  const [creativeCategory, setCreativeCategory] = useState<'ALL' | ItemCategory>('ALL');

  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  // Live crafting grid evaluation
  const gridMatch = useMemo(
    () => matchCraftingGrid(craftingGrid, gridDim),
    [craftingGrid, gridDim]
  );

  // Combined inventory + crafting grid counts for Recipe Book display
  const combinedInventoryForCounts = useMemo(() => {
    return [...inventory, ...craftingGrid];
  }, [inventory, craftingGrid]);

  const discoveredSet = useMemo(() => new Set(discoveredRecipes), [discoveredRecipes]);

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    return CRAFTING_RECIPES.filter((r) => {
      if (recipeCategory !== 'ALL' && r.category !== recipeCategory) return false;
      if (discoveredOnly && !discoveredSet.has(r.id)) return false;
      if (craftableOnly && !canCraftRecipe(combinedInventoryForCounts, r, gridDim === 3)) {
        return false;
      }
      if (q && !r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [
    recipeCategory,
    discoveredOnly,
    discoveredSet,
    craftableOnly,
    combinedInventoryForCounts,
    gridDim,
    recipeSearch,
  ]);

  const filteredCreativeItems = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    return ITEM_REGISTRY_LIST.filter((item) => {
      if (item.id === BLOCK_IDS.AIR) return false;
      if (creativeCategory !== 'ALL' && item.category !== creativeCategory) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [creativeSearch, creativeCategory]);

  // Ghost item preview for the currently selected Recipe Book entry
  const ghostGridItemIds = useMemo(() => {
    const ghosts: Array<number | null> = new Array(gridSlotCount).fill(null);
    if (!selectedPreviewRecipe) return ghosts;
    const reqDim =
      selectedPreviewRecipe.gridSize ?? (selectedPreviewRecipe.requiresWorkbench ? 3 : 2);
    if (reqDim > gridDim) return ghosts;

    if (selectedPreviewRecipe.type === 'SHAPED' && selectedPreviewRecipe.pattern) {
      for (let r = 0; r < selectedPreviewRecipe.pattern.length && r < gridDim; r++) {
        const row = selectedPreviewRecipe.pattern[r]!;
        for (let c = 0; c < row.length && c < gridDim; c++) {
          ghosts[r * gridDim + c] = row[c] ?? null;
        }
      }
    } else if (
      selectedPreviewRecipe.type === 'SHAPELESS' &&
      selectedPreviewRecipe.shapelessIngredients
    ) {
      for (
        let i = 0;
        i < selectedPreviewRecipe.shapelessIngredients.length && i < gridSlotCount;
        i++
      ) {
        ghosts[i] = selectedPreviewRecipe.shapelessIngredients[i] ?? null;
      }
    }
    return ghosts;
  }, [selectedPreviewRecipe, gridDim, gridSlotCount]);

  // Return all items in crafting grid + cursor back to player inventory on close
  const handleSafeClose = () => {
    let workingInv = inventory.map((s) => (s ? { ...s } : null));
    const gridReturned = returnGridItemsToInventory(workingInv, craftingGrid);
    workingInv = gridReturned.updatedInventory;

    if (cursorSlot && cursorSlot.count > 0) {
      const cursorReturned = addItemToInventory(
        workingInv,
        cursorSlot.itemId,
        cursorSlot.count,
        cursorSlot.durability
      );
      workingInv = cursorReturned.updatedSlots;
    }

    onUpdateInventory(workingInv);
    setCraftingGrid(new Array(gridSlotCount).fill(null));
    setCursorSlot(null);
    onClose();
  };

  // Return crafting grid items to inventory without closing modal
  const handleClearCraftingGrid = () => {
    const res = returnGridItemsToInventory(inventory, craftingGrid);
    onUpdateInventory(res.updatedInventory);
    setCraftingGrid(res.leftoverSlots);
  };

  // Handle clicking a slot in the player's 36-slot inventory
  const handleInventorySlotClick = (
    idx: number,
    rightClick = false,
    shiftClick = false
  ) => {
    const next = inventory.map((s) => (s ? { ...s } : null));
    const target = next[idx] ?? null;

    // Shift+Click quick transfer between Hotbar (0..8) and Backpack (9..35)
    if (shiftClick && target && !cursorSlot) {
      const def = getItemDef(target.itemId);
      const maxStack = def.maxStack || 64;
      const destStart = idx < HOTBAR_SLOTS ? HOTBAR_SLOTS : 0;
      const destEnd = idx < HOTBAR_SLOTS ? 36 : HOTBAR_SLOTS;
      let left = target.count;

      if (maxStack > 1) {
        for (let i = destStart; i < destEnd && left > 0; i++) {
          const s = next[i];
          if (s && s.itemId === target.itemId && s.count < maxStack) {
            const add = Math.min(maxStack - s.count, left);
            s.count += add;
            left -= add;
          }
        }
      }
      for (let i = destStart; i < destEnd && left > 0; i++) {
        if (!next[i]) {
          const add = Math.min(maxStack, left);
          next[i] = {
            itemId: target.itemId,
            count: add,
            durability: target.durability,
          };
          left -= add;
        }
      }

      next[idx] = left > 0 ? { ...target, count: left } : null;
      onUpdateInventory(next);
      return;
    }

    if (!cursorSlot) {
      if (!target) return;
      if (rightClick && target.count > 1) {
        const half = Math.ceil(target.count / 2);
        setCursorSlot({ ...target, count: half });
        target.count -= half;
        onUpdateInventory(next);
      } else {
        setCursorSlot(target);
        next[idx] = null;
        onUpdateInventory(next);
      }
      return;
    }

    // Clicking while holding cursorSlot
    if (!target) {
      if (rightClick && cursorSlot.count > 1) {
        next[idx] = { ...cursorSlot, count: 1 };
        setCursorSlot({ ...cursorSlot, count: cursorSlot.count - 1 });
      } else {
        next[idx] = cursorSlot;
        setCursorSlot(null);
      }
      onUpdateInventory(next);
      return;
    }

    const def = getItemDef(target.itemId);
    if (target.itemId === cursorSlot.itemId && def.maxStack > 1 && target.count < def.maxStack) {
      const addAmount = rightClick ? 1 : cursorSlot.count;
      const space = def.maxStack - target.count;
      const transfer = Math.min(space, addAmount);
      target.count += transfer;
      const rem = cursorSlot.count - transfer;
      setCursorSlot(rem > 0 ? { ...cursorSlot, count: rem } : null);
      onUpdateInventory(next);
      return;
    }

    // Swap
    next[idx] = cursorSlot;
    setCursorSlot(target);
    onUpdateInventory(next);
  };

  // Handle clicking one of the 2x2 or 3x3 crafting grid input slots
  const handleCraftingGridSlotClick = (gIdx: number, rightClick = false) => {
    const nextGrid = craftingGrid.map((s) => (s ? { ...s } : null));
    const target = nextGrid[gIdx] ?? null;

    if (!cursorSlot) {
      if (!target) return;
      if (rightClick && target.count > 1) {
        const half = Math.ceil(target.count / 2);
        setCursorSlot({ ...target, count: half });
        target.count -= half;
        setCraftingGrid(nextGrid);
      } else {
        setCursorSlot(target);
        nextGrid[gIdx] = null;
        setCraftingGrid(nextGrid);
      }
      return;
    }

    if (!target) {
      if (rightClick && cursorSlot.count > 1) {
        nextGrid[gIdx] = { ...cursorSlot, count: 1 };
        setCursorSlot({ ...cursorSlot, count: cursorSlot.count - 1 });
      } else {
        nextGrid[gIdx] = cursorSlot;
        setCursorSlot(null);
      }
      setCraftingGrid(nextGrid);
      return;
    }

    const def = getItemDef(target.itemId);
    if (target.itemId === cursorSlot.itemId && def.maxStack > 1 && target.count < def.maxStack) {
      const addAmount = rightClick ? 1 : cursorSlot.count;
      const space = def.maxStack - target.count;
      const transfer = Math.min(space, addAmount);
      target.count += transfer;
      const rem = cursorSlot.count - transfer;
      setCursorSlot(rem > 0 ? { ...cursorSlot, count: rem } : null);
      setCraftingGrid(nextGrid);
      return;
    }

    // Swap cursor with grid slot
    nextGrid[gIdx] = cursorSlot;
    setCursorSlot(target);
    setCraftingGrid(nextGrid);
  };

  // Collect crafted output from the Result Slot (consumes ingredients from grid)
  const handleCollectCraftedResult = () => {
    if (!gridMatch) return;
    const { output, recipe } = gridMatch;
    const outDef = getItemDef(output.itemId);

    // If holding an incompatible item on cursor, try placing directly into player inventory
    if (cursorSlot && cursorSlot.itemId !== output.itemId) {
      const added = addItemToInventory(
        inventory,
        output.itemId,
        output.count,
        output.durability
      );
      if (added.remaining > 0) return;
      onUpdateInventory(added.updatedSlots);
      setCraftingGrid(consumeCraftingGridIngredients(craftingGrid));
      onCraftGridOutput?.(output, recipe);
      return;
    }

    // Place crafted output directly into player inventory (and if full, onto cursor)
    const added = addItemToInventory(
      inventory,
      output.itemId,
      output.count,
      output.durability
    );
    if (added.remaining === 0) {
      onUpdateInventory(added.updatedSlots);
      setCraftingGrid(consumeCraftingGridIngredients(craftingGrid));
      onCraftGridOutput?.(output, recipe);
      return;
    }

    // Fallback to cursor slot if inventory has no room
    if (!cursorSlot) {
      setCursorSlot({ ...output });
      setCraftingGrid(consumeCraftingGridIngredients(craftingGrid));
      onCraftGridOutput?.(output, recipe);
    } else if (
      cursorSlot.itemId === output.itemId &&
      outDef.maxStack > 1 &&
      cursorSlot.count + output.count <= outDef.maxStack
    ) {
      setCursorSlot({
        ...cursorSlot,
        count: cursorSlot.count + output.count,
      });
      setCraftingGrid(consumeCraftingGridIngredients(craftingGrid));
      onCraftGridOutput?.(output, recipe);
    }
  };

  // Select a recipe in the Recipe Book to preview its pattern and auto-arrange owned ingredients
  const handleSelectRecipeBookEntry = (recipe: CraftingRecipe) => {
    setSelectedPreviewRecipe(recipe);
    const reqDim = recipe.gridSize ?? (recipe.requiresWorkbench ? 3 : 2);
    if (reqDim > gridDim) return;

    const arranged = populateCraftingGridFromInventory(
      inventory,
      craftingGrid,
      gridDim,
      recipe
    );
    if (arranged.placed) {
      onUpdateInventory(arranged.updatedInventory);
      setCraftingGrid(arranged.updatedGrid);
    }
  };

  const handleArmorSlotClick = () => {
    if (!cursorSlot) {
      if (armorSlot) {
        setCursorSlot(armorSlot);
        onUpdateInventory(inventory, null);
      }
      return;
    }
    const def = getItemDef(cursorSlot.itemId);
    if (def.category === 'ARMOR') {
      const prev = armorSlot;
      onUpdateInventory(inventory, cursorSlot);
      setCursorSlot(prev);
    }
  };

  const handleContainerSlotClick = (cIdx: number, rightClick = false) => {
    if (!activeContainerKey || !activeContainer) return;
    const nextSlots = activeContainer.slots.map((s) => (s ? { ...s } : null));
    const target = nextSlots[cIdx] ?? null;

    if (!cursorSlot) {
      if (!target) return;
      if (rightClick && target.count > 1) {
        const half = Math.ceil(target.count / 2);
        setCursorSlot({ ...target, count: half });
        target.count -= half;
      } else {
        setCursorSlot(target);
        nextSlots[cIdx] = null;
      }
      onUpdateContainer(activeContainerKey, { ...activeContainer, slots: nextSlots });
      return;
    }

    // Prevent placing arbitrary items into Furnace Output slot (slot 2)
    if (activeContainer.type === 'FURNACE' && cIdx === 2) {
      if (
        target &&
        target.itemId === cursorSlot.itemId &&
        cursorSlot.count + target.count <= (getItemDef(target.itemId).maxStack || 64)
      ) {
        setCursorSlot({ ...cursorSlot, count: cursorSlot.count + target.count });
        nextSlots[2] = null;
        onUpdateContainer(activeContainerKey, { ...activeContainer, slots: nextSlots });
      }
      return;
    }

    if (!target) {
      if (rightClick && cursorSlot.count > 1) {
        nextSlots[cIdx] = { ...cursorSlot, count: 1 };
        setCursorSlot({ ...cursorSlot, count: cursorSlot.count - 1 });
      } else {
        nextSlots[cIdx] = cursorSlot;
        setCursorSlot(null);
      }
      onUpdateContainer(activeContainerKey, { ...activeContainer, slots: nextSlots });
      return;
    }

    const def = getItemDef(target.itemId);
    if (target.itemId === cursorSlot.itemId && def.maxStack > 1 && target.count < def.maxStack) {
      const addAmount = rightClick ? 1 : cursorSlot.count;
      const transfer = Math.min(def.maxStack - target.count, addAmount);
      target.count += transfer;
      const rem = cursorSlot.count - transfer;
      setCursorSlot(rem > 0 ? { ...cursorSlot, count: rem } : null);
      onUpdateContainer(activeContainerKey, { ...activeContainer, slots: nextSlots });
      return;
    }

    nextSlots[cIdx] = cursorSlot;
    setCursorSlot(target);
    onUpdateContainer(activeContainerKey, { ...activeContainer, slots: nextSlots });
  };

  const hoveredDef = hoveredItemId ? getItemDef(hoveredItemId) : null;

  // Furnace progress telemetry
  const furnaceProgressPct =
    activeContainer?.type === 'FURNACE'
      ? Math.min(100, Math.round((activeContainer.smeltProgress ?? 0) * 100))
      : 0;
  const furnaceFuelPct =
    activeContainer?.type === 'FURNACE' && (activeContainer.maxFuelTime ?? 0) > 0
      ? Math.min(
          100,
          Math.round(
            ((activeContainer.fuelRemaining ?? 0) / (activeContainer.maxFuelTime ?? 1)) * 100
          )
        )
      : 0;

  return (
    <div
      data-testid="kubekcraft-inventory-modal"
      className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
    >
      <div className="w-full max-w-5xl max-h-full bg-[#070d1b] border border-white/[0.14] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3 bg-[#091124] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="kubekcraft-crafting-tab-btn"
              onClick={() => setActiveTab('CRAFTING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                activeTab === 'CRAFTING'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/[0.06] text-slate-300 hover:text-white'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>
                {isWorkbenchOpen
                  ? 'Crafting Table (3×3 Grid)'
                  : 'Personal Inventory & Crafting (2×2 Grid)'}
              </span>
            </button>

            {gameMode === 'CREATIVE' && (
              <button
                type="button"
                data-testid="kubekcraft-creative-catalog-tab"
                onClick={() => setActiveTab('CREATIVE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeTab === 'CREATIVE'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-white/[0.06] text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Creative Block & Item Catalog</span>
              </button>
            )}

            {activeContainer && (
              <button
                type="button"
                data-testid="kubekcraft-container-tab-btn"
                onClick={() => setActiveTab('CONTAINER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeTab === 'CONTAINER'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/[0.06] text-amber-300 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>
                  {activeContainer.type === 'FURNACE' ? 'Smelting Furnace' : 'Storage Chest'}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {cursorSlot && (
              <div
                data-testid="kubekcraft-cursor-holding"
                className="flex items-center gap-2 px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-xs text-cyan-200"
              >
                <span>
                  Holding: <strong>{getItemDef(cursorSlot.itemId).name}</strong> (x
                  {cursorSlot.count})
                </span>
              </div>
            )}
            <button
              type="button"
              data-testid="kubekcraft-close-inventory-btn"
              onClick={handleSafeClose}
              className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-rose-500/80 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): Backpack, Hotbar, Armor & Inspector */}
          <div className="lg:col-span-7 flex flex-col gap-3.5">
            {/* Armor & Character Strip */}
            <div className="p-3 rounded-xl bg-[#0b1326] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ItemSlotView
                  testId="kubekcraft-armor-slot"
                  slot={armorSlot}
                  onClick={handleArmorSlotClick}
                  onMouseEnter={() => setHoveredItemId(armorSlot?.itemId ?? null)}
                />
                <div>
                  <div className="text-xs font-semibold text-white">Equipped Armor Slot</div>
                  <div className="text-[11px] text-slate-400">
                    {armorSlot
                      ? `${getItemDef(armorSlot.itemId).name} (+${getItemDef(armorSlot.itemId).armorDefense ?? 0} Defense)`
                      : 'Click with crafted Tunic, Cuirass, or Aegis to equip'}
                  </div>
                </div>
              </div>

              {cursorSlot && (
                <button
                  type="button"
                  onClick={() => setCursorSlot(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] hover:bg-rose-500/30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard Held</span>
                </button>
              )}
            </div>

            {/* Main 27-Slot Backpack Grid */}
            <div className="p-3.5 rounded-xl bg-[#0b1326] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                <span>Backpack Storage (27 Slots)</span>
                <span>L-Click: Move • R-Click: Split/Place 1 • Shift+Click: Quick Move</span>
              </div>
              <div className="grid grid-cols-9 gap-1.5 justify-items-center">
                {Array.from({ length: 27 }).map((_, idx) => {
                  const slotIdx = idx + HOTBAR_SLOTS;
                  const s = inventory[slotIdx] ?? null;
                  return (
                    <ItemSlotView
                      key={slotIdx}
                      testId={`kubekcraft-inv-slot-${slotIdx}`}
                      slot={s}
                      onClick={(e) => handleInventorySlotClick(slotIdx, false, e.shiftKey)}
                      onContextMenu={() => handleInventorySlotClick(slotIdx, true, false)}
                      onMouseEnter={() => setHoveredItemId(s?.itemId ?? null)}
                    />
                  );
                })}
              </div>
            </div>

            {/* 9-Slot Active Hotbar */}
            <div className="p-3.5 rounded-xl bg-[#0b1326] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-cyan-400">
                <span>Active Hotbar (Keys 1–9)</span>
                <span>Press Q in-game to drop held item</span>
              </div>
              <div className="grid grid-cols-9 gap-1.5 justify-items-center">
                {Array.from({ length: HOTBAR_SLOTS }).map((_, idx) => {
                  const s = inventory[idx] ?? null;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <ItemSlotView
                        testId={`kubekcraft-modal-hotbar-${idx}`}
                        slot={s}
                        hotkeyLabel={String(idx + 1)}
                        onClick={(e) => handleInventorySlotClick(idx, false, e.shiftKey)}
                        onContextMenu={() => handleInventorySlotClick(idx, true, false)}
                        onMouseEnter={() => setHoveredItemId(s?.itemId ?? null)}
                      />
                      {s && (
                        <button
                          type="button"
                          onClick={() => onDropSlotItem(idx)}
                          className="text-[9px] text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          Drop
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Item Tooltip Inspector */}
            <div className="p-3 rounded-xl bg-[#090f1d] border border-white/[0.08] min-h-[64px] flex items-center gap-3">
              {hoveredDef ? (
                <>
                  <img
                    src={getItemIconDataUrl(hoveredDef.id)}
                    alt={hoveredDef.name}
                    className="w-9 h-9 shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <span>{hoveredDef.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-cyan-300">
                        {hoveredDef.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{hoveredDef.description}</p>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Place items into the {gridDim}×{gridDim} Crafting Grid to craft tools, blocks, and survival gear, or click a recipe in the Recipe Book to arrange owned materials.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Crafting Grid + Recipe Book / Creative Catalog / Container */}
          <div className="lg:col-span-5 flex flex-col bg-[#0b1326] border border-white/[0.08] rounded-xl p-3.5 max-h-[540px]">
            {activeTab === 'CRAFTING' && (
              <div className="flex flex-col h-full gap-3 min-h-0">
                {/* 1. Interactive 2x2 or 3x3 Crafting Grid Box */}
                <div
                  data-testid="kubekcraft-crafting-grid-panel"
                  className="p-3 rounded-xl bg-[#080e1c] border border-white/[0.08] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5" />
                      <span>
                        {gridDim === 3
                          ? '3×3 Crafting Table Grid'
                          : '2×2 Personal Crafting Grid'}
                      </span>
                    </span>
                    {craftingGrid.some((s) => s !== null) && (
                      <button
                        type="button"
                        data-testid="kubekcraft-clear-grid-btn"
                        onClick={handleClearCraftingGrid}
                        className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Return Items</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-around gap-3 py-1">
                    {/* Input Grid (2x2 or 3x3) */}
                    <div
                      data-testid={`kubekcraft-crafting-grid-${gridDim}x${gridDim}`}
                      className={`grid ${
                        gridDim === 3 ? 'grid-cols-3' : 'grid-cols-2'
                      } gap-1.5 p-2 rounded-xl bg-[#050914] border border-white/[0.08]`}
                    >
                      {Array.from({ length: gridSlotCount }).map((_, gIdx) => {
                        const slot = craftingGrid[gIdx] ?? null;
                        const ghostId = ghostGridItemIds[gIdx] ?? null;
                        return (
                          <ItemSlotView
                            key={gIdx}
                            testId={`kubekcraft-craft-grid-slot-${gIdx}`}
                            slot={slot}
                            ghostItemId={ghostId}
                            onClick={() => handleCraftingGridSlotClick(gIdx, false)}
                            onContextMenu={() => handleCraftingGridSlotClick(gIdx, true)}
                            onMouseEnter={() =>
                              setHoveredItemId(slot?.itemId ?? ghostId ?? null)
                            }
                          />
                        );
                      })}
                    </div>

                    {/* Arrow + Match Label */}
                    <div className="flex flex-col items-center gap-1 text-center">
                      <ArrowRight
                        className={`w-5 h-5 ${
                          gridMatch ? 'text-cyan-400 animate-pulse' : 'text-slate-600'
                        }`}
                      />
                      <span className="text-[9px] font-mono uppercase text-slate-400 max-w-[90px] truncate">
                        {gridMatch
                          ? gridMatch.isRepair
                            ? 'Tool Repair'
                            : gridMatch.recipe?.name
                          : 'No Match'}
                      </span>
                    </div>

                    {/* Result Output Slot */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono uppercase text-emerald-400">
                        Result
                      </span>
                      <ItemSlotView
                        testId="kubekcraft-craft-result-slot"
                        size="lg"
                        selected={Boolean(gridMatch)}
                        slot={gridMatch?.output ?? null}
                        onClick={handleCollectCraftedResult}
                        onMouseEnter={() =>
                          setHoveredItemId(gridMatch?.output.itemId ?? null)
                        }
                      />
                    </div>
                  </div>

                  {!isWorkbenchOpen && (
                    <div className="text-[10px] text-slate-400 font-mono text-center">
                      Tip: Craft a <strong className="text-cyan-300">Crafting Table</strong> (2×2 Planks), place it in the world, and Right-Click it for 3×3 tool & furnace recipes!
                    </div>
                  )}
                </div>

                {/* 2. Recipe Book Section */}
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Recipe Book ({filteredRecipes.length})</span>
                    </span>
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-300">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={craftableOnly}
                          onChange={(e) => setCraftableOnly(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        <span>Craftable</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discoveredOnly}
                          onChange={(e) => setDiscoveredOnly(e.target.checked)}
                          className="accent-emerald-400"
                        />
                        <span>Unlocked ({discoveredSet.size})</span>
                      </label>
                    </div>
                  </div>

                  {/* Recipe Search & Category Filter Pills */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        data-testid="kubekcraft-recipe-search"
                        value={recipeSearch}
                        onChange={(e) => setRecipeSearch(e.target.value)}
                        placeholder="Search recipes..."
                        className="w-full pl-7 pr-2 py-1 rounded-lg bg-[#080e1c] border border-white/[0.08] text-[11px] text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(['ALL', 'MATERIALS', 'TOOLS', 'SURVIVAL', 'BUILDING'] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setRecipeCategory(cat)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer ${
                            recipeCategory === cat
                              ? 'bg-cyan-500 text-slate-950 font-semibold'
                              : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>

                  {/* Recipe List */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                    {filteredRecipes.map((recipe) => {
                      const reqDim = recipe.gridSize ?? (recipe.requiresWorkbench ? 3 : 2);
                      const needsTable = reqDim > gridDim;
                      const craftable = canCraftRecipe(
                        combinedInventoryForCounts,
                        recipe,
                        gridDim === 3
                      );
                      const isSelected = selectedPreviewRecipe?.id === recipe.id;

                      return (
                        <div
                          key={recipe.id}
                          data-testid={`kubekcraft-recipe-${recipe.id}`}
                          onClick={() => handleSelectRecipeBookEntry(recipe)}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#122244] border-cyan-400'
                              : craftable
                                ? 'bg-[#0f1a33] border-cyan-500/35 hover:border-cyan-400/60'
                                : 'bg-[#080e1c]/70 border-white/[0.06] opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={getItemIconDataUrl(recipe.output.itemId)}
                                alt={recipe.name}
                                className="w-6 h-6 shrink-0"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1.5">
                                  <span>{recipe.name}</span>
                                  <span
                                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                      reqDim === 3
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-emerald-500/20 text-emerald-300'
                                    }`}
                                  >
                                    {reqDim}×{reqDim}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 line-clamp-1">
                                  {recipe.description}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!craftable || needsTable}
                              data-testid={`kubekcraft-craft-btn-${recipe.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRecipeBookEntry(recipe);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 cursor-pointer ${
                                craftable && !needsTable
                                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {needsTable ? 'Needs 3×3 Table' : craftable ? 'Place in Grid' : 'Preview'}
                            </button>
                          </div>

                          {/* Ingredients breakdown */}
                          <div className="flex flex-wrap gap-1.5 mt-1.5 pt-1.5 border-t border-white/[0.05]">
                            {recipe.ingredients.map((ing) => {
                              const allowAnyPlank =
                                ing.itemId === BLOCK_IDS.OAK_PLANKS &&
                                recipe.id !== 'oak_slabs';
                              const have = countItemInInventory(
                                combinedInventoryForCounts,
                                ing.itemId,
                                allowAnyPlank
                              );
                              const enough = have >= ing.count;
                              const ingDef = getItemDef(ing.itemId);
                              return (
                                <span
                                  key={ing.itemId}
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    enough
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'bg-rose-500/15 text-rose-300'
                                  }`}
                                >
                                  <span>
                                    {allowAnyPlank && isAnyPlankItem(ing.itemId)
                                      ? 'Wood Planks'
                                      : ingDef.name}
                                    :
                                  </span>
                                  <strong>
                                    {have}/{ing.count}
                                  </strong>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'CREATIVE' && (
              <div className="flex flex-col h-full gap-2.5 min-h-0">
                <div className="text-xs font-semibold text-white">
                  Creative Infinite Supply (Click to add to Inventory or Cursor)
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-testid="kubekcraft-creative-search"
                    value={creativeSearch}
                    onChange={(e) => setCreativeSearch(e.target.value)}
                    placeholder="Search blocks, ores, tools, foods..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#080e1c] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'BLOCK', 'TOOL', 'MATERIAL', 'FOOD', 'ARMOR'] as const).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCreativeCategory(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer ${
                          creativeCategory === cat
                            ? 'bg-cyan-500 text-slate-950 font-semibold'
                            : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-5 gap-2 pr-1">
                  {filteredCreativeItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`kubekcraft-creative-item-${item.id}`}
                      onClick={() => {
                        const count = item.maxStack > 1 ? 64 : 1;
                        const added = addItemToInventory(
                          inventory,
                          item.id,
                          count,
                          item.maxDurability
                        );
                        if (added.remaining < count) {
                          onUpdateInventory(added.updatedSlots);
                        } else {
                          setCursorSlot({
                            itemId: item.id,
                            count,
                            durability: item.maxDurability,
                          });
                        }
                      }}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      className="p-2 rounded-xl bg-[#090f1e] hover:bg-cyan-500/20 border border-white/[0.1] flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <img
                        src={getItemIconDataUrl(item.id)}
                        alt={item.name}
                        className="w-7 h-7"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <span className="text-[9px] text-slate-300 truncate max-w-full">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'CONTAINER' && activeContainer && (
              <div className="flex flex-col h-full gap-4">
                {activeContainer.type === 'CHEST' ? (
                  <>
                    <div className="text-xs font-semibold text-amber-300">
                      World Storage Chest (18 Persistent Slots)
                    </div>
                    <div className="grid grid-cols-6 gap-2 justify-items-center p-3 rounded-xl bg-[#080e1c] border border-white/[0.08]">
                      {Array.from({ length: 18 }).map((_, idx) => (
                        <ItemSlotView
                          key={idx}
                          testId={`kubekcraft-chest-slot-${idx}`}
                          slot={activeContainer.slots[idx] ?? null}
                          onClick={() => handleContainerSlotClick(idx, false)}
                          onContextMenu={() => handleContainerSlotClick(idx, true)}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Click any slot in your backpack to pick up an item, then click a Chest slot to store it in this world coordinate.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">
                        Smelting Furnace — Real-Time Ore & Food Kiln
                      </span>
                      {(activeContainer.fuelRemaining ?? 0) > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 animate-pulse">
                          Smelting Active ({Math.ceil(activeContainer.fuelRemaining ?? 0)}s fuel)
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#080e1c] border border-white/[0.08] flex items-center justify-around">
                      {/* Input Slot */}
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400">INPUT ORE/FOOD</span>
                        <ItemSlotView
                          testId="kubekcraft-furnace-input-slot"
                          slot={activeContainer.slots[0] ?? null}
                          onClick={() => handleContainerSlotClick(0, false)}
                          onContextMenu={() => handleContainerSlotClick(0, true)}
                        />
                      </div>

                      {/* Fuel Slot + Active Flame Gauge */}
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400">FUEL (COAL/WOOD)</span>
                        <ItemSlotView
                          testId="kubekcraft-furnace-fuel-slot"
                          slot={activeContainer.slots[1] ?? null}
                          onClick={() => handleContainerSlotClick(1, false)}
                          onContextMenu={() => handleContainerSlotClick(1, true)}
                        />
                        <div
                          title={`Fuel Remaining: ${furnaceFuelPct}%`}
                          className="w-11 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/10"
                        >
                          <div
                            data-testid="kubekcraft-furnace-fuel-bar"
                            style={{ width: `${furnaceFuelPct}%` }}
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all duration-150"
                          />
                        </div>
                      </div>

                      {/* Real-time Smelting Progress Indicator */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[76px]">
                        <Flame
                          className={`w-6 h-6 ${
                            (activeContainer.fuelRemaining ?? 0) > 0
                              ? 'text-orange-400 fill-orange-400/40 animate-bounce'
                              : 'text-slate-600'
                          }`}
                        />
                        <div className="w-16 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                          <div
                            data-testid="kubekcraft-furnace-progress-bar"
                            style={{ width: `${furnaceProgressPct}%` }}
                            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-150"
                          />
                        </div>
                        <span
                          data-testid="kubekcraft-furnace-progress-label"
                          className="text-[10px] font-mono text-cyan-300"
                        >
                          {furnaceProgressPct}%
                        </span>
                      </div>

                      {/* Output Slot */}
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-mono text-emerald-400">OUTPUT</span>
                        <ItemSlotView
                          testId="kubekcraft-furnace-output-slot"
                          size="lg"
                          selected={Boolean(activeContainer.slots[2])}
                          slot={activeContainer.slots[2] ?? null}
                          onClick={() => handleContainerSlotClick(2, false)}
                        />
                      </div>
                    </div>

                    {/* Active Recipe Status */}
                    <div className="p-2.5 rounded-xl bg-[#050914] border border-white/[0.06] text-[11px] text-slate-300">
                      {(() => {
                        const inSlot = activeContainer.slots[0];
                        const fuelSlot = activeContainer.slots[1];
                        const r = inSlot ? findSmeltingRecipe(inSlot.itemId) : undefined;
                        if (inSlot && !r) {
                          return (
                            <span className="text-rose-300">
                              {getItemDef(inSlot.itemId).name} cannot be smelted.
                            </span>
                          );
                        }
                        if (r) {
                          const outDef = getItemDef(r.outputItemId);
                          const hasFuel =
                            (activeContainer.fuelRemaining ?? 0) > 0 ||
                            (fuelSlot && getFuelBurnSeconds(fuelSlot.itemId) > 0);
                          return (
                            <div className="flex items-center justify-between">
                              <span>
                                Smelting <strong>{getItemDef(inSlot!.itemId).name}</strong> →{' '}
                                <strong className="text-emerald-300">{outDef.name}</strong> (
                                {r.smeltTimeSeconds}s)
                              </span>
                              {!hasFuel && (
                                <span className="text-amber-300 font-mono text-[10px]">
                                  Add Coal, Logs, Planks, or Sticks as fuel!
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <span className="text-slate-400">
                            Place Raw Ore, Sand, Clay, Wood Logs, or Raw Meat into the Input slot and fuel into the Fuel slot.
                          </span>
                        );
                      })()}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-200">
                        Supported Smelting Recipes ({SMELTING_RECIPES.length}):
                      </div>
                      <div>• Raw Iron / Copper / Gold → Metal Ingots</div>
                      <div>• Wood Logs → Charcoal (Coal) • Cobblestone → Smooth Stone</div>
                      <div>• Golden Sand → Crystal Glass • Clay Ball → Fired Clay Brick</div>
                      <div>• Raw Venison → Roasted Steak (+8 Hunger)</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
