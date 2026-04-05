import { useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';

export function AnimatedRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [animKey, setAnimKey] = useState(location.key);

  useEffect(() => {
    setAnimKey(location.key);
  }, [location.key]);

  return (
    <div
      key={animKey}
      className="animate-page-enter"
      style={{ minHeight: '100%' }}
    >
      {children}
    </div>
  );
}
