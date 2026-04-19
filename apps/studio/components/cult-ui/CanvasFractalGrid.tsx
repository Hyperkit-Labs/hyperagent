"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientType {
  stops: GradientStop[];
  centerX: number;
  centerY: number;
}

export interface CanvasFractalGridProps {
  dotSize?: number;
  dotSpacing?: number;
  dotOpacity?: number;
  gradientAnimationDuration?: number;
  waveIntensity?: number;
  waveRadius?: number;
  gradients?: GradientType[];
  dotColor?: string;
  glowColor?: string;
  enableNoise?: boolean;
  noiseOpacity?: number;
  enableMouseGlow?: boolean;
  initialPerformance?: "low" | "medium" | "high";
  enableGradient?: boolean;
}

const NoiseSVG = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <filter id="noise">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves={3}
        stitchTiles="stitch"
      />
    </filter>
    <rect width="100%" height="100%" filter="url(#noise)" />
  </svg>
));

NoiseSVG.displayName = "NoiseSVG";

const NoiseOverlay: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay"
    style={{ opacity }}
  >
    <NoiseSVG />
  </div>
);

const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    isMobile: windowSize.width < 768,
    isTablet: windowSize.width >= 768 && windowSize.width < 1024,
    isDesktop: windowSize.width >= 1024,
  };
};

const usePerformance = (
  initialPerformance: "low" | "medium" | "high" = "medium",
) => {
  const [performance, setPerformance] = useState(initialPerformance);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameCount = 0;
    let lastTime = globalThis.performance.now();
    let framerId: number;

    const measureFps = (time: number) => {
      frameCount++;
      if (time - lastTime > 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }
      framerId = requestAnimationFrame(measureFps);
    };

    framerId = requestAnimationFrame(measureFps);

    return () => cancelAnimationFrame(framerId);
  }, []);

  useEffect(() => {
    if (fps < 30 && performance !== "low") {
      setPerformance("low");
    } else if (fps >= 30 && fps < 50 && performance !== "medium") {
      setPerformance("medium");
    } else if (fps >= 50 && performance !== "high") {
      setPerformance("high");
    }
  }, [fps, performance]);

  return { performance, fps };
};

const Gradient: React.FC<{
  gradients: GradientType[];
  animationDuration: number;
}> = React.memo(({ gradients, animationDuration }) => {
  const controls = useAnimation();

  useEffect(() => {
    const bg = gradients
      .map(
        (g) =>
          `radial-gradient(circle at ${g.centerX}% ${g.centerY}%, ${g.stops
            .map((s) => `${s.color} ${s.position}%`)
            .join(", ")})`,
      )
      .join(", ");

    void controls.start({
      background: bg,
      transition: {
        duration: animationDuration,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "linear",
      },
    });
  }, [controls, gradients, animationDuration]);

  return (
    <motion.div className="absolute inset-0 h-full w-full" animate={controls} />
  );
});

Gradient.displayName = "Gradient";

const DotCanvas: React.FC<{
  dotSize: number;
  dotSpacing: number;
  dotOpacity: number;
  waveIntensity: number;
  waveRadius: number;
  dotColor: string;
  glowColor: string;
  performance: "low" | "medium" | "high";
  mousePos: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}> = React.memo(
  ({
    dotSize,
    dotSpacing,
    dotOpacity,
    waveIntensity,
    waveRadius,
    dotColor,
    glowColor,
    performance,
    mousePos,
    containerRef,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    const drawDots = useCallback(
      (ctx: CanvasRenderingContext2D, time: number) => {
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);

        const performanceSettings = {
          low: { skip: 3 },
          medium: { skip: 2 },
          high: { skip: 1 },
        };

        const skip = performanceSettings[performance].skip;

        const cols = Math.ceil(width / dotSpacing);
        const rows = Math.ceil(height / dotSpacing);

        const centerX = mousePos.x * width;
        const centerY = mousePos.y * height;

        for (let i = 0; i < cols; i += skip) {
          for (let j = 0; j < rows; j += skip) {
            const x = i * dotSpacing;
            const y = j * dotSpacing;

            const distanceX = x - centerX;
            const distanceY = y - centerY;
            const distance = Math.sqrt(
              distanceX * distanceX + distanceY * distanceY,
            );

            let dotX = x;
            let dotY = y;

            if (distance < waveRadius) {
              const waveStrength = Math.pow(1 - distance / waveRadius, 2);
              const angle = Math.atan2(distanceY, distanceX);
              const waveOffset =
                Math.sin(distance * 0.05 - time * 0.005) *
                waveIntensity *
                waveStrength;
              dotX += Math.cos(angle) * waveOffset;
              dotY += Math.sin(angle) * waveOffset;

              const glowR = dotSize * (1 + waveStrength);
              const gradient = ctx.createRadialGradient(
                dotX,
                dotY,
                0,
                dotX,
                dotY,
                glowR,
              );
              gradient.addColorStop(
                0,
                glowColor.replace("1)", `${dotOpacity * (1 + waveStrength)})`),
              );
              gradient.addColorStop(1, glowColor.replace("1)", "0)"));
              ctx.fillStyle = gradient;
            } else {
              ctx.fillStyle = dotColor.replace("1)", `${dotOpacity})`);
            }

            ctx.beginPath();
            ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
      [
        dotSize,
        dotSpacing,
        dotOpacity,
        waveIntensity,
        waveRadius,
        dotColor,
        glowColor,
        performance,
        mousePos,
      ],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      const host = containerRef.current;
      if (!canvas || !host) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const resizeCanvas = () => {
        const r = host.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      };

      resizeCanvas();
      const ro = new ResizeObserver(resizeCanvas);
      ro.observe(host);

      let lastTime = 0;
      const animate = (time: number) => {
        if (time - lastTime > 16) {
          drawDots(ctx, time);
          lastTime = time;
        }
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        ro.disconnect();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [containerRef, drawDots]);

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full bg-transparent"
      />
    );
  },
);

DotCanvas.displayName = "DotCanvas";

const MouseGlow: React.FC<{
  glowColor: string;
  mousePos: { x: number; y: number };
}> = React.memo(({ glowColor, mousePos }) => (
  <>
    <div
      className="pointer-events-none absolute h-40 w-40 rounded-full"
      style={{
        background: `radial-gradient(circle, ${glowColor.replace("1)", "0.2)")} 0%, ${glowColor.replace("1)", "0)")} 70%)`,
        left: `${mousePos.x * 100}%`,
        top: `${mousePos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        filter: "blur(10px)",
      }}
    />
    <div
      className="pointer-events-none absolute h-20 w-20 rounded-full"
      style={{
        background: `radial-gradient(circle, ${glowColor.replace("1)", "0.4)")} 0%, ${glowColor.replace("1)", "0)")} 70%)`,
        left: `${mousePos.x * 100}%`,
        top: `${mousePos.y * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    />
  </>
));

MouseGlow.displayName = "MouseGlow";

const defaultGradients: GradientType[] = [
  {
    stops: [
      { color: "#4c1d95", position: 0 },
      { color: "#6366f1", position: 35 },
      { color: "transparent", position: 70 },
    ],
    centerX: 30,
    centerY: 40,
  },
  {
    stops: [
      { color: "#312e81", position: 0 },
      { color: "#7c3aed", position: 40 },
      { color: "transparent", position: 75 },
    ],
    centerX: 70,
    centerY: 55,
  },
];

export function CanvasFractalGrid({
  dotSize = 2,
  dotSpacing = 22,
  dotOpacity = 0.22,
  gradientAnimationDuration = 24,
  waveIntensity = 22,
  waveRadius = 180,
  gradients = defaultGradients,
  dotColor = "rgba(139, 92, 246, 0.9)",
  glowColor = "rgba(167, 139, 250, 1)",
  enableNoise = true,
  noiseOpacity = 0.04,
  enableMouseGlow = true,
  initialPerformance = "medium",
  enableGradient = false,
}: CanvasFractalGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet } = useResponsive();
  const { performance } = usePerformance(initialPerformance);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const host = containerRef.current;
    if (!host) return;
    const { left, top, width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const x = (event.clientX - left) / width;
    const y = (event.clientY - top) / height;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const responsiveDotSize = useMemo(() => {
    if (isMobile) return dotSize * 0.75;
    if (isTablet) return dotSize * 0.9;
    return dotSize;
  }, [isMobile, isTablet, dotSize]);

  const responsiveDotSpacing = useMemo(() => {
    if (isMobile) return dotSpacing * 1.35;
    if (isTablet) return dotSpacing * 1.15;
    return dotSpacing;
  }, [isMobile, isTablet, dotSpacing]);

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        key="canvas-fractal-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
      >
        {enableGradient && (
          <Gradient
            animationDuration={gradientAnimationDuration}
            gradients={gradients}
          />
        )}
        {enableGradient && (
          <motion.div
            className="absolute inset-0 h-full w-full"
            style={{
              background:
                "radial-gradient(circle, transparent, rgba(255,255,255,0.06))",
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              mixBlendMode: "overlay",
            }}
            animate={{
              backgroundPosition: `${mousePos.x * 100}% ${mousePos.y * 100}%`,
            }}
          />
        )}
        <DotCanvas
          containerRef={containerRef}
          dotColor={dotColor}
          dotOpacity={dotOpacity}
          dotSize={responsiveDotSize}
          dotSpacing={responsiveDotSpacing}
          glowColor={glowColor}
          mousePos={mousePos}
          performance={performance}
          waveIntensity={waveIntensity}
          waveRadius={waveRadius}
        />
        {enableNoise && <NoiseOverlay opacity={noiseOpacity} />}
        {enableMouseGlow && (
          <MouseGlow glowColor={glowColor} mousePos={mousePos} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default React.memo(CanvasFractalGrid);
