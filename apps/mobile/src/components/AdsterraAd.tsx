import React, { useEffect, useRef } from 'react';

interface AdsterraAdProps {
  id: string; // The Adsterra ad slot hash
  format: 'banner' | 'sidebar';
  width?: number;
  height?: number;
}

export const AdsterraAd: React.FC<AdsterraAdProps> = ({ id, format, width, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Clear container before loading a fresh ad
    containerRef.current.innerHTML = '';

    // If the hash is the default placeholder, show a sleek empty glass container with NO text overlays
    if (id === 'c4e5140d39bc15f8a0058b8f2762a4f6' || id === 'f69e6b45a0b9432f8b05da39b56f8a4e') {
      const isBanner = format === 'banner';
      containerRef.current.className = `w-full h-full rounded-2xl flex flex-col items-center justify-center shadow-lg transition-all ${
        isBanner 
          ? 'border border-orange-500/10 bg-orange-500/[0.02]' 
          : 'border border-indigo-500/10 bg-indigo-500/[0.02]'
      }`;
      containerRef.current.innerHTML = '';
      return;
    }

    // Configure Adsterra global options for invocation script
    const targetWidth = width || (format === 'banner' ? 728 : 160);
    const targetHeight = height || (format === 'banner' ? 90 : 600);

    const atOptions = {
      key: id,
      format: 'iframe',
      height: targetHeight,
      width: targetWidth,
      params: {},
    };

    // Assign options to window for invocation to pick up
    (window as any).atOptions = atOptions;

    // Create wrapper element with target size inside container
    const wrapper = document.createElement('div');
    wrapper.style.width = `${targetWidth}px`;
    wrapper.style.height = `${targetHeight}px`;
    wrapper.style.margin = '0 auto';
    wrapper.className = 'relative overflow-hidden flex items-center justify-center';
    containerRef.current.appendChild(wrapper);

    // Dynamic script injection
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//www.highperformanceformat.com/${id}/invoke.js`;
    script.async = true;

    wrapper.appendChild(script);

    return () => {
      // Clean up window settings on unmount
      if ((window as any).atOptions === atOptions) {
        delete (window as any).atOptions;
      }
    };
  }, [id, format, width, height]);

  const targetWidth = width || (format === 'banner' ? 728 : 160);
  const targetHeight = height || (format === 'banner' ? 90 : 600);

  return (
    <div
      ref={containerRef}
      style={{
        width: format === 'banner' ? '100%' : `${targetWidth}px`,
        height: `${targetHeight}px`,
        maxWidth: format === 'banner' ? `${targetWidth}px` : 'none',
      }}
      className="flex items-center justify-center overflow-hidden transition-all duration-300 mx-auto"
    />
  );
};

export default AdsterraAd;
