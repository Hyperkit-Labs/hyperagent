"use client";

import { useMemo, useEffect, useRef } from "react";
import anime from "animejs";

export interface NetworkNode {
  id: string;
  name?: string;
}

export interface NetworkTopologyMapProps {
  /** Central node label (e.g. "Contract", "Project"). */
  centralLabel: string;
  /** Networks to display around the center. */
  networks: NetworkNode[];
  /** Network IDs with detected vulnerabilities (lines drawn in red). */
  vulnerableNetworkIds?: string[];
  className?: string;
}

const RADIUS = 120;
const CENTER = 160;

export function NetworkTopologyMap({
  centralLabel,
  networks,
  vulnerableNetworkIds = [],
  className = "",
}: NetworkTopologyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const positions = useMemo(() => {
    const count = Math.max(1, networks.length);
    return networks.map((n, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      return {
        id: n.id,
        name: n.name ?? n.id,
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle),
      };
    });
  }, [networks]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Animate data packets (circles) along the paths
    const elements = containerRef.current.querySelectorAll('.data-packet');
    if (elements.length === 0) return;

    const animation = anime({
      targets: '.data-packet',
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: 'linear',
      duration: (el: Element, i: number) => 2000 + (i * 200),
      delay: (el: Element, i: number) => i * 400,
      loop: true,
      direction: 'normal'
    });

    return () => animation.pause();
  }, [positions]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        viewBox="0 0 320 320"
        className="w-full max-w-md mx-auto"
        aria-label="Network topology map"
      >
        <defs>
          <marker
            id="arrow-green"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="var(--color-semantic-success)" />
          </marker>
          <marker
            id="arrow-red"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="var(--color-semantic-error)" />
          </marker>
        </defs>

        {positions.map((pos) => {
          const isVulnerable = vulnerableNetworkIds.includes(pos.id);
          const stroke = isVulnerable ? "var(--color-semantic-error)" : "var(--color-border-default)";
          const marker = isVulnerable ? "url(#arrow-red)" : "url(#arrow-green)";

          return (
            <g key={`path-${pos.id}`}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={pos.x}
                y2={pos.y}
                stroke={stroke}
                strokeWidth={isVulnerable ? 2.5 : 1.5}
                strokeDasharray={isVulnerable ? "4 2" : undefined}
                markerEnd={marker}
              />
              <path
                className="data-packet opacity-50"
                d={`M ${CENTER} ${CENTER} L ${pos.x} ${pos.y}`}
                stroke={isVulnerable ? "var(--color-semantic-error)" : "var(--color-primary)"}
                strokeWidth="4"
                strokeDasharray="4 200"
                fill="none"
              />
            </g>
          );
        })}

        <g>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={36}
            className="fill-[var(--color-bg-panel)] stroke-[var(--color-border-default)]"
            strokeWidth="2"
          />
          <text
            x={CENTER}
            y={CENTER}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] font-medium fill-[var(--color-text-primary)]"
          >
            {centralLabel}
          </text>
        </g>

        {positions.map((pos) => (
          <g key={pos.id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={24}
              className="fill-[var(--color-bg-elevated)] stroke-[var(--color-border-subtle)]"
              strokeWidth="1.5"
            />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] font-medium fill-[var(--color-text-secondary)]"
            >
              {pos.name.length > 10 ? pos.name.slice(0, 8) + "…" : pos.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
