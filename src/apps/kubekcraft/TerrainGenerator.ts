/**
 * KubekCraft — Procedural Terrain, Biome, Underground Cave & Structure Generator
 * Deterministically generates 16x64x16 chunks with multi-biome transitions,
 * rivers, oceans, beaches, mountains, caves, ore veins, and surface flora.
 */

import { BLOCK_IDS } from './BlockRegistry';
import { SeededNoise } from './Noise';
import type { BiomeId, TerrainType } from './types';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_SIZE_Z = 16;
export const SEA_LEVEL = 21;

export interface WorldGenConfig {
  numericSeed: number;
  terrainType: TerrainType;
  generateCaves: boolean;
  generateStructures: boolean;
}

export class TerrainGenerator {
  private readonly elevationNoise: SeededNoise;
  private readonly temperatureNoise: SeededNoise;
  private readonly humidityNoise: SeededNoise;
  private readonly riverNoise: SeededNoise;
  private readonly caveNoise: SeededNoise;
  private readonly detailNoise: SeededNoise;
  public readonly config: WorldGenConfig;

  constructor(config: WorldGenConfig) {
    this.config = config;
    const s = config.numericSeed;
    this.elevationNoise = new SeededNoise(s);
    this.temperatureNoise = new SeededNoise(s ^ 0x9e3779b9);
    this.humidityNoise = new SeededNoise(s ^ 0x85ebca6b);
    this.riverNoise = new SeededNoise(s ^ 0xc2b2ae35);
    this.caveNoise = new SeededNoise(s ^ 0x27d4eb2f);
    this.detailNoise = new SeededNoise(s ^ 0x165667b1);
  }

  public sampleColumnInfo(
    wx: number,
    wz: number
  ): {
    height: number;
    biome: BiomeId;
    temperature: number;
    humidity: number;
  } {
    if (this.config.terrainType === 'FLAT') {
      return {
        height: 24,
        biome: 'PLAINS',
        temperature: 0.5,
        humidity: 0.5,
      };
    }

    const temp = (this.temperatureNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3) + 1) * 0.5;
    const hum = (this.humidityNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3) + 1) * 0.5;
    const continental = this.elevationNoise.fbm2D(wx * 0.006, wz * 0.006, 4);
    const hills = this.detailNoise.fbm2D(wx * 0.022, wz * 0.022, 3);
    const riverVal = Math.abs(this.riverNoise.noise2D(wx * 0.007, wz * 0.007));

    let heightFloat = 25 + continental * 16 + hills * 6;

    if (this.config.terrainType === 'AMPLIFIED') {
      heightFloat = 26 + continental * 26 + hills * 11;
    } else if (this.config.terrainType === 'ISLANDS') {
      heightFloat = 19 + continental * 20 + hills * 6;
    }

    // Mountain ridges when continental is high
    if (continental > 0.22) {
      const ridge = Math.pow((continental - 0.22) * 1.9, 1.45) * 18;
      heightFloat += ridge;
    }

    // Carve natural winding rivers
    const isRiverChannel = riverVal < 0.028 && continental > -0.15 && continental < 0.32;
    if (isRiverChannel) {
      const riverDepth = (1 - riverVal / 0.028) * 6;
      heightFloat = Math.min(heightFloat, SEA_LEVEL - 1 - riverDepth * 0.4);
    }

    const height = Math.max(4, Math.min(CHUNK_SIZE_Y - 8, Math.round(heightFloat)));

    let biome: BiomeId = 'PLAINS';
    if (height < SEA_LEVEL - 2) {
      biome = 'OCEAN';
    } else if (isRiverChannel && height <= SEA_LEVEL) {
      biome = 'RIVER';
    } else if (height <= SEA_LEVEL + 1 && temp > 0.35) {
      biome = 'BEACH';
    } else if (height >= 39) {
      biome = temp < 0.45 ? 'SNOWY_TUNDRA' : 'MOUNTAINS';
    } else if (temp < 0.34) {
      biome = 'SNOWY_TUNDRA';
    } else if (temp > 0.66 && hum < 0.45) {
      biome = 'DESERT';
    } else if (hum > 0.53) {
      biome = 'FOREST';
    } else {
      biome = 'PLAINS';
    }

    return { height, biome, temperature: temp, humidity: hum };
  }

  public getSpawnHeight(wx: number, wz: number): number {
    const info = this.sampleColumnInfo(wx, wz);
    return Math.max(info.height + 2, SEA_LEVEL + 2);
  }

  public generateChunkData(cx: number, cz: number): Uint8Array {
    const blocks = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
    const idx = (lx: number, y: number, lz: number) =>
      y * CHUNK_SIZE_X * CHUNK_SIZE_Z + lz * CHUNK_SIZE_X + lx;

    const baseX = cx * CHUNK_SIZE_X;
    const baseZ = cz * CHUNK_SIZE_Z;

    const colHeights = new Int16Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
    const colBiomes: BiomeId[] = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);

    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const col = this.sampleColumnInfo(wx, wz);
        colHeights[lz * CHUNK_SIZE_X + lx] = col.height;
        colBiomes[lz * CHUNK_SIZE_X + lx] = col.biome;

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          if (y === 0) {
            blocks[idx(lx, y, lz)] = BLOCK_IDS.BEDROCK;
            continue;
          }

          if (y > col.height) {
            if (y <= SEA_LEVEL) {
              blocks[idx(lx, y, lz)] =
                y === SEA_LEVEL && col.biome === 'SNOWY_TUNDRA'
                  ? BLOCK_IDS.ICE
                  : BLOCK_IDS.WATER;
            }
            continue;
          }

          // Surface & Subsurface block selection by biome
          if (y === col.height) {
            if (y < SEA_LEVEL - 1) {
              const r = this.detailNoise.coordHash(wx, y, wz);
              blocks[idx(lx, y, lz)] =
                r < 0.25 ? BLOCK_IDS.CLAY : r < 0.55 ? BLOCK_IDS.GRAVEL : BLOCK_IDS.SAND;
            } else if (col.biome === 'DESERT' || col.biome === 'BEACH') {
              blocks[idx(lx, y, lz)] = BLOCK_IDS.SAND;
            } else if (col.biome === 'SNOWY_TUNDRA') {
              blocks[idx(lx, y, lz)] = col.height > 40 ? BLOCK_IDS.SNOW : BLOCK_IDS.SNOWY_GRASS;
            } else if (col.biome === 'MOUNTAINS') {
              blocks[idx(lx, y, lz)] = col.height > 43 ? BLOCK_IDS.SNOW : BLOCK_IDS.STONE;
            } else if (col.biome === 'RIVER') {
              blocks[idx(lx, y, lz)] = BLOCK_IDS.SAND;
            } else {
              blocks[idx(lx, y, lz)] = BLOCK_IDS.GRASS;
            }
          } else if (y >= col.height - 3) {
            if (col.biome === 'DESERT' || col.biome === 'BEACH') {
              blocks[idx(lx, y, lz)] =
                y === col.height - 3 ? BLOCK_IDS.SANDSTONE : BLOCK_IDS.SAND;
            } else if (col.biome === 'MOUNTAINS' && col.height > 38) {
              blocks[idx(lx, y, lz)] = BLOCK_IDS.STONE;
            } else {
              blocks[idx(lx, y, lz)] = BLOCK_IDS.DIRT;
            }
          } else {
            // Deep Underground Stone + Caves + Ore Veins
            if (this.config.generateCaves && y > 3 && y < col.height - 2) {
              const c1 = this.caveNoise.noise3D(wx * 0.065, y * 0.085, wz * 0.065);
              const c2 = this.detailNoise.noise3D(wx * 0.09, y * 0.09, wz * 0.09);
              if (c1 * c1 + c2 * c2 < 0.011) {
                // Underground cave air or deep water pocket
                blocks[idx(lx, y, lz)] = y <= 6 ? BLOCK_IDS.WATER : BLOCK_IDS.AIR;
                continue;
              }
            }

            // Ore distribution
            const oreHash = this.detailNoise.coordHash(wx, y, wz);
            let blockId: number = BLOCK_IDS.STONE;

            if (y <= 10 && oreHash > 0.988) {
              blockId = BLOCK_IDS.CRYSTAL_ORE;
            } else if (y <= 18 && oreHash > 0.978 && oreHash <= 0.988) {
              blockId = BLOCK_IDS.GOLD_ORE;
            } else if (y <= 34 && oreHash > 0.958 && oreHash <= 0.978) {
              blockId = BLOCK_IDS.IRON_ORE;
            } else if (y <= 42 && oreHash > 0.938 && oreHash <= 0.958) {
              blockId = BLOCK_IDS.COPPER_ORE;
            } else if (oreHash > 0.908 && oreHash <= 0.938) {
              blockId = BLOCK_IDS.COAL_ORE;
            } else if (oreHash < 0.025) {
              blockId = BLOCK_IDS.GRAVEL;
            }

            blocks[idx(lx, y, lz)] = blockId;
          }
        }
      }
    }

    // Pass 2: Surface Flora, Trees, Cacti, and Cave Mushrooms
    for (let lz = 2; lz < CHUNK_SIZE_Z - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE_X - 2; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const surfaceY = colHeights[lz * CHUNK_SIZE_X + lx]!;
        const biome = colBiomes[lz * CHUNK_SIZE_X + lx]!;

        if (surfaceY <= SEA_LEVEL || surfaceY >= CHUNK_SIZE_Y - 9) continue;

        const r = this.detailNoise.coordHash(wx, surfaceY + 1, wz);

        if (biome === 'DESERT') {
          if (r > 0.982) {
            const cactusH = 2 + Math.floor(this.detailNoise.coordHash(wx, 99, wz) * 2);
            for (let h = 1; h <= cactusH; h++) {
              blocks[idx(lx, surfaceY + h, lz)] = BLOCK_IDS.CACTUS;
            }
          }
          continue;
        }

        const treeThreshold =
          biome === 'FOREST'
            ? 0.955
            : biome === 'PLAINS'
              ? 0.988
              : biome === 'SNOWY_TUNDRA'
                ? 0.978
                : 0.994;

        if (r > treeThreshold) {
          const isBirch = biome === 'FOREST' && r > 0.978;
          const isPine = biome === 'SNOWY_TUNDRA' || biome === 'MOUNTAINS';
          const logId = isPine
            ? BLOCK_IDS.DARK_LOG
            : isBirch
              ? BLOCK_IDS.BIRCH_LOG
              : BLOCK_IDS.OAK_LOG;
          const leafId = isPine
            ? BLOCK_IDS.PINE_LEAVES
            : isBirch
              ? BLOCK_IDS.BIRCH_LEAVES
              : BLOCK_IDS.OAK_LEAVES;

          const trunkH = 4 + (Math.floor(r * 1000) % 2);
          for (let ty = 1; ty <= trunkH; ty++) {
            blocks[idx(lx, surfaceY + ty, lz)] = logId;
          }

          for (let dy = trunkH - 1; dy <= trunkH + 1; dy++) {
            const radius = dy === trunkH + 1 ? 1 : 2;
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === trunkH) continue;
                const tx = lx + dx;
                const ty = surfaceY + dy;
                const tz = lz + dz;
                if (
                  tx >= 0 &&
                  tx < CHUNK_SIZE_X &&
                  tz >= 0 &&
                  tz < CHUNK_SIZE_Z &&
                  ty < CHUNK_SIZE_Y
                ) {
                  if (blocks[idx(tx, ty, tz)] === BLOCK_IDS.AIR) {
                    blocks[idx(tx, ty, tz)] = leafId;
                  }
                }
              }
            }
          }
        } else if (biome === 'PLAINS' || biome === 'FOREST') {
          if (r > 0.86 && r <= 0.925) {
            blocks[idx(lx, surfaceY + 1, lz)] = BLOCK_IDS.TALL_GRASS;
          } else if (r > 0.835 && r <= 0.86) {
            blocks[idx(lx, surfaceY + 1, lz)] =
              r > 0.848 ? BLOCK_IDS.RED_FLOWER : BLOCK_IDS.GOLD_FLOWER;
          } else if (biome === 'FOREST' && r > 0.825 && r <= 0.835) {
            blocks[idx(lx, surfaceY + 1, lz)] = BLOCK_IDS.GLOW_MUSHROOM;
          }
        }
      }
    }

    return blocks;
  }
}
