export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();
  
  private mousePosition = { x: 0, y: 0 };
  private mouseDelta = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  
  private gamepadIndex: number | null = null;
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Mouse
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    
    // Gamepad
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.keysDown.has(e.code)) {
      this.keysJustPressed.add(e.code);
    }
    this.keysDown.add(e.code);
    
    // Prevent default for game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
    this.keysJustReleased.add(e.code);
  };
  
  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseDelta.x = e.movementX;
    this.mouseDelta.y = e.movementY;
    this.mousePosition.x = e.clientX;
    this.mousePosition.y = e.clientY;
  };
  
  private handleMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);
  };
  
  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
  };
  
  private handleGamepadConnected = (e: GamepadEvent): void => {
    console.log('Gamepad connected:', e.gamepad.id);
    this.gamepadIndex = e.gamepad.index;
  };
  
  private handleGamepadDisconnected = (): void => {
    console.log('Gamepad disconnected');
    this.gamepadIndex = null;
  };
  
  // Call this at the end of each frame
  public update(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }
  
  // Keyboard queries
  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }
  
  public wasKeyJustPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }
  
  public wasKeyJustReleased(code: string): boolean {
    return this.keysJustReleased.has(code);
  }
  
  // Mouse queries
  public getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }
  
  public getMouseDelta(): { x: number; y: number } {
    return { ...this.mouseDelta };
  }
  
  public isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }
  
  // Gamepad queries
  public getGamepad(): Gamepad | null {
    if (this.gamepadIndex === null) return null;
    const gamepads = navigator.getGamepads();
    return gamepads[this.gamepadIndex] || null;
  }
  
  public getGamepadAxis(index: number): number {
    const gamepad = this.getGamepad();
    if (!gamepad || index >= gamepad.axes.length) return 0;
    
    // Apply deadzone
    const value = gamepad.axes[index];
    const deadzone = 0.15;
    if (Math.abs(value) < deadzone) return 0;
    return value;
  }
  
  public isGamepadButtonDown(index: number): boolean {
    const gamepad = this.getGamepad();
    if (!gamepad || index >= gamepad.buttons.length) return false;
    return gamepad.buttons[index].pressed;
  }
  
  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }
}
