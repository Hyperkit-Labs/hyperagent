/**
 * OpenTelemetry Node SDK for the API gateway: OTLP traces + metrics when enabled in canonical gateway env.
 */
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { getGatewayEnv } from "@hyperagent/config";

export function initOtel(): void {
  const otel = getGatewayEnv().otel;
  if (!otel.enabled) return;

  const base = otel.otlpEndpoint.replace(/\/$/, "");
  const tracesUrl = otel.tracesEndpoint?.trim() || `${base}/v1/traces`;
  const metricsUrl = otel.metricsEndpoint?.trim() || `${base}/v1/metrics`;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: otel.serviceName,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: tracesUrl }),
    metricReader: new PeriodicExportingMetricReader({
      exportIntervalMillis: 60_000,
      exporter: new OTLPMetricExporter({ url: metricsUrl }),
    }),
  });

  sdk.start();

  process.on("SIGTERM", () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });
}
