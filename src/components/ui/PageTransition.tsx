'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // Only transition if the pathname actually changed
    if (prevPathname.current !== pathname) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // Faster transition

      prevPathname.current = pathname;
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div
      className="page-transition"
      style={{
        opacity: isTransitioning ? 0.7 : 1,
        transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        // Ensure content is always interactive
        pointerEvents: 'auto',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}