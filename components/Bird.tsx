
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';

export interface BirdHandle {
  updatePosition: (y: number, rotation: number) => void;
}

const Bird = forwardRef<BirdHandle, {}>((_, ref) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    updatePosition: (y: number, rotation: number) => {
      if (elementRef.current) {
        // Use translate3d for GPU acceleration and better performance
        elementRef.current.style.transform = `translate3d(0, ${y}px, 0) rotate(${rotation}deg)`;
      }
    }
  }));

  return (
    <div
      ref={elementRef}
      className="absolute z-20"
      style={{
        left: 50,
        width: 44,
        height: 36,
        top: 0,
        willChange: 'transform',
      }}
    >
      <div className="relative w-full h-full bg-yellow-400 rounded-full border-[5px] border-slate-950 overflow-hidden shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
        {/* Eye */}
        <div className="absolute top-1 right-2 w-4 h-4 bg-white rounded-full border-[3px] border-slate-950">
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-black rounded-full" />
        </div>
        {/* Wing */}
        <div className="absolute bottom-1 left-1 w-6 h-5 bg-yellow-600 rounded-full border-[3px] border-slate-950" />
        {/* Beak */}
        <div className="absolute top-5 -right-1 w-5 h-4 bg-orange-500 rounded-sm border-[3px] border-slate-950" />
      </div>
    </div>
  );
});

Bird.displayName = 'Bird';

export default memo(Bird);
