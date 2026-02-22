import { HUDData } from '@/game/FlightSimulator';
import { TrafficInfo } from '@/game/systems/AITrafficManager';

interface FlightHUDProps {
  hudData: HUDData | null;
  traffic: TrafficInfo[];
}

export function FlightHUD({ hudData, traffic }: FlightHUDProps) {
  if (!hudData) return null;

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-sm">
      {/* Top bar - Speed and Altitude */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8">
        <div className="bg-black/70 border border-cyan-500/50 px-4 py-2 rounded">
          <div className="text-cyan-400 text-xs">AIRSPEED</div>
          <div className="text-white text-2xl font-bold">{hudData.airspeed}</div>
          <div className="text-cyan-400 text-xs">KTS</div>
        </div>
        <div className="bg-black/70 border border-cyan-500/50 px-4 py-2 rounded">
          <div className="text-cyan-400 text-xs">ALTITUDE</div>
          <div className="text-white text-2xl font-bold">{hudData.altitude.toLocaleString()}</div>
          <div className="text-cyan-400 text-xs">FT</div>
        </div>
      </div>

      {/* Left panel - Vertical Speed & Throttle */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 space-y-4">
        {/* Vertical Speed */}
        <div className="bg-black/70 border border-cyan-500/50 px-3 py-2 rounded w-24">
          <div className="text-cyan-400 text-xs">V/S</div>
          <div className={`text-lg font-bold ${hudData.verticalSpeed >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {hudData.verticalSpeed > 0 ? '+' : ''}{hudData.verticalSpeed}
          </div>
          <div className="text-cyan-400 text-xs">FPM</div>
        </div>

        {/* Throttle */}
        <div className="bg-black/70 border border-cyan-500/50 px-3 py-2 rounded w-24">
          <div className="text-cyan-400 text-xs">THROTTLE</div>
          <div className="relative h-24 w-4 mx-auto bg-gray-800 rounded mt-2">
            <div 
              className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 to-yellow-500 rounded transition-all"
              style={{ height: `${hudData.throttle}%` }}
            />
          </div>
          <div className="text-white text-center mt-1">{hudData.throttle}%</div>
        </div>
      </div>

      {/* Right panel - Status indicators - positioned below traffic panel */}
      <div className="absolute right-4 top-[280px] space-y-2">
        {/* Gear indicator */}
        <div className={`px-3 py-2 rounded border ${
          hudData.gearDown 
            ? 'bg-green-900/70 border-green-500 text-green-400' 
            : 'bg-black/70 border-gray-600 text-gray-500'
        }`}>
          <div className="text-xs">GEAR</div>
          <div className="font-bold">{hudData.gearDown ? 'DOWN' : 'UP'}</div>
        </div>

        {/* Flaps indicator */}
        <div className="bg-black/70 border border-cyan-500/50 px-3 py-2 rounded">
          <div className="text-cyan-400 text-xs">FLAPS</div>
          <div className="text-white font-bold">
            {hudData.flaps === 0 ? 'UP' : `${Math.round(hudData.flaps * 100)}%`}
          </div>
        </div>

        {/* Stall warning */}
        {hudData.isStalling && (
          <div className="bg-red-900/90 border-2 border-red-500 px-3 py-2 rounded animate-pulse">
            <div className="text-red-400 text-xs">⚠ STALL</div>
            <div className="text-red-300 font-bold">WARNING</div>
          </div>
        )}

        {/* Camera mode */}
        <div className="bg-black/70 border border-cyan-500/50 px-3 py-2 rounded">
          <div className="text-cyan-400 text-xs">CAMERA</div>
          <div className="text-white font-bold uppercase">{hudData.cameraMode}</div>
        </div>
      </div>

      {/* Bottom - Compass */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="bg-black/70 border border-cyan-500/50 px-6 py-2 rounded">
          <div className="text-cyan-400 text-xs text-center">HEADING</div>
          <div className="flex items-center gap-4">
            <CompassRose heading={hudData.heading} />
            <div className="text-white text-2xl font-bold w-12 text-center">
              {String(Math.round(hudData.heading)).padStart(3, '0')}°
            </div>
          </div>
        </div>
      </div>

      {/* Radar - Bottom right */}
      <div className="absolute bottom-4 right-4">
        <Radar traffic={traffic} />
      </div>

      {/* Score & Traffic - Top right */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="bg-black/70 border border-cyan-500/50 px-3 py-2 rounded">
          <div className="text-cyan-400 text-xs">SCORE</div>
          <div className="text-white text-lg font-bold">{hudData.score?.toLocaleString() || 0}</div>
        </div>
        <div className="bg-black/50 px-2 py-1 rounded text-xs text-gray-400">
          {hudData.fps} FPS
        </div>
        
        {/* Nearby Traffic Panel - positioned to avoid gear indicator */}
        {traffic.length > 0 && (
          <div className="bg-black/70 border border-yellow-500/50 px-3 py-2 rounded max-w-[200px] max-h-[200px]">
            <div className="text-yellow-400 text-xs mb-2 flex items-center gap-1">
              <span>✈</span> TRAFFIC ({traffic.length})
            </div>
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {traffic.slice(0, 5).map((t, i) => (
                <div key={i} className="text-xs border-b border-gray-700/50 pb-1 last:border-0">
                  <div className="flex justify-between">
                    <span className="text-yellow-300 font-mono">{t.callsign}</span>
                    <span className="text-gray-400">{(t.distance / 1000).toFixed(1)}km</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{Math.floor(t.altitude)}ft</span>
                    <span>{Math.floor(t.speed)}kts</span>
                    <span>{Math.floor(t.heading)}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls help - Bottom left */}
      <div className="absolute bottom-4 left-4 bg-black/70 border border-cyan-500/30 px-3 py-2 rounded text-xs text-gray-400 space-y-1">
        <div><span className="text-cyan-400">W/S</span> Pitch</div>
        <div><span className="text-cyan-400">A/D</span> Roll</div>
        <div><span className="text-cyan-400">Q/E</span> Yaw</div>
        <div><span className="text-cyan-400">Shift/Ctrl</span> Throttle</div>
        <div><span className="text-cyan-400">Space</span> Boost/Takeoff</div>
        <div><span className="text-cyan-400">G</span> Gear</div>
        <div><span className="text-cyan-400">F</span> Flaps</div>
        <div><span className="text-cyan-400">C</span> Camera</div>
      </div>

      {/* Boost indicator - shows when near ground */}
      {hudData.isOnGround && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <div className="bg-green-900/80 border border-green-500 px-4 py-2 rounded text-green-400 text-sm animate-pulse">
            Hold <span className="font-bold text-white">SPACE</span> to boost/takeoff
          </div>
        </div>
      )}
    </div>
  );
}

function CompassRose({ heading }: { heading: number }) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Outer ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#0891b2" strokeWidth="2" />
        
        {/* Direction markers */}
        <g style={{ transform: `rotate(${-heading}deg)`, transformOrigin: '50px 50px' }}>
          {directions.map((dir, i) => {
            const angle = i * 45;
            const rad = (angle - 90) * Math.PI / 180;
            const x = 50 + Math.cos(rad) * 35;
            const y = 50 + Math.sin(rad) * 35;
            const isCardinal = i % 2 === 0;
            
            return (
              <text
                key={dir}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isCardinal ? '#22d3ee' : '#6b7280'}
                fontSize={isCardinal ? '12' : '8'}
                fontWeight={isCardinal ? 'bold' : 'normal'}
              >
                {dir}
              </text>
            );
          })}
          
          {/* Aircraft indicator */}
          <polygon
            points="50,25 45,40 55,40"
            fill="#22d3ee"
          />
        </g>
      </svg>
    </div>
  );
}

function Radar({ traffic }: { traffic: TrafficInfo[] }) {
  const radarRadius = 60;
  const maxDistance = 15000; // meters
  
  return (
    <div className="bg-black/80 border border-cyan-500/50 rounded-full p-2">
      <svg width={radarRadius * 2 + 20} height={radarRadius * 2 + 20} viewBox={`0 0 ${radarRadius * 2 + 20} ${radarRadius * 2 + 20}`}>
        {/* Background circles */}
        <circle cx={radarRadius + 10} cy={radarRadius + 10} r={radarRadius} fill="#001a1a" stroke="#0891b2" strokeWidth="1" />
        <circle cx={radarRadius + 10} cy={radarRadius + 10} r={radarRadius * 0.66} fill="none" stroke="#0891b2" strokeWidth="0.5" strokeDasharray="4 4" />
        <circle cx={radarRadius + 10} cy={radarRadius + 10} r={radarRadius * 0.33} fill="none" stroke="#0891b2" strokeWidth="0.5" strokeDasharray="4 4" />
        
        {/* Cross hairs */}
        <line x1={10} y1={radarRadius + 10} x2={radarRadius * 2 + 10} y2={radarRadius + 10} stroke="#0891b2" strokeWidth="0.5" />
        <line x1={radarRadius + 10} y1={10} x2={radarRadius + 10} y2={radarRadius * 2 + 10} stroke="#0891b2" strokeWidth="0.5" />
        
        {/* Player aircraft (center) */}
        <polygon
          points={`${radarRadius + 10},${radarRadius + 5} ${radarRadius + 7},${radarRadius + 15} ${radarRadius + 13},${radarRadius + 15}`}
          fill="#22d3ee"
        />
        
        {/* Traffic blips */}
        {traffic.slice(0, 10).map((t, i) => {
          const normalizedDist = Math.min(t.distance / maxDistance, 1);
          const rad = (t.bearing - 90) * Math.PI / 180;
          const x = radarRadius + 10 + Math.cos(rad) * normalizedDist * radarRadius;
          const y = radarRadius + 10 + Math.sin(rad) * normalizedDist * radarRadius;
          
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#fbbf24" />
              <text
                x={x}
                y={y - 6}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="6"
              >
                {t.callsign.slice(-4)}
              </text>
            </g>
          );
        })}
        
        {/* Range label */}
        <text x={radarRadius + 10} y={radarRadius * 2 + 18} textAnchor="middle" fill="#6b7280" fontSize="8">
          15nm
        </text>
      </svg>
    </div>
  );
}
