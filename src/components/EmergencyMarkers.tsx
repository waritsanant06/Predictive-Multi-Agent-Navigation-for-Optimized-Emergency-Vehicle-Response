import { useState, useEffect } from 'react';
import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';

interface Incident {
  id: string | number;
  type: 'FIRE' | 'CRASH' | 'ACCIDENT' | 'CONSTRUCTION';
  lat: number;
  lng: number;
  title: string;
  description: string;
}

export function EmergencyMarkers() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // We are completely stripping Longdo since they block localhost endpoints.
  // Instead, we will directly hook into the Bangkok Governor's Public Grievance Database (Traffy Fondue)
  // which is completely open, live, and localized to your exact map coordinates!

  useEffect(() => {
    const fetchLiveIncidents = async () => {
      try {
        // Using the open Longdo Traffic JSON feed discovered via Python requests!
        // This endpoint bypasses Cloudflare checks natively and allows wildcard CORS.
        const response = await fetch("https://event.longdo.com/feed/json");
        const data = await response.json();
        
        console.log("🚨 RAW LIVE LONGDO EVENT DATA:", data);
        
        if (!Array.isArray(data)) throw new Error("Expected array from Longdo Feed");

        const liveThaiIncidents: Incident[] = data.map((item: any) => {
             // Safely parsing coordinates based on the Python structure provided
             const lat = parseFloat(item.latitude ?? item.lat);
             const lng = parseFloat(item.longitude ?? item.lon);
             
             let type: Incident['type'] = 'ACCIDENT';
             const desc = String(item.description || item.title || "").toLowerCase();
             
             // Dynamic Thai phrase AI categorization
             if (desc.includes('ไฟไหม้') || desc.includes('ควัน') || desc.includes('fire')) type = 'FIRE';
             else if (desc.includes('ชน') || desc.includes('อุบัติเหตุ') || desc.includes('รถติด')) type = 'CRASH';
             else if (desc.includes('ซ่อม') || desc.includes('ถนนพัง') || desc.includes('หลุม') || desc.includes('ทางเท้า')) type = 'CONSTRUCTION';

             return {
               id: item.eid || item.id || Math.random().toString(),
               type,
               lat,
               lng,
               // Shorten very long descriptions for the hover tooltip 
               title: item.description && item.description.length > 50 ? item.description.substring(0, 50) + "..." : item.description || "Traffic Event",
               // Pass full description down so it renders nicely in our new InfoWindow Bubble!
               description: item.description || "No description provided."
             };
        });

        const validIncidents = liveThaiIncidents.filter((inc) => !isNaN(inc.lat) && !isNaN(inc.lng));

        if (validIncidents.length > 0) {
           setIncidents(validIncidents);
        } else {
           setIncidents([]);
        }
      } catch (error) {
        console.error("❌ Live API connection failed:", error);
        setIncidents([]);
      }
    };

    fetchLiveIncidents();
    
    // Auto-poll the earthquake feed for brand new tremors every 60 seconds
    const intervalId = window.setInterval(fetchLiveIncidents, 60000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <>
      {incidents.map(event => (
        <AdvancedMarker 
          key={event.id} 
          position={{ lat: event.lat, lng: event.lng }} 
          title={event.title}
          onClick={() => setSelectedIncident(event)}
        >
          <div className={`event-marker marker-${event.type.toLowerCase()}`}>
            <div className="marker-pulse"></div>
            <span className="marker-emoji">
              {event.type === 'FIRE' ? '🔥' : event.type === 'CONSTRUCTION' ? '🚧' : '💥'}
            </span>
          </div>
        </AdvancedMarker>
      ))}

      {selectedIncident && (
        <InfoWindow
          position={{ lat: selectedIncident.lat, lng: selectedIncident.lng }}
          onCloseClick={() => setSelectedIncident(null)}
          headerContent={
            <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '14px', fontFamily: 'system-ui' }}>
              {selectedIncident.type === 'FIRE' ? '🔥 Fire Report' : 
               selectedIncident.type === 'CONSTRUCTION' ? '🚧 Road Issue' : '💥 Accident Report'}
            </div>
          }
        >
          <div style={{ padding: '0.25rem', maxWidth: '250px', fontSize: '13px', color: '#1e293b', lineHeight: '1.5', fontFamily: 'system-ui' }}>
            {selectedIncident.description}
          </div>
        </InfoWindow>
      )}
    </>
  );
}
