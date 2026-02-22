import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  type: 'fire' | 'smoke' | 'debris';
}

export class ExplosionEffect {
  private particles: Particle[] = [];
  private group: THREE.Group;
  private scene: THREE.Scene;
  private isActive = false;
  private explosionLight: THREE.PointLight | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  public explode(position: THREE.Vector3): void {
    if (this.isActive) return;
    this.isActive = true;

    // Clear any existing particles
    this.clear();

    // Create explosion flash light
    this.explosionLight = new THREE.PointLight(0xff6600, 50, 500);
    this.explosionLight.position.copy(position);
    this.scene.add(this.explosionLight);

    // Create fire particles (bright orange/yellow)
    for (let i = 0; i < 40; i++) {
      this.createParticle(position, 'fire');
    }

    // Create smoke particles (dark gray)
    for (let i = 0; i < 30; i++) {
      this.createParticle(position, 'smoke');
    }

    // Create debris particles (dark chunks)
    for (let i = 0; i < 20; i++) {
      this.createParticle(position, 'debris');
    }

    // Create initial explosion sphere
    this.createExplosionSphere(position);

    // Fade out light
    setTimeout(() => {
      if (this.explosionLight) {
        this.explosionLight.intensity = 20;
      }
    }, 100);
    setTimeout(() => {
      if (this.explosionLight) {
        this.explosionLight.intensity = 5;
      }
    }, 200);
    setTimeout(() => {
      if (this.explosionLight) {
        this.scene.remove(this.explosionLight);
        this.explosionLight = null;
      }
    }, 500);
  }

  private createExplosionSphere(position: THREE.Vector3): void {
    // Initial bright explosion sphere
    const sphereGeom = new THREE.SphereGeometry(5, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.copy(position);
    this.group.add(sphere);

    // Animate expansion and fade
    let scale = 1;
    const expandInterval = setInterval(() => {
      scale += 2;
      sphere.scale.setScalar(scale);
      (sphere.material as THREE.MeshBasicMaterial).opacity -= 0.1;
      
      // Change color from yellow to orange to red
      const hue = Math.max(0, 0.12 - scale * 0.01);
      (sphere.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.5);

      if (scale > 15) {
        clearInterval(expandInterval);
        this.group.remove(sphere);
        sphereGeom.dispose();
        sphereMat.dispose();
      }
    }, 30);
  }

  private createParticle(position: THREE.Vector3, type: 'fire' | 'smoke' | 'debris'): void {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    let maxLife: number;
    let speed: number;

    switch (type) {
      case 'fire':
        geometry = new THREE.SphereGeometry(1 + Math.random() * 2, 8, 8);
        material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1, 0.5),
          transparent: true,
          opacity: 0.9,
        });
        maxLife = 1 + Math.random() * 1.5;
        speed = 30 + Math.random() * 50;
        break;

      case 'smoke':
        geometry = new THREE.SphereGeometry(2 + Math.random() * 4, 8, 8);
        material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.2 + Math.random() * 0.2, 0.2 + Math.random() * 0.1, 0.2),
          transparent: true,
          opacity: 0.7,
        });
        maxLife = 2 + Math.random() * 3;
        speed = 10 + Math.random() * 20;
        break;

      case 'debris':
        geometry = new THREE.BoxGeometry(
          0.5 + Math.random() * 1.5,
          0.5 + Math.random() * 1.5,
          0.5 + Math.random() * 1.5
        );
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.1 + Math.random() * 0.2, 0.1, 0.1),
        });
        maxLife = 2 + Math.random() * 2;
        speed = 20 + Math.random() * 40;
        break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * 10;
    mesh.position.y += Math.random() * 5;
    mesh.position.z += (Math.random() - 0.5) * 10;

    // Random velocity - mostly upward for fire/smoke, outward for debris
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      type === 'debris' ? Math.random() * speed * 0.5 : speed * 0.5 + Math.random() * speed * 0.5,
      (Math.random() - 0.5) * speed
    );

    this.group.add(mesh);
    this.particles.push({
      mesh,
      velocity,
      life: maxLife,
      maxLife,
      type,
    });
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;

    const gravity = -20;
    const toRemove: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      // Update life
      p.life -= deltaTime;
      if (p.life <= 0) {
        toRemove.push(i);
        continue;
      }

      // Update position
      p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));

      // Apply gravity to debris
      if (p.type === 'debris') {
        p.velocity.y += gravity * deltaTime;
        // Rotate debris
        p.mesh.rotation.x += deltaTime * 5;
        p.mesh.rotation.z += deltaTime * 3;
      }

      // Fire rises and slows
      if (p.type === 'fire') {
        p.velocity.multiplyScalar(0.98);
        p.velocity.y += 5 * deltaTime; // Rise
      }

      // Smoke rises slowly and expands
      if (p.type === 'smoke') {
        p.velocity.y += 3 * deltaTime;
        p.mesh.scale.multiplyScalar(1 + deltaTime * 0.5);
      }

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
        p.mesh.material.opacity = lifeRatio * 0.9;
      }

      // Fire changes color as it cools
      if (p.type === 'fire' && p.mesh.material instanceof THREE.MeshBasicMaterial) {
        const hue = 0.05 * lifeRatio; // Yellow to red
        p.mesh.material.color.setHSL(hue, 1, 0.3 + lifeRatio * 0.4);
      }
    }

    // Remove dead particles
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const p = this.particles[idx];
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach(m => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
      this.particles.splice(idx, 1);
    }

    // Check if explosion is done
    if (this.particles.length === 0) {
      this.isActive = false;
    }
  }

  public clear(): void {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach(m => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    }
    this.particles = [];
    this.isActive = false;

    if (this.explosionLight) {
      this.scene.remove(this.explosionLight);
      this.explosionLight = null;
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}
