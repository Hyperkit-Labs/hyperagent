/**
 * Frontend Configuration Manager
 * 
 * Centralized configuration for service URLs and feature flags
 * Uses environment variables with sensible defaults
 */

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
    return {
      env: process.env.NEXT_PUBLIC_ENV || 'development',
      services: {
        backend: {
          name: 'backend',
          protocol: process.env.NEXT_PUBLIC_BACKEND_PROTOCOL || 'http',
          host: process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_BACKEND_PORT || '8000'),
          basePath: process.env.NEXT_PUBLIC_BACKEND_BASE_PATH || '/api/v1',
        },
        orchestrator: {
          name: 'orchestrator',
          protocol: process.env.NEXT_PUBLIC_ORCHESTRATOR_PROTOCOL || 'http',
          host: process.env.NEXT_PUBLIC_ORCHESTRATOR_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_ORCHESTRATOR_PORT || '4000'),
          basePath: process.env.NEXT_PUBLIC_ORCHESTRATOR_BASE_PATH || '/api/v2',
        },
      },
      features: {
        x402: process.env.NEXT_PUBLIC_X402_ENABLED === 'true',
        monitoring: process.env.NEXT_PUBLIC_MONITORING_ENABLED === 'true',
      },
    };
  }
  
  getServiceUrl(serviceName: string): string {
    const service = this.config.services[serviceName];
    if (!service) {
      console.warn(`Unknown service: ${serviceName}, falling back to default`);
      return 'http://localhost:8000/api/v1'; // Safe fallback
    }
    
    const basePath = service.basePath || '';
    return `${service.protocol}://${service.host}:${service.port}${basePath}`;
  }
  
  isFeatureEnabled(featureName: string): boolean {
    return this.config.features[featureName] || false;
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
