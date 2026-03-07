/**
 * Frontend Configuration Manager
 *
 * Centralized configuration for service URLs and feature flags.
 * - Base URL: getServiceUrl('backend') is built from env (NEXT_PUBLIC_API_URL or host/port).
 *   It is not changed at runtime from the API; only feature flags come from GET /api/v1/config.
 * - Orchestrator basePath (/api/v2): used only if something calls getServiceUrl('orchestrator').
 *   The app uses "backend" (gateway) for all API calls; orchestrator config is for direct-orchestrator tooling.
 */

let runtimeFeatures: Record<string, boolean> = {};
let runtimeConfig: Record<string, unknown> = {};

export function setRuntimeFeatures(features: Record<string, boolean>): void {
  runtimeFeatures = { ...runtimeFeatures, ...features };
}

/** Store config from GET /api/v1/config (default_network_id, default_chain_id, a2a_identity, etc.). */
export function setRuntimeConfig(config: Record<string, unknown>): void {
  runtimeConfig = { ...runtimeConfig, ...config };
}

/** Get a runtime config value (e.g. default_network_id, default_chain_id). */
export function getRuntimeConfig<K = unknown>(key: string): K | undefined {
  return runtimeConfig[key] as K | undefined;
}

interface ServiceConfig {
  name: string;
  protocol: string;
  host: string;
  port: number;
  basePath: string;
}

interface AppConfig {
  env: string;
  services: Record<string, ServiceConfig>;
  features: Record<string, boolean>;
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  
  private constructor() {
    this.config = this.loadConfig();
  }
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  private loadConfig(): AppConfig {
    const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development';
    const isProduction = env === 'production' || env === 'prod';
    const isStaging = env === 'staging' || env === 'stage';

    // Production-safe defaults: require explicit configuration
    const getBackendProtocol = () => {
      if (process.env.NEXT_PUBLIC_BACKEND_PROTOCOL) return process.env.NEXT_PUBLIC_BACKEND_PROTOCOL;
      return isProduction ? 'https' : 'http';
    };

    const getBackendHost = () => {
      if (process.env.NEXT_PUBLIC_BACKEND_HOST) return process.env.NEXT_PUBLIC_BACKEND_HOST;
      if (process.env.NEXT_PUBLIC_API_URL?.trim()) return 'localhost';
      if (isProduction || isStaging) {
        throw new Error(
          'NEXT_PUBLIC_BACKEND_HOST is required in production/staging. ' +
          'Set it to your API domain (e.g. api.hyperkit.dev) or use NEXT_PUBLIC_API_URL instead.'
        );
      }
      return 'localhost';
    };

    const getBackendPort = () => {
      if (process.env.NEXT_PUBLIC_BACKEND_PORT) {
        return parseInt(process.env.NEXT_PUBLIC_BACKEND_PORT, 10);
      }
      // Production typically doesn't need port in URL (uses standard ports)
      return isProduction ? 443 : 4000;
    };

    return {
      env,
      services: {
        backend: {
          name: 'backend',
          protocol: getBackendProtocol(),
          host: getBackendHost(),
          port: getBackendPort(),
          basePath: process.env.NEXT_PUBLIC_BACKEND_BASE_PATH || '/api/v1',
        },
        orchestrator: {
          name: 'orchestrator',
          protocol: process.env.NEXT_PUBLIC_ORCHESTRATOR_PROTOCOL || (isProduction ? 'https' : 'http'),
          host: process.env.NEXT_PUBLIC_ORCHESTRATOR_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_ORCHESTRATOR_PORT || '4000', 10),
          basePath: process.env.NEXT_PUBLIC_ORCHESTRATOR_BASE_PATH || '/api/v2',
        },
      },
      features: {
        x402: false,
        monitoring: process.env.NEXT_PUBLIC_MONITORING_ENABLED === 'true',
      },
    };
  }
  
  getServiceUrl(serviceName: string): string {
    const isProduction = this.config.env === 'production' || this.config.env === 'prod';
    const isStaging = this.config.env === 'staging' || this.config.env === 'stage';

    if (serviceName === 'backend' && process.env.NEXT_PUBLIC_API_URL) {
      const raw = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, '');
      // Use origin only (scheme + host + port) so paths like /api/v1/docs do not double up
      let origin = raw;
      try {
        const parsed = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
        origin = parsed.origin;
        
        // Production validation: ensure HTTPS
        if (isProduction && parsed.protocol !== 'https:') {
          console.warn(
            `Production API URL should use HTTPS: ${raw}. Non-HTTPS connections may be blocked by browsers.`
          );
        }
      } catch (error) {
        // If URL parse fails, strip path by taking everything before the first /
        const slash = raw.indexOf('/', raw.indexOf('//') + 2);
        origin = slash > 0 ? raw.slice(0, slash) : raw;
        if (isProduction || isStaging) {
          console.error(`Invalid NEXT_PUBLIC_API_URL format: ${raw}`, error);
        }
      }
      return origin.endsWith('/api/v1') ? origin : `${origin}/api/v1`;
    }
    
    const service = this.config.services[serviceName];
    if (!service) {
      if (isProduction || isStaging) {
        throw new Error(
          `Unknown service "${serviceName}" in ${this.config.env}. ` +
          'Configure NEXT_PUBLIC_API_URL or add the service to environment.ts.'
        );
      }
      const fallback = 'http://localhost:4000/api/v1';
      console.warn(`[config] Unknown service: ${serviceName}, dev fallback: ${fallback}`);
      return fallback;
    }
    
    const basePath = service.basePath || '';
    // In production, omit port if using standard ports (80/443)
    const port = (isProduction && (service.port === 443 || service.port === 80))
      ? ''
      : `:${service.port}`;
    
    return `${service.protocol}://${service.host}${port}${basePath}`;
  }
  
  isFeatureEnabled(featureName: string): boolean {
    return runtimeFeatures[featureName] ?? this.config.features[featureName] ?? false;
  }
  
  getEnv(): string {
    return this.config.env;
  }
}

// Singleton instance
export const config = ConfigManager.getInstance();

// Convenience exports
export const getServiceUrl = (serviceName: string) => config.getServiceUrl(serviceName);
export const isFeatureEnabled = (featureName: string) => config.isFeatureEnabled(featureName);
