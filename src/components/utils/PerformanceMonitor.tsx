'use client';

import { useEffect } from 'react';

interface PerformanceMonitorProps {
  componentName: string;
  threshold?: number; // milliseconds
}

export function PerformanceMonitor({ componentName, threshold = 16 }: PerformanceMonitorProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    const startTime = performance.now();
    
    // Measure after paint
    requestAnimationFrame(() => {
      const renderTime = performance.now() - startTime;
      
      if (renderTime > threshold) {
        console.warn(`⚠️ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
      
      // Log to performance API
      if ('measure' in performance) {
        performance.measure(`${componentName}-render`, {
          start: startTime,
          end: performance.now(),
        });
      }
    });
    
    return () => {
      // Cleanup performance marks
      if ('clearMeasures' in performance) {
        performance.clearMeasures(`${componentName}-render`);
      }
    };
  }, [componentName, threshold]);
  
  return null;
}

// Hook version for easier usage
export function usePerformanceMonitor(componentName: string, threshold?: number) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > (threshold || 100)) {
        console.log(`📊 ${componentName} lifecycle duration: ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName, threshold]);
}