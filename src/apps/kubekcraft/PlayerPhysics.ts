/**
 * KubekCraft — Player Physics, AABB Voxel Collision & 3D DDA Block Raycaster
 * Handles gravity, jumping, sprinting, crouching, swimming, flight, fall damage,
 * and sub-voxel precision block raycasting.
 */

import { BLOCK_IDS, getItemDef, isCollidableBlock } from './BlockRegistry';
import type { RaycastHitResult } from './types';

export const PLAYER_RADIUS = 0.32;
export const PLAYER_HEIGHT_NORMAL = 1.72;
export const PLAYER_HEIGHT_CROUCH = 1.38;
export const PLAYER_EYE_HEIGHT_NORMAL = 1.56;
export const PLAYER_EYE_HEIGHT_CROUCH = 1.24;
export const GRAVITY = 24.0;
export const JUMP_VELOCITY = 8.4;

export interface PlayerKinematics {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  onGround: boolean;
  inWater: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isFlying: boolean;
  fallDistance: number;
  stepDistanceAccum: number;
}

export interface MovementInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
}

export function getBlockMaxY(blockId: number, by: number): number {
  const def = getItemDef(blockId);
  if (def.shape === 'SLAB') return by + 0.5;
  return by + 1.0;
}

export function checkPlayerAABBCollision(
  px: number,
  py: number,
  pz: number,
  height: number,
  getBlock: (wx: number, wy: number, wz: number) => number
): boolean {
  const minX = Math.floor(px - PLAYER_RADIUS);
  const maxX = Math.floor(px + PLAYER_RADIUS);
  const minY = Math.floor(py);
  const maxY = Math.floor(py + height - 0.001);
  const minZ = Math.floor(pz - PLAYER_RADIUS);
  const maxZ = Math.floor(pz + PLAYER_RADIUS);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const bid = getBlock(x, y, z);
        if (isCollidableBlock(bid)) {
          const blockTop = getBlockMaxY(bid, y);
          if (py < blockTop && py + height > y) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function wouldBlockOverlapPlayer(
  blockX: number,
  blockY: number,
  blockZ: number,
  player: PlayerKinematics
): boolean {
  const height = player.isCrouching ? PLAYER_HEIGHT_CROUCH : PLAYER_HEIGHT_NORMAL;
  const pMinX = player.x - PLAYER_RADIUS;
  const pMaxX = player.x + PLAYER_RADIUS;
  const pMinY = player.y + 0.02;
  const pMaxY = player.y + height - 0.02;
  const pMinZ = player.z - PLAYER_RADIUS;
  const pMaxZ = player.z + PLAYER_RADIUS;

  const overlapsX = pMaxX > blockX && pMinX < blockX + 1;
  const overlapsY = pMaxY > blockY && pMinY < blockY + 1;
  const overlapsZ = pMaxZ > blockZ && pMinZ < blockZ + 1;

  return overlapsX && overlapsY && overlapsZ;
}

export function stepPlayerPhysics(
  player: PlayerKinematics,
  input: MovementInputState,
  dt: number,
  getBlock: (wx: number, wy: number, wz: number) => number
): { landedFallDamage: number; footstepTriggered: boolean } {
  const clampedDt = Math.min(dt, 0.08);
  player.isCrouching = input.crouch && !player.isFlying;
  player.isSprinting = input.sprint && input.forward && !player.isCrouching;

  const height = player.isCrouching ? PLAYER_HEIGHT_CROUCH : PLAYER_HEIGHT_NORMAL;
  const feetBlock = getBlock(Math.floor(player.x), Math.floor(player.y + 0.2), Math.floor(player.z));
  const waistBlock = getBlock(Math.floor(player.x), Math.floor(player.y + 0.9), Math.floor(player.z));
  player.inWater = feetBlock === BLOCK_IDS.WATER || waistBlock === BLOCK_IDS.WATER;

  if (player.inWater) {
    player.fallDistance = 0;
  }

  // Forward/Right unit vectors on horizontal plane
  // In Three.js camera with rotation.order = 'YXZ', forward is (-sin(yaw), 0, -cos(yaw))
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);

  let moveX = 0;
  let moveZ = 0;
  if (input.forward) {
    moveX += forwardX;
    moveZ += forwardZ;
  }
  if (input.backward) {
    moveX -= forwardX;
    moveZ -= forwardZ;
  }
  if (input.right) {
    moveX += rightX;
    moveZ += rightZ;
  }
  if (input.left) {
    moveX -= rightX;
    moveZ -= rightZ;
  }

  const moveLen = Math.hypot(moveX, moveZ);
  if (moveLen > 0.001) {
    moveX /= moveLen;
    moveZ /= moveLen;
  }

  let baseSpeed = 4.6;
  if (player.isFlying) {
    baseSpeed = player.isSprinting ? 14.5 : 9.0;
  } else if (player.inWater) {
    baseSpeed = 3.2;
  } else if (player.isCrouching) {
    baseSpeed = 2.3;
  } else if (player.isSprinting) {
    baseSpeed = 6.7;
  }

  player.vx = moveX * baseSpeed;
  player.vz = moveZ * baseSpeed;

  let landedFallDamage = 0;

  if (player.isFlying) {
    player.fallDistance = 0;
    let vy = 0;
    if (input.jump) vy += 6.5;
    if (input.crouch) vy -= 6.5;
    player.vy = vy;
  } else if (player.inWater) {
    if (input.jump) {
      player.vy = 4.2;
    } else {
      player.vy = Math.max(-2.8, player.vy - GRAVITY * 0.25 * clampedDt);
    }
  } else {
    if (input.jump && player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
    player.vy = Math.max(-36, player.vy - GRAVITY * clampedDt);
  }

  // Move X with collision & auto-step for slabs
  const nextX = player.x + player.vx * clampedDt;
  if (!checkPlayerAABBCollision(nextX, player.y, player.z, height, getBlock)) {
    player.x = nextX;
  } else if (
    player.onGround &&
    !checkPlayerAABBCollision(nextX, player.y + 0.55, player.z, height, getBlock)
  ) {
    player.x = nextX;
    player.y += 0.55;
  } else {
    player.vx = 0;
  }

  // Move Z with collision & auto-step for slabs
  const nextZ = player.z + player.vz * clampedDt;
  if (!checkPlayerAABBCollision(player.x, player.y, nextZ, height, getBlock)) {
    player.z = nextZ;
  } else if (
    player.onGround &&
    !checkPlayerAABBCollision(player.x, player.y + 0.55, nextZ, height, getBlock)
  ) {
    player.z = nextZ;
    player.y += 0.55;
  } else {
    player.vz = 0;
  }

  // Move Y with collision & fall distance tracking
  const dy = player.vy * clampedDt;
  const nextY = player.y + dy;
  if (!checkPlayerAABBCollision(player.x, nextY, player.z, height, getBlock)) {
    if (dy < 0 && !player.inWater && !player.isFlying) {
      player.fallDistance += -dy;
    }
    player.y = nextY;
    player.onGround = false;
  } else {
    if (player.vy < 0) {
      if (player.fallDistance > 3.6 && !player.inWater && !player.isFlying) {
        landedFallDamage = Math.floor(player.fallDistance - 3.2);
      }
      player.fallDistance = 0;
      player.onGround = true;
      // Snap cleanly to top of supporting block
      player.y = Math.floor(player.y * 2) / 2;
      while (checkPlayerAABBCollision(player.x, player.y, player.z, height, getBlock)) {
        player.y += 0.05;
      }
    }
    player.vy = 0;
  }

  // Prevent falling below world floor
  if (player.y < 1.2) {
    player.y = 1.2;
    player.vy = 0;
    player.onGround = true;
  }

  let footstepTriggered = false;
  if (player.onGround && moveLen > 0.1) {
    player.stepDistanceAccum += Math.hypot(player.vx, player.vz) * clampedDt;
    if (player.stepDistanceAccum >= 1.9) {
      player.stepDistanceAccum = 0;
      footstepTriggered = true;
    }
  }

  return { landedFallDamage, footstepTriggered };
}

export function raycastVoxel(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDistance: number,
  getBlock: (wx: number, wy: number, wz: number) => number
): RaycastHitResult | null {
  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const stepZ = dirZ > 0 ? 1 : dirZ < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dirX) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dirY) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dirZ) : Infinity;

  let tMaxX =
    stepX > 0
      ? (Math.floor(originX) + 1 - originX) * tDeltaX
      : stepX < 0
        ? (originX - Math.floor(originX)) * tDeltaX
        : Infinity;
  let tMaxY =
    stepY > 0
      ? (Math.floor(originY) + 1 - originY) * tDeltaY
      : stepY < 0
        ? (originY - Math.floor(originY)) * tDeltaY
        : Infinity;
  let tMaxZ =
    stepZ > 0
      ? (Math.floor(originZ) + 1 - originZ) * tDeltaZ
      : stepZ < 0
        ? (originZ - Math.floor(originZ)) * tDeltaZ
        : Infinity;

  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;
  let dist = 0;

  for (let i = 0; i < 48; i++) {
    const bid = getBlock(x, y, z);
    if (bid !== BLOCK_IDS.AIR && bid !== BLOCK_IDS.WATER) {
      return {
        blockX: x,
        blockY: y,
        blockZ: z,
        normalX,
        normalY,
        normalZ,
        placeX: x + normalX,
        placeY: y + normalY,
        placeZ: z + normalZ,
        blockId: bid,
        distance: dist,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        if (dist > maxDistance) break;
        x += stepX;
        tMaxX += tDeltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else {
        dist = tMaxZ;
        if (dist > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        dist = tMaxY;
        if (dist > maxDistance) break;
        y += stepY;
        tMaxY += tDeltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        dist = tMaxZ;
        if (dist > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    }
  }

  return null;
}
