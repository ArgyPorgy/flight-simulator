import { useEffect, useRef, useState, useCallback } from 'react';
import { FlightSimulator, HUDData, GameState, GameScore } from '@/game/FlightSimulator';
import { TrafficInfo } from '@/game/systems/AITrafficManager';
import { FlightHUD } from './FlightHUD';

interface GameCanvasProps {
  onExit?: () => void;
  aircraftType?: string;
}

export function GameCanvas({ onExit, aircraftType = 'fighter' }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulatorRef = useRef<FlightSimulator | null>(null);
  
  const [hudData, setHudData] = useState<HUDData | null>(null);
  const [traffic, setTraffic] = useState<TrafficInfo[]>([]);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [finalScore, setFinalScore] = useState<GameScore | null>(null);

  const handleHUDUpdate = useCallback((data: HUDData) => {
    setHudData(data);
  }, []);

  const handleTrafficUpdate = useCallback((trafficData: TrafficInfo[]) => {
    setTraffic(trafficData);
  }, []);

  const handleGameStateChange = useCallback((state: GameState) => {
    setGameState(state);
    setShowPauseMenu(state === 'paused');
  }, []);

  const handleScoreUpdate = useCallback((score: GameScore) => {
    setFinalScore(score);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create simulator with aircraft type
    const simulator = new FlightSimulator(containerRef.current, {
      onHUDUpdate: handleHUDUpdate,
      onTrafficUpdate: handleTrafficUpdate,
      onGameStateChange: handleGameStateChange,
      onScoreUpdate: handleScoreUpdate,
      aircraftType,
    });

    simulatorRef.current = simulator;
    simulator.start();

    return () => {
      simulator.dispose();
      simulatorRef.current = null;
    };
  }, [handleHUDUpdate, handleTrafficUpdate, handleGameStateChange, handleScoreUpdate]);

  const handleRestart = () => {
    simulatorRef.current?.restart();
    setShowPauseMenu(false);
  };

  const handleResume = () => {
    if (simulatorRef.current?.getGameState() === 'paused') {
      // Trigger unpause by simulating Escape key
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }));
    }
    setShowPauseMenu(false);
  };

  const handleExit = () => {
    simulatorRef.current?.stop();
    onExit?.();
  };

  const handleEndGame = () => {
    simulatorRef.current?.endGame();
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Game canvas container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD overlay */}
      <FlightHUD hudData={hudData} traffic={traffic} />

      {/* END button - Top left */}
      {gameState === 'playing' && (
        <button
          onClick={handleEndGame}
          className="absolute top-4 left-4 z-50 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-mono rounded transition-colors shadow-lg"
        >
          END FLIGHT
        </button>
      )}

      {/* Loading screen */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="text-cyan-400 text-2xl font-mono animate-pulse">
              INITIALIZING FLIGHT SYSTEMS...
            </div>
            <div className="mt-4 w-64 h-2 bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-cyan-500 animate-loading-bar" />
            </div>
          </div>
        </div>
      )}

      {/* Pause menu */}
      {showPauseMenu && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-cyan-500/50 rounded-lg p-8 space-y-6 min-w-[300px]">
            <h2 className="text-2xl font-bold text-cyan-400 text-center font-mono">
              PAUSED
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleResume}
                className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white font-mono rounded transition-colors"
              >
                RESUME
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-mono rounded transition-colors"
              >
                RESTART
              </button>
              <button
                onClick={handleExit}
                className="w-full py-3 px-6 bg-red-700 hover:bg-red-600 text-white font-mono rounded transition-colors"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crash screen */}
      {gameState === 'crashed' && (
        <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-8 space-y-6 min-w-[400px]">
            <h2 className="text-3xl font-bold text-red-500 text-center font-mono animate-pulse">
              CRASH
            </h2>
            <p className="text-gray-400 text-center">
              Your aircraft has been destroyed.
            </p>
            {finalScore && (
              <div className="bg-gray-800/50 rounded p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Final Score:</span>
                  <span className="text-white font-bold">{finalScore.totalScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Flight Time:</span>
                  <span className="text-white">{Math.floor(finalScore.flightTime / 60)}:{(Math.floor(finalScore.flightTime) % 60).toString().padStart(2, '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Distance:</span>
                  <span className="text-white">{finalScore.distanceFlown.toFixed(1)} nm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Altitude:</span>
                  <span className="text-white">{Math.floor(finalScore.maxAltitude)} ft</span>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white font-mono rounded transition-colors"
              >
                TRY AGAIN
              </button>
              <button
                onClick={handleExit}
                className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-mono rounded transition-colors"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End game screen */}
      {gameState === 'ended' && finalScore && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg p-8 space-y-6 min-w-[500px] max-w-[600px]">
            <h2 className="text-4xl font-bold text-cyan-400 text-center font-mono">
              FLIGHT COMPLETE
            </h2>
            <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-cyan-400 mb-2">
                  {finalScore.totalScore.toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">TOTAL SCORE</div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <div className="text-gray-400 text-sm">Flight Time</div>
                  <div className="text-white font-semibold">
                    {Math.floor(finalScore.flightTime / 60)}:{(Math.floor(finalScore.flightTime) % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Distance Flown</div>
                  <div className="text-white font-semibold">{finalScore.distanceFlown.toFixed(1)} nm</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Max Altitude</div>
                  <div className="text-white font-semibold">{Math.floor(finalScore.maxAltitude)} ft</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Max Speed</div>
                  <div className="text-white font-semibold">{Math.floor(finalScore.maxSpeed)} kts</div>
                </div>
                {finalScore.crashes > 0 && (
                  <div className="col-span-2">
                    <div className="text-gray-400 text-sm">Crashes</div>
                    <div className="text-red-400 font-semibold">{finalScore.crashes}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white font-mono rounded transition-colors"
              >
                FLY AGAIN
              </button>
              <button
                onClick={handleExit}
                className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-mono rounded transition-colors"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-loading-bar {
          animation: loading-bar 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
