import * as THREE from 'three';
import { AircraftPhysics, AircraftState, DEFAULT_AIRCRAFT_CONFIG } from '../physics/AircraftPhysics';
import { InputManager } from '../input/InputManager';

export class PlayerAircraft {
  public mesh: THREE.Group;
  public state: AircraftState;

  private physics: AircraftPhysics;
  private inputManager: InputManager;

  // Camera
  private cameraMode: 'chase' | 'cockpit' | 'external' = 'chase';
  private smoothCamPos = new THREE.Vector3();
  private smoothCamTarget = new THREE.Vector3();
  private camInitialized = false;

  constructor(inputManager: InputManager) {
    this.inputManager = inputManager;
    this.physics = new AircraftPhysics(DEFAULT_AIRCRAFT_CONFIG);

    // Initial state — will be overridden by FlightSimulator
    this.state = {
      position: new THREE.Vector3(0, 150, 0),
      velocity: new THREE.Vector3(0, 0, -80),
      rotation: new THREE.Euler(0, 0, 0),
      angularVelocity: new THREE.Vector3(),
      throttle: 0.5,
      pitch: 0,
      roll: 0,
      yaw: 0,
      isOnGround: false,
      isStalling: false,
      gearDown: true,
      flaps: 0,
    };

    // Build procedural aircraft (no external assets)
    this.mesh = this.buildAircraft();
    this.syncMesh();
  }

  /* ================================================================
     PROCEDURAL AIRCRAFT — always visible, no loading required
     ================================================================ */
  private buildAircraft(): THREE.Group {
    const root = new THREE.Group();

    // Scale factor — make it big enough to see from chase camera
    const S = 1.8;

    const bodyColor = 0x5a6577;
    const wingColor = 0x4a5568;
    const darkColor = 0x1e2530;
    const glassColor = 0x63b3ed;
    const engineColor = 0x2d3748;
    const glowColor = 0xff6600;

    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const wingMat = new THREE.MeshLambertMaterial({ color: wingColor });
    const darkMat = new THREE.MeshLambertMaterial({ color: darkColor });
    const glassMat = new THREE.MeshLambertMaterial({ color: glassColor, transparent: true, opacity: 0.6 });
    const engineMat = new THREE.MeshLambertMaterial({ color: engineColor });
    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.6 });

    // ── Fuselage ──
    const fuseGeom = new THREE.CylinderGeometry(2.5 * S, 1.8 * S, 24 * S, 8);
    fuseGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuseGeom, bodyMat);
    fuselage.castShadow = true;
    root.add(fuselage);

    // ── Nose ──
    const noseGeom = new THREE.ConeGeometry(1.8 * S, 8 * S, 8);
    noseGeom.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.z = -16 * S;
    nose.castShadow = true;
    root.add(nose);

    // ── Nose tip ──
    const tipGeom = new THREE.SphereGeometry(0.9 * S, 8, 8);
    const tip = new THREE.Mesh(tipGeom, darkMat);
    tip.position.z = -20 * S;
    root.add(tip);

    // ── Cockpit canopy ──
    const canopyGeom = new THREE.SphereGeometry(2 * S, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const canopy = new THREE.Mesh(canopyGeom, glassMat);
    canopy.position.set(0, 2.5 * S, -6 * S);
    root.add(canopy);

    // ── Main wings (swept delta shape using boxes for reliability) ──
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(16 * S, 0.5 * S, 6 * S), wingMat);
    wingL.position.set(-9 * S, -0.2 * S, 1 * S);
    wingL.castShadow = true;
    root.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(16 * S, 0.5 * S, 6 * S), wingMat);
    wingR.position.set(9 * S, -0.2 * S, 1 * S);
    wingR.castShadow = true;
    root.add(wingR);

    // ── Wing tips (angled) ──
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(4 * S, 0.4 * S, 3 * S), wingMat);
    tipL.position.set(-18 * S, 0.5 * S, 2 * S);
    tipL.rotation.z = 0.3;
    root.add(tipL);

    const tipR = new THREE.Mesh(new THREE.BoxGeometry(4 * S, 0.4 * S, 3 * S), wingMat);
    tipR.position.set(18 * S, 0.5 * S, 2 * S);
    tipR.rotation.z = -0.3;
    root.add(tipR);

    // ── Vertical stabilizer (tail fin) ──
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 7 * S, 5 * S), wingMat);
    tailV.position.set(0, 4 * S, 10 * S);
    tailV.castShadow = true;
    root.add(tailV);

    // ── Horizontal stabilizers ──
    const tailHL = new THREE.Mesh(new THREE.BoxGeometry(7 * S, 0.4 * S, 3 * S), wingMat);
    tailHL.position.set(-4 * S, 0.5 * S, 10 * S);
    tailHL.castShadow = true;
    root.add(tailHL);

    const tailHR = new THREE.Mesh(new THREE.BoxGeometry(7 * S, 0.4 * S, 3 * S), wingMat);
    tailHR.position.set(4 * S, 0.5 * S, 10 * S);
    tailHR.castShadow = true;
    root.add(tailHR);

    // ── Engines ──
    const engGeom = new THREE.CylinderGeometry(1.4 * S, 1.6 * S, 8 * S, 10);
    engGeom.rotateX(Math.PI / 2);

    const engL = new THREE.Mesh(engGeom, engineMat);
    engL.position.set(-3 * S, -0.8 * S, 7 * S);
    engL.castShadow = true;
    root.add(engL);

    const engR = new THREE.Mesh(engGeom, engineMat);
    engR.position.set(3 * S, -0.8 * S, 7 * S);
    engR.castShadow = true;
    root.add(engR);

    // ── Afterburner glow cones ──
    const glowGeom = new THREE.ConeGeometry(1 * S, 4 * S, 10);
    glowGeom.rotateX(Math.PI / 2);

    const glowL = new THREE.Mesh(glowGeom, glowMat);
    glowL.position.set(-3 * S, -0.8 * S, 13 * S);
    root.add(glowL);

    const glowR = new THREE.Mesh(glowGeom, glowMat);
    glowR.position.set(3 * S, -0.8 * S, 13 * S);
    root.add(glowR);

    // ── Engine intakes ──
    const intakeGeom = new THREE.CylinderGeometry(1.3 * S, 1.5 * S, 2 * S, 10);
    intakeGeom.rotateX(Math.PI / 2);
    const intakeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const intakeL = new THREE.Mesh(intakeGeom, intakeMat);
    intakeL.position.set(-3 * S, -0.8 * S, 2.5 * S);
    root.add(intakeL);

    const intakeR = new THREE.Mesh(intakeGeom, intakeMat);
    intakeR.position.set(3 * S, -0.8 * S, 2.5 * S);
    root.add(intakeR);

    // ── Nav lights ──
    const redBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * S, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    redBulb.position.set(-17 * S, 0, 1 * S);
    root.add(redBulb);

    const greenBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * S, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    );
    greenBulb.position.set(17 * S, 0, 1 * S);
    root.add(greenBulb);

    const whiteBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * S, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    whiteBulb.position.set(0, 7 * S, 12 * S);
    root.add(whiteBulb);

    return root;
  }

  /* ================================================================
     UPDATE — called every frame
     ================================================================ */
  public update(deltaTime: number, terrainHeight: number): void {
    this.readInput(terrainHeight);
    this.state = this.physics.update(this.state, deltaTime, terrainHeight);
    this.syncMesh();
  }

  private syncMesh(): void {
    this.mesh.position.copy(this.state.position);
    this.mesh.rotation.copy(this.state.rotation);
  }

  /* ================================================================
     INPUT
     ================================================================ */
  private readInput(terrainHeight: number): void {
    const inp = this.inputManager;

    // Pitch: W/Up → nose up (-1), S/Down → nose down (+1)
    this.state.pitch = 0;
    if (inp.isKeyDown('KeyW') || inp.isKeyDown('ArrowUp')) this.state.pitch = -1;
    if (inp.isKeyDown('KeyS') || inp.isKeyDown('ArrowDown')) this.state.pitch = 1;

    // Roll: A/Left → roll left (-1), D/Right → roll right (+1)
    this.state.roll = 0;
    if (inp.isKeyDown('KeyA') || inp.isKeyDown('ArrowLeft')) this.state.roll = -1;
    if (inp.isKeyDown('KeyD') || inp.isKeyDown('ArrowRight')) this.state.roll = 1;

    // Yaw: Q → left, E → right
    this.state.yaw = 0;
    if (inp.isKeyDown('KeyQ')) this.state.yaw = -1;
    if (inp.isKeyDown('KeyE')) this.state.yaw = 1;

    // Throttle: Shift → up, Ctrl → down
    if (inp.isKeyDown('ShiftLeft') || inp.isKeyDown('ShiftRight')) {
      this.state.throttle = Math.min(1, this.state.throttle + 0.01);
    }
    if (inp.isKeyDown('ControlLeft') || inp.isKeyDown('ControlRight')) {
      this.state.throttle = Math.max(0, this.state.throttle - 0.01);
    }

    // SPACE - Boost/Launch upward when on or near ground
    const heightAboveGround = this.state.position.y - terrainHeight;
    if (inp.isKeyDown('Space') && heightAboveGround < 50) {
      // Apply strong upward boost
      const boostStrength = 25; // m/s upward velocity boost
      this.state.velocity.y += boostStrength * 0.1; // Gradual boost while held
      
      // Also add forward thrust in the direction we're facing
      const headingRad = this.state.rotation.y;
      const forwardBoost = 5;
      this.state.velocity.x += -Math.sin(headingRad) * forwardBoost * 0.1;
      this.state.velocity.z += -Math.cos(headingRad) * forwardBoost * 0.1;
      
      // Increase throttle automatically
      this.state.throttle = Math.min(1, this.state.throttle + 0.02);
      
      // Slight nose-up pitch to help lift off
      if (this.state.rotation.x > -0.2) {
        this.state.rotation.x -= 0.01;
      }
    }

    // Toggles
    if (inp.wasKeyJustPressed('KeyG')) this.state.gearDown = !this.state.gearDown;
    if (inp.wasKeyJustPressed('KeyF')) {
      this.state.flaps = this.state.flaps >= 1 ? 0 : Math.min(1, this.state.flaps + 0.33);
    }
    if (inp.wasKeyJustPressed('KeyC')) {
      const modes: Array<'chase' | 'cockpit' | 'external'> = ['chase', 'cockpit', 'external'];
      this.cameraMode = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
      this.camInitialized = false; // Reset smooth cam on mode change
    }
  }

  /* ================================================================
     CAMERA
     ================================================================ */
  public updateCamera(camera: THREE.PerspectiveCamera): void {
    switch (this.cameraMode) {
      case 'chase':
        this.chaseCamera(camera);
        break;
      case 'cockpit':
        this.cockpitCamera(camera);
        break;
      case 'external':
        this.externalCamera(camera);
        break;
    }
  }

  private chaseCamera(cam: THREE.PerspectiveCamera): void {
    // Chase offset in aircraft local space — behind and above
    const chaseOffset = new THREE.Vector3(0, 15, 55);
    const offset = chaseOffset.clone().applyEuler(this.state.rotation);
    const idealPos = this.state.position.clone().add(offset);

    // Look-at target: slightly ahead and above the aircraft
    const aheadOffset = new THREE.Vector3(0, 3, -20).applyEuler(this.state.rotation);
    const idealTarget = this.state.position.clone().add(aheadOffset);

    if (!this.camInitialized) {
      this.smoothCamPos.copy(idealPos);
      this.smoothCamTarget.copy(idealTarget);
      this.camInitialized = true;
    }

    // Smooth follow
    this.smoothCamPos.lerp(idealPos, 0.08);
    this.smoothCamTarget.lerp(idealTarget, 0.12);

    cam.position.copy(this.smoothCamPos);
    cam.lookAt(this.smoothCamTarget);
  }

  private cockpitCamera(cam: THREE.PerspectiveCamera): void {
    const cockpitOffset = new THREE.Vector3(0, 4, -5).applyEuler(this.state.rotation);
    cam.position.copy(this.state.position).add(cockpitOffset);

    const lookAhead = new THREE.Vector3(0, 2, -200).applyEuler(this.state.rotation);
    cam.lookAt(this.state.position.clone().add(lookAhead));
  }

  private externalCamera(cam: THREE.PerspectiveCamera): void {
    const offset = new THREE.Vector3(100, 50, 100);
    cam.position.copy(this.state.position).add(offset);
    cam.lookAt(this.state.position);
  }

  /* ================================================================
     HUD GETTERS
     ================================================================ */
  public getAirspeed(): number { return this.physics.getAirspeed(this.state); }
  public getAltitude(): number { return this.physics.getAltitude(this.state); }
  public getHeading(): number { return this.physics.getHeading(this.state); }
  public getVerticalSpeed(): number { return this.physics.getVerticalSpeed(this.state); }
  public getThrottle(): number { return this.state.throttle * 100; }
  public isStalling(): boolean { return this.state.isStalling; }
  public isGearDown(): boolean { return this.state.gearDown; }
  public getFlaps(): number { return this.state.flaps; }
  public getCameraMode(): string { return this.cameraMode; }
}
