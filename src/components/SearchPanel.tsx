import { useState } from 'react';
import { Search, Navigation, LocateFixed } from 'lucide-react';

interface SearchPanelProps {
  onRouteSelect: (origin: string, destination: string) => void;
}

export function SearchPanel({ onRouteSelect }: SearchPanelProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) {
      onRouteSelect(origin, destination);
    }
  };

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Google Directions accepts "lat,lng" format strings as origins!
          setOrigin(`${position.coords.latitude}, ${position.coords.longitude}`);
        },
        () => {
          alert("Could not access your location. Please check your browser's location permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="search-panel">
      <div className="search-header">
        <Navigation className="icon-main" />
        <h2>Plan Route</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="search-form">
        <div className="input-group">
          <div className="input-icon-wrapper">
            <div className="dot origin-dot"></div>
            <input 
              type="text" 
              value={origin} 
              onChange={e => setOrigin(e.target.value)} 
              placeholder="Start location (e.g. Bangkok)" 
              required
            />
            <button 
              type="button" 
              onClick={handleGetCurrentLocation}
              title="Use current location"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
            >
              <LocateFixed size={18} />
            </button>
          </div>
        </div>
        
        <div className="connector-line"></div>
        
        <div className="input-group">
          <div className="input-icon-wrapper">
            <div className="dot dest-dot"></div>
            <input 
              type="text" 
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              placeholder="Destination (e.g. Pattaya)" 
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary">
          <Search className="btn-icon" size={18} />
          <span>Get Directions</span>
        </button>
      </form>
    </div>
  );
}
