import React, { useState, useEffect } from 'react';
import { getMetrics } from '@/lib/api';

interface NetworkData {
  name: string;
  percentage: number;
  color: string;
  count: number;
}

const networkColors = [
  'bg-indigo-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
];

const networkColorClasses = [
  'text-indigo-500',
  'text-purple-500',
  'text-emerald-500',
  'text-amber-500',
  'text-pink-500',
];

export const AnalyticsNetworkDistribution: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkData[]>([]);
  const [totalDeployments, setTotalDeployments] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNetworkData = async () => {
      try {
        const metrics = await getMetrics();
        
        if (metrics && metrics.deployments && metrics.deployments.by_network) {
          const networkData = metrics.deployments.by_network;
          const total = metrics.deployments.total || 0;
          
          // Convert to array and sort by count
          const networkArray = Object.entries(networkData)
            .map(([name, count]) => ({
              name: name.replace(/-/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              count: count as number,
              percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
              color: '',
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          // Assign colors
          const networksWithColors = networkArray.map((network, index) => ({
            ...network,
            color: networkColors[index % networkColors.length],
          }));

          setNetworks(networksWithColors);
          setTotalDeployments(total);
        }
      } catch (error) {
        console.error('Failed to fetch network distribution:', error);
        setNetworks([]);
        setTotalDeployments(0);
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkData();
    const interval = setInterval(fetchNetworkData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate cumulative dashoffsets for donut chart
  let cumulativeOffset = 0;
  const segments = networks.map((network, index) => {
    const segment = {
      ...network,
      dasharray: `${network.percentage}, 100`,
      dashoffset: -cumulativeOffset,
      colorClass: networkColorClasses[index % networkColorClasses.length],
    };
    cumulativeOffset += network.percentage;
    return segment;
  });

  return (
    <div 
      className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-6 flex flex-col animate-fade-in" 
      style={{ animationDelay: '300ms' }}
    >
      <h3 className="text-sm font-medium text-white mb-6">Traffic by Network</h3>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : networks.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-slate-400">No network data available</p>
        </div>
      ) : (
        <>
          <div className="relative w-40 h-40 mx-auto mb-8">
            <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
              {/* Circle Background */}
              <path 
                className="text-slate-800" 
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3.5"
              />
              {/* Dynamic Segments */}
              {segments.map((segment, index) => (
                <path 
                  key={index}
                  className={segment.colorClass}
                  strokeDasharray={segment.dasharray}
                  strokeDashoffset={segment.dashoffset}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3.5"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-semibold text-white">{totalDeployments}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total</span>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            {networks.map((network, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${network.color}`}></span>
                  <span className="text-slate-300">{network.name}</span>
                </div>
                <span className="font-mono text-slate-400">{network.percentage}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};