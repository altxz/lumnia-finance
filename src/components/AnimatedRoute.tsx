import { useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

export function AnimatedRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter');
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      setTransitionStage('exit');
    }
  }, [location.key]);

  useEffect(() => {
    if (transitionStage === 'exit') {
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('enter');
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [transitionStage, children]);

  // On first render or when children change without route change, update immediately
  useEffect(() => {
    if (transitionStage === 'enter') {
      setDisplayChildren(children);
    }
  }, [children, transitionStage]);

  return (
    <div
      className={
        transitionStage === 'enter'
          ? 'animate-page-enter'
          : 'animate-page-exit'
      }
      style={{ minHeight: '100%' }}
    >
      {displayChildren}
    </div>
  );
}
