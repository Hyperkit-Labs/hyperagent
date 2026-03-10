"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

interface FlickeringGridProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(0, 0, 0)",
  width,
  height,
  className,
  maxOpacity = 0.3,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: width || containerRef.current.clientWidth,
          height: height || containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [width, height]);

  const memoizedColor = useMemo(() => {
    let colorStr = color;
    if (colorStr.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)) {
      colorStr = colorStr.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorStr);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
    }
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = containerSize.width;
    canvas.height = containerSize.height;

    const cols = Math.floor(canvas.width / (squareSize + gridGap));
    const rows = Math.floor(canvas.height / (squareSize + gridGap));

    const squares = new Float32Array(cols * rows);
    for (let i = 0; i < squares.length; i++) {
      squares[i] = Math.random() * maxOpacity;
    }

    let animationFrameId: number;
    let lastDrawTime = 0;

    const draw = (time: number) => {
      // Throttle to roughly ~30fps for the grid effect
      if (time - lastDrawTime > 50) {
        lastDrawTime = time;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const idx = i * rows + j;
            const opacity = squares[idx];
            
            if (Math.random() < flickerChance) {
              squares[idx] = Math.max(0, Math.min(maxOpacity, opacity + (Math.random() - 0.5) * 0.1));
            }

            ctx.fillStyle = `rgba(${memoizedColor[0]}, ${memoizedColor[1]}, ${memoizedColor[2]}, ${squares[idx]})`;
            ctx.fillRect(
              i * (squareSize + gridGap),
              j * (squareSize + gridGap),
              squareSize,
              squareSize
            );
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [containerSize, squareSize, gridGap, flickerChance, maxOpacity, memoizedColor]);

  return (
    <div ref={containerRef} className={`w-full h-full overflow-hidden ${className || ""}`}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          width: containerSize.width,
          height: containerSize.height,
        }}
      />
    </div>
  );
};
