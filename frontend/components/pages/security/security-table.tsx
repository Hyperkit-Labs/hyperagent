import React, { useState, useEffect } from 'react';
import { SecurityAlertTableHeader } from '@/components/pages/security/table-header';
import { SecurityAlertTableRow } from '@/components/pages/security/table-row';
import { SecurityAlertTableFooter } from '@/components/pages/security/table.footer';
import { getWorkflows, type WorkflowResponse } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export interface SecurityAlert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'fixed';
  severityLabel: string;
  description: string;
  icon: string;
  iconColor: string;
  affectedAsset: string;
  detectionTime: string;
  detectionMethod: string;
  status: {
    state: 'pending' | 'patched' | 'ignored' | 'resolved';
    label: string;
    detail: string;
  };
  isResolved?: boolean;
}

const getSeverityFromScore = (score: number): { severity: 'critical' | 'high' | 'medium' | 'low' | 'fixed'; label: string } => {
  if (score >= 90) return { severity: 'fixed', label: 'PASS' };
  if (score >= 70) return { severity: 'low', label: 'LOW' };
  if (score >= 50) return { severity: 'medium', label: 'MED' };
  if (score >= 30) return { severity: 'high', label: 'HIGH' };
  return { severity: 'critical', label: 'CRIT' };
};

const getSeverityIcon = (severity: string): string => {
  if (severity === 'fixed') return 'shield-check';
  if (severity === 'critical') return 'alert-triangle';
  if (severity === 'high') return 'unlocked';
  if (severity === 'medium') return 'key';
  return 'zap-off';
};

const getSeverityColor = (severity: string): string => {
  if (severity === 'fixed') return 'emerald';
  if (severity === 'critical') return 'red';
  if (severity === 'high') return 'amber';
  if (severity === 'medium') return 'orange';
  return 'blue';
};

export const SecurityAlertsTable: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await getWorkflows({ limit: 50 });
        const workflows = response.workflows || [];
        
        // Convert workflows with audit data to security alerts
        const alertsData: SecurityAlert[] = workflows
          .filter((wf: WorkflowResponse) => {
            const auditScore = (wf as any).auditScore || (wf.meta as any)?.audit_score;
            return auditScore !== undefined && auditScore !== null;
          })
          .map((wf: WorkflowResponse) => {
            const auditScore = (wf as any).auditScore || (wf.meta as any)?.audit_score || 0;
            const { severity, label } = getSeverityFromScore(auditScore);
            const contractName = wf.nlp_input?.split(' ')[0] || (wf as any).intent || 'Contract';
            
            return {
              id: wf.workflow_id,
              title: auditScore && auditScore < 90 
                ? `Security Issue Detected` 
                : 'Audit Passed',
              severity,
              severityLabel: label,
              description: auditScore && auditScore < 90
                ? `Audit score: ${auditScore}/100`
                : 'All security checks passed',
              icon: getSeverityIcon(severity),
              iconColor: getSeverityColor(severity),
              affectedAsset: `${contractName}.sol`,
              detectionTime: wf.updated_at 
                ? formatDistanceToNow(new Date(wf.updated_at), { addSuffix: true })
                : 'Unknown',
              detectionMethod: 'Slither + AI Audit',
              status: {
                state: auditScore && auditScore >= 90 
                  ? 'resolved' 
                  : wf.status === 'completed' || wf.status === 'COMPLETED' 
                  ? 'pending' 
                  : 'patched',
                label: wf.auditScore && wf.auditScore >= 90 
                  ? 'Passed' 
                  : wf.status === 'completed' 
                  ? 'Needs Review' 
                  : 'In Progress',
                detail: wf.auditScore && wf.auditScore >= 90 
                  ? 'Security verified' 
                  : 'Manual review required',
              },
              isResolved: wf.auditScore && wf.auditScore >= 90,
            };
          });

        setAlerts(alertsData);
      } catch (error) {
        console.error('Failed to fetch security alerts:', error);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <SecurityAlertTableHeader />

      {/* List Items */}
      <div className="divide-y divide-white/5 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading security alerts...</p>
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-slate-400 mb-2">No security alerts</p>
              <p className="text-sm text-slate-500">All contracts passed security audits</p>
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <SecurityAlertTableRow key={alert.id} alert={alert} />
          ))
        )}
      </div>

      {!loading && <SecurityAlertTableFooter totalAlerts={alerts.length} />}
    </div>
  );
};