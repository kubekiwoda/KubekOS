/**
 * KubekCraft — Day/Night Cycle, Celestial Bodies & Weather Particle System
 * Manages dynamic sky color transitions, fog density, Sun/Moon orbits,
 * nighttime starfield, and rain/snow precipitation around the player.
 */

import * as THREE from 'three';
import type { WeatherType } from './types';

export class EnvironmentSkyManager {
  public readonly skyGroup = new THREE.Group();
  public readonly ambientLight: THREE.AmbientLight;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly fog: THREE.Fog;

  private readonly sunMesh: THREE.Mesh;
  private readonly moonMesh: THREE.Mesh;
  private readonly starsPoints: THREE.Points;
  private readonly weatherPoints: THREE.Points;
  private readonly weatherMat: THREE.PointsMaterial;
  private readonly weatherPositions: Float32Array;
  private readonly weatherCount = 450;

  private readonly colorDay = new THREE.Color('#68b5f8');
  private readonly colorSunset = new THREE.Color('#ea580c');
  private readonly colorNight = new THREE.Color('#060919');
  private readonly colorRain = new THREE.Color('#475569');
  private readonly currentSkyColor = new THREE.Color('#68b5f8');

  constructor(scene: THREE.Scene) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.52);
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 0.45);
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    this.sunLight.position.set(40, 80, 30);

    this.fog = new THREE.Fog('#68b5f8', 32, 72);
    scene.fog = this.fog;
    scene.background = this.currentSkyColor;

    // Sun Mesh
    const sunGeom = new THREE.BoxGeometry(8, 8, 8);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfde047, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.skyGroup.add(this.sunMesh);

    // Moon Mesh
    const moonGeom = new THREE.BoxGeometry(6.5, 6.5, 6.5);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.skyGroup.add(this.moonMesh);

    // Starfield
    const starCount = 260;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.12);
      const r = 115;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 1.4,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.starsPoints = new THREE.Points(starGeom, starMat);
    this.skyGroup.add(this.starsPoints);

    // Weather Particles (Rain / Snow)
    this.weatherPositions = new Float32Array(this.weatherCount * 3);
    for (let i = 0; i < this.weatherCount; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 36;
      this.weatherPositions[i * 3 + 1] = Math.random() * 24;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    const weatherGeom = new THREE.BufferGeometry();
    weatherGeom.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.22,
      transparent: true,
      opacity: 0.75,
    });
    this.weatherPoints = new THREE.Points(weatherGeom, this.weatherMat);
    this.weatherPoints.visible = false;

    scene.add(this.ambientLight);
    scene.add(this.hemiLight);
    scene.add(this.sunLight);
    scene.add(this.skyGroup);
    scene.add(this.weatherPoints);
  }

  public update(
    dt: number,
    worldTime: number,
    weather: WeatherType,
    playerX: number,
    playerY: number,
    playerZ: number,
    renderDistanceChunks: number,
    enableParticles: boolean
  ): { isNight: boolean; timeLabel: string } {
    // Normalize 0..24000 ticks: 0 = 06:00, 6000 = 12:00, 12000 = 18:00, 18000 = 00:00
    const phase = ((worldTime % 24000) + 24000) % 24000;
    const angle = (phase / 24000) * Math.PI * 2;
    const sunElev = Math.sin(angle); // +1 at noon (6000), -1 at midnight (18000)
    const sunHoriz = Math.cos(angle);

    this.skyGroup.position.set(playerX, playerY, playerZ);

    const orbitRadius = 95;
    this.sunMesh.position.set(sunHoriz * orbitRadius, sunElev * orbitRadius, -24);
    this.sunMesh.lookAt(playerX, playerY, playerZ);

    this.moonMesh.position.set(-sunHoriz * orbitRadius, -sunElev * orbitRadius, 24);
    this.moonMesh.lookAt(playerX, playerY, playerZ);

    this.sunLight.position.set(
      playerX + sunHoriz * 50,
      playerY + Math.max(12, sunElev * 75),
      playerZ - 20
    );

    // Sky color & light intensity transitions
    if (sunElev > 0.22) {
      const t = Math.min(1, (sunElev - 0.22) / 0.5);
      this.currentSkyColor.copy(this.colorSunset).lerp(this.colorDay, t);
    } else if (sunElev > -0.18) {
      const t = (sunElev + 0.18) / 0.4;
      this.currentSkyColor.copy(this.colorNight).lerp(this.colorSunset, t);
    } else {
      this.currentSkyColor.copy(this.colorNight);
    }

    if (weather !== 'CLEAR') {
      this.currentSkyColor.lerp(this.colorRain, 0.48);
    }

    const dayFactor = Math.max(0, Math.min(1, (sunElev + 0.15) / 0.85));
    const weatherDim = weather === 'CLEAR' ? 1.0 : 0.72;

    this.ambientLight.intensity = (0.26 + dayFactor * 0.42) * weatherDim;
    this.hemiLight.intensity = (0.18 + dayFactor * 0.35) * weatherDim;
    this.sunLight.intensity = (0.08 + dayFactor * 0.92) * weatherDim;

    // Fog distance scales with configured render distance
    const maxDist = Math.max(36, renderDistanceChunks * 16);
    this.fog.color.copy(this.currentSkyColor);
    this.fog.near = maxDist * (weather === 'CLEAR' ? 0.52 : 0.35);
    this.fog.far = maxDist * (weather === 'CLEAR' ? 0.98 : 0.78);

    // Starfield opacity at night
    const starMat = this.starsPoints.material as THREE.PointsMaterial;
    const nightOpacity = sunElev < -0.05 && weather === 'CLEAR' ? Math.min(0.9, -sunElev) : 0;
    starMat.opacity = nightOpacity;

    // Weather particles update
    if (weather !== 'CLEAR' && enableParticles) {
      this.weatherPoints.visible = true;
      this.weatherPoints.position.set(playerX, playerY - 6, playerZ);
      const isSnow = weather === 'SNOW';
      this.weatherMat.color.setHex(isSnow ? 0xf8fafc : 0x60a5fa);
      this.weatherMat.size = isSnow ? 0.28 : 0.18;

      const fallSpeed = isSnow ? 3.8 : 16.5;
      const clampedDt = Math.min(dt, 0.08);
      for (let i = 0; i < this.weatherCount; i++) {
        let py = this.weatherPositions[i * 3 + 1]! - fallSpeed * clampedDt;
        if (py < 0) py += 24;
        this.weatherPositions[i * 3 + 1] = py;
        if (isSnow) {
          this.weatherPositions[i * 3]! += Math.sin(performance.now() * 0.002 + i) * 0.015;
        }
      }
      this.weatherPoints.geometry.attributes.position!.needsUpdate = true;
    } else {
      this.weatherPoints.visible = false;
    }

    // Format clock time (tick 0 = 06:00)
    const totalHours = ((phase / 1000 + 6) % 24 + 24) % 24;
    const hh = String(Math.floor(totalHours)).padStart(2, '0');
    const mm = String(Math.floor((totalHours % 1) * 60)).padStart(2, '0');

    return {
      isNight: sunElev < -0.08,
      timeLabel: `${hh}:${mm}`,
    };
  }

  public dispose() {
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();
    this.starsPoints.geometry.dispose();
    (this.starsPoints.material as THREE.Material).dispose();
    this.weatherPoints.geometry.dispose();
    this.weatherMat.dispose();
  }
}
