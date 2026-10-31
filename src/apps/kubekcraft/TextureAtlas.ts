/**
 * KubekCraft — Procedural Pixel-Art Texture Atlas & Isometric Item Icon Generator
 * Generates a crisp 16x16 tile texture atlas for Three.js chunk meshes and
 * caches 2D isometric block & pixel-art item icons for the HUD and Inventory.
 */

import * as THREE from 'three';
import { ITEM_REGISTRY_LIST, getItemDef } from './BlockRegistry';
import type { BlockFacePalette, ItemDefinition } from './types';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 16;
export const ATLAS_WIDTH = TILE_SIZE * ATLAS_COLS; // 256
export const ATLAS_HEIGHT = TILE_SIZE * ATLAS_ROWS; // 256

export interface BlockTileUVs {
  topIndex: number;
  bottomIndex: number;
  sideIndex: number;
}

const blockTileMap = new Map<number, BlockTileUVs>();
const itemIconCache = new Map<number, string>();
let sharedAtlasTexture: THREE.CanvasTexture | null = null;
let sharedAtlasCanvas: HTMLCanvasElement | null = null;

function hashPixel(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawTileFace(
  ctx: CanvasRenderingContext2D,
  tileIndex: number,
  colors: string[],
  pattern: BlockFacePalette['pattern'],
  faceType: 'TOP' | 'BOTTOM' | 'SIDE',
  seedSalt: number
) {
  const col = tileIndex % ATLAS_COLS;
  const row = Math.floor(tileIndex / ATLAS_COLS);
  const ox = col * TILE_SIZE;
  const oy = row * TILE_SIZE;

  const c0 = colors[0] ?? '#888888';
  const c1 = colors[1] ?? c0;
  const c2 = colors[2] ?? c1;

  // Clear first for transparent tiles
  ctx.clearRect(ox, oy, TILE_SIZE, TILE_SIZE);

  if (pattern === 'FLOWER' || pattern === 'MUSHROOM' || pattern === 'TORCH') {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        if (pattern === 'TORCH') {
          if (x >= 7 && x <= 8 && y >= 6 && y <= 15) {
            ctx.fillStyle = y < 8 ? c0 : c2;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          } else if (x >= 6 && x <= 9 && y >= 3 && y <= 6) {
            ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c0;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        } else if (pattern === 'MUSHROOM') {
          if (x >= 7 && x <= 8 && y >= 9 && y <= 15) {
            ctx.fillStyle = c2;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          } else if (y >= 4 && y <= 9 && Math.abs(x - 7.5) <= 4.5 - (9 - y) * 0.6) {
            ctx.fillStyle = (x + y) % 3 === 0 ? c1 : c0;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        } else {
          // Flower or tall grass
          if (c0 === '#4ea832') {
            // Tall grass blades
            const blade = Math.sin(x * 1.3 + y * 0.25) > 0.15 && y > 2 + (x % 4);
            if (blade) {
              ctx.fillStyle = y < 7 ? c2 : (x + y) % 2 === 0 ? c0 : c1;
              ctx.fillRect(ox + x, oy + y, 1, 1);
            }
          } else {
            // Stem + Petals
            if (x >= 7 && x <= 8 && y >= 8 && y <= 15) {
              ctx.fillStyle = c1;
              ctx.fillRect(ox + x, oy + y, 1, 1);
            } else {
              const dx = x - 7.5;
              const dy = y - 5.5;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= 1.6) {
                ctx.fillStyle = c2;
                ctx.fillRect(ox + x, oy + y, 1, 1);
              } else if (dist <= 4.0) {
                ctx.fillStyle = c0;
                ctx.fillRect(ox + x, oy + y, 1, 1);
              }
            }
          }
        }
      }
    }
    return;
  }

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = hashPixel(x, y, seedSalt);
      let pixelColor = c0;

      if (pattern === 'GRASS_SIDE' && faceType === 'SIDE') {
        const grassEdge = 2 + Math.floor(hashPixel(x, 0, seedSalt) * 3);
        if (y <= grassEdge) {
          pixelColor = r > 0.55 ? c1 : '#3f8f27';
        } else {
          pixelColor = r < 0.3 ? c2 : c0;
        }
      } else if (pattern === 'LOG_SIDE' && faceType === 'SIDE') {
        const stripe = (x + Math.floor(r * 2)) % 4;
        pixelColor = stripe === 0 ? c1 : stripe === 2 ? c2 : c0;
      } else if (pattern === 'LOG_SIDE' && (faceType === 'TOP' || faceType === 'BOTTOM')) {
        const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
        const dx = Math.abs(x - 7.5);
        const dy = Math.abs(y - 7.5);
        const ring = Math.max(dx, dy);
        if (isBorder) pixelColor = c1;
        else if (Math.floor(ring) % 2 === 0) pixelColor = c0;
        else pixelColor = c2;
      } else if (pattern === 'PLANKS') {
        const plankRow = y % 4 === 0;
        const joint = (x + Math.floor(y / 4) * 7) % 16 === 0;
        if (plankRow || joint) pixelColor = c1;
        else pixelColor = r > 0.65 ? c2 : c0;
      } else if (pattern === 'BRICKS') {
        const mortarH = y % 4 === 0;
        const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
        const mortarV = (x + offset) % 8 === 0;
        if (mortarH || mortarV) pixelColor = c2;
        else pixelColor = r > 0.5 ? c1 : c0;
      } else if (pattern === 'COBBLESTONE') {
        const cell = ((x >> 2) * 7 + (y >> 2) * 13) % 5;
        const border = x % 4 === 0 || y % 4 === 0;
        if (border && r > 0.25) pixelColor = c1;
        else if (cell === 0 || r > 0.72) pixelColor = c2;
        else pixelColor = c0;
      } else if (pattern === 'ORE') {
        const isVein =
          x >= 2 &&
          x <= 13 &&
          y >= 2 &&
          y <= 13 &&
          hashPixel(Math.floor(x / 2), Math.floor(y / 2), seedSalt + 19) > 0.73;
        if (isVein) {
          pixelColor = r > 0.45 ? c1 : c2;
        } else {
          pixelColor = r < 0.28 ? '#6d747e' : r > 0.78 ? '#8c939e' : c0;
        }
      } else if (pattern === 'GLASS') {
        const isFrame = x === 0 || x === 15 || y === 0 || y === 15;
        const isStreak = (x + y === 5 || x + y === 6) && x > 1 && y > 1;
        if (isFrame) {
          pixelColor = c1;
        } else if (isStreak) {
          pixelColor = c2;
        } else {
          continue; // transparent interior
        }
      } else if (pattern === 'WATER') {
        const wave = Math.sin(x * 0.6 + y * 0.4) > 0.45;
        ctx.fillStyle = wave ? 'rgba(56, 189, 248, 0.78)' : 'rgba(2, 132, 199, 0.75)';
        ctx.fillRect(ox + x, oy + y, 1, 1);
        continue;
      } else if (pattern === 'CRAFTING_TOP' && faceType === 'TOP') {
        const isBorder = x < 2 || x > 13 || y < 2 || y > 13;
        const isGrid = x % 4 === 1 || y % 4 === 1;
        pixelColor = isBorder ? c1 : isGrid ? c2 : c0;
      } else if (pattern === 'FURNACE_FRONT' && faceType === 'SIDE') {
        const isOpening = x >= 4 && x <= 11 && y >= 6 && y <= 13;
        if (isOpening) {
          pixelColor = y > 9 ? c1 : c2;
        } else {
          pixelColor = r > 0.6 ? '#64748b' : c0;
        }
      } else if (pattern === 'CHEST_FRONT' && faceType === 'SIDE') {
        const isRim = y === 5 || y === 6 || x === 0 || x === 15 || y === 0 || y === 15;
        const isLatch = x >= 7 && x <= 8 && y >= 5 && y <= 8;
        pixelColor = isLatch ? c2 : isRim ? c1 : c0;
      } else if (pattern === 'BOOKSHELF' && faceType === 'SIDE') {
        if (y < 2 || y > 13 || y === 7 || y === 8 || x === 0 || x === 15) {
          pixelColor = c0;
        } else {
          const spine = Math.floor(x / 2) % 3;
          pixelColor = spine === 0 ? c1 : spine === 1 ? c2 : '#10b981';
        }
      } else {
        // Default natural noise dither
        pixelColor = r < 0.28 ? c1 : r > 0.74 ? c2 : c0;
      }

      // Subtle pixel border for clean voxel readability
      if ((x === 0 || y === 0) && r > 0.6) {
        ctx.fillStyle = pixelColor;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      } else {
        ctx.fillStyle = pixelColor;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

export function initBlockTextureAtlas(): {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
} {
  if (sharedAtlasTexture && sharedAtlasCanvas) {
    return { texture: sharedAtlasTexture, canvas: sharedAtlasCanvas };
  }

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  let nextTileIdx = 1;
  for (const item of ITEM_REGISTRY_LIST) {
    if (!item.isBlock || item.id === 0 || !item.palette) continue;

    const topIndex = nextTileIdx++;
    const bottomIndex = nextTileIdx++;
    const sideIndex = nextTileIdx++;

    blockTileMap.set(item.id, { topIndex, bottomIndex, sideIndex });

    if (ctx) {
      drawTileFace(ctx, topIndex, item.palette.top, item.palette.pattern, 'TOP', item.id * 11);
      drawTileFace(
        ctx,
        bottomIndex,
        item.palette.bottom,
        item.palette.pattern,
        'BOTTOM',
        item.id * 17
      );
      drawTileFace(
        ctx,
        sideIndex,
        item.palette.side,
        item.palette.pattern,
        'SIDE',
        item.id * 23
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  sharedAtlasCanvas = canvas;
  sharedAtlasTexture = texture;
  return { texture, canvas };
}

export function getBlockTileUVs(blockId: number): BlockTileUVs {
  if (blockTileMap.size === 0) {
    initBlockTextureAtlas();
  }
  return blockTileMap.get(blockId) ?? { topIndex: 1, bottomIndex: 2, sideIndex: 3 };
}

export function getTileUVRect(tileIndex: number): {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
} {
  const col = tileIndex % ATLAS_COLS;
  const row = Math.floor(tileIndex / ATLAS_COLS);
  const pad = 0.0015;
  const u0 = col / ATLAS_COLS + pad;
  const u1 = (col + 1) / ATLAS_COLS - pad;
  // Canvas Y is top-down, WebGL UV Y is bottom-up
  const v1 = 1 - row / ATLAS_ROWS - pad;
  const v0 = 1 - (row + 1) / ATLAS_ROWS + pad;
  return { u0, v0, u1, v1 };
}

function drawNonBlockItemIcon(ctx: CanvasRenderingContext2D, item: ItemDefinition) {
  const cfg = item.iconColors;
  if (!cfg) return;

  ctx.clearRect(0, 0, 32, 32);
  const p = cfg.primary;
  const s = cfg.secondary;
  const a = cfg.accent ?? '#ffffff';

  const px = (x: number, y: number, color: string, w = 2, h = 2) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 2, y * 2, w, h);
  };

  switch (cfg.shape) {
    case 'PICKAXE': {
      // Diagonal handle
      for (let i = 2; i <= 11; i++) {
        px(i, 15 - i, s);
      }
      // Curved pickaxe head
      for (let x = 7; x <= 13; x++) px(x, 2, p);
      for (let y = 3; y <= 8; y++) px(13, y, p);
      px(6, 3, p);
      px(12, 8, a);
      break;
    }
    case 'AXE': {
      for (let i = 2; i <= 12; i++) px(i, 15 - i, s);
      for (let x = 8; x <= 12; x++) {
        for (let y = 2; y <= 6; y++) {
          px(x, y, p);
        }
      }
      px(7, 3, a);
      px(7, 4, a);
      break;
    }
    case 'SHOVEL': {
      for (let i = 2; i <= 10; i++) px(i, 15 - i, s);
      for (let x = 10; x <= 13; x++) {
        for (let y = 2; y <= 5; y++) px(x, y, p);
      }
      break;
    }
    case 'SWORD': {
      px(2, 13, s);
      px(3, 12, s);
      px(4, 11, s);
      // Crossguard
      px(4, 9, s);
      px(5, 10, s);
      px(6, 11, s);
      // Blade
      for (let i = 5; i <= 13; i++) {
        px(i, 15 - i, p);
        px(i, 14 - i, a);
      }
      break;
    }
    case 'STICK': {
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, p);
        px(i + 1, 15 - i, s);
      }
      break;
    }
    case 'INGOT': {
      for (let y = 5; y <= 10; y++) {
        for (let x = 3; x <= 12; x++) {
          px(x, y, y < 7 ? s : p);
        }
      }
      break;
    }
    case 'CRYSTAL': {
      for (let y = 2; y <= 13; y++) {
        const half = Math.max(1, 5 - Math.floor(Math.abs(y - 7.5)));
        for (let x = 8 - half; x <= 7 + half; x++) {
          px(x, y, (x + y) % 2 === 0 ? p : s);
        }
      }
      break;
    }
    case 'FOOD_BERRY': {
      for (let y = 5; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if ((x - 7.5) ** 2 + (y - 8.5) ** 2 <= 14) {
            px(x, y, p);
          }
        }
      }
      px(7, 3, s, 4, 3);
      px(6, 6, '#ffffff');
      break;
    }
    case 'FOOD_MEAT':
    case 'FOOD_BREAD': {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          px(x, y, y === 5 || x === 3 ? s : p);
        }
      }
      break;
    }
    case 'ARMOR': {
      for (let y = 3; y <= 13; y++) {
        for (let x = 3; x <= 12; x++) {
          if (y < 6 && (x === 7 || x === 8)) continue;
          if (y > 7 && (x === 3 || x === 12)) continue;
          px(x, y, y % 3 === 0 ? s : p);
        }
      }
      break;
    }
    default: {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if ((x - 7.5) ** 2 + (y - 7.5) ** 2 <= 15) {
            px(x, y, (x + y) % 2 === 0 ? p : s);
          }
        }
      }
    }
  }
}

export function getItemIconDataUrl(itemId: number): string {
  if (itemId <= 0) return '';
  const cached = itemIconCache.get(itemId);
  if (cached) return cached;

  const item = getItemDef(itemId);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (item.isBlock && item.palette) {
    if (
      item.palette.pattern === 'FLOWER' ||
      item.palette.pattern === 'MUSHROOM' ||
      item.palette.pattern === 'TORCH'
    ) {
      const temp = document.createElement('canvas');
      temp.width = 16;
      temp.height = 16;
      const tctx = temp.getContext('2d');
      if (tctx) {
        drawTileFace(tctx, 0, item.palette.top, item.palette.pattern, 'TOP', item.id);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(temp, 0, 0, 32, 32);
      }
    } else {
      // Draw crisp isometric 3D block icon
      const topC = item.palette.top[0] ?? '#888';
      const sideLeft = item.palette.side[0] ?? '#666';
      const sideRight = item.palette.side[1] ?? item.palette.bottom[0] ?? '#444';

      // Top diamond
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(28, 9.5);
      ctx.lineTo(16, 16);
      ctx.lineTo(4, 9.5);
      ctx.closePath();
      ctx.fillStyle = topC;
      ctx.fill();

      // Left face
      ctx.beginPath();
      ctx.moveTo(4, 9.5);
      ctx.lineTo(16, 16);
      ctx.lineTo(16, 29);
      ctx.lineTo(4, 22.5);
      ctx.closePath();
      ctx.fillStyle = sideLeft;
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(28, 9.5);
      ctx.lineTo(28, 22.5);
      ctx.lineTo(16, 29);
      ctx.closePath();
      ctx.fillStyle = sideRight;
      ctx.fill();

      // Crisp outline
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else {
    drawNonBlockItemIcon(ctx, item);
  }

  const url = canvas.toDataURL('image/png');
  itemIconCache.set(itemId, url);
  return url;
}
