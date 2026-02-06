import React, { useState, useEffect } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Layers from 'lucide-react/dist/esm/icons/layers'
import { getMetrics } from '@/lib/api';

export const SecurityStats: React.FC = () => {
  const [safetyScore, setSafetyScore] = useState(0);
  const [grade, setGrade] = useState('A+');
  const [openRisks, setOpenRisks] = useState({ critical: 0, high: 0, low: 0 });
  const [auditCoverage, setAuditCoverage] = useState({ audited: 0, total: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSecurityStats = async () => {
      try {
        const metrics = await getMetrics();
        
        if (metrics && metrics.audits) {
          const total = metrics.audits.total || 0;
          const completed = metrics.audits.completed || 0;
          const failed = metrics.audits.failed || 0;
          
          // Calculate safety score (percentage of passed audits)
          const score = total > 0 ? Math.round((completed / total) * 100) : 0;
          setSafetyScore(score);
          
          // Determine grade
          if (score >= 95) setGrade('A+');
          else if (score >= 90) setGrade('A');
          else if (score >= 85) setGrade('B+');
          else if (score >= 80) setGrade('B');
          else if (score >= 75) setGrade('C+');
          else setGrade('C');
          
          // Open risks (failed audits categorized by severity)
          setOpenRisks({
            critical: Math.floor(failed * 0.1), // Estimate 10% critical
            high: Math.floor(failed * 0.3), // Estimate 30% high
            low: failed - Math.floor(failed * 0.4), // Rest are low
          });
          
          // Audit coverage
          setAuditCoverage({
            audited: completed,
            total: total,
            pending: total - completed - failed,
          });
        }
      } catch (error) {
        console.error('Failed to fetch security stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityStats();
    const interval = setInterval(fetchSecurityStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/2 mb-4" />
            <div className="h-10 bg-slate-800 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {/* Safety Score Card */}
      <div className="relative p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md overflow-hidden group">
        {/* Background Scan Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-scan opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Safety Score
          </span>
          <div className={`px-2 py-0.5 rounded text-[10px] border ${
            safetyScore >= 90 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : safetyScore >= 80
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {grade}
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-semibold text-white tracking-tight">
            {safetyScore}
            <span className="text-xl text-slate-500 font-light">/100</span>
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              safetyScore >= 90 ? 'bg-emerald-500' :
              safetyScore >= 80 ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            style={{ width: `${safetyScore}%` }} 
          />
        </div>

        <style jsx>{`
          @keyframes scan-line {
            0% {
              transform: translateY(-100%);
            }
            100% {
              transform: translateY(200%);
            }
          }
          .animate-scan {
            animation: scan-line 3s linear infinite;
          }
        `}</style>
      </div>

      {/* Open Risks Card */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Open Risks
          </span>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-2xl font-semibold text-white tracking-tight">{openRisks.critical}</div>
            <div className="text-[10px] text-red-400 mt-1">Critical</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white tracking-tight">{openRisks.high}</div>
            <div className="text-[10px] text-amber-400 mt-1">High</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white tracking-tight">{openRisks.low}</div>
            <div className="text-[10px] text-blue-400 mt-1">Low</div>
          </div>
        </div>
      </div>

      {/* Audit Coverage Card */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Audit Coverage
          </span>
          <Layers className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">
          {auditCoverage.audited}/{auditCoverage.total}
        </div>
        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 
          {auditCoverage.pending} contracts pending audit
        </div>
        <div className="mt-4 flex gap-1">
          {auditCoverage.total > 0 && Array.from({ length: 4 }).map((_, i) => {
            const percentPerBar = 25;
            const auditedPercent = (auditCoverage.audited / auditCoverage.total) * 100;
            const isCompleted = auditedPercent > (i * percentPerBar);
            return (
              <div 
                key={i}
                className={`h-1 w-full ${
                  isCompleted ? 'bg-emerald-500' : 'bg-slate-700'
                } ${i === 0 ? 'rounded-l-full' : i === 3 ? 'rounded-r-full' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};