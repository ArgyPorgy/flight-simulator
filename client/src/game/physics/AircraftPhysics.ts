import * as THREE from 'three';

export interface AircraftState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Vector3;

  throttle: number;      // 0-1
  pitch: number;         // -1 to 1 (elevator)
  roll: number;          // -1 to 1 (ailerons)
  yaw: number;           // -1 to 1 (rudder)

  isOnGround: boolean;
  isStalling: boolean;
  gearDown: boolean;
  flaps: number;         // 0-1
}

export interface AircraftConfig {
  mass: number;              // kg
  wingArea: number;          // m²
  maxThrust: number;         // N
  dragCoefficient: number;   // CD_0 (parasitic)
  liftCoefficientBase: number; // CL at zero AoA (from wing camber)
  liftCurveSlope: number;    // dCL/dAlpha (per radian)
  stallAngle: number;        // radians
  maxSpeed: number;          // m/s

  pitchRate: number;
  rollRate: number;
  yawRate: number;
}

/**
 * Balanced so the plane can actually fly level:
 *
 * At 80 m/s level flight:
 *   Weight = 8000 * 9.81 = 78,480 N
 *   qS = 0.5 * 1.225 * 6400 * 45 = 176,400
 *   Required CL = 78480 / 176400 = 0.445
 *   AoA needed = (0.445 - 0.35) / 4.5 = 0.021 rad ≈ 1.2°  ← perfect
 */
export const DEFAULT_AIRCRAFT_CONFIG: AircraftConfig = {
  mass: 8000,
  wingArea: 45,
  maxThrust: 55000,
  dragCoefficient: 0.032,
  liftCoefficientBase: 0.35,  // wing camber lift at zero AoA
  liftCurveSlope: 4.5,        // dCL/dAlpha per radian (typical)
  stallAngle: 0.30,            // ~17 degrees
  maxSpeed: 280,

  pitchRate: 1.5,
  rollRate: 2.5,
  yawRate: 0.8,
};

/** Deep-clone aircraft state so physics never mutates the original */
export function cloneState(state: AircraftState): AircraftState {
  return {
    position: state.position.clone(),
    velocity: state.velocity.clone(),
    rotation: new THREE.Euler(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.order),
    angularVelocity: state.angularVelocity.clone(),
    throttle: state.throttle,
    pitch: state.pitch,
    roll: state.roll,
    yaw: state.yaw,
    isOnGround: state.isOnGround,
    isStalling: state.isStalling,
    gearDown: state.gearDown,
    flaps: state.flaps,
  };
}

export class AircraftPhysics {
  private config: AircraftConfig;
  private readonly GRAVITY = 9.81;
  private readonly AIR_DENSITY = 1.225;

  constructor(config: AircraftConfig = DEFAULT_AIRCRAFT_CONFIG) {
    this.config = config;
  }

  public update(state: AircraftState, deltaTime: number, terrainHeight: number): AircraftState {
    const s = cloneState(state);

    const speed = s.velocity.length();
    const speedSq = speed * speed;

    // Aircraft local axes (in world space)
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(s.rotation);
    const up = new THREE.Vector3(0, 1, 0).applyEuler(s.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(s.rotation);

    // ── Angle of Attack ──────────────────────────────────────────
    let angleOfAttack = 0;
    if (speed > 1) {
      const velDir = s.velocity.clone().normalize();
      // AoA = angle between velocity and aircraft forward, measured in pitch plane
      // Positive AoA = nose above velocity vector = more lift
      angleOfAttack = Math.asin(
        THREE.MathUtils.clamp(-up.dot(velDir), -1, 1)
      );
    }

    // Stall detection
    s.isStalling = Math.abs(angleOfAttack) > this.config.stallAngle && speed > 15;

    // Dynamic pressure × wing area
    const qS = 0.5 * this.AIR_DENSITY * speedSq * this.config.wingArea;

    // ── FORCES ───────────────────────────────────────────────────
    const forces = new THREE.Vector3();

    // 1. GRAVITY — always world-down
    forces.y -= this.config.mass * this.GRAVITY;

    // 2. THRUST — along aircraft forward
    const thrustMag = s.throttle * this.config.maxThrust;
    forces.addScaledVector(forward, thrustMag);

    // 3. LIFT — along aircraft up, proportional to CL
    if (speed > 3) {
      let cl = this.config.liftCoefficientBase + this.config.liftCurveSlope * angleOfAttack;

      // Post-stall: lift collapses
      if (s.isStalling) {
        cl *= 0.25;
      }

      // Flaps add lift (and drag via separate term)
      cl += s.flaps * 0.35;

      // Clamp to physical range
      cl = THREE.MathUtils.clamp(cl, -0.5, 2.2);

      const liftMag = qS * cl;
      forces.addScaledVector(up, liftMag);
    }

    // 4. DRAG — opposite to velocity
    if (speed > 0.5) {
      let cd = this.config.dragCoefficient;

      // Induced drag: proportional to CL² (vortex drag)
      const clForDrag = this.config.liftCoefficientBase + this.config.liftCurveSlope * angleOfAttack;
      const aspectRatio = 8; // typical wing aspect ratio
      cd += (clForDrag * clForDrag) / (Math.PI * aspectRatio * 0.8);

      // Gear drag
      if (s.gearDown) cd += 0.015;

      // Flaps drag
      cd += s.flaps * 0.025;

      const dragMag = qS * cd;
      const velDir = s.velocity.clone().normalize();
      forces.addScaledVector(velDir, -dragMag);
    }

    // ── ACCELERATION → VELOCITY ──────────────────────────────────
    const accel = forces.divideScalar(this.config.mass);
    s.velocity.addScaledVector(accel, deltaTime);

    // Clamp max speed
    if (s.velocity.length() > this.config.maxSpeed) {
      s.velocity.setLength(this.config.maxSpeed);
    }

    // ── ROTATION ─────────────────────────────────────────────────
    // Control authority scales with airspeed (can't steer at low speed)
    const authority = THREE.MathUtils.clamp(speed / 30, 0, 1);

    const targetAngVel = new THREE.Vector3(
      s.pitch * this.config.pitchRate * authority,
      s.yaw * this.config.yawRate * authority,
      -s.roll * this.config.rollRate * authority,
    );

    // Smooth towards target angular velocity
    s.angularVelocity.lerp(targetAngVel, Math.min(deltaTime * 5, 1));

    // Natural stability dampening when no input
    const damp = 1 - deltaTime * 2;
    if (Math.abs(s.pitch) < 0.05) s.angularVelocity.x *= damp;
    if (Math.abs(s.yaw) < 0.05) s.angularVelocity.y *= damp;
    if (Math.abs(s.roll) < 0.05) s.angularVelocity.z *= damp;

    // Banking auto-yaw: when banked, the aircraft naturally yaws into the turn
    if (speed > 20) {
      const bankAngle = s.rotation.z;
      const autoYaw = -Math.sin(bankAngle) * 0.3 * authority;
      s.angularVelocity.y += autoYaw * deltaTime;
    }

    // Apply rotation via quaternion multiplication (local frame)
    const curQuat = new THREE.Quaternion().setFromEuler(s.rotation);
    const dRot = new THREE.Euler(
      s.angularVelocity.x * deltaTime,
      s.angularVelocity.y * deltaTime,
      s.angularVelocity.z * deltaTime,
    );
    const dQuat = new THREE.Quaternion().setFromEuler(dRot);
    curQuat.multiply(dQuat);
    s.rotation.setFromQuaternion(curQuat);

    // ── POSITION ─────────────────────────────────────────────────
    s.position.addScaledVector(s.velocity, deltaTime);

    // ── GROUND COLLISION ─────────────────────────────────────────
    const groundClearance = 5;
    if (s.position.y < terrainHeight + groundClearance) {
      s.position.y = terrainHeight + groundClearance;
      s.isOnGround = true;

      if (s.gearDown) {
        // Normal landing — gentle friction
        s.velocity.x *= 1 - deltaTime * 0.5;
        s.velocity.z *= 1 - deltaTime * 0.5;
        s.velocity.y = Math.max(0, s.velocity.y);
      } else {
        // Belly landing — heavy friction
        s.velocity.multiplyScalar(Math.max(0, 1 - deltaTime * 3));
      }

      // Level out on ground
      s.rotation.x *= 1 - deltaTime * 3;
      s.rotation.z *= 1 - deltaTime * 3;
    } else {
      s.isOnGround = false;
    }

    return s;
  }

  // ── HUD helpers ──────────────────────────────────────────────
  public getAirspeed(state: AircraftState): number {
    return state.velocity.length() * 1.944; // m/s → knots
  }

  public getAltitude(state: AircraftState): number {
    return state.position.y * 3.281; // m → feet
  }

  public getHeading(state: AircraftState): number {
    const h = THREE.MathUtils.radToDeg(state.rotation.y);
    return ((h % 360) + 360) % 360;
  }

  public getVerticalSpeed(state: AircraftState): number {
    return state.velocity.y * 196.85; // m/s → fpm
  }
}
