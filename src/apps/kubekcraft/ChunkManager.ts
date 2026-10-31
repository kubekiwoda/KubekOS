/**
 * KubekCraft — Chunk Streaming, Block Modification & Mesh Lifecycle Manager
 * Dynamically streams chunks around the player, applies persisted block edits,
 * updates chunk boundary meshes cleanly, and disposes distant GPU resources.
 */

import * as THREE from 'three';
import { BLOCK_IDS } from './BlockRegistry';
import { buildChunkGeometry } from './ChunkMesher';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  TerrainGenerator,
} from './TerrainGenerator';
import { initBlockTextureAtlas } from './TextureAtlas';

export interface ActiveChunkRecord {
  key: string;
  cx: number;
  cz: number;
  blocks: Uint8Array;
  dirty: boolean;
  opaqueMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  cutoutMesh: THREE.Mesh | null;
}

export class ChunkManager {
  public readonly sceneGroup = new THREE.Group();
  private readonly chunks = new Map<string, ActiveChunkRecord>();
  private readonly modifiedChunks = new Map<string, Map<number, number>>();
  private readonly terrainGen: TerrainGenerator;
  private readonly opaqueMaterial: THREE.MeshLambertMaterial;
  private readonly cutoutMaterial: THREE.MeshLambertMaterial;
  private readonly waterMaterial: THREE.MeshLambertMaterial;

  constructor(terrainGen: TerrainGenerator) {
    this.terrainGen = terrainGen;
    const { texture } = initBlockTextureAtlas();

    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
    });

    this.cutoutMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      alphaTest: 0.4,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
  }

  public static chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public static localIndex(lx: number, y: number, lz: number): number {
    return y * CHUNK_SIZE_X * CHUNK_SIZE_Z + lz * CHUNK_SIZE_X + lx;
  }

  public loadSavedChunkDeltas(
    deltas: Array<{ cx: number; cz: number; edits: Array<[number, number]> }>
  ) {
    for (const d of deltas) {
      const key = ChunkManager.chunkKey(d.cx, d.cz);
      const editMap = new Map<number, number>(d.edits);
      this.modifiedChunks.set(key, editMap);
      const existing = this.chunks.get(key);
      if (existing) {
        for (const [idx, bid] of editMap.entries()) {
          existing.blocks[idx] = bid;
        }
        existing.dirty = true;
      }
    }
  }

  public exportModifiedChunkDeltas(): Array<{
    cx: number;
    cz: number;
    edits: Array<[number, number]>;
  }> {
    const out: Array<{ cx: number; cz: number; edits: Array<[number, number]> }> = [];
    for (const [key, map] of this.modifiedChunks.entries()) {
      if (map.size === 0) continue;
      const [cxStr, czStr] = key.split(',');
      out.push({
        cx: Number(cxStr),
        cz: Number(czStr),
        edits: Array.from(map.entries()),
      });
    }
    return out;
  }

  private getOrCreateChunkData(cx: number, cz: number): ActiveChunkRecord {
    const key = ChunkManager.chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = this.terrainGen.generateChunkData(cx, cz);
    const savedEdits = this.modifiedChunks.get(key);
    if (savedEdits) {
      for (const [idx, bid] of savedEdits.entries()) {
        blocks[idx] = bid;
      }
    }

    const record: ActiveChunkRecord = {
      key,
      cx,
      cz,
      blocks,
      dirty: true,
      opaqueMesh: null,
      waterMesh: null,
      cutoutMesh: null,
    };

    this.chunks.set(key, record);
    return record;
  }

  public getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_SIZE_Y) return BLOCK_IDS.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    const chunk = this.chunks.get(ChunkManager.chunkKey(cx, cz));
    if (!chunk) {
      const edits = this.modifiedChunks.get(ChunkManager.chunkKey(cx, cz));
      const idx = ChunkManager.localIndex(lx, wy, lz);
      if (edits?.has(idx)) return edits.get(idx)!;
      return BLOCK_IDS.AIR;
    }

    return chunk.blocks[ChunkManager.localIndex(lx, wy, lz)] ?? BLOCK_IDS.AIR;
  }

  public setBlock(wx: number, wy: number, wz: number, blockId: number): boolean {
    if (wy <= 0 || wy >= CHUNK_SIZE_Y) return false;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    const chunk = this.getOrCreateChunkData(cx, cz);
    const idx = ChunkManager.localIndex(lx, wy, lz);
    if (chunk.blocks[idx] === blockId) return false;

    chunk.blocks[idx] = blockId;
    chunk.dirty = true;

    let editMap = this.modifiedChunks.get(chunk.key);
    if (!editMap) {
      editMap = new Map<number, number>();
      this.modifiedChunks.set(chunk.key, editMap);
    }
    editMap.set(idx, blockId);

    // Simple water propagation when adjacent water exists
    if (blockId === BLOCK_IDS.AIR) {
      const neighbors: Array<[number, number, number]> = [
        [wx + 1, wy, wz],
        [wx - 1, wy, wz],
        [wx, wy, wz + 1],
        [wx, wy, wz - 1],
        [wx, wy + 1, wz],
      ];
      for (const [nx, ny, nz] of neighbors) {
        if (this.getBlock(nx, ny, nz) === BLOCK_IDS.WATER) {
          chunk.blocks[idx] = BLOCK_IDS.WATER;
          editMap.set(idx, BLOCK_IDS.WATER);
          break;
        }
      }
    }

    // Mark neighbor chunks dirty if block is on a chunk boundary
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE_X - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.markChunkDirty(cx, cz + 1);

    this.rebuildChunkMesh(chunk);
    if (lx === 0) this.rebuildChunkIfLoaded(cx - 1, cz);
    if (lx === CHUNK_SIZE_X - 1) this.rebuildChunkIfLoaded(cx + 1, cz);
    if (lz === 0) this.rebuildChunkIfLoaded(cx, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.rebuildChunkIfLoaded(cx, cz + 1);

    return true;
  }

  private markChunkDirty(cx: number, cz: number) {
    const c = this.chunks.get(ChunkManager.chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  private rebuildChunkIfLoaded(cx: number, cz: number) {
    const c = this.chunks.get(ChunkManager.chunkKey(cx, cz));
    if (c && c.dirty) {
      this.rebuildChunkMesh(c);
    }
  }

  private disposeChunkMeshes(chunk: ActiveChunkRecord) {
    if (chunk.opaqueMesh) {
      this.sceneGroup.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (chunk.waterMesh) {
      this.sceneGroup.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
    if (chunk.cutoutMesh) {
      this.sceneGroup.remove(chunk.cutoutMesh);
      chunk.cutoutMesh.geometry.dispose();
      chunk.cutoutMesh = null;
    }
  }

  private rebuildChunkMesh(chunk: ActiveChunkRecord) {
    this.disposeChunkMeshes(chunk);

    const buffers = buildChunkGeometry(chunk.cx, chunk.cz, (wx, wy, wz) =>
      this.getBlock(wx, wy, wz)
    );

    if (buffers.opaqueGeometry) {
      const m = new THREE.Mesh(buffers.opaqueGeometry, this.opaqueMaterial);
      m.frustumCulled = true;
      m.receiveShadow = true;
      m.castShadow = false;
      this.sceneGroup.add(m);
      chunk.opaqueMesh = m;
    }

    if (buffers.cutoutGeometry) {
      const m = new THREE.Mesh(buffers.cutoutGeometry, this.cutoutMaterial);
      m.frustumCulled = true;
      this.sceneGroup.add(m);
      chunk.cutoutMesh = m;
    }

    if (buffers.waterGeometry) {
      const m = new THREE.Mesh(buffers.waterGeometry, this.waterMaterial);
      m.frustumCulled = true;
      m.renderOrder = 1;
      this.sceneGroup.add(m);
      chunk.waterMesh = m;
    }

    chunk.dirty = false;
  }

  public updateStreaming(
    playerX: number,
    playerZ: number,
    renderDistance: number,
    maxRebuildsPerFrame = 2
  ) {
    const centerCx = Math.floor(playerX / CHUNK_SIZE_X);
    const centerCz = Math.floor(playerZ / CHUNK_SIZE_Z);
    const r = Math.max(2, Math.min(6, renderDistance));

    const neededKeys = new Set<string>();
    const candidates: Array<{ cx: number; cz: number; distSq: number }> = [];

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > (r + 0.5) * (r + 0.5)) continue;
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        neededKeys.add(ChunkManager.chunkKey(cx, cz));
        candidates.push({ cx, cz, distSq });
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);

    // Ensure chunk voxel data exists for immediate neighborhood first
    for (const c of candidates) {
      this.getOrCreateChunkData(c.cx, c.cz);
    }

    // Rebuild up to maxRebuildsPerFrame dirty chunks closest to player
    let rebuilt = 0;
    for (const c of candidates) {
      const chunk = this.chunks.get(ChunkManager.chunkKey(c.cx, c.cz));
      if (chunk && chunk.dirty) {
        this.rebuildChunkMesh(chunk);
        rebuilt++;
        if (rebuilt >= maxRebuildsPerFrame) break;
      }
    }

    // Unload distant chunks outside renderDistance + 1
    const unloadRadiusSq = (r + 1.8) * (r + 1.8);
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        const dx = chunk.cx - centerCx;
        const dz = chunk.cz - centerCz;
        if (dx * dx + dz * dz > unloadRadiusSq) {
          this.disposeChunkMeshes(chunk);
          this.chunks.delete(key);
        }
      }
    }
  }

  public prebuildSpawnArea(spawnX: number, spawnZ: number, radius = 2) {
    const centerCx = Math.floor(spawnX / CHUNK_SIZE_X);
    const centerCz = Math.floor(spawnZ / CHUNK_SIZE_Z);

    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        this.getOrCreateChunkData(centerCx + dx, centerCz + dz);
      }
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getOrCreateChunkData(centerCx + dx, centerCz + dz);
        this.rebuildChunkMesh(chunk);
      }
    }
  }

  public getLoadedChunkCount(): number {
    return this.chunks.size;
  }

  public disposeAll() {
    for (const chunk of this.chunks.values()) {
      this.disposeChunkMeshes(chunk);
    }
    this.chunks.clear();
    this.opaqueMaterial.dispose();
    this.cutoutMaterial.dispose();
    this.waterMaterial.dispose();
  }
}
