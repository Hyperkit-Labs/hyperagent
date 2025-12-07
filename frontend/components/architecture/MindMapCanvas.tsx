'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

export interface MindMapNode {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  position: { x: number; y: number };
  connections: string[];
  details?: {
    implementation?: string;
    status?: string;
    dependencies?: string[];
  };
}

interface MindMapCanvasProps {
  nodes: MindMapNode[];
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

export default function MindMapCanvas({ 
  nodes, 
  selectedNode, 
  onNodeSelect,
  hoveredNodeId: externalHoveredNode,
  onNodeHover
}: MindMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [internalHoveredNode, setInternalHoveredNode] = useState<string | null>(null);
  
  // Use external hover state if provided, otherwise use internal
  const hoveredNode = externalHoveredNode !== undefined ? externalHoveredNode : internalHoveredNode;
  const setHoveredNode = onNodeHover || setInternalHoveredNode;
  
  // Virtual canvas size (larger than viewport for zoom/pan)
  const VIRTUAL_WIDTH = 2400;
  const VIRTUAL_HEIGHT = 1600;
  
  // Zoom and pan state
  const scale = useMotionValue(0.5);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        setDimensions({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize zoom to fit canvas
  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      const scaleX = dimensions.width / VIRTUAL_WIDTH;
      const scaleY = dimensions.height / VIRTUAL_HEIGHT;
      const initialScale = Math.min(scaleX, scaleY) * 0.8; // 80% to show some padding
      scale.set(initialScale);
      x.set((dimensions.width - VIRTUAL_WIDTH * initialScale) / 2);
      y.set((dimensions.height - VIRTUAL_HEIGHT * initialScale) / 2);
    }
  }, [dimensions, scale, x, y]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    scale.set(Math.min(scale.get() * 1.2, 2));
  }, [scale]);

  const handleZoomOut = useCallback(() => {
    scale.set(Math.max(scale.get() / 1.2, 0.2));
  }, [scale]);

  const handleReset = useCallback(() => {
    if (dimensions.width && dimensions.height) {
      const scaleX = dimensions.width / VIRTUAL_WIDTH;
      const scaleY = dimensions.height / VIRTUAL_HEIGHT;
      const initialScale = Math.min(scaleX, scaleY) * 0.8;
      scale.set(initialScale);
      x.set((dimensions.width - VIRTUAL_WIDTH * initialScale) / 2);
      y.set((dimensions.height - VIRTUAL_HEIGHT * initialScale) / 2);
    }
  }, [dimensions, scale, x, y]);

  const handleFitToScreen = useCallback(() => {
    if (dimensions.width && dimensions.height) {
      const scaleX = dimensions.width / VIRTUAL_WIDTH;
      const scaleY = dimensions.height / VIRTUAL_HEIGHT;
      const fitScale = Math.min(scaleX, scaleY) * 0.95;
      scale.set(fitScale);
      x.set((dimensions.width - VIRTUAL_WIDTH * fitScale) / 2);
      y.set((dimensions.height - VIRTUAL_HEIGHT * fitScale) / 2);
    }
  }, [dimensions, scale, x, y]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - x.get(), y: e.clientY - y.get() });
    }
  }, [x, y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      x.set(e.clientX - dragStart.x);
      y.set(e.clientY - dragStart.y);
    }
  }, [isDragging, dragStart, x, y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(2, scale.get() * delta));
    scale.set(newScale);
  }, [scale]);

  // Calculate actual positions based on virtual canvas size
  // Simple linear mapping: 0-100 position values map directly to virtual canvas
  const getNodePosition = (node: MindMapNode) => {
    // Map 0-100 to virtual canvas coordinates (2400x1600)
    const paddingX = 150; // Side padding on virtual canvas
    const paddingY = 150; // Top padding on virtual canvas
    const availableWidth = VIRTUAL_WIDTH - (paddingX * 2);
    const availableHeight = VIRTUAL_HEIGHT - (paddingY * 2);
    
    // Linear mapping: position.x/y (0-100) maps directly to virtual canvas area
    const x = paddingX + (node.position.x / 100) * availableWidth;
    const y = paddingY + (node.position.y / 100) * availableHeight;
    
    return { x, y };
  };

  // Get connection line path - connects from node center to node center
  // Uses precise Bezier curves like React Flow's getStraightPath/getBezierPath
  const getConnectionPath = (from: MindMapNode, to: MindMapNode) => {
    const fromPos = getNodePosition(from);
    const toPos = getNodePosition(to);
    
    // Node centers (since we use transform: translate(-50%, -50%))
    const sourceX = fromPos.x;
    const sourceY = fromPos.y;
    const targetX = toPos.x;
    const targetY = toPos.y;
    
    // Calculate distance and angle
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Icon radius for edge connection (64px / 2 = 32px)
    const iconRadius = 32;
    const angle = Math.atan2(dy, dx);
    
    // Connection points at icon edges (not center, but edge)
    const startX = sourceX + Math.cos(angle) * iconRadius;
    const startY = sourceY + Math.sin(angle) * iconRadius;
    const endX = targetX - Math.cos(angle) * iconRadius;
    const endY = targetY - Math.sin(angle) * iconRadius;
    
    // Calculate control points for smooth bezier curve
    // Use similar approach to React Flow's bezier path
    const curvature = Math.min(distance * 0.2, 60);
    const controlX1 = startX + (endX - startX) / 3;
    const controlY1 = startY + (endY - startY) / 3 + curvature;
    const controlX2 = endX - (endX - startX) / 3;
    const controlY2 = endY - (endY - startY) / 3 - curvature;
    
    // Cubic bezier path: M start, C control1, control2, end
    return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
  };

  // Get all connections using node IDs for accurate matching
  const connections = nodes.flatMap((node) =>
    node.connections
      .map((connId) => {
        // Use node ID to find the target node (ensures exact matching)
        const targetNode = nodes.find((n) => n.id === connId);
        if (!targetNode) {
          console.warn(`Connection target not found: ${connId} from node ${node.id}`);
          return null;
        }
        return { from: node, to: targetNode, fromId: node.id, toId: targetNode.id };
      })
      .filter((conn): conn is { from: MindMapNode; to: MindMapNode; fromId: string; toId: string } => conn !== null)
  );

  // Filter visible connections based on selection and hover state
  // Show all connections when nothing is selected/hovered
  // Show only connections to/from selected/hovered node when active
  const visibleConnections = connections.filter((conn) => {
    if (selectedNode) {
      return conn.from.id === selectedNode || conn.to.id === selectedNode;
    }
    if (hoveredNode) {
      return conn.from.id === hoveredNode || conn.to.id === hoveredNode;
    }
    return true; // Show all connections by default
  });

  const smoothScale = useSpring(scale, { stiffness: 300, damping: 30 });
  const smoothX = useSpring(x, { stiffness: 300, damping: 30 });
  const smoothY = useSpring(y, { stiffness: 300, damping: 30 });

  return (
    <div 
      ref={canvasRef} 
      className="w-full h-full relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Radial glow effects (fixed to viewport) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(139,92,246,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />
      
      {/* Virtual canvas container with zoom/pan transform */}
      <motion.div
        ref={containerRef}
        className="absolute"
        style={{
          width: VIRTUAL_WIDTH,
          height: VIRTUAL_HEIGHT,
          x: smoothX,
          y: smoothY,
          scale: smoothScale,
          transformOrigin: '0 0',
        }}
      >
        {/* Infinite grid background (inside virtual canvas) */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(to right, #475569 1px, transparent 1px), linear-gradient(to bottom, #475569 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            width: VIRTUAL_WIDTH,
            height: VIRTUAL_HEIGHT,
          }}
        />
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1, width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }}>
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="connectionGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow-line">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#8b5cf6" opacity="0.6" />
          </marker>
        </defs>
        {visibleConnections.map((conn, index) => {
          const path = getConnectionPath(conn.from, conn.to);
          const isHighlighted =
            selectedNode === conn.from.id ||
            selectedNode === conn.to.id ||
            hoveredNode === conn.from.id ||
            hoveredNode === conn.to.id;

          return (
            <g key={`${conn.from.id}-${conn.to.id}-${index}`}>
              {/* Glow effect for highlighted connections */}
              {isHighlighted && (
                <motion.path
                  d={path}
                  stroke="url(#connectionGradientActive)"
                  strokeWidth="4"
                  fill="none"
                  opacity={0.3}
                  filter="url(#glow-line)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.3 }}
                  transition={{ duration: 0.8, delay: index * 0.02 }}
                />
              )}
              {/* Main connection line */}
              <motion.path
                d={path}
                stroke={isHighlighted ? "url(#connectionGradientActive)" : "url(#connectionGradient)"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                fill="none"
                strokeDasharray={isHighlighted ? '0' : '4,4'}
                markerEnd={isHighlighted ? "url(#arrowhead)" : undefined}
                filter={isHighlighted ? "url(#glow-line)" : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: 1, 
                  opacity: isHighlighted ? 1 : 0.3,
                  strokeDashoffset: isHighlighted ? 0 : [0, -8]
                }}
                transition={{ 
                  pathLength: { duration: 0.8, delay: index * 0.02 },
                  opacity: { duration: 0.3 },
                  strokeDashoffset: { duration: 2, repeat: Infinity, ease: "linear" }
                }}
              />
            </g>
          );
        })}
        </svg>

        {/* Nodes */}
        <div className="absolute inset-0" style={{ zIndex: 2, width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }}>
        {nodes.map((node) => {
          const position = getNodePosition(node);
          const isSelected = selectedNode === node.id;
          const isHovered = hoveredNode === node.id;
          const NodeIcon = node.icon;

          const getGradientClass = (color: string) => {
            const colorMap: Record<string, string> = {
              blue: 'bg-gradient-to-br from-blue-500 to-cyan-500',
              purple: 'bg-gradient-to-br from-purple-500 to-pink-500',
              green: 'bg-gradient-to-br from-green-500 to-emerald-500',
              orange: 'bg-gradient-to-br from-orange-500 to-red-500',
              indigo: 'bg-gradient-to-br from-indigo-500 to-blue-500',
              pink: 'bg-gradient-to-br from-pink-500 to-rose-500',
            };
            return colorMap[color] || 'bg-gradient-to-br from-gray-500 to-gray-600';
          };

          return (
            <motion.div
              key={node.id}
              id={`node-${node.id}`}
              data-node-id={node.id}
              className="absolute cursor-pointer z-10"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{
                scale: isSelected ? 1.15 : isHovered ? 1.1 : 1,
                opacity: 1,
                y: 0,
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 20,
                delay: nodes.indexOf(node) * 0.03
              }}
              onMouseEnter={() => {
                setHoveredNode(node.id);
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
              }}
              onClick={() => onNodeSelect(isSelected ? null : node.id)}
            >
              <div className="relative flex flex-col items-center gap-2.5">
                {/* Glow effect for selected/hovered nodes */}
                {(isSelected || isHovered) && (
                  <motion.div
                    className="absolute inset-0 rounded-xl blur-xl"
                    style={{
                      background: isSelected 
                        ? 'radial-gradient(circle, rgba(139, 92, 246, 0.6), transparent 70%)'
                        : 'radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent 70%)',
                    }}
                    animate={{
                      scale: isSelected ? [1, 1.2, 1] : 1,
                      opacity: isSelected ? [0.6, 0.8, 0.6] : 0.3,
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                
                {/* Node icon container - Glass card styling with category gradients */}
                <motion.div
                  className={`relative ${getGradientClass(node.color)} rounded-xl border-2 backdrop-blur-md w-16 h-16 flex items-center justify-center ${
                    isSelected 
                      ? 'border-white/50 shadow-[0_0_40px_rgba(139,92,246,0.8)] bg-opacity-90' 
                      : isHovered
                      ? 'border-white/30 shadow-[0_0_25px_rgba(139,92,246,0.5)] bg-opacity-80'
                      : 'border-white/20 shadow-lg bg-opacity-70'
                  } transition-all duration-300`}
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`,
                  }}
                  animate={{
                    boxShadow: isSelected 
                      ? '0 0 40px rgba(139, 92, 246, 0.8), 0 10px 30px rgba(0, 0, 0, 0.4)' 
                      : isHovered
                      ? '0 0 25px rgba(139, 92, 246, 0.5), 0 6px 18px rgba(0, 0, 0, 0.3)'
                      : '0 4px 12px rgba(0, 0, 0, 0.3)',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Inner glow gradient overlay */}
                  <motion.div
                    className={`absolute inset-0 rounded-xl bg-gradient-to-br ${getGradientClass(node.color)} opacity-0 ${
                      isSelected ? 'opacity-30' : isHovered ? 'opacity-15' : ''
                    } transition-opacity duration-300`}
                  />
                  <NodeIcon className="w-7 h-7 text-white relative z-10 drop-shadow-lg" />
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      <motion.div
                        className="w-2 h-2 bg-violet-600 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                  )}
                </motion.div>
                
                {/* Node label */}
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ 
                    opacity: isSelected || isHovered ? 1 : 0.9,
                    y: 0 
                  }}
                  className="px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg"
                >
                  <div className={`text-[10px] font-medium tracking-wide text-center max-w-[200px] leading-tight ${
                    isSelected ? 'text-white' : isHovered ? 'text-slate-200' : 'text-slate-400'
                  } transition-colors`}>
                    <div className="break-words whitespace-nowrap">
                      {node.label}
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
        </div>
      </motion.div>

      {/* Zoom/Pan Controls */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-xl rounded-xl p-2 shadow-xl border border-white/10 z-30 flex flex-col gap-2"
      >
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-slate-300" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-slate-300" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4 text-slate-300" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
        </button>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-6 left-6 bg-slate-900/80 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-white/10 text-xs z-20"
      >
        <div className="font-semibold text-slate-200 mb-3 text-sm">Legend</div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
            <span className="text-slate-400">Active</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-slate-600"></div>
            <span className="text-slate-400">Inactive</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 font-mono mt-3 pt-3 border-t border-white/5">
          HOVER TO HIGHLIGHT • CLICK TO SELECT • DRAG TO PAN • SCROLL TO ZOOM
        </p>
      </motion.div>
    </div>
  );
}

