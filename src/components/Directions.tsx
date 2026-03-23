import { useState, useEffect } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface DirectionsProps {
  origin: string;
  destination: string;
}

export function Directions({ origin, destination }: DirectionsProps) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLibrary || !map) return;
    const service = new routesLibrary.DirectionsService();
    const renderer = new routesLibrary.DirectionsRenderer({ 
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 6,
      }
    });

    setDirectionsService(service);
    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) return;

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    })
    .then(response => {
      directionsRenderer.setDirections(response);
    })
    .catch((err) => {
      console.error("Failed to fetch directions", err);
      alert("Could not find a driving route. Please try typing more specific city names or addresses!");
    });
  }, [directionsService, directionsRenderer, origin, destination]);

  return null;
}
