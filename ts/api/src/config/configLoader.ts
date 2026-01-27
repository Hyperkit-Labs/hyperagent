/**
 * YAML Configuration Loader (TypeScript)
 * Centralized config loading for networks, tokens, pricing, deployment
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "yaml";

// Config directory path (relative to repo root)
const CONFIG_DIR = resolve(__dirname, "../../../../config");

export interface NetworkConfig {
  chain_id: number;
  rpc_urls: string[];
  explorer: string;
  currency: string;
  features: {
    batch_deployment: boolean;
    eigenda: boolean;
  };
}

export interface TokenAddresses {
  [network: string]: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  type: string;
}

export interface PricingConfig {
  contract_types: Record<string, number>;
  workflow_tiers: Record<string, number>;
  tasks: Record<string, number>;
  network_multipliers: Record<string, number>;
  model_multipliers: Record<string, number>;
  complexity_multipliers: Record<string, number>;
}

export interface DeploymentConfig {
  strategies: {
    erc4337: {
      enabled: boolean;
      networks: string[];
      entrypoint_address: string;
      paymaster_required: boolean;
    };
    server_wallet: {
      enabled: boolean;
      networks: string[];
      max_gas_price_gwei: number;
    };
  };
  gas_settings: Record<string, {
    max_priority_fee_gwei: number;
    max_fee_gwei: number;
    gas_limit_multiplier: number;
  }>;
  verification: {
    auto_verify: boolean;
    explorers: Record<string, string>;
  };
  wallets?: {
    merchant?: {
      address: string;
      description: string;
      networks: string[];
    };
    server_deployer?: {
      address: string;
      description: string;
      networks: string[];
    };
    erc4337?: {
      entrypoint: string;
      factory: string;
      description: string;
    };
  };
}

export interface LLMProviderConfig {
  enabled: boolean;
  priority: number;
  models: {
    default: string;
  };
  generation: {
    temperature: number;
    max_output_tokens?: number;
    max_tokens?: number;
    thinking_budget?: number | null;
    timeout_seconds: number;
  };
  embedding?: {
    model: string;
    dimensions: number;
    timeout_seconds: number;
  };
  rate_limits: {
    requests_per_minute: number;
    tokens_per_minute: number;
  };
  features: {
    multimodal: boolean;
    function_calling: boolean;
    streaming: boolean;
    json_mode: boolean;
  };
}

export interface LLMRoutingConfig {
  strategy: string;
  tasks: Record<string, {
    primary: string;
    fallback: string[];
    timeout: number;
    retry_attempts: number;
  }>;
  fallback: {
    enabled: boolean;
    max_retries: number;
    backoff_multiplier: number;
    retry_on_errors: string[];
  };
}

export interface LLMConfig {
  providers: Record<string, LLMProviderConfig>;
  routing: LLMRoutingConfig;
  pricing: Record<string, {
    input: number;
    output: number;
  }>;
  features: {
    enable_acontext: boolean;
    enable_multi_model_router: boolean;
    enable_cost_tracking: boolean;
    enable_latency_monitoring: boolean;
    enable_automatic_fallback: boolean;
    prefer_streaming: boolean;
  };
  global: {
    default_provider: string;
    embedding_provider: string;
    max_concurrent_requests: number;
    request_queue_size: number;
    cache_responses: boolean;
    cache_ttl_seconds: number;
  };
}

export interface X402Config {
  enabled: boolean;
  version: string;
  protocol_standard: string;
  supported_networks: string[];
  network_settings: Record<string, {
    enabled: boolean;
    testnet: boolean;
    confirmation_blocks: number;
    timeout_seconds: number;
  }>;
  verifier: {
    service_url_env: string;
    default_url: string;
    timeout_seconds: number;
    retry_attempts: number;
    retry_delay_seconds: number;
  };
  settlement: {
    auto_settle: boolean;
    batch_settlements: boolean;
    batch_size: number;
    batch_timeout_minutes: number;
    min_amount_usdc: number;
    max_amount_usdc: number;
    use_gas_optimization: boolean;
    max_gas_price_gwei: number;
  };
  payment_tokens: Record<string, {
    enabled: boolean;
    symbol: string;
    decimals: number;
  }>;
  pricing: {
    contract_generation: Record<string, number>;
    workflow: Record<string, number>;
    deployment: Record<string, number>;
    tasks: Record<string, number>;
  };
  payment_flow: {
    verify_before_execution: boolean;
    require_confirmation: boolean;
    confirmation_blocks: number;
    methods: string[];
    default_method: string;
  };
  refunds: {
    enabled: boolean;
    auto_refund_on_failure: boolean;
    refund_timeout_hours: number;
    conditions: string[];
    manual_review_amount_usdc: number;
  };
  fraud_prevention: {
    enabled: boolean;
    rate_limits: {
      requests_per_hour: number;
      requests_per_day: number;
      max_amount_per_day_usdc: number;
    };
    use_blacklist: boolean;
    use_whitelist: boolean;
    require_wallet_age_days: number;
    require_min_balance_usdc: number;
  };
}

class ConfigLoader {
  private cache: Map<string, any> = new Map();

  private loadYaml<T>(filename: string): T {
    if (this.cache.has(filename)) {
      return this.cache.get(filename) as T;
    }

    const filepath = resolve(CONFIG_DIR, filename);
    try {
      const content = readFileSync(filepath, "utf-8");
      const parsed = yaml.parse(content);
      this.cache.set(filename, parsed);
      return parsed as T;
    } catch (error) {
      throw new Error(`Failed to load config file ${filename}: ${error}`);
    }
  }

  getNetworks(): Record<string, NetworkConfig> {
    const data = this.loadYaml<{ networks: Record<string, NetworkConfig> }>("networks.yaml");
    return data.networks || {};
  }

  getNetwork(networkId: string): NetworkConfig | undefined {
    const networks = this.getNetworks();
    return networks[networkId];
  }

  getTokens(): Record<string, TokenAddresses> {
    const data = this.loadYaml<{ tokens: Record<string, TokenAddresses> }>("tokens.yaml");
    return data.tokens || {};
  }

  getTokenAddress(tokenSymbol: string, networkId: string): string | undefined {
    const tokens = this.getTokens();
    const tokenData = tokens[tokenSymbol.toLowerCase()];
    return tokenData?.[networkId];
  }

  getTokenMetadata(tokenSymbol: string): TokenMetadata | undefined {
    const data = this.loadYaml<{ metadata: Record<string, TokenMetadata> }>("tokens.yaml");
    return data.metadata?.[tokenSymbol.toLowerCase()];
  }

  getPricing(): PricingConfig {
    return this.loadYaml<PricingConfig>("pricing.yaml");
  }

  getContractPrice(contractType: string): number {
    const pricing = this.getPricing();
    return pricing.contract_types?.[contractType] ?? 0.15;
  }

  getWorkflowPrice(tier: string): number {
    const pricing = this.getPricing();
    return pricing.workflow_tiers?.[tier] ?? 0.02;
  }

  getNetworkMultiplier(networkId: string): number {
    const pricing = this.getPricing();
    return pricing.network_multipliers?.[networkId] ?? 1.0;
  }

  getModelMultiplier(modelName: string): number {
    const pricing = this.getPricing();
    return pricing.model_multipliers?.[modelName] ?? 1.0;
  }

  getDeploymentConfig(): DeploymentConfig {
    return this.loadYaml<DeploymentConfig>("deployment.yaml");
  }

  getDeploymentStrategy(networkId: string): "erc4337" | "server_wallet" | "thirdweb_engine" {
    const config = this.getDeploymentConfig();

    if (config.strategies.erc4337.networks.includes(networkId)) {
      return "erc4337";
    }

    if (config.strategies.server_wallet.networks.includes(networkId)) {
      return "server_wallet";
    }

    return "server_wallet"; // Default
  }

  getGasSettings(networkId: string) {
    const config = this.getDeploymentConfig();
    return config.gas_settings?.[networkId];
  }

  getExplorerApi(networkId: string): string | undefined {
    const config = this.getDeploymentConfig();
    return config.verification.explorers?.[networkId];
  }

  listSupportedNetworks(): string[] {
    return Object.keys(this.getNetworks());
  }

  listSupportedTokens(): string[] {
    return Object.keys(this.getTokens());
  }

  isTestnet(networkId: string): boolean {
    return (
      networkId.includes("_testnet") ||
      networkId.includes("sepolia") ||
      networkId.includes("fuji") ||
      networkId.includes("calibration") ||
      networkId.includes("amoy")
    );
  }

  // ========================================================================
  // LLM Configuration Methods
  // ========================================================================

  getLLMConfig(): LLMConfig {
    return this.loadYaml<LLMConfig>("llm.yaml");
  }

  getLLMProviderConfig(providerName: string): LLMProviderConfig | undefined {
    const config = this.getLLMConfig();
    return config.providers?.[providerName];
  }

  getEnabledLLMProviders(): string[] {
    const config = this.getLLMConfig();
    const providers = config.providers || {};

    const enabled = Object.entries(providers)
      .filter(([_, data]) => data.enabled)
      .map(([name, data]) => ({ name, priority: data.priority || 99 }))
      .sort((a, b) => a.priority - b.priority);

    return enabled.map((p) => p.name);
  }

  getPrimaryLLMProvider(): string {
    const enabled = this.getEnabledLLMProviders();
    return enabled[0] || "gemini"; // Default fallback
  }

  getLLMModel(providerName: string): string {
    const provider = this.getLLMProviderConfig(providerName);
    return provider?.models?.default || "";
  }

  getLLMGenerationConfig(providerName: string): LLMProviderConfig["generation"] | undefined {
    const provider = this.getLLMProviderConfig(providerName);
    return provider?.generation;
  }

  getLLMRoutingConfig(): LLMRoutingConfig {
    const config = this.getLLMConfig();
    return config.routing;
  }

  getLLMRoutingForTask(taskName: string) {
    const routing = this.getLLMRoutingConfig();
    return routing.tasks?.[taskName];
  }

  getLLMPricing(providerName: string) {
    const config = this.getLLMConfig();
    return config.pricing?.[providerName];
  }

  // ========================================================================
  // Wallet Configuration Methods
  // ========================================================================

  getMerchantWalletAddress(): string {
    const config = this.getDeploymentConfig();
    return config.wallets?.merchant?.address || "";
  }

  getServerDeployerAddress(): string {
    const config = this.getDeploymentConfig();
    return config.wallets?.server_deployer?.address || "";
  }

  getERC4337Entrypoint(): string {
    const config = this.getDeploymentConfig();
    return config.wallets?.erc4337?.entrypoint || "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  }

  getERC4337Factory(): string {
    const config = this.getDeploymentConfig();
    return config.wallets?.erc4337?.factory || "";
  }

  // ========================================================================
  // x402 Configuration Methods
  // ========================================================================

  getX402Config(): X402Config {
    return this.loadYaml<X402Config>("x402.yaml");
  }

  isX402Enabled(): boolean {
    const config = this.getX402Config();
    return config.enabled ?? false;
  }

  getX402SupportedNetworks(): string[] {
    const config = this.getX402Config();
    return config.supported_networks || [];
  }

  isNetworkX402Supported(networkId: string): boolean {
    return this.getX402SupportedNetworks().includes(networkId);
  }

  getX402NetworkSettings(networkId: string) {
    const config = this.getX402Config();
    return config.network_settings?.[networkId];
  }

  getX402VerifierConfig() {
    const config = this.getX402Config();
    return config.verifier;
  }

  getX402Pricing(category: string, tier: string = "basic"): number {
    const config = this.getX402Config();
    const pricing = config.pricing?.[category as keyof typeof config.pricing];
    if (pricing && typeof pricing === "object") {
      return (pricing as Record<string, number>)[tier] ?? 0.0;
    }
    return 0.0;
  }

  getX402PaymentMethods(): string[] {
    const config = this.getX402Config();
    return config.payment_flow?.methods || ["erc4337_bundler"];
  }

  getX402DefaultPaymentMethod(): string {
    const config = this.getX402Config();
    return config.payment_flow?.default_method || "erc4337_bundler";
  }

  isX402RefundEnabled(): boolean {
    const config = this.getX402Config();
    return config.refunds?.enabled ?? true;
  }

  getX402RateLimits() {
    const config = this.getX402Config();
    return config.fraud_prevention?.rate_limits;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let _configLoader: ConfigLoader | null = null;

export function getConfigLoader(): ConfigLoader {
  if (!_configLoader) {
    _configLoader = new ConfigLoader();
  }
  return _configLoader;
}

// Convenience exports
export const getNetwork = (networkId: string) => getConfigLoader().getNetwork(networkId);
export const getTokenAddress = (tokenSymbol: string, networkId: string) =>
  getConfigLoader().getTokenAddress(tokenSymbol, networkId);
export const getContractPrice = (contractType: string) => getConfigLoader().getContractPrice(contractType);
export const getDeploymentStrategy = (networkId: string) => getConfigLoader().getDeploymentStrategy(networkId);
export const listNetworks = () => getConfigLoader().listSupportedNetworks();
export const isTestnet = (networkId: string) => getConfigLoader().isTestnet(networkId);

// LLM convenience exports
export const getLLMProviderConfig = (providerName: string) => getConfigLoader().getLLMProviderConfig(providerName);
export const getPrimaryLLMProvider = () => getConfigLoader().getPrimaryLLMProvider();
export const getLLMModel = (providerName: string) => getConfigLoader().getLLMModel(providerName);

// Wallet convenience exports
export const getMerchantWalletAddress = () => getConfigLoader().getMerchantWalletAddress();
export const getERC4337Entrypoint = () => getConfigLoader().getERC4337Entrypoint();

// x402 convenience exports
export const isX402Enabled = () => getConfigLoader().isX402Enabled();
export const getX402SupportedNetworks = () => getConfigLoader().getX402SupportedNetworks();
export const isNetworkX402Supported = (networkId: string) => getConfigLoader().isNetworkX402Supported(networkId);
export const getX402Pricing = (category: string, tier?: string) => getConfigLoader().getX402Pricing(category, tier);

