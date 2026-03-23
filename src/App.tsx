/// <reference types="vite/client" />
import { useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { SearchPanel } from './components/SearchPanel';
import { NavigationManager } from './components/NavigationManager';
import { EmergencyMarkers } from './components/EmergencyMarkers';
import { AmbulanceNotification } from './components/AmbulanceNotification';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export default function App() {
  const [route, setRoute] = useState<{ origin: string, destination: string } | null>(null);

  const handleRouteSelect = (origin: string, destination: string) => {
    setRoute({ origin, destination });
  };

  const handleCancelRoute = () => {
    setRoute(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Emergency Alert Navigation</h1>
      </header>
      
      <main className="map-container">
        {API_KEY ? (
          <APIProvider apiKey={API_KEY}>
            <Map 
              defaultCenter={{ lat: 13.7563, lng: 100.5018 }} // Bangkok center
              defaultZoom={13}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              mapId={MAP_ID}
              renderingType={"VECTOR"}
            >
              <EmergencyMarkers />
              {route && (
                <NavigationManager 
                  origin={route.origin} 
                  destination={route.destination} 
                  onCancel={handleCancelRoute}
                />
              )}
            </Map>
          </APIProvider>
        ) : (
          <div className="api-key-missing">
            <h2>API Key Required</h2>
            <p>Please add your Google Maps API key to the .env file as VITE_GOOGLE_MAPS_API_KEY.</p>
          </div>
        )}
      </main>

      {/* Only show search panel if no route is currently selected */}
      {!route && (
        <div className="overlay-panels fade-in">
          <SearchPanel onRouteSelect={handleRouteSelect} />
        </div>
      )}

      <AmbulanceNotification />
    </div>
  );
}
