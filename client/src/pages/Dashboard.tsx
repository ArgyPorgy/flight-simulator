import { useState } from "react";
import { useMe } from "@/hooks/use-auth";
import { useAgents } from "@/hooks/use-agents";
import { LoginOverlay } from "@/components/auth/LoginOverlay";
import { FlightSidebar } from "@/components/sidebar/FlightSidebar";
import { RadarMap } from "@/components/map/RadarMap";

export default function Dashboard() {
  const { data: user, isLoading: isAuthLoading } = useMe();
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center scanlines">
        <div className="text-primary font-mono animate-pulse">INITIALIZING SECURE LINK...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background scanlines relative">
      {/* Show Auth Overlay if not authenticated */}
      {!user && <LoginOverlay />}

      {/* Main UI Layout */}
      <FlightSidebar 
        agents={agents} 
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
      />
      
      <RadarMap 
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
      />
      
      {/* Full screen scanline effect handled globally by CSS, but we ensure it covers the app */}
    </div>
  );
}
