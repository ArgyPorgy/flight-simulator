import * as THREE from 'three';
import { AircraftPhysics, AircraftState, AircraftConfig } from '../physics/AircraftPhysics';
import { aiController, FlightContext } from '../ai/AIController';

export type AIBehaviorState = 
  | 'taxi'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'turn'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'avoid'
  | 'follow'
  | 'patrol';

interface Waypoint {
  position: THREE.Vector3;
  altitude: number;
  speed: number;
}

const AI_AIRCRAFT_CONFIG: AircraftConfig = {
  mass: 6000,
  wingArea: 40,
  maxThrust: 40000,
  dragCoefficient: 0.030,
  liftCoefficientBase: 0.35,
  liftCurveSlope: 4.5,
  stallAngle: 0.28,
  maxSpeed: 220,
  pitchRate: 1.0,
  rollRate: 1.5,
  yawRate: 0.6,
};

// Different aircraft types for variety
type AircraftType = 'fighter' | 'airliner' | 'private' | 'cargo';

const AIRCRAFT_COLORS: Record<AircraftType, number[]> = {
  fighter: [0x4a5568, 0x2d3748, 0x1a202c, 0x718096],
  airliner: [0xffffff, 0xe2e8f0, 0x3182ce, 0xe53e3e],
  private: [0xffffff, 0xf6e05e, 0x48bb78, 0x9f7aea],
  cargo: [0x718096, 0x4a5568, 0xa0aec0, 0x2d3748],
};

export class AIAircraft {
  public mesh: THREE.Group;
  public state: AircraftState;
  public behaviorState: AIBehaviorState = 'cruise';
  public callsign: string;
  public aircraftType: AircraftType;
  public lastDecisionReasoning: string = '';
  
  private physics: AircraftPhysics;
  private waypoints: Waypoint[] = [];
  private currentWaypointIndex = 0;
  private targetAltitude = 1000;
  private targetSpeed = 150;
  private targetHeading = 0;
  private engineGlow: THREE.Mesh | null = null;
  
  constructor(callsign: string, startPosition: THREE.Vector3, startHeading: number) {
    this.callsign = callsign;
    this.physics = new AircraftPhysics(AI_AIRCRAFT_CONFIG);
    
    // Random aircraft type
    const types: AircraftType[] = ['fighter', 'airliner', 'private', 'cargo'];
    this.aircraftType = types[Math.floor(Math.random() * types.length)];
    
    // Initialize state
    const headingRad = THREE.MathUtils.degToRad(startHeading);
    const initialSpeed = 80;
    
    this.state = {
      position: startPosition.clone(),
      velocity: new THREE.Vector3(
        -Math.sin(headingRad) * initialSpeed,
        0,
        -Math.cos(headingRad) * initialSpeed
      ),
      rotation: new THREE.Euler(0, headingRad, 0),
      angularVelocity: new THREE.Vector3(),
      throttle: 0.6,
      pitch: 0,
      roll: 0,
      yaw: 0,
      isOnGround: false,
      isStalling: false,
      gearDown: false,
      flaps: 0,
    };
    
    // Create mesh based on type
    this.mesh = this.createAircraftMesh();
    this.updateMeshFromState();
    
    // Generate flight plan
    this.generateFlightPlan();
  }
  
  private createAircraftMesh(): THREE.Group {
    switch (this.aircraftType) {
      case 'fighter':
        return this.createFighterMesh();
      case 'airliner':
        return this.createAirlinerMesh();
      case 'private':
        return this.createPrivateMesh();
      case 'cargo':
        return this.createCargoMesh();
      default:
        return this.createFighterMesh();
    }
  }
  
  private createFighterMesh(): THREE.Group {
    const group = new THREE.Group();
    const colors = AIRCRAFT_COLORS.fighter;
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    
    const bodyMat = new THREE.MeshLambertMaterial({
      color: mainColor,
    });
    
    // Fuselage
    const fuselageGeom = new THREE.CylinderGeometry(1.5, 1.2, 18, 8);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);
    
    // Nose
    const noseGeom = new THREE.ConeGeometry(1.2, 6, 8);
    noseGeom.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.z = -12;
    nose.castShadow = true;
    group.add(nose);
    
    // Delta wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(12, -5);
    wingShape.lineTo(12, 5);
    wingShape.lineTo(0, 0);
    
    const wingGeom = new THREE.ExtrudeGeometry(wingShape, { depth: 0.3, bevelEnabled: false });
    wingGeom.rotateX(Math.PI / 2);
    wingGeom.rotateZ(-Math.PI / 2);
    
    const leftWing = new THREE.Mesh(wingGeom, bodyMat);
    leftWing.position.set(-1, 0, 0);
    leftWing.castShadow = true;
    group.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeom, bodyMat);
    rightWing.position.set(1, 0, 0);
    rightWing.scale.x = -1;
    rightWing.castShadow = true;
    group.add(rightWing);
    
    // Tail
    const tailGeom = new THREE.BoxGeometry(0.3, 5, 3);
    const tail = new THREE.Mesh(tailGeom, bodyMat);
    tail.position.set(0, 2.5, 7);
    tail.castShadow = true;
    group.add(tail);
    
    // Engine glow
    const glowGeom = new THREE.ConeGeometry(0.8, 3, 8);
    glowGeom.rotateX(Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
    });
    this.engineGlow = new THREE.Mesh(glowGeom, glowMat);
    this.engineGlow.position.z = 11;
    group.add(this.engineGlow);
    
    // Nav lights
    this.addNavLights(group, 12);
    
    group.scale.setScalar(0.8);
    return group;
  }
  
  private createAirlinerMesh(): THREE.Group {
    const group = new THREE.Group();
    const colors = AIRCRAFT_COLORS.airliner;
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    
    const bodyMat = new THREE.MeshLambertMaterial({ color: mainColor });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x2d3748 });
    
    // Fuselage (longer, wider)
    const fuselageGeom = new THREE.CylinderGeometry(3, 3, 35, 16);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);
    
    // Nose
    const noseGeom = new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    noseGeom.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.z = -17.5;
    nose.castShadow = true;
    group.add(nose);
    
    // Tail cone
    const tailGeom = new THREE.ConeGeometry(3, 8, 16);
    tailGeom.rotateX(Math.PI / 2);
    const tailCone = new THREE.Mesh(tailGeom, bodyMat);
    tailCone.position.z = 21.5;
    tailCone.castShadow = true;
    group.add(tailCone);
    
    // Wings (swept back)
    const wingGeom = new THREE.BoxGeometry(40, 0.5, 8);
    const wings = new THREE.Mesh(wingGeom, bodyMat);
    wings.position.y = -1;
    wings.castShadow = true;
    group.add(wings);
    
    // Engines under wings
    const engineGeom = new THREE.CylinderGeometry(1.5, 1.8, 6, 12);
    engineGeom.rotateX(Math.PI / 2);
    
    const leftEngine = new THREE.Mesh(engineGeom, darkMat);
    leftEngine.position.set(-12, -3, 2);
    leftEngine.castShadow = true;
    group.add(leftEngine);
    
    const rightEngine = new THREE.Mesh(engineGeom, darkMat);
    rightEngine.position.set(12, -3, 2);
    rightEngine.castShadow = true;
    group.add(rightEngine);
    
    // Vertical stabilizer
    const vStabGeom = new THREE.BoxGeometry(0.5, 10, 8);
    const vStab = new THREE.Mesh(vStabGeom, bodyMat);
    vStab.position.set(0, 5, 18);
    vStab.castShadow = true;
    group.add(vStab);
    
    // Horizontal stabilizer
    const hStabGeom = new THREE.BoxGeometry(15, 0.3, 4);
    const hStab = new THREE.Mesh(hStabGeom, bodyMat);
    hStab.position.set(0, 0, 22);
    hStab.castShadow = true;
    group.add(hStab);
    
    // Nav lights
    this.addNavLights(group, 20);
    
    group.scale.setScalar(0.5);
    return group;
  }
  
  private createPrivateMesh(): THREE.Group {
    const group = new THREE.Group();
    const colors = AIRCRAFT_COLORS.private;
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    
    const bodyMat = new THREE.MeshLambertMaterial({ color: mainColor });
    
    // Fuselage
    const fuselageGeom = new THREE.CylinderGeometry(1.2, 1, 12, 8);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);
    
    // Nose
    const noseGeom = new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    noseGeom.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.z = -6;
    nose.castShadow = true;
    group.add(nose);
    
    // High wing
    const wingGeom = new THREE.BoxGeometry(20, 0.3, 3);
    const wings = new THREE.Mesh(wingGeom, bodyMat);
    wings.position.y = 1.5;
    wings.castShadow = true;
    group.add(wings);
    
    // Tail
    const tailGeom = new THREE.BoxGeometry(0.2, 4, 2);
    const tail = new THREE.Mesh(tailGeom, bodyMat);
    tail.position.set(0, 2, 5);
    tail.castShadow = true;
    group.add(tail);
    
    // Horizontal stabilizer
    const hStabGeom = new THREE.BoxGeometry(8, 0.2, 2);
    const hStab = new THREE.Mesh(hStabGeom, bodyMat);
    hStab.position.set(0, 0, 5.5);
    hStab.castShadow = true;
    group.add(hStab);
    
    // Propeller
    const propGeom = new THREE.BoxGeometry(0.3, 6, 0.5);
    const propMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const prop = new THREE.Mesh(propGeom, propMat);
    prop.position.z = -7;
    group.add(prop);
    
    // Nav lights
    this.addNavLights(group, 10);
    
    group.scale.setScalar(0.7);
    return group;
  }
  
  private createCargoMesh(): THREE.Group {
    const group = new THREE.Group();
    const colors = AIRCRAFT_COLORS.cargo;
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    
    const bodyMat = new THREE.MeshLambertMaterial({ color: mainColor });
    
    // Wide fuselage
    const fuselageGeom = new THREE.CylinderGeometry(4, 4, 40, 16);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);
    
    // Nose
    const noseGeom = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    noseGeom.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.z = -20;
    nose.castShadow = true;
    group.add(nose);
    
    // Tail
    const tailGeom = new THREE.ConeGeometry(4, 10, 16);
    tailGeom.rotateX(Math.PI / 2);
    const tailCone = new THREE.Mesh(tailGeom, bodyMat);
    tailCone.position.z = 25;
    tailCone.castShadow = true;
    group.add(tailCone);
    
    // High wings
    const wingGeom = new THREE.BoxGeometry(50, 0.8, 10);
    const wings = new THREE.Mesh(wingGeom, bodyMat);
    wings.position.y = 4;
    wings.castShadow = true;
    group.add(wings);
    
    // 4 engines
    const engineGeom = new THREE.CylinderGeometry(2, 2.5, 8, 12);
    engineGeom.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshLambertMaterial({ color: 0x2d3748 });
    
    [-18, -8, 8, 18].forEach(x => {
      const engine = new THREE.Mesh(engineGeom, engineMat);
      engine.position.set(x, 2, -5);
      engine.castShadow = true;
      group.add(engine);
    });
    
    // T-tail
    const vStabGeom = new THREE.BoxGeometry(0.8, 15, 10);
    const vStab = new THREE.Mesh(vStabGeom, bodyMat);
    vStab.position.set(0, 7.5, 22);
    vStab.castShadow = true;
    group.add(vStab);
    
    const hStabGeom = new THREE.BoxGeometry(20, 0.5, 5);
    const hStab = new THREE.Mesh(hStabGeom, bodyMat);
    hStab.position.set(0, 15, 22);
    hStab.castShadow = true;
    group.add(hStab);
    
    // Nav lights
    this.addNavLights(group, 25);
    
    group.scale.setScalar(0.4);
    return group;
  }
  
  private addNavLights(group: THREE.Group, wingSpan: number): void {
    // Red (left)
    const redBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    redBulb.position.set(-wingSpan / 2, 0, 0);
    group.add(redBulb);
    
    // Green (right)
    const greenBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    greenBulb.position.set(wingSpan / 2, 0, 0);
    group.add(greenBulb);
    
    // White (tail)
    const whiteBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    whiteBulb.position.set(0, 3, wingSpan / 2);
    group.add(whiteBulb);
  }
  
  private generateFlightPlan(): void {
    const centerX = this.state.position.x;
    const centerZ = this.state.position.z;
    const radius = 5000 + Math.random() * 10000;
    const numWaypoints = 4 + Math.floor(Math.random() * 4);
    
    this.waypoints = [];
    
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 2000;
      const z = centerZ + Math.sin(angle) * radius + (Math.random() - 0.5) * 2000;
      const altitude = 500 + Math.random() * 2000;
      
      this.waypoints.push({
        position: new THREE.Vector3(x, altitude, z),
        altitude,
        speed: 100 + Math.random() * 100,
      });
    }
    
    this.currentWaypointIndex = 0;
    this.targetAltitude = this.waypoints[0].altitude;
    this.targetSpeed = this.waypoints[0].speed;
  }
  
  private nearbyTrafficCache: Array<{ callsign: string; distance: number; bearing: number; altitude: number }> = [];
  private lastAIUpdateTime = 0;
  private aiUpdateInterval = 2000; // Update AI decision every 2 seconds

  public setNearbyTraffic(traffic: Array<{ callsign: string; distance: number; bearing: number; altitude: number }>): void {
    this.nearbyTrafficCache = traffic.filter(t => t.callsign !== this.callsign);
  }

  public update(deltaTime: number, terrainHeight: number, playerPosition: THREE.Vector3): void {
    this.updateBehavior(playerPosition);
    this.applyControls(deltaTime);
    this.state = this.physics.update(this.state, deltaTime, terrainHeight);
    this.updateMeshFromState();
    this.updateEffects();
  }
  
  private updateBehavior(playerPosition: THREE.Vector3): void {
    const now = Date.now();
    
    // Get AI decision periodically
    if (now - this.lastAIUpdateTime > this.aiUpdateInterval) {
      this.lastAIUpdateTime = now;
      this.getAIDecision(playerPosition);
    }

    // Fallback to waypoint navigation if no AI decision yet
    if (this.waypoints.length === 0) return;
    
    const currentWaypoint = this.waypoints[this.currentWaypointIndex];
    const distanceToWaypoint = this.state.position.distanceTo(currentWaypoint.position);
    
    if (distanceToWaypoint < 500) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      const nextWaypoint = this.waypoints[this.currentWaypointIndex];
      this.targetAltitude = nextWaypoint.altitude;
      this.targetSpeed = nextWaypoint.speed;
    }
    
    // Only use waypoint heading if not overridden by AI
    if (this.behaviorState === 'cruise' || this.behaviorState === 'patrol') {
      const dx = currentWaypoint.position.x - this.state.position.x;
      const dz = currentWaypoint.position.z - this.state.position.z;
      this.targetHeading = Math.atan2(-dx, -dz);
    }
    
    // Collision avoidance (immediate override)
    const distanceToPlayer = this.state.position.distanceTo(playerPosition);
    if (distanceToPlayer < 500) {
      if (this.state.position.y < playerPosition.y + 100) {
        this.targetAltitude = playerPosition.y + 200;
        this.behaviorState = 'avoid';
      }
    }
    
    // Update behavior state based on altitude change
    const altitudeDiff = this.targetAltitude - this.state.position.y;
    if (this.behaviorState !== 'avoid' && this.behaviorState !== 'follow') {
      if (Math.abs(altitudeDiff) < 50) {
        if (this.behaviorState !== 'turn' && this.behaviorState !== 'patrol') {
          this.behaviorState = 'cruise';
        }
      } else if (altitudeDiff > 0) {
        this.behaviorState = 'climb';
      } else {
        this.behaviorState = 'descent';
      }
    }
  }

  private async getAIDecision(playerPosition: THREE.Vector3): Promise<void> {
    const context: FlightContext = {
      position: this.state.position.clone(),
      altitude: this.state.position.y * 3.281, // feet
      speed: this.state.velocity.length() * 1.944, // knots
      heading: this.getHeading(),
      nearbyTraffic: this.nearbyTrafficCache,
      playerPosition: playerPosition.clone(),
      playerAltitude: playerPosition.y * 3.281,
    };

    try {
      const decision = await aiController.getDecision(this.callsign, context);
      
      // Apply decision
      this.targetHeading = THREE.MathUtils.degToRad(decision.targetHeading);
      this.targetAltitude = decision.targetAltitude / 3.281; // Convert feet to meters
      this.targetSpeed = decision.targetSpeed / 1.944; // Convert knots to m/s
      this.behaviorState = decision.action as AIBehaviorState;
      this.lastDecisionReasoning = decision.reasoning || '';
      
    } catch (e) {
      // Fallback to waypoint navigation on error
      console.warn(`AI decision failed for ${this.callsign}:`, e);
    }
  }
  
  private applyControls(deltaTime: number): void {
    const currentHeading = this.state.rotation.y;
    let headingError = this.targetHeading - currentHeading;
    
    while (headingError > Math.PI) headingError -= Math.PI * 2;
    while (headingError < -Math.PI) headingError += Math.PI * 2;
    
    this.state.roll = THREE.MathUtils.clamp(headingError * 2, -1, 1);
    this.state.yaw = THREE.MathUtils.clamp(headingError, -0.3, 0.3);
    
    const altitudeError = this.targetAltitude - this.state.position.y;
    const targetPitch = THREE.MathUtils.clamp(altitudeError / 500, -0.5, 0.5);
    this.state.pitch = targetPitch;
    
    const currentSpeed = this.state.velocity.length();
    const speedError = this.targetSpeed - currentSpeed;
    this.state.throttle = THREE.MathUtils.clamp(0.5 + speedError / 100, 0.2, 0.9);
    
    this.state.gearDown = this.state.position.y < 200;
  }
  
  private updateMeshFromState(): void {
    this.mesh.position.copy(this.state.position);
    this.mesh.rotation.copy(this.state.rotation);
  }
  
  private updateEffects(): void {
    if (this.engineGlow) {
      (this.engineGlow.material as THREE.MeshBasicMaterial).opacity = 
        0.3 + this.state.throttle * 0.5;
    }
  }
  
  public getPosition(): THREE.Vector3 {
    return this.state.position.clone();
  }
  
  public getAltitude(): number {
    return this.state.position.y * 3.281;
  }
  
  public getSpeed(): number {
    return this.state.velocity.length() * 1.944;
  }
  
  public getHeading(): number {
    const heading = THREE.MathUtils.radToDeg(this.state.rotation.y);
    return ((heading % 360) + 360) % 360;
  }
}
