
import React from 'react';
import { PipeData, GameConfig } from '../types';

interface PipeProps {
  data: PipeData;
  config: GameConfig;
}

const Pipe: React.FC<PipeProps> = ({ data, config }) => {
  const bottomPipeHeight = config.height - data.topHeight - data.gap;

  return (
    <div className="absolute top-0 h-full" style={{ left: data.x, width: config.pipeWidth }}>
      {/* Top Pipe */}
      <div 
        className="absolute top-0 w-full bg-emerald-500 border-x-[6px] border-b-[6px] border-slate-950 rounded-b-2xl shadow-[0_8px_15px_rgba(0,0,0,0.5)]"
        style={{ height: data.topHeight }}
      >
        <div className="absolute bottom-0 w-[calc(100%+16px)] left-[-8px] h-12 border-[6px] border-slate-950 bg-emerald-400 rounded-xl shadow-lg" />
        {/* Subtle Stripe */}
        <div className="absolute top-0 left-2 w-2 h-full bg-white/10" />
      </div>

      {/* Bottom Pipe */}
      <div 
        className="absolute bottom-0 w-full bg-emerald-500 border-x-[6px] border-t-[6px] border-slate-950 rounded-t-2xl shadow-[0_-8px_15px_rgba(0,0,0,0.5)]"
        style={{ height: bottomPipeHeight }}
      >
        <div className="absolute top-0 w-[calc(100%+16px)] left-[-8px] h-12 border-[6px] border-slate-950 bg-emerald-400 rounded-xl shadow-lg" />
        <div className="absolute top-0 left-2 w-2 h-full bg-white/10" />
      </div>
    </div>
  );
};

export default Pipe;
