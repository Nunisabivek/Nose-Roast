
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';

export interface PipeHandle {
  updatePosition: (x: number) => void;
  setVisibility: (visible: boolean) => void;
  configure: (topHeight: number, gap: number, screenHeight: number, pipeWidth: number) => void;
}

interface PipeProps {
  pipeWidth: number;
}

const Pipe = forwardRef<PipeHandle, PipeProps>(({ pipeWidth }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topPipeRef = useRef<HTMLDivElement>(null);
  const bottomPipeRef = useRef<HTMLDivElement>(null);
  const topCapRef = useRef<HTMLDivElement>(null);
  const bottomCapRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    updatePosition: (x: number) => {
      if (containerRef.current) {
        // Use translate3d for GPU acceleration
        containerRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
      }
    },
    setVisibility: (visible: boolean) => {
      if (containerRef.current) {
        containerRef.current.style.display = visible ? 'block' : 'none';
      }
    },
    configure: (topHeight: number, gap: number, screenHeight: number, pipeWidthVal: number) => {
      // Calculate bottom pipe position and height
      const bottomPipeTop = topHeight + gap;
      const bottomPipeHeight = screenHeight - bottomPipeTop;

      // Set container dimensions
      if (containerRef.current) {
        containerRef.current.style.width = `${pipeWidthVal}px`;
        containerRef.current.style.height = `${screenHeight}px`;
      }

      // TOP PIPE: positioned at top, extends down to topHeight
      if (topPipeRef.current) {
        topPipeRef.current.style.position = 'absolute';
        topPipeRef.current.style.top = '0px';
        topPipeRef.current.style.left = '0px';
        topPipeRef.current.style.right = '0px';
        topPipeRef.current.style.height = `${topHeight}px`;
        topPipeRef.current.style.bottom = 'unset';
      }

      // BOTTOM PIPE: positioned below the gap, extends to bottom
      if (bottomPipeRef.current) {
        bottomPipeRef.current.style.position = 'absolute';
        bottomPipeRef.current.style.top = `${bottomPipeTop}px`;
        bottomPipeRef.current.style.left = '0px';
        bottomPipeRef.current.style.right = '0px';
        bottomPipeRef.current.style.height = `${bottomPipeHeight}px`;
        bottomPipeRef.current.style.bottom = 'unset';
      }

      // Caps visibility - only show if pipe has enough height for cap
      if (topCapRef.current) {
        topCapRef.current.style.display = topHeight > 40 ? 'block' : 'none';
      }
      if (bottomCapRef.current) {
        bottomCapRef.current.style.display = bottomPipeHeight > 40 ? 'block' : 'none';
      }
    }
  }));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: pipeWidth,
        height: '100%',
        willChange: 'transform',
        display: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Top Pipe - hangs from top */}
      <div
        ref={topPipeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 0, // Will be set by configure()
          backgroundColor: '#10b981', // emerald-500
          borderLeft: '4px solid #020617',
          borderRight: '4px solid #020617',
          borderBottom: '4px solid #020617',
          borderRadius: '0 0 12px 12px',
          boxSizing: 'border-box',
        }}
      >
        {/* Top pipe cap */}
        <div
          ref={topCapRef}
          style={{
            position: 'absolute',
            bottom: 0,
            left: -6,
            right: -6,
            height: 32,
            backgroundColor: '#34d399', // emerald-400
            border: '4px solid #020617',
            borderRadius: 8,
            display: 'none',
          }}
        />
      </div>

      {/* Bottom Pipe - rises from bottom */}
      <div
        ref={bottomPipeRef}
        style={{
          position: 'absolute',
          top: 0, // Will be set by configure()
          left: 0,
          right: 0,
          height: 0, // Will be set by configure()
          backgroundColor: '#10b981', // emerald-500
          borderLeft: '4px solid #020617',
          borderRight: '4px solid #020617',
          borderTop: '4px solid #020617',
          borderRadius: '12px 12px 0 0',
          boxSizing: 'border-box',
        }}
      >
        {/* Bottom pipe cap */}
        <div
          ref={bottomCapRef}
          style={{
            position: 'absolute',
            top: 0,
            left: -6,
            right: -6,
            height: 32,
            backgroundColor: '#34d399', // emerald-400
            border: '4px solid #020617',
            borderRadius: 8,
            display: 'none',
          }}
        />
      </div>
    </div>
  );
});

Pipe.displayName = 'Pipe';

export default memo(Pipe);
