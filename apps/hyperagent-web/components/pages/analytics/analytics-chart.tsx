import React, { useState, useRef } from 'react';

export const AnalyticsChart: React.FC = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    setMousePosition({ x, y: 0 });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // Calculate Y position on the VIOLET line based on X position
  // Path: M0,200 C150,180 300,220 450,140 C600,60 750,100 900,80 C1050,60 1200,120 1350,140
  const getYPositionOnLine = (x: number) => {
    if (!chartRef.current) return 0;
    const width = chartRef.current.offsetWidth;
    const height = chartRef.current.offsetHeight;
    
    // Normalize x to percentage
    const normalizedX = x / width;
    
    // Scale factor for the path (path is defined for ~1350px width)
    const pathX = normalizedX * 1350;
    
    let y = 200;
    
    // Bezier curve segments from the violet line path
    if (pathX <= 450) {
      // First segment: M0,200 C150,180 300,220 450,140
      const t = pathX / 450;
      const p0 = 200, p1 = 180, p2 = 220, p3 = 140;
      // Cubic bezier formula
      y = Math.pow(1-t, 3) * p0 + 
          3 * Math.pow(1-t, 2) * t * p1 + 
          3 * (1-t) * Math.pow(t, 2) * p2 + 
          Math.pow(t, 3) * p3;
    } else if (pathX <= 900) {
      // Second segment: C600,60 750,100 900,80
      const t = (pathX - 450) / 450;
      const p0 = 140, p1 = 60, p2 = 100, p3 = 80;
      y = Math.pow(1-t, 3) * p0 + 
          3 * Math.pow(1-t, 2) * t * p1 + 
          3 * (1-t) * Math.pow(t, 2) * p2 + 
          Math.pow(t, 3) * p3;
    } else {
      // Third segment: C1050,60 1200,120 1350,140
      const t = (pathX - 900) / 450;
      const p0 = 80, p1 = 60, p2 = 120, p3 = 140;
      y = Math.pow(1-t, 3) * p0 + 
          3 * Math.pow(1-t, 2) * t * p1 + 
          3 * (1-t) * Math.pow(t, 2) * p2 + 
          Math.pow(t, 3) * p3;
    }
    
    // Scale y to current height (path is defined for 256px height)
    const scaledY = (y / 256) * height;
    
    return scaledY;
  };

  const yPosition = getYPositionOnLine(mousePosition.x);

  // Calculate data point based on cursor position
  const getDataAtPosition = (x: number) => {
    const percentage = x / (chartRef.current?.offsetWidth || 1);
    const requests = Math.floor(3800 + Math.random() * 800);
    const latency = Math.floor(100 + Math.random() * 60);
    return { requests, latency };
  };

  const data = getDataAtPosition(mousePosition.x);

  return (
    <div 
      ref={chartRef}
      className="relative h-64 w-full chart-container cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Grid Lines (Horizontal) */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        <div className="border-b border-white/[0.03] w-full h-0"></div>
        <div className="border-b border-white/[0.03] w-full h-0"></div>
        <div className="border-b border-white/[0.03] w-full h-0"></div>
        <div className="border-b border-white/[0.03] w-full h-0"></div>
        <div className="border-b border-white/[0.03] w-full h-0"></div>
      </div>

      {/* SVG Chart */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradientRequests" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area Fill */}
        <path 
          d="M0,200 C150,180 300,220 450,140 C600,60 750,100 900,80 C1050,60 1200,120 1350,140 V300 H0 Z" 
          fill="url(#gradientRequests)" 
          className="w-full" 
          vectorEffect="non-scaling-stroke"
        />

        {/* Line Path (Requests) - VIOLET LINE */}
        <path 
          d="M0,200 C150,180 300,220 450,140 C600,60 750,100 900,80 C1050,60 1200,120 1350,140" 
          fill="none" 
          stroke="#6366f1" 
          strokeWidth="2" 
          className="animate-draw" 
          vectorEffect="non-scaling-stroke"
        />
              
        {/* Dashed Line (Latency) */}
        <path 
          d="M0,220 C150,210 300,230 450,190 C600,180 750,170 900,190 C1050,200 1200,180 1350,190" 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="1.5" 
          strokeDasharray="4 4" 
          className="opacity-60" 
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Hover Tooltip (Follows Cursor on Violet Line) */}
      {isHovering && (
        <div 
          className="chart-tooltip absolute top-0 bottom-0 w-[1px] bg-white/20 pointer-events-none flex flex-col transition-opacity"
          style={{ left: `${mousePosition.x}px` }}
        >
          {/* Dot on the violet line */}
          <div 
            className="absolute w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-[#05050A]"
            style={{ 
              top: `${yPosition}px`,
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          ></div>
          
          {/* Tooltip card positioned above the dot */}
          <div 
            className="absolute bg-[#08080C] border border-white/10 rounded-lg p-3 shadow-xl backdrop-blur-xl z-10 w-40"
            style={{ 
              top: `${Math.max(10, yPosition - 70)}px`,
              left: mousePosition.x > (chartRef.current?.offsetWidth || 0) / 2 ? '-168px' : '16px'
            }}
          >
            <div className="text-[10px] text-slate-500 font-mono mb-2">Oct 24, 14:30</div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-300">Reqs</span>
              <span className="text-xs font-mono text-indigo-400">{data.requests.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-300">Lat</span>
              <span className="text-xs font-mono text-emerald-400">{data.latency}ms</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes draw-path {
          from { stroke-dashoffset: 2000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw {
          stroke-dasharray: 2000;
          animation: draw-path 2.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};