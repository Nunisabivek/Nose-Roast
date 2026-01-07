
import React, { memo } from 'react';
import { PipeData, GameConfig } from '../types';

interface PipeProps {
  data: PipeData;
  config: GameConfig;
}

const Pipe: React.FC<PipeProps> = memo(({ data, config }) => {
  // Ensure minimum heights and valid gap
  const minPipeHeight = 40;
  const safeTopHeight = Math.max(minPipeHeight, data.topHeight);
  const safeGap = Math.max(100, data.gap); // Minimum 100px gap always
  const bottomPipeHeight = Math.max(minPipeHeight, config.height - safeTopHeight - safeGap);

  // Don't render if heights are invalid
  if (safeTopHeight <= 0 || bottomPipeHeight <= 0) {
    return null;
  }

  return (
    <div
      className="absolute top-0 h-full"
      style={{
        left: data.x,
        width: config.pipeWidth,
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    >
      {/* Top Pipe */}
      <div
        className="absolute top-0 w-full bg-emerald-500 border-x-4 border-b-4 border-slate-950 rounded-b-xl"
        style={{ height: safeTopHeight }}
      >
        {/* Pipe cap - only show if pipe is tall enough */}
        {safeTopHeight > 30 && (
          <div
            className="absolute bottom-0 w-[calc(100%+12px)] left-[-6px] h-8 border-4 border-slate-950 bg-emerald-400 rounded-lg"
          />
        )}
      </div>

      {/* Bottom Pipe */}
      <div
        className="absolute w-full bg-emerald-500 border-x-4 border-t-4 border-slate-950 rounded-t-xl"
        style={{
          bottom: 0,
          height: bottomPipeHeight
        }}
      >
        {/* Pipe cap - only show if pipe is tall enough */}
        {bottomPipeHeight > 30 && (
          <div
            className="absolute top-0 w-[calc(100%+12px)] left-[-6px] h-8 border-4 border-slate-950 bg-emerald-400 rounded-lg"
          />
        )}
      </div>
    </div>
  );
});

Pipe.displayName = 'Pipe';

export default Pipe;
