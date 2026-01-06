import { useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableTabsContainerProps {
  children: React.ReactNode;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  totalTabs: number;
  className?: string;
}

export function SwipeableTabsContainer({
  children,
  activeIndex,
  onIndexChange,
  totalTabs,
  className,
}: SwipeableTabsContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const threshold = 80;
  const verticalThreshold = 30;

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = null;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!touchStartX.current || !touchStartY.current) return;
    
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    
    // Check if vertical scroll is intended
    const deltaY = Math.abs(currentY - touchStartY.current);
    const deltaX = Math.abs(currentX - touchStartX.current);
    
    // If scrolling more vertically, ignore horizontal swipe
    if (deltaY > verticalThreshold && deltaY > deltaX) {
      setIsDragging(false);
      return;
    }
    
    touchEndX.current = currentX;
    
    // Calculate drag offset for visual feedback
    const distance = currentX - touchStartX.current;
    
    // Apply resistance at edges
    let adjustedDistance = distance;
    if ((activeIndex === 0 && distance > 0) || (activeIndex === totalTabs - 1 && distance < 0)) {
      adjustedDistance = distance * 0.3; // Reduced movement at edges
    }
    
    setDragOffset(adjustedDistance);
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !isDragging) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const isSwipe = Math.abs(distance) > threshold;

    if (isSwipe) {
      if (distance > 0 && activeIndex < totalTabs - 1) {
        // Swiped left - go to next tab
        onIndexChange(activeIndex + 1);
      } else if (distance < 0 && activeIndex > 0) {
        // Swiped right - go to previous tab
        onIndexChange(activeIndex - 1);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn("overflow-hidden", className)}
      style={{
        transform: isDragging ? `translateX(${dragOffset * 0.3}px)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      {children}
    </div>
  );
}
