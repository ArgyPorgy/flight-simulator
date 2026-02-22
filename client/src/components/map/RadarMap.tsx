import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AircraftAgent } from '@shared/schema';
import { MapController } from './MapController';

interface RadarMapProps {
  agents: AircraftAgent[];
  selectedAgentId: number | null;
  onSelectAgent: (id: number) => void;
}

// Generate the SVG for the custom rotated aircraft marker
const createAircraftIcon = (heading: number, isSelected: boolean) => {
  const color = isSelected ? '#ffb000' : '#00f0ff'; // Amber vs Cyan
  const dropShadow = isSelected ? `filter: drop-shadow(0 0 4px ${color});` : '';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="#000" stroke-width="1.5" width="28" height="28" style="transform: rotate(${heading}deg); transform-origin: center; ${dropShadow}">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-.5-.5-2.5 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 4-4 4-2.8-.9c-.4-.1-.8.2-1 .6L1 17l4 2 2 4c.4.2.8-.2.7-.6L6.8 19.5l4-4 4 6c.4.2.8.2 1 .6L17 19.2z"/>
    </svg>
  `;
  
  return new L.DivIcon({
    html: svg,
    className: 'aircraft-marker', // Hooks into the 2s transition defined in index.css
    iconSize: [28, 28],
    iconAnchor: [14, 14], // Center of the 28x28 icon
    popupAnchor: [0, -14],
  });
};

export function RadarMap({ agents, selectedAgentId, onSelectAgent }: RadarMapProps) {
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="flex-1 h-full w-full relative z-0 bg-[#06090e]">
      {/* Radar sweeping overlay effect (purely visual) */}
      <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden opacity-20">
        <div className="absolute top-1/2 left-1/2 w-[200vw] h-[200vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
      </div>

      <MapContainer
        center={[39.8283, -98.5795]} // Center of US as default
        zoom={4}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <MapController selectedAgent={selectedAgent} />
        
        {/* CartoDB Dark Matter Tile Layer - highly suited for ATC aesthetic */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />

        {agents.map(agent => (
          <Marker
            key={agent.id}
            position={[agent.lat, agent.lon]}
            icon={createAircraftIcon(agent.heading, selectedAgentId === agent.id)}
            eventHandlers={{
              click: () => onSelectAgent(agent.id),
            }}
          >
            <Popup className="atc-popup">
              <div className="p-3 bg-black text-xs space-y-1 w-48">
                <div className="font-display text-base text-primary font-bold border-b border-primary/30 pb-1 mb-2">
                  {agent.callsign}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TYPE</span>
                  <span className="text-white">{agent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ALT</span>
                  <span className="text-white">{Math.round(agent.altitude)} FT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SPD</span>
                  <span className="text-white">{Math.round(agent.speed)} KT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HDG</span>
                  <span className="text-white">{Math.round(agent.heading)}°</span>
                </div>
                <div className="pt-2 mt-2 border-t border-primary/30 text-center text-accent uppercase">
                  {agent.status}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map Overlay Controls / Visuals */}
      <div className="absolute top-4 right-4 z-[400] pointer-events-none">
        <div className="glass-panel px-4 py-2 font-mono text-primary text-xs flex gap-4 border-primary/30">
          <span className="animate-pulse">● LIVE</span>
          <span>SYS_NORMAL</span>
        </div>
      </div>
    </div>
  );
}
