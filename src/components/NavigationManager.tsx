import { useState, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Navigation, X, Clock, MapPin, LocateFixed } from 'lucide-react';

interface NavigationManagerProps {
  origin: string;
  destination: string;
  onCancel: () => void;
}

export function NavigationManager({ origin, destination, onCancel }: NavigationManagerProps) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const geometryLibrary = useMapsLibrary('geometry');
  
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();
  const [routeData, setRouteData] = useState<google.maps.DirectionsRoute | null>(null);
  
  const [ambulancePolyline, setAmbulancePolyline] = useState<google.maps.Polyline | null>(null);
  const [ambulanceMockPath, setAmbulanceMockPath] = useState<google.maps.LatLng[] | null>(null);
  const [hasIntersection, setHasIntersection] = useState(false);
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [carPosition, setCarPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [carHeading, setCarHeading] = useState<number>(0);
  const [ambulancePosition, setAmbulancePosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [ambulanceHeading, setAmbulanceHeading] = useState<number>(0);
  const [showAmbulancePath, setShowAmbulancePath] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [accidentLocation, setAccidentLocation] = useState<google.maps.LatLngLiteral | null>(null);

  
  const animationRef = useRef<number>();
  const geolocationWatchRef = useRef<number | null>(null);
  
  // Speed is now purely physics-based: Distance traveled per 50ms frame.
  // 1.2m per 50ms = 24 meters per second (~86 km/h)
  const speedRef = useRef<number>(1.2); 

  useEffect(() => {
    // When emergency starts, slam on the brakes to 0.15m per 50ms (3 meters per second / ~10 km/h)
    const handleEmergencyStart = () => { speedRef.current = 0.15; }; 
    // Go back to cruising speed when alert ends
    const handleEmergencyEnd = () => { speedRef.current = 1.2; };   
    
    window.addEventListener('emergencyActive', handleEmergencyStart);
    window.addEventListener('emergencyEnded', handleEmergencyEnd);
    return () => {
      window.removeEventListener('emergencyActive', handleEmergencyStart);
      window.removeEventListener('emergencyEnded', handleEmergencyEnd);
    };
  }, []);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    const service = new routesLibrary.DirectionsService();
    const renderer = new routesLibrary.DirectionsRenderer({ 
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeOpacity: 0.9,
        strokeWeight: 8,
      }
    });

    const ambPolyline = new google.maps.Polyline({
      map,
      path: [],
      strokeColor: '#ef4444',
      strokeOpacity: 0.0,
      strokeWeight: 6,
      zIndex: 50
    });

    setDirectionsService(service);
    setDirectionsRenderer(renderer);
    setAmbulancePolyline(ambPolyline);

    return () => {
      renderer.setMap(null);
      ambPolyline.setMap(null);
    };
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !ambulancePolyline || !origin || !destination || !geometryLibrary) return;

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    })
    .then(response => {
      directionsRenderer.setDirections(response);
      setRouteData(response.routes[0]);

      // Mock Ambulance Route Logic
      const userPath = response.routes[0].overview_path;
      if (userPath.length > 5 && geometryLibrary) {
        
        // Accident starts 350m behind the user's start point (shortened by 30%)
        const firstPoint = userPath[0];
        const secondPoint = userPath[1] || firstPoint;
        const startHeading = geometryLibrary.spherical.computeHeading(secondPoint, firstPoint); // heading backwards
        const mockAccident = geometryLibrary.spherical.computeOffset(firstPoint, 350, startHeading);
        
        // Hospital is 2km beyond the user's destination
        const lastPoint = userPath[userPath.length - 1];
        const secondToLast = userPath[userPath.length - 2] || firstPoint;
        const endHeading = geometryLibrary.spherical.computeHeading(secondToLast, lastPoint); // heading forwards
        const mockHospital = geometryLibrary.spherical.computeOffset(lastPoint, 2000, endHeading);

        const ambPath = [mockAccident, ...userPath, mockHospital];
        
        ambulancePolyline.setPath(ambPath);
        setAmbulanceMockPath(ambPath);
        setHasIntersection(true);

        setAccidentLocation({ lat: mockAccident.lat(), lng: mockAccident.lng() });
        setHospitalLocation({ lat: mockHospital.lat(), lng: mockHospital.lng() });
      }
    })
    .catch((err) => {
      console.error("Failed to fetch directions", err);
      // alert("Could not find a driving route. Please try typing more specific city names or addresses!");
      onCancel();
    });
  }, [directionsService, directionsRenderer, ambulancePolyline, origin, destination, geometryLibrary]);

  useEffect(() => {
    if (ambulancePolyline) {
      ambulancePolyline.setOptions({ strokeOpacity: showAmbulancePath ? 0.8 : 0.0 });
    }
  }, [showAmbulancePath, ambulancePolyline]);

  useEffect(() => {
    // This useEffect is no longer needed as hasIntersection is set directly
    // and ambulanceRouteData is removed.
  }, []);

  const startNavigation = (isSimulated: boolean) => {
    if (!routeData || !map || !geometryLibrary) return;
    setIsNavigating(true);
    window.dispatchEvent(new Event('navigationStarted'));
    
    if (hasIntersection) {
      // Trigger ambulance approaching warning 3 seconds into the drive
      setTimeout(() => {
        window.dispatchEvent(new Event('ambulanceApproaching'));
      }, 3000);
    }
    
    // Hide default A/B markers inside the renderer during live nav
    directionsRenderer?.setOptions({ suppressMarkers: true });

    const path = routeData.overview_path;
    
    // Switch map to 3D driving view
    map.moveCamera({
      tilt: 60,
      zoom: 18,
    });

    let currentMapHeading = geometryLibrary.spherical.computeHeading(path[0], path[1]);

    if (isSimulated) {
      // 1. Precalculate distances for every node segment
      const segments: Array<{p1: google.maps.LatLng, p2: google.maps.LatLng, dist: number, cumulativeStart: number}> = [];
      let totalDist = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const d = geometryLibrary.spherical.computeDistanceBetween(path[i], path[i+1]);
        segments.push({ p1: path[i], p2: path[i+1], dist: d, cumulativeStart: totalDist });
        totalDist += d;
      }

      // Precalc for ambulance
      const ambSegments: Array<{p1: google.maps.LatLng, p2: google.maps.LatLng, dist: number, cumulativeStart: number}> = [];
      let totalAmbDist = 0;
      if (ambulanceMockPath) {
        const ambPath = ambulanceMockPath;
        for (let i = 0; i < ambPath.length - 1; i++) {
          const d = geometryLibrary.spherical.computeDistanceBetween(ambPath[i], ambPath[i+1]);
          ambSegments.push({ p1: ambPath[i], p2: ambPath[i+1], dist: d, cumulativeStart: totalAmbDist });
          totalAmbDist += d;
        }
      }

      let currentDistanceAlongPath = 0; 
      let currentAmbDist = 0;
      let hasDispatchedPassed = false;
      
      const simulateDrive = () => {
        // 2. Drive the car forward using the speed (distance) metric
        currentDistanceAlongPath += speedRef.current;

        // Drive ambulance forward faster
        if (ambulanceMockPath && currentAmbDist < totalAmbDist) {
            currentAmbDist += 2.0; // Fixed faster speed
            if (currentAmbDist >= totalAmbDist) {
               const lastP = ambulanceMockPath[ambulanceMockPath.length - 1];
               setAmbulancePosition({lat: lastP.lat(), lng: lastP.lng()});
            } else {
               const ambSegment = ambSegments.find(s => currentAmbDist >= s.cumulativeStart && currentAmbDist < s.cumulativeStart + s.dist) || ambSegments[ambSegments.length - 1];
               const overflowAmb = currentAmbDist - ambSegment.cumulativeStart;
               const fractionAmb = ambSegment.dist === 0 ? 0 : overflowAmb / ambSegment.dist;
               const currentAmbLatLng = geometryLibrary.spherical.interpolate(ambSegment.p1, ambSegment.p2, fractionAmb);
               const targetAmbHeading = geometryLibrary.spherical.computeHeading(ambSegment.p1, ambSegment.p2);
               setAmbulancePosition({ lat: currentAmbLatLng.lat(), lng: currentAmbLatLng.lng() });
               setAmbulanceHeading(targetAmbHeading);
            }
            
            // Check if ambulance has overtaken the car by at least 30 meters
            const ambRelativePos = currentAmbDist - 350; // started 350m behind
            if (!hasDispatchedPassed && ambRelativePos > currentDistanceAlongPath + 30) {
               hasDispatchedPassed = true;
               window.dispatchEvent(new Event('ambulancePassed'));
            }
        }

        if (currentDistanceAlongPath >= totalDist) {
          setIsNavigating(false);
          alert("You have reached your destination!");
          return;
        }
        
        // 3. Find exactly which road segment we are currently driving on
        const segment = segments.find(s => currentDistanceAlongPath >= s.cumulativeStart && currentDistanceAlongPath < s.cumulativeStart + s.dist) || segments[segments.length - 1];
        
        // 4. Linearly calculate the exact geographic point between the two segment nodes based on distance traveled
        const overflow = currentDistanceAlongPath - segment.cumulativeStart;
        const fraction = segment.dist === 0 ? 0 : overflow / segment.dist;
        
        const currentPosLatLng = geometryLibrary.spherical.interpolate(segment.p1, segment.p2, fraction);
        const targetHeading = geometryLibrary.spherical.computeHeading(segment.p1, segment.p2);
        
        // Smoothly interpolate the camera heading so it gracefully sweeps turns
        let headingDiff = targetHeading - currentMapHeading;
        if (headingDiff > 180) headingDiff -= 360;
        if (headingDiff < -180) headingDiff += 360;
        currentMapHeading += headingDiff * 0.08; // smooth turn by 8% per frame
        
        const pos = { lat: currentPosLatLng.lat(), lng: currentPosLatLng.lng() };
        
        setCarPosition(pos);
        setCarHeading(targetHeading);

        
        // Smoothly and constantly move camera
        map.moveCamera({
          center: pos,
          heading: currentMapHeading,
          tilt: 60,
          zoom: 19
        });
        
        // Lock frame rate to 20 updates per second
        animationRef.current = window.setTimeout(simulateDrive, 50);
      };

      simulateDrive();
      
    } else {
      // REAL-WORLD NAVIGATION
      if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser!");
        return;
      }

      let lastPos: google.maps.LatLngLiteral | null = null;
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
          let newHeading = currentMapHeading;
          
          if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
             newHeading = position.coords.heading;
          } else if (lastPos) {
             const prevLatLng = new google.maps.LatLng(lastPos.lat, lastPos.lng);
             const newLatLng = new google.maps.LatLng(newPos.lat, newPos.lng);
             const distMoved = geometryLibrary.spherical.computeDistanceBetween(prevLatLng, newLatLng);
             // Generate dynamic heading from previous plot point to current plot point if distance spans 1m+
             if (distMoved > 1) {
                newHeading = geometryLibrary.spherical.computeHeading(prevLatLng, newLatLng);
             }
          }
          lastPos = newPos;
          
          let headingDiff = newHeading - currentMapHeading;
          if (headingDiff > 180) headingDiff -= 360;
          if (headingDiff < -180) headingDiff += 360;
          currentMapHeading += headingDiff * 0.15; // Smooths jittery GPS jumps globally

          setCarPosition(newPos);
          setCarHeading(newHeading);

          
          map.moveCamera({
            center: newPos,
            heading: currentMapHeading,
            tilt: 60,
            zoom: 19
          });

          // End navigation check (closer than 30m)
          const dest = routeData.legs[0].end_location;
          const distToDest = geometryLibrary.spherical.computeDistanceBetween(
             new google.maps.LatLng(newPos.lat, newPos.lng), dest
          );
          
          if (distToDest < 30) {
             setIsNavigating(false);
             alert("You have reached your destination!");
             navigator.geolocation.clearWatch(watchId);
             geolocationWatchRef.current = null;
          }
        },
        (error) => console.warn("GPS tracking error: ", error.message),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      geolocationWatchRef.current = watchId;
    }
  };

  const stopNavigation = () => {
    if (animationRef.current) clearTimeout(animationRef.current);
    if (geolocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchRef.current);
      geolocationWatchRef.current = null;
    }
    setIsNavigating(false);
    
    // Reset camera to 2D
    map?.moveCamera({ tilt: 0, heading: 0, zoom: 13 });
    directionsRenderer?.setOptions({ suppressMarkers: false });
    
    // Reset view bounds to original route
    if (routeData && map) {
      map.fitBounds(routeData.bounds);
    }
    
    // Clear mock ambulance pos
    setAmbulancePosition(null);
  };

  return (
    <>
      {carPosition && isNavigating && (
        <AdvancedMarker position={carPosition} zIndex={100}>
          <div className="simulated-car" style={{ 
            transform: `rotate(${carHeading - (map?.getHeading() || 0)}deg)`,
            transition: 'transform 0.1s linear'
          }}>
            <div className="car-glow"></div>
            <svg 
              className="car-model" 
              viewBox="0 0 24 24" 
              width="48" 
              height="48" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Google Maps style navigation arrow pointing Up */}
              <path 
                d="M12 2L4 20l1.5 1.5L12 17l6.5 4.5L20 20z" 
                fill="#3b82f6" 
                stroke="#ffffff" 
                strokeWidth="1.5" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </AdvancedMarker>
      )}

      {/* Ambulance Marker */}
      {ambulancePosition && isNavigating && (
        <AdvancedMarker position={ambulancePosition} zIndex={110}>
          <div className="simulated-ambulance" style={{ 
            transform: `rotate(${ambulanceHeading - (map?.getHeading() || 0)}deg)`,
            transition: 'transform 0.05s linear'
          }}>
            <svg 
              viewBox="0 0 100 200" 
              width="36" 
              height="72" 
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.4))" }}
            >
              {/* Tires */}
              <rect x="8" y="30" width="12" height="30" fill="#1f2937" rx="4" />
              <rect x="80" y="30" width="12" height="30" fill="#1f2937" rx="4" />
              <rect x="8" y="140" width="12" height="30" fill="#1f2937" rx="4" />
              <rect x="80" y="140" width="12" height="30" fill="#1f2937" rx="4" />

              {/* Main Body */}
              <rect x="15" y="10" width="70" height="180" fill="#f8fafc" rx="12" />

              {/* Front Bumper hood area */}
              <rect x="20" y="15" width="60" height="25" fill="#e2e8f0" rx="8" />

              {/* Windshield */}
              <path d="M 22 45 Q 50 35 78 45 L 85 70 L 15 70 Z" fill="#334155" />

              {/* Rear Window */}
              <rect x="25" y="175" width="50" height="10" fill="#334155" rx="2" />

              {/* Roof Details / Box */}
              <rect x="20" y="75" width="60" height="95" fill="#f1f5f9" rx="6" stroke="#e2e8f0" strokeWidth="2" />

              {/* Red Cross */}
              <rect x="35" y="115" width="30" height="12" fill="#ef4444" />
              <rect x="44" y="106" width="12" height="30" fill="#ef4444" />

              {/* Flashing Sirens */}
              <rect x="22" y="12" width="20" height="6" fill="#ef4444" rx="2">
                 <animate attributeName="opacity" values="1;0;1" dur="0.5s" repeatCount="indefinite" />
              </rect>
              <rect x="58" y="12" width="20" height="6" fill="#3b82f6" rx="2">
                 <animate attributeName="opacity" values="0;1;0" dur="0.5s" repeatCount="indefinite" />
              </rect>
            </svg>
          </div>
        </AdvancedMarker>
      )}

      {/* Ambulance Route Endpoints */}
      {showAmbulancePath && accidentLocation && (
        <AdvancedMarker position={accidentLocation} zIndex={40}>
           <div style={{ fontSize: '20px', background: 'white', padding: '6px', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             ⚠️
           </div>
        </AdvancedMarker>
      )}

      {showAmbulancePath && hospitalLocation && (
        <AdvancedMarker position={hospitalLocation} zIndex={40}>
           <div style={{ fontSize: '20px', background: 'white', padding: '6px', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             🏥
           </div>
        </AdvancedMarker>
      )}

      {/* Pre-navigation preview modal */}
      {!isNavigating && routeData && (
        <div className="route-preview-panel slide-up">
          <div className="route-preview-header">
            <h3>Route Preview</h3>
            <button className="close-btn" onClick={onCancel}><X size={20}/></button>
          </div>
          
          <div className="route-metrics">
            <div className="metric">
              <Clock className="metric-icon" size={24} />
              <div className="metric-text">
                <span className="metric-value text-accent">{routeData.legs[0].duration?.text}</span>
                <span className="metric-label">Duration</span>
              </div>
            </div>
            <div className="metric">
              <MapPin className="metric-icon" size={24} />
              <div className="metric-text">
                <span className="metric-value">{routeData.legs[0].distance?.text}</span>
                <span className="metric-label">Distance</span>
              </div>
            </div>
          </div>
          
          <div className="simulation-options" style={{ padding: '0 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="show-amb-path"
              checked={showAmbulancePath} 
              onChange={(e) => setShowAmbulancePath(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ef4444' }}
            />
            <label htmlFor="show-amb-path" style={{ cursor: 'pointer', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
              Show Ambulance Tracking Path Layer
            </label>
          </div>

          <div className="nav-buttons">
            <button className="btn-primary w-full start-nav-btn" onClick={() => startNavigation(true)}>
              <Navigation size={20} fill="currentColor" /> 
              <span>Simulate Drive</span>
            </button>
            <button className="btn-primary w-full start-real-btn" onClick={() => startNavigation(false)}>
              <LocateFixed size={20} />
              <span>Real World Nav</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Active Navigation HUD */}
      {isNavigating && routeData && (
        <div className="active-nav-hud fade-in">
          <div className="nav-hud-top">
            <Navigation className="nav-direction-icon" style={{ transform: 'rotate(45deg)' }} />
            <div className="nav-hud-instruction">
              <span className="nav-distance">Proceed</span>
              <h2 className="nav-street">{routeData.legs[0].steps[0]?.instructions?.replace(/<[^>]*>?/gm, '') || "Follow highlighted path"}</h2>
            </div>
          </div>
          <div className="nav-hud-bottom">
            <div className="nav-stats">
              <div className="stat-time-eta">
                <span className="stat-time">{routeData.legs[0].duration?.text}</span>
                <span className="stat-eta">ETA</span>
              </div>
              <span className="stat-dist">{routeData.legs[0].distance?.text} remaining</span>
            </div>
            <button className="btn-danger nav-exit-btn" onClick={stopNavigation}>
              <X size={24}/> End
            </button>
          </div>
        </div>
      )}
    </>
  );
}
