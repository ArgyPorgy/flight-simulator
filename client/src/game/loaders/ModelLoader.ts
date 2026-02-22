import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

class ModelLoaderSingleton {
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private cache: Map<string, LoadedModel> = new Map();
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map();
  
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
  }
  
  async loadGLTF(url: string): Promise<LoadedModel> {
    // Check cache
    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      return {
        scene: cached.scene.clone(),
        animations: cached.animations,
      };
    }
    
    // Check if already loading
    if (this.loadingPromises.has(url)) {
      const result = await this.loadingPromises.get(url)!;
      return {
        scene: result.scene.clone(),
        animations: result.animations,
      };
    }
    
    // Start loading
    const loadPromise = new Promise<LoadedModel>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model: LoadedModel = {
            scene: gltf.scene,
            animations: gltf.animations,
          };
          
          // Enable shadows for all meshes
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          this.cache.set(url, model);
          resolve(model);
        },
        (progress) => {
          console.log(`Loading ${url}: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
        },
        (error) => {
          console.error(`Failed to load ${url}:`, error);
          reject(error);
        }
      );
    });
    
    this.loadingPromises.set(url, loadPromise);
    
    try {
      const result = await loadPromise;
      return {
        scene: result.scene.clone(),
        animations: result.animations,
      };
    } finally {
      this.loadingPromises.delete(url);
    }
  }
  
  loadTexture(url: string): THREE.Texture {
    return this.textureLoader.load(url);
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}

export const ModelLoader = new ModelLoaderSingleton();
