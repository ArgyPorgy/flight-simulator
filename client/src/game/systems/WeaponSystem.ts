import * as THREE from 'three';

export interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  type: 'bullet' | 'missile';
  lifetime: number;
  damage: number;
  trail?: THREE.Points;
}

export interface WeaponState {
  bullets: number;
  missiles: number;
  maxBullets: number;
  maxMissiles: number;
  bulletCooldown: number;
  missileCooldown: number;
  lastBulletTime: number;
  lastMissileTime: number;
}

export interface ImpactResult {
  position: THREE.Vector3;
  type: 'aircraft' | 'ground' | 'building';
  projectileType: 'bullet' | 'missile';
}

// Bomb blast effect for missile impacts
export class BombBlastEffect {
  private scene: THREE.Scene;
  private blasts: Array<{
    particles: THREE.Points;
    light: THREE.PointLight;
    shockwave: THREE.Mesh;
    debris: THREE.Points;
    startTime: number;
    duration: number;
    position: THREE.Vector3;
  }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public createBlast(position: THREE.Vector3, isGround: boolean = true): void {
    const startTime = performance.now();
    const duration = 2000; // 2 seconds

    // === FIREBALL PARTICLES ===
    const fireCount = 200;
    const fireGeom = new THREE.BufferGeometry();
    const firePositions = new Float32Array(fireCount * 3);
    const fireColors = new Float32Array(fireCount * 3);
    const fireSizes = new Float32Array(fireCount);
    const fireVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < fireCount; i++) {
      // Start at impact point
      firePositions[i * 3] = position.x;
      firePositions[i * 3 + 1] = position.y + 2;
      firePositions[i * 3 + 2] = position.z;

      // Orange/yellow/red colors
      const colorChoice = Math.random();
      if (colorChoice < 0.4) {
        // Orange
        fireColors[i * 3] = 1.0;
        fireColors[i * 3 + 1] = 0.5;
        fireColors[i * 3 + 2] = 0.0;
      } else if (colorChoice < 0.7) {
        // Yellow
        fireColors[i * 3] = 1.0;
        fireColors[i * 3 + 1] = 0.8;
        fireColors[i * 3 + 2] = 0.2;
      } else {
        // Red
        fireColors[i * 3] = 1.0;
        fireColors[i * 3 + 1] = 0.2;
        fireColors[i * 3 + 2] = 0.0;
      }

      fireSizes[i] = 8 + Math.random() * 12;

      // Explosion velocity - mostly upward with spread
      const angle = Math.random() * Math.PI * 2;
      const upwardBias = isGround ? 0.7 : 0.3;
      const speed = 20 + Math.random() * 40;
      fireVelocities.push(new THREE.Vector3(
        Math.cos(angle) * speed * (1 - upwardBias),
        speed * upwardBias + Math.random() * 20,
        Math.sin(angle) * speed * (1 - upwardBias)
      ));
    }

    fireGeom.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
    fireGeom.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));
    fireGeom.setAttribute('size', new THREE.BufferAttribute(fireSizes, 1));

    const fireMat = new THREE.PointsMaterial({
      size: 10,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const fireParticles = new THREE.Points(fireGeom, fireMat);
    (fireParticles as any).velocities = fireVelocities;
    this.scene.add(fireParticles);

    // === SHOCKWAVE RING ===
    const shockwaveGeom = new THREE.RingGeometry(1, 3, 32);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwave = new THREE.Mesh(shockwaveGeom, shockwaveMat);
    shockwave.position.copy(position);
    shockwave.position.y += 1;
    shockwave.rotation.x = -Math.PI / 2; // Lay flat
    this.scene.add(shockwave);

    // === EXPLOSION LIGHT ===
    const light = new THREE.PointLight(0xff6600, 100, 200);
    light.position.copy(position);
    light.position.y += 10;
    this.scene.add(light);

    // === DEBRIS PARTICLES ===
    const debrisCount = 50;
    const debrisGeom = new THREE.BufferGeometry();
    const debrisPositions = new Float32Array(debrisCount * 3);
    const debrisVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < debrisCount; i++) {
      debrisPositions[i * 3] = position.x;
      debrisPositions[i * 3 + 1] = position.y + 1;
      debrisPositions[i * 3 + 2] = position.z;

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      debrisVelocities.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        20 + Math.random() * 40,
        Math.sin(angle) * speed
      ));
    }

    debrisGeom.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));

    const debrisMat = new THREE.PointsMaterial({
      size: 3,
      color: 0x444444,
      transparent: true,
      opacity: 1,
    });

    const debris = new THREE.Points(debrisGeom, debrisMat);
    (debris as any).velocities = debrisVelocities;
    this.scene.add(debris);

    // Store blast for animation
    this.blasts.push({
      particles: fireParticles,
      light,
      shockwave,
      debris,
      startTime,
      duration,
      position: position.clone(),
    });
  }

  public update(deltaTime: number): void {
    const now = performance.now();

    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const blast = this.blasts[i];
      const elapsed = now - blast.startTime;
      const progress = elapsed / blast.duration;

      if (progress >= 1) {
        // Remove blast
        this.scene.remove(blast.particles);
        this.scene.remove(blast.light);
        this.scene.remove(blast.shockwave);
        this.scene.remove(blast.debris);
        this.blasts.splice(i, 1);
        continue;
      }

      // Animate fire particles
      const firePositions = blast.particles.geometry.attributes.position.array as Float32Array;
      const fireVelocities = (blast.particles as any).velocities as THREE.Vector3[];
      const fireMat = blast.particles.material as THREE.PointsMaterial;

      for (let j = 0; j < fireVelocities.length; j++) {
        // Apply gravity and drag
        fireVelocities[j].y -= 30 * deltaTime;
        fireVelocities[j].multiplyScalar(0.98);

        firePositions[j * 3] += fireVelocities[j].x * deltaTime;
        firePositions[j * 3 + 1] += fireVelocities[j].y * deltaTime;
        firePositions[j * 3 + 2] += fireVelocities[j].z * deltaTime;

        // Don't go below ground
        if (firePositions[j * 3 + 1] < 0) {
          firePositions[j * 3 + 1] = 0;
          fireVelocities[j].y = 0;
        }
      }
      blast.particles.geometry.attributes.position.needsUpdate = true;

      // Fade out fire
      fireMat.opacity = 1 - progress;

      // Animate shockwave - expand and fade
      const shockwaveScale = 1 + progress * 80;
      blast.shockwave.scale.set(shockwaveScale, shockwaveScale, 1);
      (blast.shockwave.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - progress);

      // Animate light - fade out
      blast.light.intensity = 100 * (1 - progress);

      // Animate debris
      const debrisPositions = blast.debris.geometry.attributes.position.array as Float32Array;
      const debrisVelocities = (blast.debris as any).velocities as THREE.Vector3[];
      const debrisMat = blast.debris.material as THREE.PointsMaterial;

      for (let j = 0; j < debrisVelocities.length; j++) {
        debrisVelocities[j].y -= 50 * deltaTime; // Gravity
        debrisPositions[j * 3] += debrisVelocities[j].x * deltaTime;
        debrisPositions[j * 3 + 1] += debrisVelocities[j].y * deltaTime;
        debrisPositions[j * 3 + 2] += debrisVelocities[j].z * deltaTime;

        if (debrisPositions[j * 3 + 1] < 0) {
          debrisPositions[j * 3 + 1] = 0;
          debrisVelocities[j].set(0, 0, 0);
        }
      }
      blast.debris.geometry.attributes.position.needsUpdate = true;
      debrisMat.opacity = 1 - progress * 0.5;
    }
  }

  public dispose(): void {
    for (const blast of this.blasts) {
      this.scene.remove(blast.particles);
      this.scene.remove(blast.light);
      this.scene.remove(blast.shockwave);
      this.scene.remove(blast.debris);
    }
    this.blasts = [];
  }
}

export class WeaponSystem {
  private scene: THREE.Scene;
  private projectiles: Projectile[] = [];
  private state: WeaponState;
  
  // Weapon configs
  private bulletSpeed = 800; // m/s
  private missileSpeed = 400; // m/s
  private bulletDamage = 10;
  private missileDamage = 100;
  private bulletCooldownTime = 0.08; // seconds between bullets
  private missileCooldownTime = 2.0; // seconds between missiles
  
  // Visual materials
  private bulletMaterial: THREE.MeshBasicMaterial;
  private missileMaterial: THREE.MeshStandardMaterial;
  private trailMaterial: THREE.PointsMaterial;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Initialize weapon state
    this.state = {
      bullets: 500,
      missiles: 8,
      maxBullets: 500,
      maxMissiles: 8,
      bulletCooldown: 0,
      missileCooldown: 0,
      lastBulletTime: 0,
      lastMissileTime: 0,
    };
    
    // Create materials
    this.bulletMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      emissive: 0xffaa00,
    });
    
    this.missileMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.3,
    });
    
    this.trailMaterial = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
  }
  
  public fireBullet(position: THREE.Vector3, direction: THREE.Vector3): boolean {
    const now = performance.now() / 1000;
    
    // Check cooldown and ammo
    if (now - this.state.lastBulletTime < this.bulletCooldownTime) return false;
    if (this.state.bullets <= 0) return false;
    
    this.state.bullets--;
    this.state.lastBulletTime = now;
    
    // Create bullet mesh - small elongated cylinder
    const bulletGeom = new THREE.CylinderGeometry(0.1, 0.1, 2, 6);
    bulletGeom.rotateX(Math.PI / 2);
    const bullet = new THREE.Mesh(bulletGeom, this.bulletMaterial);
    
    // Position slightly ahead of aircraft
    const spawnOffset = direction.clone().multiplyScalar(15);
    bullet.position.copy(position).add(spawnOffset);
    
    // Orient bullet in direction of travel
    bullet.lookAt(bullet.position.clone().add(direction));
    
    this.scene.add(bullet);
    
    // Create projectile
    const projectile: Projectile = {
      mesh: bullet,
      velocity: direction.clone().multiplyScalar(this.bulletSpeed),
      type: 'bullet',
      lifetime: 3, // seconds
      damage: this.bulletDamage,
    };
    
    this.projectiles.push(projectile);
    return true;
  }
  
  public fireMissile(position: THREE.Vector3, direction: THREE.Vector3): boolean {
    const now = performance.now() / 1000;
    
    // Check cooldown and ammo
    if (now - this.state.lastMissileTime < this.missileCooldownTime) return false;
    if (this.state.missiles <= 0) return false;
    
    this.state.missiles--;
    this.state.lastMissileTime = now;
    
    // Create missile mesh
    const missileGroup = new THREE.Group();
    
    // Missile body
    const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
    bodyGeom.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeom, this.missileMaterial);
    missileGroup.add(body);
    
    // Missile nose cone
    const noseGeom = new THREE.ConeGeometry(0.3, 1, 8);
    noseGeom.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, this.missileMaterial);
    nose.position.z = -2.5;
    missileGroup.add(nose);
    
    // Fins
    const finMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    for (let i = 0; i < 4; i++) {
      const finGeom = new THREE.BoxGeometry(0.8, 0.05, 0.6);
      const fin = new THREE.Mesh(finGeom, finMat);
      fin.position.z = 1.5;
      fin.rotation.z = (i * Math.PI) / 2;
      fin.position.x = Math.cos((i * Math.PI) / 2) * 0.4;
      fin.position.y = Math.sin((i * Math.PI) / 2) * 0.4;
      missileGroup.add(fin);
    }
    
    // Engine glow
    const glowGeom = new THREE.SphereGeometry(0.4, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: 0xff6600, 
      transparent: true, 
      opacity: 0.8 
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.z = 2.5;
    missileGroup.add(glow);
    
    // Position and orient
    const spawnOffset = direction.clone().multiplyScalar(20);
    missileGroup.position.copy(position).add(spawnOffset);
    missileGroup.lookAt(missileGroup.position.clone().add(direction));
    
    this.scene.add(missileGroup);
    
    // Create smoke trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(100 * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Points(trailGeometry, this.trailMaterial.clone());
    this.scene.add(trail);
    
    // Create projectile
    const projectile: Projectile = {
      mesh: missileGroup as unknown as THREE.Mesh,
      velocity: direction.clone().multiplyScalar(this.missileSpeed),
      type: 'missile',
      lifetime: 8, // seconds
      damage: this.missileDamage,
      trail,
    };
    
    this.projectiles.push(projectile);
    return true;
  }
  
  public update(
    deltaTime: number, 
    targets: THREE.Vector3[], 
    terrainHeightFn?: (x: number, z: number) => number
  ): ImpactResult[] {
    const impacts: ImpactResult[] = [];
    
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      // Store previous position for collision detection
      const prevPos = proj.mesh.position.clone();
      
      // Update position
      proj.mesh.position.add(proj.velocity.clone().multiplyScalar(deltaTime));
      
      // Update missile trail
      if (proj.trail && proj.type === 'missile') {
        this.updateMissileTrail(proj);
      }
      
      // Decrease lifetime
      proj.lifetime -= deltaTime;
      
      let hitSomething = false;
      
      // Check for hits against aircraft targets
      for (const target of targets) {
        const hitRadius = proj.type === 'missile' ? 30 : 15;
        if (proj.mesh.position.distanceTo(target) < hitRadius) {
          impacts.push({
            position: target.clone(),
            type: 'aircraft',
            projectileType: proj.type,
          });
          hitSomething = true;
          break;
        }
      }
      
      // Check ground/building collision (only for missiles - bullets just disappear)
      if (!hitSomething && terrainHeightFn) {
        const groundHeight = terrainHeightFn(proj.mesh.position.x, proj.mesh.position.z);
        
        // Check if we hit the ground or a building
        if (proj.mesh.position.y <= groundHeight + 2) {
          const impactPos = proj.mesh.position.clone();
          impactPos.y = groundHeight;
          
          // Determine if it's a building (ground height > 5 means building)
          const impactType = groundHeight > 5 ? 'building' : 'ground';
          
          impacts.push({
            position: impactPos,
            type: impactType,
            projectileType: proj.type,
          });
          hitSomething = true;
        }
      } else if (!hitSomething && proj.mesh.position.y < 0) {
        // Fallback ground check
        const impactPos = proj.mesh.position.clone();
        impactPos.y = 0;
        impacts.push({
          position: impactPos,
          type: 'ground',
          projectileType: proj.type,
        });
        hitSomething = true;
      }
      
      // Mark for removal if hit something
      if (hitSomething) {
        proj.lifetime = 0;
      }
      
      // Remove expired projectiles
      if (proj.lifetime <= 0) {
        this.scene.remove(proj.mesh);
        if (proj.trail) {
          this.scene.remove(proj.trail);
        }
        this.projectiles.splice(i, 1);
      }
    }
    
    return impacts;
  }
  
  private updateMissileTrail(proj: Projectile): void {
    if (!proj.trail) return;
    
    const positions = proj.trail.geometry.attributes.position.array as Float32Array;
    
    // Shift existing positions back
    for (let i = positions.length - 3; i >= 3; i -= 3) {
      positions[i] = positions[i - 3];
      positions[i + 1] = positions[i - 2];
      positions[i + 2] = positions[i - 1];
    }
    
    // Add new position at front
    positions[0] = proj.mesh.position.x + (Math.random() - 0.5) * 2;
    positions[1] = proj.mesh.position.y + (Math.random() - 0.5) * 2;
    positions[2] = proj.mesh.position.z + (Math.random() - 0.5) * 2;
    
    proj.trail.geometry.attributes.position.needsUpdate = true;
  }
  
  public getState(): WeaponState {
    return { ...this.state };
  }
  
  public reload(): void {
    this.state.bullets = this.state.maxBullets;
    this.state.missiles = this.state.maxMissiles;
  }
  
  public canFireBullet(): boolean {
    const now = performance.now() / 1000;
    return this.state.bullets > 0 && 
           (now - this.state.lastBulletTime >= this.bulletCooldownTime);
  }
  
  public canFireMissile(): boolean {
    const now = performance.now() / 1000;
    return this.state.missiles > 0 && 
           (now - this.state.lastMissileTime >= this.missileCooldownTime);
  }
  
  public dispose(): void {
    for (const proj of this.projectiles) {
      this.scene.remove(proj.mesh);
      if (proj.trail) {
        this.scene.remove(proj.trail);
      }
    }
    this.projectiles = [];
  }
}
