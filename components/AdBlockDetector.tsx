import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

const AdBlockDetector: React.FC = () => {
  const [adBlockDetected, setAdBlockDetected] = useState(false);

  useEffect(() => {
    // 1. Create a bait element
    const bait = document.createElement('div');
    bait.innerHTML = '&nbsp;';
    bait.className = 'adsbox pub_300x250 ad-banner';
    bait.style.position = 'absolute'; 
    bait.style.top = '-1000px'; 
    bait.style.left = '-1000px';
    document.body.appendChild(bait);

    // 2. Check if it was blocked/hidden
    const checkAdBlock = () => {
      if (
        document.body.getAttribute('abp') !== null ||
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.offsetLeft === 0 ||
        bait.offsetWidth === 0 ||
        bait.clientHeight === 0 ||
        bait.clientWidth === 0
      ) {
        setAdBlockDetected(true);
      }
      // Cleanup
      if (document.body.contains(bait)) {
        document.body.removeChild(bait);
      }
    };

    // Small delay to allow adblocker to act
    const timer = setTimeout(checkAdBlock, 200);

    return () => clearTimeout(timer);
  }, []);

  if (!adBlockDetected) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-orange-950/20 border-2 border-orange-500/50 p-8 rounded-[2rem] text-center shadow-[0_0_50px_rgba(249,115,22,0.2)]">
        <div className="bg-orange-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-orange-500" />
        </div>
        <h3 className="text-2xl font-game text-white mb-4">ADBLOCK DETECTED</h3>
        <p className="text-orange-200/60 text-sm leading-relaxed mb-8">
          We need ad revenue to keep the servers running and the roasts fresh. 
          Please disable your ad blocker to play NoseRoast.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-4 rounded-xl hover:scale-105 transition-transform"
        >
          Check Again
        </button>
      </div>
    </div>
  );
};

export default AdBlockDetector;
