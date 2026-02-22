// Main game exports
export { FlightSimulator } from './FlightSimulator';
export type { FlightSimulatorCallbacks, HUDData, GameState } from './FlightSimulator';

// Engine
export { GameEngine } from './engine/GameEngine';

// Physics
export { AircraftPhysics } from './physics/AircraftPhysics';
export type { AircraftState, AircraftConfig } from './physics/AircraftPhysics';

// Entities
export { PlayerAircraft } from './entities/PlayerAircraft';
export { AIAircraft } from './entities/AIAircraft';

// Systems
export { AITrafficManager } from './systems/AITrafficManager';
export type { TrafficInfo } from './systems/AITrafficManager';

// World
export { CityWorld } from './world/CityWorld';

// Input
export { InputManager } from './input/InputManager';

// Loaders (available if needed for future use)
export { ModelLoader } from './loaders/ModelLoader';

// Effects
export { ExplosionEffect } from './effects/ExplosionEffect';

// AI
export { aiController, AIController } from './ai/AIController';
export type { AIDecision, FlightContext } from './ai/AIController';
