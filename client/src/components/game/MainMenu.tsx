import { useState } from 'react';
import { Plane, Settings, Trophy, LogOut } from 'lucide-react';

interface MainMenuProps {
  username: string;
  onStartGame: (aircraftType: string) => void;
  onLogout: () => void;
}

const AIRCRAFT_OPTIONS = [
  {
    id: 'fighter',
    name: 'F-16 Falcon',
    description: 'High-performance fighter jet. Fast and agile.',
    stats: { speed: 95, handling: 90, durability: 60 },
    color: '#3b82f6',
    image: '/F-16.jpg',
  },
  {
    id: 'commercial',
    name: 'Boeing 737',
    description: 'Commercial airliner. Stable and reliable.',
    stats: { speed: 50, handling: 40, durability: 90 },
    color: '#22c55e',
    image: '/boeing 737.jpeg',
  },
  {
    id: 'private',
    name: 'Cessna 172',
    description: 'Light aircraft. Perfect for beginners.',
    stats: { speed: 30, handling: 70, durability: 70 },
    color: '#f59e0b',
    image: '/cessna.jpg',
  },
  {
    id: 'stealth',
    name: 'B-2 Spirit',
    description: 'Stealth bomber. Slow but powerful.',
    stats: { speed: 60, handling: 50, durability: 85 },
    color: '#6366f1',
    image: '/b2spirit.jpg',
  },
];

export function MainMenu({ username, onStartGame, onLogout }: MainMenuProps) {
  const [selectedAircraft, setSelectedAircraft] = useState(AIRCRAFT_OPTIONS[0].id);
  const [showSettings, setShowSettings] = useState(false);

  const selected = AIRCRAFT_OPTIONS.find(a => a.id === selectedAircraft)!;

  return (
    <div className="min-h-screen bg-black relative overflow-y-auto">
      {/* Video background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        >
          <source src="/videoplayback.mp4" type="video/mp4" />
        </video>
        {/* Overlay for better text readability - neutral dark overlay */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl -bottom-32 -right-32 animate-pulse delay-1000" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 border-b border-violet-500/20">
        <div className="flex items-center gap-4">
          <img 
            src="/skynet.jpg" 
            alt="SKYNET Logo" 
            className="w-16 h-16 object-contain rounded-lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">SKYNET</h1>
            <p className="text-violet-400 text-sm font-mono">FLIGHT SIMULATOR</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-gray-400 text-sm">Welcome back,</p>
            <p className="text-white font-semibold">{username}</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto p-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Aircraft selection */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Plane className="w-5 h-5 text-violet-400" />
              SELECT AIRCRAFT
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {AIRCRAFT_OPTIONS.map((aircraft) => (
                <button
                  key={aircraft.id}
                  onClick={() => setSelectedAircraft(aircraft.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedAircraft === aircraft.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div 
                    className="w-full h-24 rounded-lg mb-3 flex items-center justify-center overflow-hidden bg-gray-900/50"
                    style={{ borderColor: aircraft.color + '30' }}
                  >
                    <img 
                      src={aircraft.image} 
                      alt={aircraft.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-white font-semibold">{aircraft.name}</h3>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                    {aircraft.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Aircraft details */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-violet-400" />
              AIRCRAFT SPECS
            </h2>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-6">
              {/* Aircraft preview */}
              <div 
                className="h-48 rounded-lg flex items-center justify-center relative overflow-hidden bg-gray-900/50"
                style={{ border: `2px solid ${selected.color}30` }}
              >
                <img 
                  src={selected.image} 
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at center, ${selected.color}40 0%, transparent 70%)`,
                  }}
                />
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <StatBar label="SPEED" value={selected.stats.speed} color={selected.color} />
                <StatBar label="HANDLING" value={selected.stats.handling} color={selected.color} />
                <StatBar label="DURABILITY" value={selected.stats.durability} color={selected.color} />
              </div>

              {/* Description */}
              <p className="text-gray-400">{selected.description}</p>
            </div>

            {/* Start button */}
            <button
              onClick={() => onStartGame(selectedAircraft)}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-500/25"
            >
              LAUNCH FLIGHT
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-12 grid grid-cols-4 gap-4">
          <QuickStat label="Total Flights" value="0" />
          <QuickStat label="Flight Hours" value="0h" />
          <QuickStat label="Distance Flown" value="0 nm" />
          <QuickStat label="Best Altitude" value="0 ft" />
        </div>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Graphics Quality</label>
                <select className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Sound Volume</label>
                <input 
                  type="range" 
                  className="w-full mt-1"
                  defaultValue={80}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-gray-400 text-sm">Show FPS</label>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${value}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  );
}
