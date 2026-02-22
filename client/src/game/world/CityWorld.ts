import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * High-performance city world using geometry merging and instanced meshes.
 * Instead of thousands of individual Mesh objects (which each cause a draw call),
 * we merge all static geometry into a handful of batched meshes.
 */

interface BuildingConfig {
  minHeight: number;
  maxHeight: number;
  minWidth: number;
  maxWidth: number;
  density: number;
}

const DISTRICT_CONFIGS: Record<string, BuildingConfig> = {
  downtown: { minHeight: 80, maxHeight: 300, minWidth: 30, maxWidth: 60, density: 0.85 },
  commercial: { minHeight: 30, maxHeight: 100, minWidth: 25, maxWidth: 50, density: 0.7 },
  residential: { minHeight: 10, maxHeight: 40, minWidth: 15, maxWidth: 30, density: 0.6 },
  industrial: { minHeight: 15, maxHeight: 50, minWidth: 40, maxWidth: 80, density: 0.5 },
  suburbs: { minHeight: 5, maxHeight: 15, minWidth: 10, maxWidth: 20, density: 0.4 },
};

// Seeded pseudo-random for deterministic city generation
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class CityWorld {
  public group: THREE.Group;
  private citySize = 6000;
  private blockSize = 100;
  private streetWidth = 20;

  constructor() {
    this.group = new THREE.Group();
    this.generateCity();
  }

  private generateCity(): void {
    this.createGround();
    this.createWater();
    this.createMergedBuildings();
    this.createMergedRoads();
    this.createRunway();
    this.createInstancedTrees();
    this.createInstancedStreetLights();
    this.createInstancedVehicles();
    this.createLandmarks();
    this.createBridges();
    this.createParks();
  }

  // ─── Ground ───────────────────────────────────────────────────────
  private createGround(): void {
    const groundGeom = new THREE.PlaneGeometry(this.citySize * 3, this.citySize * 3);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3d5c3d });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private createWater(): void {
    const waterGeom = new THREE.PlaneGeometry(40000, 40000);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.85,
    });
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2;
    this.group.add(water);

    // River
    const riverGeom = new THREE.PlaneGeometry(200, this.citySize * 1.5);
    const river = new THREE.Mesh(riverGeom, waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(1500, -1, 0);
    this.group.add(river);
  }

  // ─── Merged Buildings (single draw call per color group) ──────────
  private createMergedBuildings(): void {
    const rand = seededRandom(42);
    const halfSize = this.citySize / 2;
    const gridSize = Math.floor(this.citySize / (this.blockSize + this.streetWidth));

    // Group geometries by color bucket for merging
    const colorBuckets: Map<number, THREE.BufferGeometry[]> = new Map();

    const PALETTE = [
      0x4a90d9, 0x5ba3e0, 0x3d7ab8,  // glass
      0x8c8c8c, 0x9a9a9a, 0x7a7a7a,  // concrete
      0xb35c44, 0xa04d38, 0xc46d55,  // brick
      0x2c3e50, 0x34495e, 0x1a252f,  // modern
      0xe8d5b7, 0xf0e0c8, 0xd9c6a8,  // residential
    ];

    const GLASS_INDICES = [0, 1, 2];
    const CONCRETE_INDICES = [3, 4, 5];
    const BRICK_INDICES = [6, 7, 8];
    const MODERN_INDICES = [9, 10, 11];
    const RESIDENTIAL_INDICES = [12, 13, 14];

    function pickColor(district: string): number {
      let indices: number[];
      if (district === 'downtown') {
        indices = rand() > 0.5 ? GLASS_INDICES : MODERN_INDICES;
      } else if (district === 'commercial') {
        indices = rand() > 0.5 ? CONCRETE_INDICES : GLASS_INDICES;
      } else if (district === 'industrial') {
        indices = CONCRETE_INDICES;
      } else {
        indices = rand() > 0.5 ? RESIDENTIAL_INDICES : BRICK_INDICES;
      }
      return PALETTE[indices[Math.floor(rand() * indices.length)]];
    }

    for (let gx = -gridSize / 2; gx < gridSize / 2; gx++) {
      for (let gz = -gridSize / 2; gz < gridSize / 2; gz++) {
        const worldX = gx * (this.blockSize + this.streetWidth);
        const worldZ = gz * (this.blockSize + this.streetWidth);

        // Skip river
        if (worldX > 1400 && worldX < 1600) continue;

        const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
        let district: string;
        if (distFromCenter < 500) district = 'downtown';
        else if (distFromCenter < 1200) district = 'commercial';
        else if (distFromCenter < 2000) district = 'residential';
        else if (Math.abs(worldX) > 2000) district = 'industrial';
        else district = 'suburbs';

        const config = DISTRICT_CONFIGS[district];
        if (rand() > config.density) continue;

        const numBuildings = district === 'downtown' ? 1 : Math.floor(rand() * 2) + 1;

        for (let b = 0; b < numBuildings; b++) {
          const width = config.minWidth + rand() * (config.maxWidth - config.minWidth);
          const depth = config.minWidth + rand() * (config.maxWidth - config.minWidth);
          const height = config.minHeight + rand() * (config.maxHeight - config.minHeight);

          const offsetX = (rand() - 0.5) * (this.blockSize - width);
          const offsetZ = (rand() - 0.5) * (this.blockSize - depth);

          const color = pickColor(district);

          // Create geometry, apply transform, collect for merging
          const geom = new THREE.BoxGeometry(width, height, depth);
          geom.translate(worldX + offsetX, height / 2, worldZ + offsetZ);

          if (!colorBuckets.has(color)) {
            colorBuckets.set(color, []);
          }
          colorBuckets.get(color)!.push(geom);
        }
      }
    }

    // Merge each color bucket into a single mesh
    for (const [color, geometries] of colorBuckets) {
      if (geometries.length === 0) continue;

      const merged = mergeGeometries(geometries, false);
      if (!merged) continue;

      const isGlassy = GLASS_INDICES.some(i => PALETTE[i] === color) || MODERN_INDICES.some(i => PALETTE[i] === color);
      const mat = new THREE.MeshLambertMaterial({
        color,
      });

      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Dispose individual geometries (they've been merged)
      geometries.forEach(g => g.dispose());
    }
  }

  // ─── Merged Roads ────────────────────────────────────────────────
  private createMergedRoads(): void {
    const roadGeometries: THREE.BufferGeometry[] = [];
    const gridSize = Math.floor(this.citySize / (this.blockSize + this.streetWidth));

    // Main highways
    const hw1 = new THREE.PlaneGeometry(40, this.citySize * 2);
    hw1.rotateX(-Math.PI / 2);
    hw1.translate(0, 0.1, 0);
    roadGeometries.push(hw1);

    const hw2 = new THREE.PlaneGeometry(this.citySize * 2, 40);
    hw2.rotateX(-Math.PI / 2);
    hw2.translate(0, 0.1, 0);
    roadGeometries.push(hw2);

    // Grid streets
    for (let i = -gridSize / 2; i <= gridSize / 2; i++) {
      const pos = i * (this.blockSize + this.streetWidth);
      if (Math.abs(pos) < 30) continue;

      const hRoad = new THREE.PlaneGeometry(this.streetWidth, this.citySize);
      hRoad.rotateX(-Math.PI / 2);
      hRoad.translate(pos, 0.05, 0);
      roadGeometries.push(hRoad);

      const vRoad = new THREE.PlaneGeometry(this.citySize, this.streetWidth);
      vRoad.rotateX(-Math.PI / 2);
      vRoad.translate(0, 0.05, pos);
      roadGeometries.push(vRoad);
    }

    const merged = mergeGeometries(roadGeometries, false);
    if (merged) {
      const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const mesh = new THREE.Mesh(merged, roadMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      roadGeometries.forEach(g => g.dispose());
    }

    // Center lines for highways (merged)
    const lineGeoms: THREE.BufferGeometry[] = [];
    const l1 = new THREE.PlaneGeometry(1, this.citySize * 2);
    l1.rotateX(-Math.PI / 2);
    l1.translate(0, 0.15, 0);
    lineGeoms.push(l1);
    const l2 = new THREE.PlaneGeometry(this.citySize * 2, 1);
    l2.rotateX(-Math.PI / 2);
    l2.translate(0, 0.15, 0);
    lineGeoms.push(l2);

    const mergedLines = mergeGeometries(lineGeoms, false);
    if (mergedLines) {
      const mesh = new THREE.Mesh(mergedLines, new THREE.MeshLambertMaterial({ color: 0xffff00 }));
      this.group.add(mesh);
      lineGeoms.forEach(g => g.dispose());
    }
  }

  // ─── Runway ──────────────────────────────────────────────────────
  private createRunway(): void {
    const geoms: THREE.BufferGeometry[] = [];

    // Main runway
    const runway = new THREE.PlaneGeometry(80, 2500);
    runway.rotateX(-Math.PI / 2);
    runway.translate(-2500, 0.2, 0);
    geoms.push(runway);

    // Taxiway
    const taxiway = new THREE.PlaneGeometry(30, 500);
    taxiway.rotateX(-Math.PI / 2);
    taxiway.rotateY(Math.PI / 4);
    taxiway.translate(-2300, 0.15, -500);
    geoms.push(taxiway);

    const merged = mergeGeometries(geoms, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x222222 }));
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geoms.forEach(g => g.dispose());
    }

    // Runway markings (merged)
    const markGeoms: THREE.BufferGeometry[] = [];
    for (let i = -1100; i < 1100; i += 80) {
      const dash = new THREE.PlaneGeometry(2, 30);
      dash.rotateX(-Math.PI / 2);
      dash.translate(-2500, 0.25, i);
      markGeoms.push(dash);
    }
    // Threshold markings
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const mark = new THREE.PlaneGeometry(4, 40);
        mark.rotateX(-Math.PI / 2);
        mark.translate(-2500 - 30 + i * 8, 0.25, side * 1200);
        markGeoms.push(mark);
      }
    }

    if (markGeoms.length > 0) {
      const mergedMarks = mergeGeometries(markGeoms, false);
      if (mergedMarks) {
        const mesh = new THREE.Mesh(mergedMarks, new THREE.MeshLambertMaterial({ color: 0xffffff }));
        this.group.add(mesh);
        markGeoms.forEach(g => g.dispose());
      }
    }

    // Control tower (few meshes, fine)
    this.createControlTower(-2200, 0, -800);

    // Hangars
    for (let i = 0; i < 3; i++) {
      this.createHangar(-2100, 0, -400 + i * 200);
    }
  }

  private createControlTower(x: number, y: number, z: number): void {
    const geoms: THREE.BufferGeometry[] = [];
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    const base = new THREE.BoxGeometry(30, 40, 30);
    base.translate(0, 20, 0);
    geoms.push(base);

    const shaft = new THREE.CylinderGeometry(8, 10, 60, 8);
    shaft.translate(0, 70, 0);
    geoms.push(shaft);

    const roof = new THREE.ConeGeometry(16, 8, 8);
    roof.translate(0, 118, 0);
    geoms.push(roof);

    const merged = mergeGeometries(geoms, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, baseMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      geoms.forEach(g => g.dispose());
    }

    // Control room (separate material for glass look)
    const roomGeom = new THREE.CylinderGeometry(15, 12, 15, 8);
    const roomMat = new THREE.MeshLambertMaterial({ color: 0x4488aa });
    const room = new THREE.Mesh(roomGeom, roomMat);
    room.position.set(x, y + 107, z);
    this.group.add(room);
  }

  private createHangar(x: number, y: number, z: number): void {
    const hangarGeom = new THREE.CylinderGeometry(40, 40, 80, 8, 1, false, 0, Math.PI);
    const hangarMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const main = new THREE.Mesh(hangarGeom, hangarMat);
    main.rotation.z = Math.PI / 2;
    main.rotation.y = Math.PI / 2;
    main.position.set(x, y + 40, z);
    main.castShadow = true;
    this.group.add(main);
  }

  // ─── Instanced Trees (2 draw calls total: trunks + foliage) ──────
  private createInstancedTrees(): void {
    const positions: { x: number; z: number; scale: number }[] = [];

    // Street trees
    for (let i = -3000; i <= 3000; i += 200) {
      if ((i > 1400 && i < 1600) || i < -2000) continue;
      positions.push({ x: i, z: 35, scale: 1 });
      positions.push({ x: i, z: -35, scale: 1 });
      positions.push({ x: 35, z: i, scale: 1 });
      positions.push({ x: -35, z: i, scale: 1 });
    }

    if (positions.length === 0) return;
    const count = positions.length;

    // Trunk instanced mesh
    const trunkGeom = new THREE.CylinderGeometry(0.5, 0.8, 4, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, count);

    // Foliage instanced mesh
    const foliageGeom = new THREE.ConeGeometry(3, 8, 6);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
    const foliage = new THREE.InstancedMesh(foliageGeom, foliageMat, count);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const p = positions[i];

      // Trunk
      dummy.position.set(p.x, 2, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      // Foliage
      dummy.position.set(p.x, 8, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      foliage.setMatrixAt(i, dummy.matrix);
    }

    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    trunks.castShadow = true;
    foliage.castShadow = true;

    this.group.add(trunks);
    this.group.add(foliage);
  }

  // ─── Instanced Street Lights (2 draw calls) ─────────────────────
  private createInstancedStreetLights(): void {
    const positions: { x: number; z: number }[] = [];

    for (let i = -3000; i <= 3000; i += 200) {
      if (i > 1400 && i < 1600) continue;
      positions.push({ x: i, z: 25 });
      positions.push({ x: i, z: -25 });
      positions.push({ x: 25, z: i });
      positions.push({ x: -25, z: i });
    }

    if (positions.length === 0) return;
    const count = positions.length;

    // Pole instanced mesh
    const poleGeom = new THREE.CylinderGeometry(0.3, 0.4, 12, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const poles = new THREE.InstancedMesh(poleGeom, poleMat, count);

    // Light fixture instanced mesh (emissive)
    const fixtureGeom = new THREE.BoxGeometry(2, 0.5, 1);
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const fixtures = new THREE.InstancedMesh(fixtureGeom, fixtureMat, count);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const p = positions[i];

      // Pole
      dummy.position.set(p.x, 6, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      // Fixture
      dummy.position.set(p.x + 2, 11.5, p.z);
      dummy.updateMatrix();
      fixtures.setMatrixAt(i, dummy.matrix);
    }

    poles.instanceMatrix.needsUpdate = true;
    fixtures.instanceMatrix.needsUpdate = true;

    this.group.add(poles);
    this.group.add(fixtures);
  }

  // ─── Instanced Vehicles (2 draw calls) ──────────────────────────
  private createInstancedVehicles(): void {
    const rand = seededRandom(123);
    const CAR_COLORS = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00, 0xffffff, 0x333333, 0xff8800];
    const count = 60; // Reduced from 100

    const bodyGeom = new THREE.BoxGeometry(4, 3, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcccccc }); // Base color, overridden per instance
    const bodies = new THREE.InstancedMesh(bodyGeom, bodyMat, count);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    let placed = 0;
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const onMainRoad = rand() > 0.5;
      let carX: number, carZ: number, rotation: number;

      if (onMainRoad) {
        if (rand() > 0.5) {
          carX = (rand() - 0.5) * 5000;
          carZ = rand() > 0.5 ? 8 : -8;
          rotation = Math.PI / 2;
        } else {
          carX = rand() > 0.5 ? 8 : -8;
          carZ = (rand() - 0.5) * 5000;
          rotation = 0;
        }
      } else {
        const gridPos = Math.floor(rand() * 40) - 20;
        const streetPos = gridPos * (this.blockSize + this.streetWidth);
        if (rand() > 0.5) {
          carX = streetPos;
          carZ = (rand() - 0.5) * 4000;
          rotation = 0;
        } else {
          carX = (rand() - 0.5) * 4000;
          carZ = streetPos;
          rotation = Math.PI / 2;
        }
      }

      // Skip river
      if (carX > 1400 && carX < 1600) continue;

      dummy.position.set(carX, 1.5, carZ);
      dummy.rotation.set(0, rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodies.setMatrixAt(placed, dummy.matrix);

      color.setHex(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]);
      bodies.setColorAt(placed, color);

      placed++;
    }

    bodies.count = placed;
    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    bodies.castShadow = true;

    this.group.add(bodies);
  }

  // ─── Parks (small, few meshes) ───────────────────────────────────
  private createParks(): void {
    const parkLocations = [
      { x: 800, z: 800, size: 300 },
      { x: -1000, z: 500, size: 200 },
      { x: 500, z: -1200, size: 250 },
    ];

    const parkTreePositions: { x: number; z: number; scale: number }[] = [];

    parkLocations.forEach(park => {
      // Grass
      const grassGeom = new THREE.PlaneGeometry(park.size, park.size);
      const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7c4e });
      const grass = new THREE.Mesh(grassGeom, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(park.x, 0.1, park.z);
      grass.receiveShadow = true;
      this.group.add(grass);

      // Pond
      if (park.size > 200) {
        const pondGeom = new THREE.CircleGeometry(park.size / 6, 16);
        const pondMat = new THREE.MeshLambertMaterial({ color: 0x3399cc });
        const pond = new THREE.Mesh(pondGeom, pondMat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(park.x + 30, 0.15, park.z - 30);
        this.group.add(pond);
      }

      // Collect park tree positions
      for (let i = 0; i < 12; i++) {
        parkTreePositions.push({
          x: park.x + (Math.random() - 0.5) * park.size * 0.8,
          z: park.z + (Math.random() - 0.5) * park.size * 0.8,
          scale: 1.2 + Math.random() * 0.5,
        });
      }

      // Paths (merged)
      const pathGeom1 = new THREE.PlaneGeometry(5, park.size * 0.8);
      const pathMat = new THREE.MeshLambertMaterial({ color: 0xccbb99 });
      const path1 = new THREE.Mesh(pathGeom1, pathMat);
      path1.rotation.x = -Math.PI / 2;
      path1.position.set(park.x, 0.12, park.z);
      this.group.add(path1);

      const pathGeom2 = new THREE.PlaneGeometry(5, park.size * 0.8);
      const path2 = new THREE.Mesh(pathGeom2, pathMat);
      path2.rotation.x = -Math.PI / 2;
      path2.rotation.z = Math.PI / 2;
      path2.position.set(park.x, 0.12, park.z);
      this.group.add(path2);
    });

    // Park trees as instanced meshes
    if (parkTreePositions.length > 0) {
      const count = parkTreePositions.length;
      const trunkGeom = new THREE.CylinderGeometry(0.6, 0.9, 5, 6);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
      const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, count);

      const foliageGeom = new THREE.ConeGeometry(4, 10, 6);
      const foliageMat = new THREE.MeshLambertMaterial({ color: 0x3d6a37 });
      const foliages = new THREE.InstancedMesh(foliageGeom, foliageMat, count);

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const p = parkTreePositions[i];
        dummy.position.set(p.x, 2.5, p.z);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(p.x, 9, p.z);
        dummy.updateMatrix();
        foliages.setMatrixAt(i, dummy.matrix);
      }

      trunks.instanceMatrix.needsUpdate = true;
      foliages.instanceMatrix.needsUpdate = true;
      trunks.castShadow = true;
      foliages.castShadow = true;
      this.group.add(trunks);
      this.group.add(foliages);
    }
  }

  // ─── Bridges ─────────────────────────────────────────────────────
  private createBridges(): void {
    const bridgePositions = [-500, 0, 500];

    bridgePositions.forEach(z => {
      const geoms: THREE.BufferGeometry[] = [];

      // Road surface
      const road = new THREE.BoxGeometry(300, 3, 40);
      road.translate(0, 15, 0);
      geoms.push(road);

      // Support pillars
      for (let i = -1; i <= 1; i++) {
        const pillar = new THREE.BoxGeometry(10, 30, 10);
        pillar.translate(i * 100, 0, 0);
        geoms.push(pillar);
      }

      // Towers
      for (let side = -1; side <= 1; side += 2) {
        const t1 = new THREE.BoxGeometry(8, 50, 8);
        t1.translate(-130, 25, side * 18);
        geoms.push(t1);

        const t2 = new THREE.BoxGeometry(8, 50, 8);
        t2.translate(130, 25, side * 18);
        geoms.push(t2);
      }

      const merged = mergeGeometries(geoms, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x555555 }));
        mesh.position.set(1500, 0, z);
        mesh.castShadow = true;
        this.group.add(mesh);
        geoms.forEach(g => g.dispose());
      }
    });
  }

  // ─── Landmarks (few meshes, fine as-is) ──────────────────────────
  private createLandmarks(): void {
    this.createStadium(-800, 0, -800);
    this.createFerrisWheel(2000, 0, 1000);
    this.createObelisk(0, 0, 0);
  }

  private createStadium(x: number, y: number, z: number): void {
    const outerGeom = new THREE.TorusGeometry(100, 30, 6, 16);
    const outerMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const outer = new THREE.Mesh(outerGeom, outerMat);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(x, y + 20, z);
    outer.castShadow = true;
    this.group.add(outer);

    const fieldGeom = new THREE.CircleGeometry(70, 16);
    const fieldMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
    const field = new THREE.Mesh(fieldGeom, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.set(x, y + 1, z);
    this.group.add(field);
  }

  private createFerrisWheel(x: number, y: number, z: number): void {
    // Wheel ring
    const wheelGeom = new THREE.TorusGeometry(60, 3, 6, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
    wheel.position.set(x, y + 70, z);
    this.group.add(wheel);

    // Support
    const supportGeom = new THREE.CylinderGeometry(5, 8, 80, 6);
    const supportMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

    const s1 = new THREE.Mesh(supportGeom, supportMat);
    s1.position.set(x - 20, y + 40, z);
    s1.rotation.z = 0.2;
    this.group.add(s1);

    const s2 = new THREE.Mesh(supportGeom, supportMat);
    s2.position.set(x + 20, y + 40, z);
    s2.rotation.z = -0.2;
    this.group.add(s2);

    // Gondolas as instanced mesh
    const gondolaGeom = new THREE.BoxGeometry(8, 10, 8);
    const gondolaMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const gondolas = new THREE.InstancedMesh(gondolaGeom, gondolaMat, 12);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const gondolaColors = [0xff6666, 0x66ff66, 0x6666ff, 0xffff66];

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      dummy.position.set(
        x + Math.cos(angle) * 60,
        y + 70 + Math.sin(angle) * 60,
        z
      );
      dummy.updateMatrix();
      gondolas.setMatrixAt(i, dummy.matrix);
      color.setHex(gondolaColors[i % 4]);
      gondolas.setColorAt(i, color);
    }
    gondolas.instanceMatrix.needsUpdate = true;
    if (gondolas.instanceColor) gondolas.instanceColor.needsUpdate = true;
    this.group.add(gondolas);
  }

  private createObelisk(x: number, y: number, z: number): void {
    const geoms: THREE.BufferGeometry[] = [];
    const base = new THREE.BoxGeometry(30, 5, 30);
    base.translate(0, 2.5, 0);
    geoms.push(base);

    const shaft = new THREE.BoxGeometry(10, 80, 10);
    shaft.translate(0, 45, 0);
    geoms.push(shaft);

    const merged = mergeGeometries(geoms, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      geoms.forEach(g => g.dispose());
    }

    const topGeom = new THREE.ConeGeometry(7, 15, 4);
    const topMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const top = new THREE.Mesh(topGeom, topMat);
    top.position.set(x, y + 92, z);
    top.rotation.y = Math.PI / 4;
    this.group.add(top);
  }

  // ─── Terrain height ──────────────────────────────────────────────
  public getHeightAt(_x: number, _z: number): number {
    return 0;
  }
}
