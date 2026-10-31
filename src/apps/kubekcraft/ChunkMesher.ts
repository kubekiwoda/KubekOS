/**
 * KubekCraft — High-Performance Culled Voxel Chunk Mesher
 * Builds Three.js BufferGeometries per chunk with internal face culling,
 * corner Ambient Occlusion (AO), directional shading, and torch illumination.
 */

import * as THREE from 'three';
import { BLOCK_IDS, getItemDef, isOpaqueCube } from './BlockRegistry';
import { getBlockTileUVs, getTileUVRect } from './TextureAtlas';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './TerrainGenerator';

export interface ChunkMeshBuffers {
  opaqueGeometry: THREE.BufferGeometry | null;
  waterGeometry: THREE.BufferGeometry | null;
  cutoutGeometry: THREE.BufferGeometry | null;
}

interface GeometryAccumulator {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  vertexCount: number;
}

function createAccumulator(): GeometryAccumulator {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],
    vertexCount: 0,
  };
}

function buildBufferGeometry(acc: GeometryAccumulator): THREE.BufferGeometry | null {
  if (acc.vertexCount === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(acc.positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(acc.normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(acc.colors, 3));
  geom.setIndex(acc.indices);
  geom.computeBoundingSphere();
  return geom;
}

function pushBox(
  acc: GeometryAccumulator,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  topTile: number,
  bottomTile: number,
  sideTile: number,
  lightBoost: number
) {
  const faces: Array<{
    normal: [number, number, number];
    verts: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
    tile: number;
    shade: number;
  }> = [
    {
      normal: [0, 1, 0],
      verts: [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      tile: topTile,
      shade: 1.0,
    },
    {
      normal: [0, -1, 0],
      verts: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      tile: bottomTile,
      shade: 0.55,
    },
    {
      normal: [0, 0, 1],
      verts: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      tile: sideTile,
      shade: 0.86,
    },
    {
      normal: [0, 0, -1],
      verts: [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      tile: sideTile,
      shade: 0.82,
    },
    {
      normal: [1, 0, 0],
      verts: [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      tile: sideTile,
      shade: 0.74,
    },
    {
      normal: [-1, 0, 0],
      verts: [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      tile: sideTile,
      shade: 0.74,
    },
  ];

  for (const f of faces) {
    const uv = getTileUVRect(f.tile);
    const base = acc.vertexCount;
    const c = Math.min(1.15, f.shade + lightBoost);
    for (let i = 0; i < 4; i++) {
      const v = f.verts[i]!;
      acc.positions.push(v[0], v[1], v[2]);
      acc.normals.push(f.normal[0], f.normal[1], f.normal[2]);
      acc.colors.push(c, c, c);
    }
    acc.uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
    acc.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    acc.vertexCount += 4;
  }
}

export function buildChunkGeometry(
  cx: number,
  cz: number,
  getWorldBlock: (wx: number, wy: number, wz: number) => number
): ChunkMeshBuffers {
  const opaqueAcc = createAccumulator();
  const waterAcc = createAccumulator();
  const cutoutAcc = createAccumulator();

  const baseX = cx * CHUNK_SIZE_X;
  const baseZ = cz * CHUNK_SIZE_Z;

  // Collect light emitters inside and near chunk for warm local torch illumination
  const lightSources: Array<{ x: number; y: number; z: number; level: number }> = [];
  for (let y = 1; y < CHUNK_SIZE_Y; y++) {
    for (let lz = -2; lz < CHUNK_SIZE_Z + 2; lz++) {
      for (let lx = -2; lx < CHUNK_SIZE_X + 2; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const bid = getWorldBlock(wx, y, wz);
        if (bid !== BLOCK_IDS.AIR) {
          const def = getItemDef(bid);
          if (def.lightLevel && def.lightLevel > 0) {
            lightSources.push({ x: wx, y, z: wz, level: def.lightLevel });
          }
        }
      }
    }
  }

  const sampleTorchLight = (wx: number, wy: number, wz: number): number => {
    if (lightSources.length === 0) return 0;
    let best = 0;
    for (let i = 0; i < lightSources.length; i++) {
      const src = lightSources[i]!;
      const dist = Math.abs(wx - src.x) + Math.abs(wy - src.y) + Math.abs(wz - src.z);
      if (dist < src.level) {
        const val = ((src.level - dist) / 15) * 0.45;
        if (val > best) best = val;
      }
    }
    return best;
  };

  const cubeFaces: Array<{
    dir: [number, number, number];
    verts: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
    faceKey: 'TOP' | 'BOTTOM' | 'SIDE';
    shade: number;
  }> = [
    {
      dir: [0, 1, 0],
      verts: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
      faceKey: 'TOP',
      shade: 1.0,
    },
    {
      dir: [0, -1, 0],
      verts: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
      faceKey: 'BOTTOM',
      shade: 0.52,
    },
    {
      dir: [0, 0, 1],
      verts: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
      faceKey: 'SIDE',
      shade: 0.86,
    },
    {
      dir: [0, 0, -1],
      verts: [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      faceKey: 'SIDE',
      shade: 0.82,
    },
    {
      dir: [1, 0, 0],
      verts: [
        [1, 0, 1],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ],
      faceKey: 'SIDE',
      shade: 0.72,
    },
    {
      dir: [-1, 0, 0],
      verts: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      faceKey: 'SIDE',
      shade: 0.72,
    },
  ];

  for (let y = 0; y < CHUNK_SIZE_Y; y++) {
    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const blockId = getWorldBlock(wx, y, wz);
        if (blockId === BLOCK_IDS.AIR) continue;

        const def = getItemDef(blockId);
        const tiles = getBlockTileUVs(blockId);
        const shape = def.shape ?? 'CUBE';
        const torchBoost = sampleTorchLight(wx, y, wz);

        if (shape === 'CROSS') {
          const uv = getTileUVRect(tiles.topIndex);
          const h = blockId === BLOCK_IDS.TORCH ? 0.75 : 0.9;
          const inset = blockId === BLOCK_IDS.TORCH ? 0.25 : 0.12;
          const x0 = wx + inset;
          const x1 = wx + 1 - inset;
          const z0 = wz + inset;
          const z1 = wz + 1 - inset;
          const y0 = y;
          const y1 = y + h;

          const diagQuads: Array<
            [[number, number, number], [number, number, number], [number, number, number], [number, number, number]]
          > = [
            [
              [x0, y0, z0],
              [x1, y0, z1],
              [x1, y1, z1],
              [x0, y1, z0],
            ],
            [
              [x1, y0, z1],
              [x0, y0, z0],
              [x0, y1, z0],
              [x1, y1, z1],
            ],
            [
              [x0, y0, z1],
              [x1, y0, z0],
              [x1, y1, z0],
              [x0, y1, z1],
            ],
            [
              [x1, y0, z0],
              [x0, y0, z1],
              [x0, y1, z1],
              [x1, y1, z0],
            ],
          ];

          const brightness = def.lightLevel ? 1.0 : Math.min(1.0, 0.92 + torchBoost);
          for (const q of diagQuads) {
            const base = cutoutAcc.vertexCount;
            for (let i = 0; i < 4; i++) {
              const v = q[i]!;
              cutoutAcc.positions.push(v[0], v[1], v[2]);
              cutoutAcc.normals.push(0, 1, 0);
              cutoutAcc.colors.push(brightness, brightness, brightness);
            }
            cutoutAcc.uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
            cutoutAcc.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            cutoutAcc.vertexCount += 4;
          }
          continue;
        }

        if (shape === 'SLAB') {
          pushBox(
            opaqueAcc,
            wx,
            y,
            wz,
            wx + 1,
            y + 0.5,
            wz + 1,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          continue;
        }

        if (shape === 'STAIRS') {
          pushBox(
            opaqueAcc,
            wx,
            y,
            wz,
            wx + 1,
            y + 0.5,
            wz + 1,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          pushBox(
            opaqueAcc,
            wx,
            y + 0.5,
            wz,
            wx + 1,
            y + 1,
            wz + 0.5,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          continue;
        }

        if (shape === 'FENCE') {
          pushBox(
            opaqueAcc,
            wx + 0.35,
            y,
            wz + 0.35,
            wx + 0.65,
            y + 1,
            wz + 0.65,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          pushBox(
            opaqueAcc,
            wx,
            y + 0.65,
            wz + 0.42,
            wx + 1,
            y + 0.85,
            wz + 0.58,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          continue;
        }

        if (shape === 'DOOR') {
          pushBox(
            opaqueAcc,
            wx,
            y,
            wz + 0.38,
            wx + 1,
            y + 1,
            wz + 0.62,
            tiles.topIndex,
            tiles.bottomIndex,
            tiles.sideIndex,
            torchBoost
          );
          continue;
        }

        // Standard CUBE or LIQUID
        const isWater = shape === 'LIQUID';
        const targetAcc = isWater ? waterAcc : def.transparent ? cutoutAcc : opaqueAcc;

        for (let f = 0; f < 6; f++) {
          const face = cubeFaces[f]!;
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];
          const neighborId = getWorldBlock(nx, ny, nz);

          if (isWater) {
            if (neighborId === BLOCK_IDS.WATER || isOpaqueCube(neighborId)) continue;
          } else if (def.transparent) {
            if (neighborId === blockId || isOpaqueCube(neighborId)) continue;
          } else {
            if (isOpaqueCube(neighborId)) continue;
          }

          const tileIdx =
            face.faceKey === 'TOP'
              ? tiles.topIndex
              : face.faceKey === 'BOTTOM'
                ? tiles.bottomIndex
                : tiles.sideIndex;
          const uv = getTileUVRect(tileIdx);
          const base = targetAcc.vertexCount;

          // Depth & smooth voxel corner ambient occlusion
          const depthFactor = 0.82 + (y / CHUNK_SIZE_Y) * 0.18;

          for (let i = 0; i < 4; i++) {
            const v = face.verts[i]!;
            let vy = y + v[1];
            if (isWater && v[1] === 1 && getWorldBlock(wx, y + 1, wz) !== BLOCK_IDS.WATER) {
              vy = y + 0.86;
            }

            // Corner Ambient Occlusion check for top faces
            let ao = 1.0;
            if (face.faceKey === 'TOP' && !isWater) {
              const ox = v[0] === 1 ? 1 : -1;
              const oz = v[2] === 1 ? 1 : -1;
              const s1 = isOpaqueCube(getWorldBlock(wx + ox, y + 1, wz)) ? 1 : 0;
              const s2 = isOpaqueCube(getWorldBlock(wx, y + 1, wz + oz)) ? 1 : 0;
              const c1 = isOpaqueCube(getWorldBlock(wx + ox, y + 1, wz + oz)) ? 1 : 0;
              const occ = s1 && s2 ? 3 : s1 + s2 + c1;
              ao = 1.0 - occ * 0.11;
            }

            const lightVal = Math.min(1.12, face.shade * depthFactor * ao + torchBoost);
            const warmR = Math.min(1.15, lightVal + torchBoost * 0.35);
            const warmG = Math.min(1.12, lightVal + torchBoost * 0.18);
            const warmB = lightVal;

            targetAcc.positions.push(wx + v[0], vy, wz + v[2]);
            targetAcc.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            targetAcc.colors.push(warmR, warmG, warmB);
          }

          targetAcc.uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
          targetAcc.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          targetAcc.vertexCount += 4;
        }
      }
    }
  }

  return {
    opaqueGeometry: buildBufferGeometry(opaqueAcc),
    waterGeometry: buildBufferGeometry(waterAcc),
    cutoutGeometry: buildBufferGeometry(cutoutAcc),
  };
}
