import { PlaneTakeoff, PlaneLanding, Navigation, Activity, Plus } from "lucide-react";
import { AircraftAgent } from "@shared/schema";
import { useSpawnAgents } from "@/hooks/use-agents";

interface FlightSidebarProps {
  agents: AircraftAgent[];
  selectedAgentId: number | null;
  onSelectAgent: (id: number) => void;
}

export function FlightSidebar({ agents, selectedAgentId, onSelectAgent }: FlightSidebarProps) {
  const spawnMutation = useSpawnAgents();

  const handleSpawn = () => {
    spawnMutation.mutate(5);
  };

  const activeCount = agents.length;
  const inAirCount = agents.filter(a => !['taxi', 'holding'].includes(a.status)).length;

  return (
    <div className="w-96 glass-panel border-y-0 border-l-0 flex flex-col h-full relative z-10">
      {/* Header */}
      <div className="p-4 border-b border-border bg-black/40 flex-shrink-0">
        <h2 className="text-xl font-display font-bold text-primary flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5" />
          Global Traffic Monitor
        </h2>
        
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-primary/10 border border-primary/30 p-2 rounded">
            <div className="text-muted-foreground">ACTIVE TRACKS</div>
            <div className="text-lg text-primary">{activeCount.toString().padStart(4, '0')}</div>
          </div>
          <div className="bg-accent/10 border border-accent/30 p-2 rounded">
            <div className="text-muted-foreground">AIRBORNE</div>
            <div className="text-lg text-accent">{inAirCount.toString().padStart(4, '0')}</div>
          </div>
        </div>

        <button
          onClick={handleSpawn}
          disabled={spawnMutation.isPending}
          className="mt-4 w-full py-2 bg-secondary hover:bg-secondary/80 border border-border text-primary hover:text-white transition-colors flex items-center justify-center gap-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {spawnMutation.isPending ? 'Spawning...' : 'Inject Traffic'}
        </button>
      </div>

      {/* Flight List */}
      <div className="flex-1 overflow-y-auto atc-scrollbar p-2 space-y-2">
        {agents.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono text-sm border border-dashed border-border mt-4 mx-2">
            NO RADAR CONTACTS
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`w-full text-left p-3 rounded border transition-all duration-200 ${
                selectedAgentId === agent.id
                  ? 'bg-accent/20 border-accent/50 shadow-[0_0_15px_rgba(255,176,0,0.2)]'
                  : 'bg-black/20 border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`font-display font-bold text-lg ${selectedAgentId === agent.id ? 'text-accent' : 'text-primary'}`}>
                  {agent.callsign}
                </span>
                <span className="font-mono text-xs bg-black/50 px-2 py-0.5 rounded text-muted-foreground border border-border">
                  {agent.model}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-1 font-mono text-xs">
                <div className="flex flex-col">
                  <span className="text-muted-foreground/60">ALT</span>
                  <span className="text-white">{Math.round(agent.altitude)} ft</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground/60">SPD</span>
                  <span className="text-white">{Math.round(agent.speed)} kt</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground/60">HDG</span>
                  <span className="text-white">{Math.round(agent.heading)}°</span>
                </div>
              </div>

              {agent.walletAddress && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    <span className="text-muted-foreground/60">WALLET</span>
                    <div className="text-primary mt-0.5 break-all">
                      {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1 uppercase">
                  {agent.status === 'takeoff' || agent.status === 'climb' ? (
                    <PlaneTakeoff className="w-3 h-3 text-primary" />
                  ) : agent.status === 'landing' || agent.status === 'descent' ? (
                    <PlaneLanding className="w-3 h-3 text-accent" />
                  ) : (
                    <Navigation className="w-3 h-3" />
                  )}
                  {agent.status}
                </div>
                <div className="flex gap-2">
                  <span>{agent.origin}</span>
                  <span>→</span>
                  <span>{agent.destination}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      
      {/* Footer Branding */}
      <div className="p-2 text-center text-[10px] font-mono text-muted-foreground/50 border-t border-border bg-black/40">
        SKYNET v1.0.4 // REAL-TIME MESH
      </div>
    </div>
  );
}
