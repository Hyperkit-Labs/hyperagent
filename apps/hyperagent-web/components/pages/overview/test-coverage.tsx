"use client";

import React, { useEffect, useState } from 'react';
import TestTube from 'lucide-react/dist/esm/icons/test-tube'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { getWorkflows } from '@/lib/api';
import Link from 'next/link';

export const TestCoverage: React.FC = () => {
  const [coverageData, setCoverageData] = useState({
    totalTests: 0,
    passedTests: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoverageData = async () => {
      try {
        const result = await getWorkflows({ limit: 50 });
        const workflows = result.workflows || [];
        
        // Calculate test coverage from workflows with testing stage
        const testedWorkflows = workflows.filter((w) =>
          w.stages?.some(s => s.name === 'testing' && s.status === 'completed')
        );
        
        const passedTests = testedWorkflows.filter((w) => {
          const testStage = w.stages?.find(s => s.name === 'testing');
          return testStage && !testStage.error;
        }).length;
        
        const totalTests = testedWorkflows.length;
        const percentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
        
        setCoverageData({
          totalTests,
          passedTests,
          percentage,
        });
      } catch (error) {
        console.error('Failed to fetch coverage data:', error);
        setCoverageData({ totalTests: 0, passedTests: 0, percentage: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchCoverageData();
    const interval = setInterval(fetchCoverageData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <TestTube className="w-4 h-4 text-violet-400" /> Workflow Testing
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-center py-4">
        {coverageData.totalTests > 0 ? (
          <>
            <div className="flex items-end justify-between mb-1">
              <span className="text-4xl font-medium tracking-tight text-white">{coverageData.percentage}%</span>
              <span className="text-xs text-emerald-400 mb-1">Tests Passed</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
              <div 
                className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full relative"
                style={{ width: `${coverageData.percentage}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded p-2 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase">Total Tests</div>
                <div className="text-sm font-medium text-white">{coverageData.totalTests}</div>
              </div>
              <div className="bg-white/5 rounded p-2 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase">Passed</div>
                <div className="text-sm font-medium text-white">{coverageData.passedTests}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <TestTube className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-2">No test data yet</p>
            <p className="text-xs text-slate-500">Create workflows with testing enabled</p>
          </div>
        )}
      </div>

      <Link href="/workflows" className="w-full block">
        <button className="w-full py-2 text-xs font-medium text-slate-300 hover:text-white border border-dashed border-slate-600 hover:border-violet-500 rounded-md transition-all">
          View All Workflows
        </button>
      </Link>
    </div>
  );
};