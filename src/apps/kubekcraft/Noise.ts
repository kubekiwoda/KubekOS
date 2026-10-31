/**
 * KubekCraft — Deterministic Seeded PRNG & Multi-Octave 2D/3D Noise Engine
 * Guarantees identical terrain, biomes, caves, and ores for the same world seed.
 */

export function hashSeedString(seedStr: string): number {
  const clean = seedStr.trim() || 'KubekOS-2026';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1337420;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededNoise {
  private readonly perm = new Uint8Array(512);

  constructor(seed: number) {
    const rng = createSeededRng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i]!;
      p[i] = p[j]!;
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad2d(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -2.0 * v : 2.0 * v);
  }

  private grad3d(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X]! + Y]!;
    const ab = this.perm[this.perm[X]! + Y + 1]!;
    const ba = this.perm[this.perm[X + 1]! + Y]!;
    const bb = this.perm[this.perm[X + 1]! + Y + 1]!;

    const x1 = this.lerp(u, this.grad2d(aa, xf, yf), this.grad2d(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad2d(ab, xf, yf - 1), this.grad2d(bb, xf - 1, yf - 1));
    return this.lerp(v, x1, x2) * 0.45;
  }

  public noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A = this.perm[X]! + Y;
    const AA = this.perm[A]! + Z;
    const AB = this.perm[A + 1]! + Z;
    const B = this.perm[X + 1]! + Y;
    const BA = this.perm[B]! + Z;
    const BB = this.perm[B + 1]! + Z;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad3d(this.perm[AA]!, xf, yf, zf),
          this.grad3d(this.perm[BA]!, xf - 1, yf, zf)
        ),
        this.lerp(
          u,
          this.grad3d(this.perm[AB]!, xf, yf - 1, zf),
          this.grad3d(this.perm[BB]!, xf - 1, yf - 1, zf)
        )
      ),
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad3d(this.perm[AA + 1]!, xf, yf, zf - 1),
          this.grad3d(this.perm[BA + 1]!, xf - 1, yf, zf - 1)
        ),
        this.lerp(
          u,
          this.grad3d(this.perm[AB + 1]!, xf, yf - 1, zf - 1),
          this.grad3d(this.perm[BB + 1]!, xf - 1, yf - 1, zf - 1)
        )
      )
    );
  }

  public fbm2D(
    x: number,
    y: number,
    octaves = 4,
    lacunarity = 2.0,
    gain = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxVal = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total / maxVal;
  }

  public coordHash(x: number, y: number, z: number): number {
    let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }
}
