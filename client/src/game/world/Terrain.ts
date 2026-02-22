import * as THREE from 'three';

export class Terrain {
  public mesh: THREE.Mesh;
  private heightData: Float32Array;
  private size: number;
  private segments: number;
  private maxHeight: number;
  
  constructor(size = 50000, segments = 256, maxHeight = 2000) {
    this.size = size;
    this.segments = segments;
    this.maxHeight = maxHeight;
    
    // Generate height data
    this.heightData = this.generateHeightData();
    
    // Create terrain mesh
    this.mesh = this.createTerrainMesh();
  }
  
  private generateHeightData(): Float32Array {
    const data = new Float32Array((this.segments + 1) * (this.segments + 1));
    
    // Use multiple octaves of noise for realistic terrain
    for (let i = 0; i <= this.segments; i++) {
      for (let j = 0; j <= this.segments; j++) {
        const x = i / this.segments;
        const y = j / this.segments;
        
        let height = 0;
        
        // Multiple octaves of noise
        height += this.noise(x * 2, y * 2) * 0.5;
        height += this.noise(x * 4, y * 4) * 0.25;
        height += this.noise(x * 8, y * 8) * 0.125;
        height += this.noise(x * 16, y * 16) * 0.0625;
        
        // Normalize and scale
        height = (height + 1) / 2; // 0 to 1
        height *= this.maxHeight;
        
        // Create some flat areas (for runways)
        const distFromCenter = Math.sqrt(Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2));
        if (distFromCenter < 0.05) {
          height *= distFromCenter / 0.05; // Flatten center for runway
        }
        
        data[i * (this.segments + 1) + j] = height;
      }
    }
    
    return data;
  }
  
  // Simple noise function (Perlin-like)
  private noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.p[X] + Y;
    const B = this.p[X + 1] + Y;
    
    return this.lerp(v,
      this.lerp(u, this.grad(this.p[A], x, y), this.grad(this.p[B], x - 1, y)),
      this.lerp(u, this.grad(this.p[A + 1], x, y - 1), this.grad(this.p[B + 1], x - 1, y - 1))
    );
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  // Permutation table
  private p = new Uint8Array(512);
  
  constructor_init() {
    // Initialize permutation table
    const permutation = [];
    for (let i = 0; i < 256; i++) permutation[i] = i;
    
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }
  
  private createTerrainMesh(): THREE.Mesh {
    // Initialize permutation table
    const permutation = [];
    for (let i = 0; i < 256; i++) permutation[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
    
    // Regenerate height data with initialized permutation
    this.heightData = this.generateHeightData();
    
    const geometry = new THREE.PlaneGeometry(
      this.size, 
      this.size, 
      this.segments, 
      this.segments
    );
    
    // Apply height data to vertices
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, this.heightData[i]);
    }
    
    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);
    
    // Create terrain material with vertex colors based on height
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const height = this.heightData[i];
      const normalizedHeight = height / this.maxHeight;
      
      let r, g, b;
      
      if (normalizedHeight < 0.1) {
        // Low - grass
        r = 0.2; g = 0.5; b = 0.2;
      } else if (normalizedHeight < 0.4) {
        // Medium - forest
        r = 0.15; g = 0.35; b = 0.15;
      } else if (normalizedHeight < 0.7) {
        // High - rock
        r = 0.4; g = 0.35; b = 0.3;
      } else {
        // Very high - snow
        r = 0.9; g = 0.9; b = 0.95;
      }
      
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: false,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.y = 0;
    
    return mesh;
  }
  
  public getHeightAt(x: number, z: number): number {
    // Convert world coordinates to terrain grid coordinates
    const gridX = ((x / this.size) + 0.5) * this.segments;
    const gridZ = ((z / this.size) + 0.5) * this.segments;
    
    // Clamp to valid range
    const i = Math.max(0, Math.min(this.segments, Math.floor(gridX)));
    const j = Math.max(0, Math.min(this.segments, Math.floor(gridZ)));
    
    // Bilinear interpolation
    const fx = gridX - i;
    const fz = gridZ - j;
    
    const i1 = Math.min(i + 1, this.segments);
    const j1 = Math.min(j + 1, this.segments);
    
    const h00 = this.heightData[i * (this.segments + 1) + j];
    const h10 = this.heightData[i1 * (this.segments + 1) + j];
    const h01 = this.heightData[i * (this.segments + 1) + j1];
    const h11 = this.heightData[i1 * (this.segments + 1) + j1];
    
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
  }
  
  // Create a runway at the center
  public createRunway(): THREE.Group {
    const group = new THREE.Group();
    
    // Runway surface
    const runwayGeom = new THREE.PlaneGeometry(100, 3000);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });
    const runway = new THREE.Mesh(runwayGeom, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 1;
    runway.receiveShadow = true;
    group.add(runway);
    
    // Runway markings
    const markingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    
    // Center line
    for (let i = -1400; i < 1400; i += 100) {
      const lineGeom = new THREE.PlaneGeometry(2, 30);
      const line = new THREE.Mesh(lineGeom, markingMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 1.1, i);
      group.add(line);
    }
    
    // Threshold markings
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const markGeom = new THREE.PlaneGeometry(3, 45);
        const mark = new THREE.Mesh(markGeom, markingMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(-35 + i * 10, 1.1, side * 1450);
        group.add(mark);
      }
    }
    
    return group;
  }
}
