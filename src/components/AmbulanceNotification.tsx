import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function AmbulanceNotification() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleAmbulanceApproaching = () => setShow(true);
    const handleAmbulancePassed = () => {
      setShow(false);
      // Delay back to normal speed to safely pull back into traffic (4-second delay)
      setTimeout(() => {
        window.dispatchEvent(new Event('emergencyEnded'));
      }, 4000);
    };

    window.addEventListener('ambulanceApproaching', handleAmbulanceApproaching);
    window.addEventListener('ambulancePassed', handleAmbulancePassed);
    
    return () => {
      window.removeEventListener('ambulanceApproaching', handleAmbulanceApproaching);
      window.removeEventListener('ambulancePassed', handleAmbulancePassed);
    };
  }, []);

  // Handle dismiss
  const handleDismiss = () => {
    setShow(false);
    window.dispatchEvent(new Event('emergencyEnded'));
  };

  useEffect(() => {
    let timeout: number;
    if (show) {
      // 4 second realistic response delay before slowing down/pulling over
      timeout = window.setTimeout(() => {
        window.dispatchEvent(new Event('emergencyActive'));
      }, 4000);
    }
    return () => clearTimeout(timeout);
  }, [show]);

  if (!show) return null;

  return (
    <>
      <div className="global-emergency-border"></div>
      <div className="ambulance-notification slide-in">
        <div className="notification-content">
          <div className="icon-pulse-container">
            <div className="icon-pulse-ring"></div>
            <AlertTriangle color="#ef4444" size={32} className="alert-icon" />
          </div>
          <div className="notification-text">
            <h3>Emergency Vehicle Approaching</h3>
            <p>An ambulance is navigating near your route. Please pull over safely to clear the path.</p>
          </div>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss Alert">
            <X size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
