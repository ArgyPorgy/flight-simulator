import * as THREE from 'three';
import { GameEngine } from './engine/GameEngine';
import { InputManager } from './input/InputManager';
import { PlayerAircraft } from './entities/PlayerAircraft';
import { CityWorld } from './world/CityWorld';
import { AITrafficManager, TrafficInfo } from './systems/AITrafficManager';
import { SoundManager } from './audio/SoundManager';
import { ExplosionEffect } from './effects/ExplosionEffect';
import { WeaponSystem, WeaponState, BombBlastEffect, ImpactResult } from './systems/WeaponSystem';

export interface FlightSimulatorCallbacks {
  onHUDUpdate?: (data: HUDData) => void;
  onTrafficUpdate?: (traffic: TrafficInfo[]) => void;
  onGameStateChange?: (state: GameState) => void;
  onScoreUpdate?: (score: GameScore) => void;
  aircraftType?: string;
}

export interface HUDData {
  airspeed: number;
  altitude: number;
  heading: number;
  verticalSpeed: number;
  throttle: number;
  isStalling: boolean;
  gearDown: boolean;
  flaps: number;
  cameraMode: string;
  fps: number;
  score?: number;
  isOnGround?: boolean;
  // Weapon data (only for combat aircraft)
  hasWeapons?: boolean;
  bullets?: number;
  missiles?: number;
  maxBullets?: number;
  maxMissiles?: number;
  kills?: number;
}

export interface GameScore {
  totalScore: number;
  flightTime: number;
  distanceFlown: number;
  maxAltitude: number;
  maxSpeed: number;
  crashes: number;
}

export type GameState = 'loading' | 'playing' | 'paused' | 'crashed' | 'ended';

export class FlightSimulator {
  private engine: GameEngine;
  private inputManager: InputManager;
  private playerAircraft: PlayerAircraft;
  private cityWorld: CityWorld;
  private trafficManager: AITrafficManager;
  private soundManager: SoundManager;
  private explosionEffect: ExplosionEffect;
  private weaponSystem: WeaponSystem | null = null;
  private bombBlastEffect: BombBlastEffect | null = null;
  
  private callbacks: FlightSimulatorCallbacks;
  private gameState: GameState = 'loading';
  private frameCount = 0;
  private lastFPSUpdate = 0;
  private fps = 60;
  
  // Aircraft type
  private aircraftType: string = 'fighter';
  private hasWeapons: boolean = false;
  private kills: number = 0;

  // Scoring
  private startTime = 0;
  private startPosition = new THREE.Vector3();
  private totalDistance = 0;
  private lastPosition = new THREE.Vector3();
  private maxAltitude = 0;
  private maxSpeed = 0;
  private crashes = 0;
  private totalScore = 0;
  private lastGearState = true;
  private lastStallState = false;
  
  constructor(container: HTMLElement, callbacks: FlightSimulatorCallbacks = {}) {
    this.callbacks = callbacks;
    this.aircraftType = callbacks.aircraftType || 'fighter';
    
    // Check if this aircraft has weapons (F-16 Falcon or B-2 Spirit)
    this.hasWeapons = this.aircraftType === 'fighter' || this.aircraftType === 'stealth';
    
    // Initialize sound manager
    this.soundManager = new SoundManager();
    
    // Initialize input manager
    this.inputManager = new InputManager();
    
    // Initialize game engine
    this.engine = new GameEngine({
      container,
      onUpdate: this.update.bind(this),
      onRender: this.onRender.bind(this),
    });
    
    // Create city world
    this.cityWorld = new CityWorld();
    this.engine.scene.add(this.cityWorld.group);
    
    // Create player aircraft
    this.playerAircraft = new PlayerAircraft(this.inputManager);
    this.engine.scene.add(this.playerAircraft.mesh);
    
    // Initialize weapon system for combat aircraft
    if (this.hasWeapons) {
      this.weaponSystem = new WeaponSystem(this.engine.scene);
      this.bombBlastEffect = new BombBlastEffect(this.engine.scene);
      console.log(`🎯 Weapons enabled for ${this.aircraftType}`);
    }
    
    // Start in stable level flight above the runway
    this.playerAircraft.state.position.set(-2500, 150, 500);
    this.playerAircraft.state.velocity.set(0, 0, -80);  // ~155 kts forward
    this.playerAircraft.state.rotation.set(0, 0, 0);
    this.playerAircraft.state.throttle = 0.5;
    
    // Initialize scoring
    this.startTime = performance.now();
    this.startPosition.copy(this.playerAircraft.state.position);
    this.lastPosition.copy(this.playerAircraft.state.position);
    this.lastGearState = this.playerAircraft.state.gearDown;
    
    // Initialize AI traffic - 100 AI aircraft flying nearby
    this.trafficManager = new AITrafficManager(this.engine.scene);
    this.trafficManager.initialize(100); // 100 AI aircraft
    
    // Initialize explosion effect
    this.explosionEffect = new ExplosionEffect(this.engine.scene);
    
    // Add atmospheric effects
    this.createAtmosphere();
    
    // Add clouds
    this.createClouds();
    
    this.setGameState('playing');
  }
  
  private createAtmosphere(): void {
    // Sky gradient dome
    const skyGeom = new THREE.SphereGeometry(20000, 16, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0066cc) },
        bottomColor: { value: new THREE.Color(0x99ccff) },
        horizonColor: { value: new THREE.Color(0xffeedd) },
        offset: { value: 400 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          
          vec3 skyColor;
          if (h < 0.1) {
            skyColor = mix(horizonColor, bottomColor, h * 10.0);
          } else {
            skyColor = mix(bottomColor, topColor, t);
          }
          
          gl_FragColor = vec4(skyColor, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    
    const sky = new THREE.Mesh(skyGeom, skyMat);
    this.engine.scene.add(sky);
    
    // Sun
    const sunGeom = new THREE.SphereGeometry(500, 12, 12);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
    });
    const sun = new THREE.Mesh(sunGeom, sunMat);
    sun.position.set(10000, 8000, -15000);
    this.engine.scene.add(sun);
    
    // Sun glow
    const glowGeom = new THREE.SphereGeometry(800, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffff99,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.copy(sun.position);
    this.engine.scene.add(glow);
  }
  
  private createClouds(): void {
    // Use InstancedMesh for all cloud puffs — single draw call
    const totalPuffs = 120;
    const puffGeom = new THREE.SphereGeometry(1, 6, 6);
    const puffMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const clouds = new THREE.InstancedMesh(puffGeom, puffMat, totalPuffs);
    
    const dummy = new THREE.Object3D();
    let idx = 0;
    
    for (let c = 0; c < 20 && idx < totalPuffs; c++) {
      const cx = (Math.random() - 0.5) * 15000;
      const cy = 1500 + Math.random() * 2000;
      const cz = (Math.random() - 0.5) * 15000;
      const cloudScale = 40 + Math.random() * 80;
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      
      for (let p = 0; p < numPuffs && idx < totalPuffs; p++) {
        dummy.position.set(
          cx + (Math.random() - 0.5) * cloudScale * 2,
          cy + (Math.random() - 0.5) * cloudScale * 0.3,
          cz + (Math.random() - 0.5) * cloudScale * 2
        );
        const s = cloudScale * (0.5 + Math.random() * 0.5);
        dummy.scale.set(s, s * 0.4, s);
        dummy.updateMatrix();
        clouds.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    
    clouds.count = idx;
    clouds.instanceMatrix.needsUpdate = true;
    this.engine.scene.add(clouds);
  }
  
  private update(deltaTime: number): void {
    // Clamp delta time
    deltaTime = Math.min(deltaTime, 0.1);

    // Always update explosion effect (even when crashed)
    this.explosionEffect.update(deltaTime);

    if (this.gameState !== 'playing') return;
    
    // Get terrain height at player position
    const terrainHeight = this.cityWorld.getHeightAt(
      this.playerAircraft.state.position.x,
      this.playerAircraft.state.position.z
    );
    
    // Update player
    this.playerAircraft.update(deltaTime, terrainHeight);
    
    // Update camera
    this.playerAircraft.updateCamera(this.engine.camera);
    
    // Update AI traffic
    this.trafficManager.update(
      deltaTime,
      (x, z) => this.cityWorld.getHeightAt(x, z),
      this.playerAircraft.state.position
    );
    
    // Update scoring
    this.updateScoring(deltaTime);
    
    // Sound effects
    this.updateSounds();
    
    // Check for emergency (about to crash)
    this.checkEmergency(terrainHeight);
    
    // Check for crash - multiple conditions
    const speed = this.playerAircraft.state.velocity.length();
    const verticalSpeed = this.playerAircraft.state.velocity.y;
    const heightAboveGround = this.playerAircraft.state.position.y - terrainHeight;
    const isOnGround = this.playerAircraft.state.isOnGround;
    const gearDown = this.playerAircraft.state.gearDown;
    
    // Crash conditions:
    // 1. Hit ground without gear down
    // 2. Hit ground too fast (hard landing)
    // 3. Stopped on ground without gear (belly landing)
    const crashConditions = (
      // Belly landing (gear up on ground)
      (isOnGround && !gearDown) ||
      // Hard impact (descending fast and hit ground)
      (isOnGround && verticalSpeed < -15) ||
      // Crashed into terrain at speed
      (heightAboveGround < 3 && speed > 50 && !gearDown)
    );
    
    if (crashConditions && this.gameState === 'playing') {
      this.triggerCrash();
    }
    
    // Update weapons if available
    if (this.weaponSystem) {
      this.updateWeapons(deltaTime);
    }
    
    // Update input manager
    this.inputManager.update();
    
    // Handle pause
    if (this.inputManager.wasKeyJustPressed('Escape')) {
      this.setGameState(this.gameState === 'paused' ? 'playing' : 'paused');
    }
    
    // Send HUD update
    this.sendHUDUpdate();
    
    // Send traffic update periodically
    if (this.frameCount % 30 === 0) {
      this.sendTrafficUpdate();
    }
  }

  private isEmergencyActive = false;

  private updateWeapons(deltaTime: number): void {
    if (!this.weaponSystem) return;
    
    // Update bomb blast effects
    this.bombBlastEffect?.update(deltaTime);
    
    // Get aircraft forward direction
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.playerAircraft.state.rotation);
    
    // Fire bullets with left mouse button or 'X' key (continuous fire)
    if (this.inputManager.isMouseButtonDown(0) || this.inputManager.isKeyDown('KeyX')) {
      const fired = this.weaponSystem.fireBullet(
        this.playerAircraft.state.position.clone(),
        forward
      );
      if (fired) {
        this.soundManager.playBullet();
      }
    }
    
    // Fire missiles with right mouse button or 'Z' key (single fire)
    if (this.inputManager.wasKeyJustPressed('KeyZ') || this.inputManager.isMouseButtonDown(2)) {
      const fired = this.weaponSystem.fireMissile(
        this.playerAircraft.state.position.clone(),
        forward
      );
      if (fired) {
        this.soundManager.playMissile();
      }
    }
    
    // Get AI aircraft positions as targets
    const targets = this.trafficManager.getAircraftPositions();
    
    // Update projectiles and check for impacts (pass terrain height function)
    const impacts = this.weaponSystem.update(
      deltaTime, 
      targets,
      (x, z) => this.cityWorld.getHeightAt(x, z)
    );
    
    // Process impacts
    for (const impact of impacts) {
      if (impact.type === 'aircraft') {
        // Find and destroy the hit aircraft
        const destroyed = this.trafficManager.destroyAircraftAt(impact.position);
        if (destroyed) {
          this.kills++;
          this.totalScore += 500; // Bonus points for kills
          this.explosionEffect.explode(impact.position);
          this.soundManager.playCrash();
        }
      } else if (impact.projectileType === 'missile') {
        // Missile hit ground or building - create bomb blast!
        const isGround = impact.type === 'ground';
        this.bombBlastEffect?.createBlast(impact.position, isGround);
        this.soundManager.playExplosion();
        
        // Bonus points for hitting buildings
        if (impact.type === 'building') {
          this.totalScore += 100;
        }
      }
      // Bullets hitting ground/buildings don't create big explosions
    }
  }

  private checkEmergency(terrainHeight: number): void {
    const altitude = this.playerAircraft.state.position.y;
    const verticalSpeed = this.playerAircraft.state.velocity.y;
    const speed = this.playerAircraft.state.velocity.length();
    const gearDown = this.playerAircraft.state.gearDown;
    
    // Calculate time to impact if descending
    const heightAboveGround = altitude - terrainHeight;
    const timeToImpact = verticalSpeed < -1 ? heightAboveGround / Math.abs(verticalSpeed) : Infinity;
    
    // Emergency conditions:
    // 1. Low altitude + descending fast + gear up
    // 2. Very low altitude + any descent
    // 3. Stalling at low altitude
    const isEmergency = (
      // Gear up and descending towards ground
      (heightAboveGround < 100 && verticalSpeed < -5 && !gearDown) ||
      // Very close to ground and descending
      (heightAboveGround < 30 && verticalSpeed < -2) ||
      // About to hit ground in < 3 seconds
      (timeToImpact < 3 && timeToImpact > 0) ||
      // Stalling at low altitude
      (this.playerAircraft.isStalling() && heightAboveGround < 200) ||
      // Too slow at low altitude (about to stall/crash)
      (speed < 30 && heightAboveGround < 100 && !this.playerAircraft.state.isOnGround)
    );

    if (isEmergency && !this.isEmergencyActive) {
      this.soundManager.playEmergency();
      this.isEmergencyActive = true;
    } else if (!isEmergency && this.isEmergencyActive) {
      this.soundManager.stopEmergency();
      this.isEmergencyActive = false;
    }
  }

  private triggerCrash(): void {
    console.log('🔥 CRASH TRIGGERED!');
    this.crashes++;
    
    // Hide the aircraft
    this.playerAircraft.mesh.visible = false;
    
    // Trigger explosion at crash location
    this.explosionEffect.explode(this.playerAircraft.state.position.clone());
    
    // Play massive boom sound
    this.soundManager.playCrash();
    
    this.setGameState('crashed');
  }

  private updateScoring(deltaTime: number): void {
    const pos = this.playerAircraft.state.position;
    const speed = this.playerAircraft.state.velocity.length();
    const altitude = pos.y * 3.281; // feet

    // Distance flown
    const distance = pos.distanceTo(this.lastPosition);
    this.totalDistance += distance;
    this.lastPosition.copy(pos);

    // Max altitude
    if (altitude > this.maxAltitude) {
      this.maxAltitude = altitude;
    }

    // Max speed
    const speedKnots = speed * 1.944;
    if (speedKnots > this.maxSpeed) {
      this.maxSpeed = speedKnots;
    }

    // Score calculation
    let score = 0;
    score += Math.floor(this.totalDistance * 0.1); // Distance bonus
    score += Math.floor(altitude * 0.01); // Altitude bonus
    score += Math.floor(speedKnots * 0.5); // Speed bonus
    score += Math.floor((performance.now() - this.startTime) / 1000); // Time bonus (1 point per second)

    // Gear change sound
    if (this.playerAircraft.state.gearDown !== this.lastGearState) {
      this.soundManager.playGearSound();
      this.lastGearState = this.playerAircraft.state.gearDown;
    }

    // Stall warning
    if (this.playerAircraft.isStalling() && !this.lastStallState) {
      this.soundManager.playStallWarning();
    }
    this.lastStallState = this.playerAircraft.isStalling();

    this.totalScore = score;
  }

  private updateSounds(): void {
    // Continuous flight sound (uses the MP3 file)
    this.soundManager.playEngine(this.playerAircraft.state.throttle);
  }

  public endGame(): void {
    if (this.gameState !== 'playing') return;

    this.soundManager.stopEmergency();
    this.soundManager.stopEngine();
    this.soundManager.playSuccess();
    this.isEmergencyActive = false;

    const flightTime = (performance.now() - this.startTime) / 1000; // seconds
    const distanceNm = this.totalDistance * 0.000539957; // meters to nautical miles

    const finalScore: GameScore = {
      totalScore: this.totalScore,
      flightTime: flightTime,
      distanceFlown: distanceNm,
      maxAltitude: this.maxAltitude,
      maxSpeed: this.maxSpeed,
      crashes: this.crashes,
    };

    this.callbacks.onScoreUpdate?.(finalScore);
    this.setGameState('ended');
  }
  
  private onRender(): void {
    this.frameCount++;
    
    // Calculate FPS
    const now = performance.now();
    if (now - this.lastFPSUpdate > 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFPSUpdate));
      this.frameCount = 0;
      this.lastFPSUpdate = now;
    }
  }
  
  private sendHUDUpdate(): void {
    if (!this.callbacks.onHUDUpdate) return;
    
    // Get terrain height to check if on ground
    const terrainHeight = this.cityWorld.getHeightAt(
      this.playerAircraft.state.position.x,
      this.playerAircraft.state.position.z
    );
    const heightAboveGround = this.playerAircraft.state.position.y - terrainHeight;
    const isOnGround = heightAboveGround < 10; // Within 10 meters of ground
    
    // Get weapon state if available
    const weaponState = this.weaponSystem?.getState();
    
    this.callbacks.onHUDUpdate({
      airspeed: Math.round(this.playerAircraft.getAirspeed()),
      altitude: Math.round(this.playerAircraft.getAltitude()),
      heading: Math.round(this.playerAircraft.getHeading()),
      verticalSpeed: Math.round(this.playerAircraft.getVerticalSpeed()),
      throttle: Math.round(this.playerAircraft.getThrottle()),
      isStalling: this.playerAircraft.isStalling(),
      gearDown: this.playerAircraft.isGearDown(),
      flaps: this.playerAircraft.getFlaps(),
      cameraMode: this.playerAircraft.getCameraMode(),
      fps: this.fps,
      score: this.totalScore,
      isOnGround: isOnGround,
      // Weapon data
      hasWeapons: this.hasWeapons,
      bullets: weaponState?.bullets,
      missiles: weaponState?.missiles,
      maxBullets: weaponState?.maxBullets,
      maxMissiles: weaponState?.maxMissiles,
      kills: this.kills,
    });
  }
  
  private sendTrafficUpdate(): void {
    if (!this.callbacks.onTrafficUpdate) return;
    
    const traffic = this.trafficManager.getNearbyTraffic(
      this.playerAircraft.state.position,
      15000
    );
    
    this.callbacks.onTrafficUpdate(traffic);
  }
  
  private setGameState(state: GameState): void {
    this.gameState = state;
    this.callbacks.onGameStateChange?.(state);
  }
  
  public start(): void {
    this.engine.start();
  }
  
  public stop(): void {
    this.engine.stop();
  }
  
  public takeoff(): void {
    if (this.gameState !== 'playing') return;

    // Get terrain height
    const terrainHeight = this.cityWorld.getHeightAt(
      this.playerAircraft.state.position.x,
      this.playerAircraft.state.position.z
    );
    const heightAboveGround = this.playerAircraft.state.position.y - terrainHeight;
    
    // Only allow takeoff if on ground with gear down
    if (heightAboveGround > 10 || !this.playerAircraft.state.gearDown) {
      return; // Not on ground or gear not down
    }

    // Set takeoff configuration
    this.playerAircraft.state.throttle = 0.9; // High throttle
    this.playerAircraft.state.flaps = 0.5; // Takeoff flaps
    
    // Set forward velocity for takeoff roll
    const headingRad = this.playerAircraft.state.rotation.y;
    const takeoffSpeed = 40; // m/s (~78 knots) - good takeoff speed
    this.playerAircraft.state.velocity.set(
      -Math.sin(headingRad) * takeoffSpeed,
      0,
      -Math.cos(headingRad) * takeoffSpeed
    );
    
    // Slight nose-up attitude for takeoff
    this.playerAircraft.state.rotation.x = -0.1; // Slight pitch up
    
    // Reset angular velocity
    this.playerAircraft.state.angularVelocity.set(0, 0, 0);
    
    console.log('✈️ Takeoff initiated!');
  }

  public restart(): void {
    // Stop any emergency sounds
    this.soundManager.stopEmergency();
    this.isEmergencyActive = false;
    
    // Clear explosion effect
    this.explosionEffect.clear();
    
    // Show aircraft again
    this.playerAircraft.mesh.visible = true;
    
    // Reset to stable level flight
    this.playerAircraft.state.position.set(-2500, 150, 500);
    this.playerAircraft.state.velocity.set(0, 0, -80);
    this.playerAircraft.state.rotation.set(0, 0, 0);
    this.playerAircraft.state.angularVelocity.set(0, 0, 0);
    this.playerAircraft.state.throttle = 0.5;
    this.playerAircraft.state.gearDown = true;
    this.playerAircraft.state.flaps = 0;
    
    // Reset scoring
    this.startTime = performance.now();
    this.startPosition.copy(this.playerAircraft.state.position);
    this.lastPosition.copy(this.playerAircraft.state.position);
    this.totalDistance = 0;
    this.maxAltitude = 0;
    this.maxSpeed = 0;
    this.crashes = 0;
    this.totalScore = 0;
    this.lastGearState = true;
    this.lastStallState = false;
    
    this.setGameState('playing');
  }
  
  public getGameState(): GameState {
    return this.gameState;
  }
  
  public getScore(): GameScore {
    const flightTime = (performance.now() - this.startTime) / 1000;
    const distanceNm = this.totalDistance * 0.000539957;
    return {
      totalScore: this.totalScore,
      flightTime: flightTime,
      distanceFlown: distanceNm,
      maxAltitude: this.maxAltitude,
      maxSpeed: this.maxSpeed,
      crashes: this.crashes,
    };
  }

  public dispose(): void {
    this.soundManager.dispose();
    this.explosionEffect.dispose();
    this.weaponSystem?.dispose();
    this.bombBlastEffect?.dispose();
    this.engine.dispose();
    this.inputManager.dispose();
    this.trafficManager.dispose();
  }
}
