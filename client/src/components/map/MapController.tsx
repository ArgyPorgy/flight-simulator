import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { AircraftAgent } from '@shared/schema';

interface MapControllerProps {
  selectedAgent: AircraftAgent | undefined;
}

export function MapController({ selectedAgent }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (selectedAgent) {
      // Pan to the selected aircraft smoothly
      map.flyTo([selectedAgent.lat, selectedAgent.lon], 7, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedAgent, map]);

  // Force map to recalculate size occasionally if UI layout changes
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}
