import * as THREE from 'three';

export interface GameEngineConfig {
  container: HTMLElement;
  onUpdate?: (deltaTime: number) => void;
  onRender?: () => void;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  
  private clock: THREE.Clock;
  private animationId: number | null = null;
  private config: GameEngineConfig;
  private isRunning = false;
  
  constructor(config: GameEngineConfig) {
    this.config = config;
    this.clock = new THREE.Clock();
    
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 2000, 15000);
    
    // Initialize camera
    const aspect = config.container.clientWidth / config.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 30000);
    this.camera.position.set(0, 500, 1000);
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,          // not needed, saves memory
    });
    this.renderer.setSize(config.container.clientWidth, config.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap DPR for perf
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft → PCF (much faster)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    config.container.appendChild(this.renderer.domElement);
    
    // Setup lighting
    this.setupLighting();
    
    // Handle resize
    window.addEventListener('resize', this.handleResize);
  }
  
  private setupLighting(): void {
    // Hemisphere light for sky/ground ambient
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3d, 0.8);
    this.scene.add(hemi);
    
    // Directional light (sun) - shadow frustum kept small for performance
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3000, 8000, 3000);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 20000;
    sun.shadow.camera.left = -4000;
    sun.shadow.camera.right = 4000;
    sun.shadow.camera.top = 4000;
    sun.shadow.camera.bottom = -4000;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
  }
  
  private handleResize = (): void => {
    const width = this.config.container.clientWidth;
    const height = this.config.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
  
  private gameLoop = (): void => {
    if (!this.isRunning) return;
    
    this.animationId = requestAnimationFrame(this.gameLoop);
    
    const deltaTime = this.clock.getDelta();
    
    // Call update callback
    this.config.onUpdate?.(deltaTime);
    
    // Render
    this.renderer.render(this.scene, this.camera);
    
    // Call render callback
    this.config.onRender?.();
  };
  
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.gameLoop();
  }
  
  public stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    this.config.container.removeChild(this.renderer.domElement);
  }
}
