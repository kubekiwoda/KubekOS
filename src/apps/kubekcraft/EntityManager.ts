/**
 * KubekCraft — 3D Voxel Creature AI & Dropped Item Entity Manager
 * Builds articulated multi-part 3D voxel creature models (not single cubes),
 * runs roaming/chase/flee/attack AI, handles combat & knockback, and manages item drops.
 */

import * as THREE from 'three';
import { BLOCK_IDS, ITEM_IDS, getItemDef, isCollidableBlock } from './BlockRegistry';
import { SEA_LEVEL } from './TerrainGenerator';
import type {
  BiomeId,
  CreatureEntity,
  CreatureType,
  DifficultyLevel,
  DroppedItemEntity,
  GameMode,
} from './types';

interface ArticulatedCreatureMesh {
  root: THREE.Group;
  head: THREE.Mesh;
  legs: THREE.Mesh[];
  materials: THREE.MeshLambertMaterial[];
}

export class EntityManager {
  public readonly sceneGroup = new THREE.Group();
  public creatures: CreatureEntity[] = [];
  public droppedItems: DroppedItemEntity[] = [];

  private readonly creatureMeshes = new Map<string, ArticulatedCreatureMesh>();
  private readonly droppedMeshes = new Map<string, THREE.Mesh>();
  private spawnTimer = 0;

  private buildCreatureModel(type: CreatureType): ArticulatedCreatureMesh {
    const root = new THREE.Group();
    const materials: THREE.MeshLambertMaterial[] = [];
    const legs: THREE.Mesh[] = [];

    const makeBox = (
      w: number,
      h: number,
      d: number,
      hex: string,
      x: number,
      y: number,
      z: number
    ) => {
      const mat = new THREE.MeshLambertMaterial({ color: hex });
      materials.push(mat);
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      root.add(mesh);
      return mesh;
    };

    let head: THREE.Mesh;

    switch (type) {
      case 'MEADOW_SHEEP': {
        // Fluffy wool torso + beige head + 4 hooves
        makeBox(0.85, 0.65, 1.15, '#f8fafc', 0, 0.68, 0);
        head = makeBox(0.5, 0.48, 0.52, '#e2d5c1', 0, 0.92, -0.68);
        // Eyes
        makeBox(0.1, 0.1, 0.05, '#1e293b', -0.15, 0.96, -0.95);
        makeBox(0.1, 0.1, 0.05, '#1e293b', 0.15, 0.96, -0.95);
        // 4 legs
        legs.push(makeBox(0.22, 0.42, 0.22, '#cbd5e1', -0.26, 0.21, -0.38));
        legs.push(makeBox(0.22, 0.42, 0.22, '#cbd5e1', 0.26, 0.21, -0.38));
        legs.push(makeBox(0.22, 0.42, 0.22, '#cbd5e1', -0.26, 0.21, 0.38));
        legs.push(makeBox(0.22, 0.42, 0.22, '#cbd5e1', 0.26, 0.21, 0.38));
        break;
      }
      case 'FOREST_HOPPER': {
        // Small brown forest critter with long ears
        makeBox(0.46, 0.38, 0.62, '#a16207', 0, 0.35, 0);
        head = makeBox(0.36, 0.34, 0.36, '#b4741b', 0, 0.56, -0.34);
        // Long ears
        makeBox(0.09, 0.32, 0.08, '#92400e', -0.1, 0.82, -0.32);
        makeBox(0.09, 0.32, 0.08, '#92400e', 0.1, 0.82, -0.32);
        // 4 nimble legs
        legs.push(makeBox(0.14, 0.22, 0.16, '#78350f', -0.15, 0.11, -0.2));
        legs.push(makeBox(0.14, 0.22, 0.16, '#78350f', 0.15, 0.11, -0.2));
        legs.push(makeBox(0.16, 0.24, 0.2, '#78350f', -0.16, 0.12, 0.22));
        legs.push(makeBox(0.16, 0.24, 0.2, '#78350f', 0.16, 0.12, 0.22));
        break;
      }
      case 'SKYWING_BIRD': {
        // Azure bird with flapping wings and yellow beak
        makeBox(0.4, 0.34, 0.58, '#0ea5e9', 0, 0.45, 0);
        head = makeBox(0.3, 0.3, 0.3, '#38bdf8', 0, 0.68, -0.32);
        makeBox(0.14, 0.1, 0.2, '#facc15', 0, 0.64, -0.52);
        // Wings stored in legs array for flapping animation
        legs.push(makeBox(0.45, 0.08, 0.42, '#7dd3fc', -0.4, 0.5, 0));
        legs.push(makeBox(0.45, 0.08, 0.42, '#7dd3fc', 0.4, 0.5, 0));
        break;
      }
      case 'SHADOW_STALKER': {
        // Tall bipedal dark-obsidian creature with glowing crimson eyes
        makeBox(0.56, 0.82, 0.34, '#1e1b4b', 0, 0.98, 0);
        head = makeBox(0.48, 0.48, 0.48, '#0f172a', 0, 1.64, 0);
        makeBox(0.12, 0.08, 0.05, '#f43f5e', -0.12, 1.66, -0.25);
        makeBox(0.12, 0.08, 0.05, '#f43f5e', 0.12, 1.66, -0.25);
        // Arms & Legs
        legs.push(makeBox(0.22, 0.65, 0.22, '#1e293b', -0.15, 0.32, 0));
        legs.push(makeBox(0.22, 0.65, 0.22, '#1e293b', 0.15, 0.32, 0));
        legs.push(makeBox(0.18, 0.68, 0.18, '#312e81', -0.4, 1.0, -0.15));
        legs.push(makeBox(0.18, 0.68, 0.18, '#312e81', 0.4, 1.0, -0.15));
        break;
      }
      case 'FROST_RUNNER': {
        // Fast quadrupedal ice-crawler with cyan core
        makeBox(0.68, 0.42, 0.85, '#164e63', 0, 0.45, 0);
        head = makeBox(0.46, 0.38, 0.46, '#0891b2', 0, 0.58, -0.52);
        makeBox(0.12, 0.12, 0.06, '#67e8f9', -0.12, 0.62, -0.76);
        makeBox(0.12, 0.12, 0.06, '#67e8f9', 0.12, 0.62, -0.76);
        legs.push(makeBox(0.18, 0.38, 0.18, '#22d3ee', -0.36, 0.19, -0.3));
        legs.push(makeBox(0.18, 0.38, 0.18, '#22d3ee', 0.36, 0.19, -0.3));
        legs.push(makeBox(0.18, 0.38, 0.18, '#22d3ee', -0.36, 0.19, 0.3));
        legs.push(makeBox(0.18, 0.38, 0.18, '#22d3ee', 0.36, 0.19, 0.3));
        break;
      }
      case 'VOID_SENTINEL':
      default: {
        // Floating crystalline sentinel with orbiting pillars
        makeBox(0.55, 0.75, 0.55, '#4c1d95', 0, 0.95, 0);
        head = makeBox(0.45, 0.45, 0.45, '#7c3aed', 0, 1.58, 0);
        makeBox(0.22, 0.14, 0.06, '#facc15', 0, 1.58, -0.24);
        legs.push(makeBox(0.16, 0.55, 0.16, '#c084fc', -0.45, 0.95, 0));
        legs.push(makeBox(0.16, 0.55, 0.16, '#c084fc', 0.45, 0.95, 0));
        break;
      }
    }

    this.sceneGroup.add(root);
    return { root, head, legs, materials };
  }

  public spawnCreature(
    type: CreatureType,
    x: number,
    y: number,
    z: number
  ): CreatureEntity {
    const id = `mob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isHostile =
      type === 'SHADOW_STALKER' || type === 'FROST_RUNNER' || type === 'VOID_SENTINEL';

    const specs: Record<
      CreatureType,
      { name: string; hp: number; speed: number; dmg: number; range: number }
    > = {
      MEADOW_SHEEP: { name: 'Meadow Sheep', hp: 10, speed: 2.0, dmg: 0, range: 0 },
      FOREST_HOPPER: { name: 'Forest Hopper', hp: 6, speed: 3.1, dmg: 0, range: 0 },
      SKYWING_BIRD: { name: 'Skywing Bird', hp: 6, speed: 3.4, dmg: 0, range: 0 },
      SHADOW_STALKER: { name: 'Shadow Stalker', hp: 20, speed: 3.3, dmg: 3, range: 1.75 },
      FROST_RUNNER: { name: 'Frost Runner', hp: 14, speed: 4.3, dmg: 2, range: 1.65 },
      VOID_SENTINEL: { name: 'Void Sentinel', hp: 22, speed: 2.8, dmg: 4, range: 3.8 },
    };

    const s = specs[type];
    const entity: CreatureEntity = {
      id,
      type,
      name: s.name,
      hostile: isHostile,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      health: s.hp,
      maxHealth: s.hp,
      speed: s.speed,
      attackDamage: s.dmg,
      attackRange: s.range,
      attackCooldown: 0,
      aiState: 'ROAM',
      stateTimer: 2 + Math.random() * 4,
      targetYaw: Math.random() * Math.PI * 2,
      hurtTimer: 0,
      animPhase: Math.random() * 10,
      onGround: true,
    };

    const model = this.buildCreatureModel(type);
    model.root.position.set(x, y, z);
    this.creatureMeshes.set(id, model);
    this.creatures.push(entity);
    return entity;
  }

  public spawnDroppedItem(
    itemId: number,
    count: number,
    x: number,
    y: number,
    z: number,
    durability?: number,
    pickupDelay = 0.25
  ) {
    if (itemId <= 0 || count <= 0) return;
    const id = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const def = getItemDef(itemId);
    const primaryHex =
      def.palette?.top[0] ?? def.iconColors?.primary ?? '#38bdf8';

    const geom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat = new THREE.MeshLambertMaterial({ color: primaryHex });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y + 0.35, z);
    this.sceneGroup.add(mesh);
    this.droppedMeshes.set(id, mesh);

    this.droppedItems.push({
      id,
      itemId,
      count,
      durability,
      x,
      y: y + 0.3,
      z,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 3.2,
      vz: (Math.random() - 0.5) * 2.2,
      createdAt: performance.now(),
      pickupDelay,
    });
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    isNight: boolean,
    gameMode: GameMode,
    difficulty: DifficultyLevel,
    getBlock: (wx: number, wy: number, wz: number) => number,
    sampleBiome: (wx: number, wz: number) => { height: number; biome: BiomeId },
    onPlayerAttacked: (damage: number, attackerName: string) => void,
    onItemPickedUp: (itemId: number, count: number, durability?: number) => boolean
  ) {
    const clampedDt = Math.min(dt, 0.08);
    const allowHostiles = gameMode === 'SURVIVAL' && difficulty !== 'PEACEFUL';

    // Remove hostile mobs immediately if switched to Peaceful
    if (!allowHostiles) {
      for (let i = this.creatures.length - 1; i >= 0; i--) {
        if (this.creatures[i]!.hostile) {
          this.removeCreatureAt(i);
        }
      }
    }

    // Periodic ambient spawning around player
    this.spawnTimer += clampedDt;
    if (this.spawnTimer >= 4.0 && this.creatures.length < 14) {
      this.spawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 14;
      const sx = Math.floor(playerX + Math.cos(angle) * dist);
      const sz = Math.floor(playerZ + Math.sin(angle) * dist);
      const col = sampleBiome(sx, sz);

      if (col.height > SEA_LEVEL && getBlock(sx, col.height, sz) !== BLOCK_IDS.WATER) {
        if (isNight && allowHostiles && Math.random() < 0.65) {
          const r = Math.random();
          const hType: CreatureType =
            r < 0.45
              ? 'SHADOW_STALKER'
              : r < 0.8
                ? 'FROST_RUNNER'
                : 'VOID_SENTINEL';
          this.spawnCreature(hType, sx + 0.5, col.height + 1, sz + 0.5);
        } else {
          const pType: CreatureType =
            col.biome === 'FOREST'
              ? 'FOREST_HOPPER'
              : Math.random() < 0.35
                ? 'SKYWING_BIRD'
                : 'MEADOW_SHEEP';
          this.spawnCreature(pType, sx + 0.5, col.height + 1, sz + 0.5);
        }
      }
    }

    // Update active creatures
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i]!;
      const dx = playerX - c.x;
      const dy = playerY - c.y;
      const dz = playerZ - c.z;
      const distToPlayer = Math.hypot(dx, dy, dz);

      // Despawn very distant creatures
      if (distToPlayer > 54) {
        this.removeCreatureAt(i);
        continue;
      }

      if (c.hurtTimer > 0) {
        c.hurtTimer = Math.max(0, c.hurtTimer - clampedDt);
      }
      if (c.attackCooldown > 0) {
        c.attackCooldown = Math.max(0, c.attackCooldown - clampedDt);
      }

      c.stateTimer -= clampedDt;

      if (c.hostile && allowHostiles && distToPlayer < 16) {
        c.aiState = distToPlayer <= c.attackRange ? 'ATTACK' : 'CHASE';
        c.targetYaw = Math.atan2(-dx, -dz);
      } else if (c.aiState === 'FLEE' && c.stateTimer > 0) {
        // Continue fleeing after being hit
      } else if (c.stateTimer <= 0) {
        c.aiState = Math.random() < 0.35 ? 'IDLE' : 'ROAM';
        c.stateTimer = 2 + Math.random() * 4;
        c.targetYaw = Math.random() * Math.PI * 2;
      }

      // Smooth yaw rotation
      const yawDiff = c.targetYaw - c.yaw;
      c.yaw += Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff)) * Math.min(1, clampedDt * 6);

      let moveSpeed = 0;
      if (c.aiState === 'ROAM') moveSpeed = c.speed * 0.55;
      else if (c.aiState === 'CHASE') moveSpeed = c.speed;
      else if (c.aiState === 'FLEE') moveSpeed = c.speed * 1.45;

      const fx = -Math.sin(c.yaw);
      const fz = -Math.cos(c.yaw);
      c.vx = fx * moveSpeed;
      c.vz = fz * moveSpeed;

      // Gravity & Obstacle jumping
      if (c.type === 'SKYWING_BIRD') {
        const groundY = sampleBiome(Math.floor(c.x), Math.floor(c.z)).height + 3.5;
        c.vy = (groundY - c.y) * 1.5;
      } else {
        c.vy = Math.max(-24, c.vy - 22 * clampedDt);
      }

      const nextX = c.x + c.vx * clampedDt;
      const nextZ = c.z + c.vz * clampedDt;
      const blockAhead = getBlock(
        Math.floor(nextX),
        Math.floor(c.y + 0.2),
        Math.floor(nextZ)
      );

      if (!isCollidableBlock(blockAhead)) {
        c.x = nextX;
        c.z = nextZ;
      } else if (
        c.onGround &&
        !isCollidableBlock(
          getBlock(Math.floor(nextX), Math.floor(c.y + 1.2), Math.floor(nextZ))
        )
      ) {
        c.vy = 7.4;
        c.onGround = false;
      } else {
        c.targetYaw += Math.PI * 0.65;
      }

      const nextY = c.y + c.vy * clampedDt;
      const blockBelow = getBlock(
        Math.floor(c.x),
        Math.floor(nextY),
        Math.floor(c.z)
      );
      if (!isCollidableBlock(blockBelow)) {
        c.y = nextY;
        c.onGround = false;
      } else {
        if (c.vy < 0) {
          c.y = Math.floor(nextY) + 1;
          c.onGround = true;
        }
        c.vy = 0;
      }

      // Hostile attack execution
      if (
        c.hostile &&
        allowHostiles &&
        distToPlayer <= c.attackRange &&
        c.attackCooldown <= 0
      ) {
        c.attackCooldown = 1.25;
        const diffMult =
          difficulty === 'EASY' ? 0.75 : difficulty === 'HARD' ? 1.35 : 1.0;
        onPlayerAttacked(Math.max(1, Math.round(c.attackDamage * diffMult)), c.name);
      }

      // Update visual mesh & limb swing animation
      const model = this.creatureMeshes.get(c.id);
      if (model) {
        model.root.position.set(c.x, c.y, c.z);
        model.root.rotation.y = c.yaw;

        if (moveSpeed > 0.1 || c.type === 'SKYWING_BIRD') {
          c.animPhase += clampedDt * (moveSpeed * 2.6 + 3);
          const swing = Math.sin(c.animPhase) * 0.55;
          model.legs.forEach((leg, idx) => {
            if (c.type === 'SKYWING_BIRD') {
              leg.rotation.z = idx % 2 === 0 ? swing : -swing;
            } else {
              leg.rotation.x = idx % 2 === 0 ? swing : -swing;
            }
          });
        } else {
          model.legs.forEach((leg) => {
            leg.rotation.x = 0;
            leg.rotation.z = 0;
          });
        }

        // Flash red when damaged
        for (const mat of model.materials) {
          mat.emissive.setHex(c.hurtTimer > 0 ? 0x991111 : 0x000000);
        }
      }
    }

    // Update dropped items in world
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const drop = this.droppedItems[i]!;
      drop.pickupDelay = Math.max(0, drop.pickupDelay - clampedDt);

      drop.vy = Math.max(-18, drop.vy - 20 * clampedDt);
      const nx = drop.x + drop.vx * clampedDt;
      const nz = drop.z + drop.vz * clampedDt;
      const ny = drop.y + drop.vy * clampedDt;

      if (!isCollidableBlock(getBlock(Math.floor(nx), Math.floor(drop.y), Math.floor(nz)))) {
        drop.x = nx;
        drop.z = nz;
      }
      drop.vx *= 0.88;
      drop.vz *= 0.88;

      if (!isCollidableBlock(getBlock(Math.floor(drop.x), Math.floor(ny), Math.floor(drop.z)))) {
        drop.y = ny;
      } else {
        drop.y = Math.floor(ny) + 1.15;
        drop.vy = 0;
      }

      const dist = Math.hypot(playerX - drop.x, playerY + 0.8 - drop.y, playerZ - drop.z);
      if (drop.pickupDelay <= 0 && dist < 2.1) {
        // Magnetic attraction to player
        drop.x += (playerX - drop.x) * Math.min(1, clampedDt * 11);
        drop.y += (playerY + 0.7 - drop.y) * Math.min(1, clampedDt * 11);
        drop.z += (playerZ - drop.z) * Math.min(1, clampedDt * 11);

        if (dist < 1.15) {
          const picked = onItemPickedUp(drop.itemId, drop.count, drop.durability);
          if (picked) {
            this.removeDroppedItemAt(i);
            continue;
          }
        }
      }

      // Despawn after 3 minutes
      if (performance.now() - drop.createdAt > 180_000) {
        this.removeDroppedItemAt(i);
        continue;
      }

      const mesh = this.droppedMeshes.get(drop.id);
      if (mesh) {
        const bob = Math.sin(performance.now() * 0.004 + i) * 0.08;
        mesh.position.set(drop.x, drop.y + bob, drop.z);
        mesh.rotation.y += clampedDt * 2.2;
      }
    }
  }

  public tryAttackCreatureOnRay(
    originX: number,
    originY: number,
    originZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    attackDamage: number
  ): { hitCreature: CreatureEntity; killed: boolean } | null {
    let bestCreature: CreatureEntity | null = null;
    let bestDist = 4.2;

    for (const c of this.creatures) {
      const cx = c.x;
      const cy = c.y + 0.75;
      const cz = c.z;
      const toX = cx - originX;
      const toY = cy - originY;
      const toZ = cz - originZ;
      const proj = toX * dirX + toY * dirY + toZ * dirZ;
      if (proj < 0.2 || proj > bestDist) continue;

      const perpX = toX - dirX * proj;
      const perpY = toY - dirY * proj;
      const perpZ = toZ - dirZ * proj;
      const perpDist = Math.hypot(perpX, perpY, perpZ);

      if (perpDist <= 0.75) {
        bestDist = proj;
        bestCreature = c;
      }
    }

    if (!bestCreature) return null;

    bestCreature.health -= attackDamage;
    bestCreature.hurtTimer = 0.35;
    bestCreature.vx += dirX * 4.5;
    bestCreature.vy = 4.2;
    bestCreature.vz += dirZ * 4.5;

    if (!bestCreature.hostile) {
      bestCreature.aiState = 'FLEE';
      bestCreature.stateTimer = 4.0;
      bestCreature.targetYaw = Math.atan2(-dirX, -dirZ);
    }

    if (bestCreature.health <= 0) {
      const idx = this.creatures.indexOf(bestCreature);
      if (idx !== -1) {
        // Spawn drops
        if (bestCreature.type === 'MEADOW_SHEEP') {
          this.spawnDroppedItem(ITEM_IDS.RAW_MEAT, 2, bestCreature.x, bestCreature.y, bestCreature.z);
          this.spawnDroppedItem(ITEM_IDS.LEATHER, 1, bestCreature.x, bestCreature.y, bestCreature.z);
        } else if (bestCreature.type === 'FOREST_HOPPER') {
          this.spawnDroppedItem(ITEM_IDS.RAW_MEAT, 1, bestCreature.x, bestCreature.y, bestCreature.z);
          this.spawnDroppedItem(ITEM_IDS.LEATHER, 1, bestCreature.x, bestCreature.y, bestCreature.z);
        } else if (bestCreature.type === 'SKYWING_BIRD') {
          this.spawnDroppedItem(ITEM_IDS.FEATHER, 2, bestCreature.x, bestCreature.y, bestCreature.z);
        } else if (bestCreature.type === 'SHADOW_STALKER') {
          this.spawnDroppedItem(ITEM_IDS.COAL, 2, bestCreature.x, bestCreature.y, bestCreature.z);
          this.spawnDroppedItem(ITEM_IDS.IRON_INGOT, 1, bestCreature.x, bestCreature.y, bestCreature.z);
        } else if (bestCreature.type === 'FROST_RUNNER') {
          this.spawnDroppedItem(BLOCK_IDS.ICE, 2, bestCreature.x, bestCreature.y, bestCreature.z);
        } else if (bestCreature.type === 'VOID_SENTINEL') {
          this.spawnDroppedItem(
            ITEM_IDS.CRYSTAL_SHARD,
            2,
            bestCreature.x,
            bestCreature.y,
            bestCreature.z
          );
        }
        this.removeCreatureAt(idx);
      }
      return { hitCreature: bestCreature, killed: true };
    }

    return { hitCreature: bestCreature, killed: false };
  }

  private removeCreatureAt(index: number) {
    const c = this.creatures[index];
    if (!c) return;
    const model = this.creatureMeshes.get(c.id);
    if (model) {
      this.sceneGroup.remove(model.root);
      model.root.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      for (const m of model.materials) m.dispose();
      this.creatureMeshes.delete(c.id);
    }
    this.creatures.splice(index, 1);
  }

  private removeDroppedItemAt(index: number) {
    const d = this.droppedItems[index];
    if (!d) return;
    const mesh = this.droppedMeshes.get(d.id);
    if (mesh) {
      this.sceneGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.droppedMeshes.delete(d.id);
    }
    this.droppedItems.splice(index, 1);
  }

  public disposeAll() {
    while (this.creatures.length > 0) {
      this.removeCreatureAt(0);
    }
    while (this.droppedItems.length > 0) {
      this.removeDroppedItemAt(0);
    }
  }
}
