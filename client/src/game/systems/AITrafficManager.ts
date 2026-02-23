import * as THREE from 'three';
import { AIAircraft } from '../entities/AIAircraft';

export interface TrafficInfo {
  callsign: string;
  position: THREE.Vector3;
  altitude: number;
  speed: number;
  heading: number;
  distance: number;
  bearing: number;
  aircraftType: string;
}

export class AITrafficManager {
  private aircraft: AIAircraft[] = [];
  private scene: THREE.Scene;
  private maxAircraft = 120; // Increased to support 100+ aircraft
  private spawnRadius = 12000;
  private playerStartPosition = new THREE.Vector3(-2500, 150, 500);
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  public initialize(count: number = 50): void {
    // Spawn initial AI aircraft near the player's starting position
    for (let i = 0; i < Math.min(count, this.maxAircraft); i++) {
      this.spawnAircraftNearPosition(this.playerStartPosition, i);
    }
  }
  
  private spawnAircraftNearPosition(centerPos: THREE.Vector3, index: number): void {
    // Generate position based on index - spread aircraft in rings around player
    const ring = Math.floor(index / 8); // 8 aircraft per ring
    const positionInRing = index % 8;
    
    // Base distance increases with each ring
    const baseDistance = 500 + ring * 600;
    const angle = (positionInRing / 8) * Math.PI * 2 + (ring * 0.4); // Offset each ring
    
    // Add randomness
    const distanceVariation = (Math.random() - 0.5) * 400;
    const angleVariation = (Math.random() - 0.5) * 0.5;
    const distance = baseDistance + distanceVariation;
    
    // Altitude varies by ring and random
    const baseAltitude = 100 + ring * 80 + Math.random() * 200;
    
    const x = centerPos.x + Math.sin(angle + angleVariation) * distance;
    const z = centerPos.z + Math.cos(angle + angleVariation) * distance;
    const altitude = centerPos.y + baseAltitude;
    
    const position = new THREE.Vector3(x, altitude, z);
    
    // Random heading with slight bias toward center
    const heading = Math.random() * 360;
    
    // Generate callsign from various airlines
    const airlines = [
      'AAL', 'UAL', 'DAL', 'SWA', 'JBU', 'ASA', 'NKS', 'FFT', 'SKW', 'ENY',
      'BAW', 'AFR', 'DLH', 'KLM', 'JAL', 'ANA', 'QFA', 'SIA', 'UAE', 'CPA'
    ];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNum = Math.floor(Math.random() * 9000) + 1000;
    const callsign = `${airline}${flightNum}`;
    
    const aircraft = new AIAircraft(callsign, position, heading);
    this.aircraft.push(aircraft);
    this.scene.add(aircraft.mesh);
  }
  
  private spawnAircraft(): void {
    // Generate random position for respawning
    const angle = Math.random() * Math.PI * 2;
    const distance = 2000 + Math.random() * this.spawnRadius;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const altitude = 200 + Math.random() * 1500;
    
    const position = new THREE.Vector3(x, altitude, z);
    const heading = Math.random() * 360;
    
    // Generate callsign
    const airlines = ['AAL', 'UAL', 'DAL', 'SWA', 'JBU', 'ASA', 'NKS', 'FFT'];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNum = Math.floor(Math.random() * 9000) + 1000;
    const callsign = `${airline}${flightNum}`;
    
    const aircraft = new AIAircraft(callsign, position, heading);
    this.aircraft.push(aircraft);
    this.scene.add(aircraft.mesh);
  }
  
  public update(deltaTime: number, terrainHeightFn: (x: number, z: number) => number, playerPosition: THREE.Vector3): void {
    // Get all traffic info for AI awareness
    const allTraffic = this.getAllTrafficInfo();
    
    for (const aircraft of this.aircraft) {
      // Pass nearby traffic to each AI (excluding itself)
      const nearbyTraffic = allTraffic
        .filter(t => t.callsign !== aircraft.callsign)
        .map(t => ({
          callsign: t.callsign,
          distance: aircraft.state.position.distanceTo(t.position),
          bearing: this.calculateBearing(aircraft.state.position, t.position),
          altitude: t.altitude,
        }))
        .filter(t => t.distance < 5000); // Only nearby traffic
      
      aircraft.setNearbyTraffic(nearbyTraffic);
      
      const terrainHeight = terrainHeightFn(aircraft.state.position.x, aircraft.state.position.z);
      aircraft.update(deltaTime, terrainHeight, playerPosition);
    }
    
    // Respawn aircraft that are too far away
    this.manageTraffic(playerPosition);
  }

  private calculateBearing(from: THREE.Vector3, to: THREE.Vector3): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
  }

  private getAllTrafficInfo(): Array<{ callsign: string; position: THREE.Vector3; altitude: number }> {
    return this.aircraft.map(a => ({
      callsign: a.callsign,
      position: a.state.position.clone(),
      altitude: a.getAltitude(),
    }));
  }
  
  private manageTraffic(playerPosition: THREE.Vector3): void {
    const despawnDistance = this.spawnRadius * 1.5;
    
    // Remove aircraft that are too far
    for (let i = this.aircraft.length - 1; i >= 0; i--) {
      const aircraft = this.aircraft[i];
      const distance = aircraft.state.position.distanceTo(playerPosition);
      
      if (distance > despawnDistance) {
        this.scene.remove(aircraft.mesh);
        this.aircraft.splice(i, 1);
      }
    }
    
    // Spawn new aircraft if needed
    while (this.aircraft.length < this.maxAircraft) {
      this.spawnAircraftNearPlayer(playerPosition);
    }
  }
  
  private spawnAircraftNearPlayer(playerPosition: THREE.Vector3): void {
    // Spawn at edge of spawn radius
    const angle = Math.random() * Math.PI * 2;
    const distance = this.spawnRadius * 0.8 + Math.random() * this.spawnRadius * 0.2;
    const x = playerPosition.x + Math.cos(angle) * distance;
    const z = playerPosition.z + Math.sin(angle) * distance;
    const altitude = 500 + Math.random() * 2500;
    
    const position = new THREE.Vector3(x, altitude, z);
    
    // Head towards player area
    const headingToPlayer = Math.atan2(
      playerPosition.x - x,
      playerPosition.z - z
    );
    const heading = THREE.MathUtils.radToDeg(headingToPlayer) + (Math.random() - 0.5) * 90;
    
    const airlines = ['AAL', 'UAL', 'DAL', 'SWA', 'JBU', 'ASA', 'NKS', 'FFT'];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNum = Math.floor(Math.random() * 9000) + 1000;
    const callsign = `${airline}${flightNum}`;
    
    const aircraft = new AIAircraft(callsign, position, heading);
    this.aircraft.push(aircraft);
    this.scene.add(aircraft.mesh);
  }
  
  public getNearbyTraffic(playerPosition: THREE.Vector3, maxDistance: number = 10000): TrafficInfo[] {
    const traffic: TrafficInfo[] = [];
    
    for (const aircraft of this.aircraft) {
      const position = aircraft.getPosition();
      const distance = position.distanceTo(playerPosition);
      
      if (distance <= maxDistance) {
        // Calculate bearing from player to aircraft
        const dx = position.x - playerPosition.x;
        const dz = position.z - playerPosition.z;
        const bearing = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
        
        traffic.push({
          callsign: aircraft.callsign,
          position: position,
          altitude: aircraft.getAltitude(),
          speed: aircraft.getSpeed(),
          heading: aircraft.getHeading(),
          distance: distance,
          bearing: bearing,
          aircraftType: aircraft.aircraftType,
        });
      }
    }
    
    // Sort by distance
    traffic.sort((a, b) => a.distance - b.distance);
    
    return traffic;
  }
  
  public getAircraftCount(): number {
    return this.aircraft.length;
  }
  
  // Get all aircraft positions for weapon targeting
  public getAircraftPositions(): THREE.Vector3[] {
    return this.aircraft.map(a => a.state.position.clone());
  }
  
  // Destroy aircraft at a given position (called when hit by weapon)
  public destroyAircraftAt(position: THREE.Vector3, radius: number = 50): boolean {
    for (let i = 0; i < this.aircraft.length; i++) {
      const aircraft = this.aircraft[i];
      if (aircraft.state.position.distanceTo(position) < radius) {
        // Remove from scene
        this.scene.remove(aircraft.mesh);
        // Remove from array
        this.aircraft.splice(i, 1);
        console.log(`💥 Aircraft destroyed!`);
        return true;
      }
    }
    return false;
  }
  
  public dispose(): void {
    for (const aircraft of this.aircraft) {
      this.scene.remove(aircraft.mesh);
    }
    this.aircraft = [];
  }
}
