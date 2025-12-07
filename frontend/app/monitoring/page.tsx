'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useHealth } from '@/hooks/useHealth';
import { getMetrics, type Metrics } from '@/lib/api';
import {
  Activity,
  Database,
  Server,
  Cpu,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  TrendingUp,
  Zap,
  Shield,
  Network as NetworkIcon,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ServiceStatus {
  status: string;
  response_time_ms?: number;
  error?: string;
  providers?: Record<string, any>;
  endpoints?: Record<string, any>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function MonitoringPage() {
  const { health, loading: healthLoading } = useHealth(15000); // Poll every 15 seconds
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await getMetrics();
        setMetrics(data);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="warning">Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="error">Unhealthy</Badge>;
      default:
        return <Badge variant="default">Unknown</Badge>;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getServiceStatus = (service: ServiceStatus | undefined) => {
    if (!service) return { status: 'unknown', color: 'gray' };
    const status = service.status || 'unknown';
    return {
      status,
      color:
        status === 'healthy'
          ? 'green'
          : status === 'warning' || status === 'degraded'
          ? 'yellow'
          : status === 'unhealthy'
          ? 'red'
          : 'gray',
    };
  };

  // Prepare metrics data for charts
  const workflowMetrics = metrics
    ? [
        {
          name: 'Total',
          value: metrics.workflows_total || 0,
        },
        {
          name: 'Completed',
          value: metrics.workflows_completed || 0,
        },
        {
          name: 'Failed',
          value: metrics.workflows_failed || 0,
        },
      ]
    : [];

  const performanceData = metrics
    ? [
        {
          name: 'Generation',
          time: (metrics.average_generation_time_ms || 0) / 1000,
        },
        {
          name: 'Deployment',
          time: (metrics.average_deployment_time_ms || 0) / 1000,
        },
      ]
    : [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            System Monitoring
          </h1>
          <p className="text-gray-600 mt-2">Real-time system health and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw className="w-4 h-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </motion.div>

      {/* System Health Overview */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  System Status
                </h3>
                {getStatusIcon(health?.status)}
              </div>
              {healthLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shadow-lg animate-pulse ${
                      health?.status === 'healthy'
                        ? 'bg-green-500 ring-4 ring-green-200/50'
                        : health?.status === 'degraded'
                        ? 'bg-yellow-500 ring-4 ring-yellow-200/50'
                        : 'bg-red-500 ring-4 ring-red-200/50'
                    }`}
                  />
                  <span className="text-3xl font-bold capitalize text-gray-900">
                    {health?.status || 'Unknown'}
                  </span>
                </div>
              )}
              <div className="pt-2">{getStatusBadge(health?.status)}</div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Workflows
              </h3>
              {metricsLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-900">
                    {metrics?.workflows_total || 0}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">total</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">{metrics?.workflows_completed || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-gray-700">{metrics?.workflows_failed || 0}</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Contracts
              </h3>
              {metricsLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-900">
                    {metrics?.contracts_generated || 0}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">generated</span>
                </div>
              )}
              <div className="text-sm text-gray-600">
                {metrics?.deployments_successful || 0} deployments
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Service Status */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Service Status
            </h2>
            <p className="text-sm text-gray-600 mt-1">Real-time status of all system services</p>
          </div>

          {healthLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading service status..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Database */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Database</span>
                  </div>
                  {getStatusIcon(
                    (health?.services?.database as ServiceStatus)?.status || 'unknown'
                  )}
                </div>
                {health?.services?.database && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge((health.services.database as ServiceStatus).status)}
                    </div>
                    {(health.services.database as ServiceStatus).response_time_ms && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Response:</span>
                        <span className="font-medium text-gray-900">
                          {(health.services.database as ServiceStatus).response_time_ms}ms
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Redis */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-gray-900">Redis</span>
                  </div>
                  {getStatusIcon((health?.services?.redis as ServiceStatus)?.status || 'unknown')}
                </div>
                {health?.services?.redis && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge((health.services.redis as ServiceStatus).status)}
                    </div>
                    {(health.services.redis as ServiceStatus).response_time_ms && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Response:</span>
                        <span className="font-medium text-gray-900">
                          {(health.services.redis as ServiceStatus).response_time_ms}ms
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* LLM Providers */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">LLM Providers</span>
                  </div>
                  {getStatusIcon((health?.services?.llm as ServiceStatus)?.status || 'unknown')}
                </div>
                {health?.services?.llm && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge((health.services.llm as ServiceStatus).status)}
                    </div>
                    {(health.services.llm as ServiceStatus).providers && (
                      <div className="text-xs text-gray-600">
                        {Object.keys((health.services.llm as ServiceStatus).providers || {}).length}{' '}
                        provider(s) configured
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RPC Endpoints */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <NetworkIcon className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900">RPC Endpoints</span>
                  </div>
                  {getStatusIcon((health?.services?.rpc as ServiceStatus)?.status || 'unknown')}
                </div>
                {health?.services?.rpc && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge((health.services.rpc as ServiceStatus).status)}
                    </div>
                    {(health.services.rpc as ServiceStatus).endpoints && (
                      <div className="text-xs text-gray-600">
                        {Object.keys((health.services.rpc as ServiceStatus).endpoints || {}).length}{' '}
                        endpoint(s) configured
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Metrics Charts */}
      {metrics && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workflow Metrics Bar Chart */}
          <Card>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Workflow Statistics
              </h3>
              <p className="text-sm text-gray-600 mt-1">Total, completed, and failed workflows</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workflowMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name="Workflows" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                Average Performance
              </h3>
              <p className="text-sm text-gray-600 mt-1">Average time for generation and deployment</p>
            </div>
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}s`, 'Time']}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="time"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorPerformance)"
                    name="Time (seconds)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No performance data available</p>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Prometheus Metrics Link */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Prometheus Metrics
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Access detailed metrics and monitoring through Prometheus
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="http://localhost:9090"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Prometheus UI</h3>
                <p className="text-sm text-gray-600">http://localhost:9090</p>
              </div>
            </a>
            <a
              href="http://localhost:9090/metrics"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <Server className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Metrics Endpoint</h3>
                <p className="text-sm text-gray-600">http://localhost:9090/metrics</p>
              </div>
            </a>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
