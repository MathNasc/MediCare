import { useState, useEffect } from 'react';

export function useNetwork() {
  const [isOnline, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine);
      const onlineHandler = () => setOnline(true);
      const offlineHandler = () => setOnline(false);
      
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
      return () => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      };
    }
  }, []);

  return isOnline;
}
