/**
 * Sound Manager for flight simulator
 * Uses Web Audio API for procedural sounds and HTML5 Audio for MP3 files
 */

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.5;
  private sounds: Map<string, AudioBufferSourceNode | OscillatorNode> = new Map();
  
  // HTML5 Audio elements for MP3 files
  private flightAudio: HTMLAudioElement | null = null;
  private boomAudio: HTMLAudioElement | null = null;
  private emergencyInterval: number | null = null;
  private isEmergencyPlaying = false;

  constructor() {
    // Initialize audio context
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }

    // Preload the flight sound MP3
    if (typeof window !== 'undefined') {
      this.flightAudio = new Audio('/Airplane landing Sound Effect.mp3');
      this.flightAudio.loop = true;
      this.flightAudio.volume = this.masterVolume * 0.6;
      this.flightAudio.preload = 'auto';

      // Preload the boom crash sound MP3
      this.boomAudio = new Audio('/Boom Sound Effect.mp3');
      this.boomAudio.volume = this.masterVolume * 0.8;
      this.boomAudio.preload = 'auto';
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    // Resume if suspended (required by browsers)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Start playing the flight/engine sound (MP3)
   */
  public startFlightSound(): void {
    if (this.flightAudio) {
      this.flightAudio.currentTime = 0;
      this.flightAudio.volume = this.masterVolume * 0.6;
      this.flightAudio.play().catch(e => {
        console.warn('Could not play flight sound:', e);
      });
    }
  }

  /**
   * Stop the flight sound
   */
  public stopFlightSound(): void {
    if (this.flightAudio) {
      this.flightAudio.pause();
      this.flightAudio.currentTime = 0;
    }
  }

  /**
   * Adjust flight sound volume based on throttle
   */
  public updateFlightSound(throttle: number): void {
    if (this.flightAudio && !this.flightAudio.paused) {
      // Volume scales with throttle (0.3 to 0.8)
      this.flightAudio.volume = this.masterVolume * (0.3 + throttle * 0.5);
      // Playback rate scales slightly with throttle for pitch variation
      this.flightAudio.playbackRate = 0.8 + throttle * 0.4;
    }
  }

  /**
   * Generate engine sound (continuous oscillator - backup)
   */
  public playEngine(throttle: number): void {
    // Use the MP3 flight sound instead
    if (this.flightAudio && this.flightAudio.paused) {
      this.startFlightSound();
    }
    this.updateFlightSound(throttle);
  }

  /**
   * Stop engine sound
   */
  public stopEngine(): void {
    this.stopFlightSound();
    this.stopSound('engine');
  }

  /**
   * Play emergency warning sound (repeating alarm)
   */
  public playEmergency(): void {
    if (this.isEmergencyPlaying) return;
    this.isEmergencyPlaying = true;

    const playAlarm = () => {
      const ctx = this.ensureContext();
      if (!ctx) return;

      // Two-tone emergency alarm (like aircraft GPWS)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

      // Alternating tones
      osc1.frequency.setValueAtTime(800, ctx.currentTime);
      osc1.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
      osc2.frequency.setValueAtTime(600, ctx.currentTime);
      osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.15);

      gainNode.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
      gainNode.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    };

    // Play immediately
    playAlarm();

    // Repeat every 400ms
    this.emergencyInterval = window.setInterval(playAlarm, 400);
  }

  /**
   * Stop emergency warning
   */
  public stopEmergency(): void {
    if (this.emergencyInterval) {
      clearInterval(this.emergencyInterval);
      this.emergencyInterval = null;
    }
    this.isEmergencyPlaying = false;
  }

  /**
   * Play a beep sound
   */
  public playBeep(frequency: number = 800, duration: number = 0.1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.2, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /**
   * Play warning sound
   */
  public playWarning(): void {
    this.playBeep(400, 0.2);
    setTimeout(() => this.playBeep(400, 0.2), 150);
  }

  /**
   * Play stall warning
   */
  public playStallWarning(): void {
    this.playBeep(300, 0.15);
  }

  /**
   * Play gear up/down sound
   */
  public playGearSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Mechanical whirring sound
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.15, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  /**
   * Play massive explosion/crash sound - BOOM! (using MP3 file)
   */
  public playCrash(): void {
    console.log('💥 CRASH! Playing boom sound...');
    
    // Stop emergency alarm first
    this.stopEmergency();
    this.stopFlightSound();

    // Play the boom sound MP3
    if (this.boomAudio) {
      console.log('Playing boom MP3, volume:', this.masterVolume * 0.9);
      // Reset to beginning and play
      this.boomAudio.currentTime = 0;
      this.boomAudio.volume = this.masterVolume * 0.9; // Loud!
      this.boomAudio.play()
        .then(() => {
          console.log('Boom sound playing successfully');
        })
        .catch(e => {
          console.warn('Could not play boom sound:', e);
          // Fallback to procedural sound if MP3 fails
          this.playCrashFallback();
        });
    } else {
      console.warn('Boom audio not loaded, using fallback');
      // Fallback to procedural sound if MP3 not loaded
      this.playCrashFallback();
    }
  }

  /**
   * Fallback procedural crash sound (if MP3 fails to load)
   */
  private playCrashFallback(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Simple boom fallback
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(150, ctx.currentTime);
    boomOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
    boomGain.gain.setValueAtTime(this.masterVolume * 0.9, ctx.currentTime);
    boomGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start();
    boomOsc.stop(ctx.currentTime + 1);
  }

  /**
   * Play bullet/gun fire sound
   */
  public playBullet(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Quick sharp sound for bullet
    const osc = ctx.createOscillator();
    const noise = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const noiseGain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);

    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(2000, ctx.currentTime);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    noiseGain.gain.setValueAtTime(this.masterVolume * 0.1, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

    osc.connect(gainNode);
    noise.connect(noiseGain);
    gainNode.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    osc.start();
    noise.start();
    osc.stop(ctx.currentTime + 0.05);
    noise.stop(ctx.currentTime + 0.03);
  }

  /**
   * Play missile launch sound
   */
  public playMissile(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Whoosh + ignition sound
    const osc = ctx.createOscillator();
    const noise = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const noiseGain = ctx.createGain();

    // Rising whoosh
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);

    // Rocket ignition noise
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(1500, ctx.currentTime);
    noise.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    noiseGain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gainNode);
    noise.connect(noiseGain);
    gainNode.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    osc.start();
    noise.start();
    osc.stop(ctx.currentTime + 0.6);
    noise.stop(ctx.currentTime + 0.5);
  }

  /**
   * Play bomb/missile explosion sound (for ground/building impacts)
   */
  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Deep rumbling explosion
    const bassOsc = ctx.createOscillator();
    const midOsc = ctx.createOscillator();
    const noiseOsc = ctx.createOscillator();
    
    const bassGain = ctx.createGain();
    const midGain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const masterGain = ctx.createGain();

    // Deep bass boom
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(80, ctx.currentTime);
    bassOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.8);

    // Mid frequency crunch
    midOsc.type = 'sawtooth';
    midOsc.frequency.setValueAtTime(200, ctx.currentTime);
    midOsc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

    // High frequency debris/crackle
    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(800, ctx.currentTime);
    noiseOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    // Envelope for bass
    bassGain.gain.setValueAtTime(this.masterVolume * 0.8, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

    // Envelope for mid
    midGain.gain.setValueAtTime(this.masterVolume * 0.5, ctx.currentTime);
    midGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    // Envelope for noise
    noiseGain.gain.setValueAtTime(this.masterVolume * 0.3, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    // Connect
    bassOsc.connect(bassGain);
    midOsc.connect(midGain);
    noiseOsc.connect(noiseGain);
    
    bassGain.connect(masterGain);
    midGain.connect(masterGain);
    noiseGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Start and stop
    bassOsc.start();
    midOsc.start();
    noiseOsc.start();
    
    bassOsc.stop(ctx.currentTime + 1.0);
    midOsc.stop(ctx.currentTime + 0.6);
    noiseOsc.stop(ctx.currentTime + 0.3);
  }

  /**
   * Play success/landing sound
   */
  public playSuccess(): void {
    this.stopEmergency();
    
    // Ascending chord
    const ctx = this.ensureContext();
    if (!ctx) return;

    const frequencies = [523.25, 659.25, 783.99]; // C, E, G
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.15, ctx.currentTime + i * 0.1 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  }

  /**
   * Stop a specific sound
   */
  private stopSound(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      try {
        if ('stop' in sound) sound.stop();
        if ('disconnect' in sound) sound.disconnect();
      } catch (e) {
        // Ignore errors when stopping
      }
      this.sounds.delete(name);
    }
  }

  /**
   * Set master volume (0-1)
   */
  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.flightAudio) {
      this.flightAudio.volume = this.masterVolume * 0.6;
    }
    if (this.boomAudio) {
      this.boomAudio.volume = this.masterVolume * 0.9;
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.stopEmergency();
    this.stopFlightSound();
    
    this.sounds.forEach((sound) => {
      try {
        if ('stop' in sound) sound.stop();
        if ('disconnect' in sound) sound.disconnect();
      } catch (e) {
        // Ignore
      }
    });
    this.sounds.clear();
    
    if (this.flightAudio) {
      this.flightAudio.pause();
      this.flightAudio = null;
    }
    
    if (this.boomAudio) {
      this.boomAudio.pause();
      this.boomAudio = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
