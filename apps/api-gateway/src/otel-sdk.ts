/**
 * OpenTelemetry Node SDK for the API gateway: OTLP traces + metrics when
 * OPENTELEMETRY_ENABLED is set. Loads after dotenv in index.ts.
 */
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const enabled = ["1", "true", "yes"].includes(
  (process.env.OPENTELEMETRY_ENABLED || "").trim().toLowerCase(),
);

if (enabled) {
  const base = (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://127.0.0.1:4318"
  ).replace(/\/$/, "");
  const tracesUrl =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() ||
    `${base}/v1/traces`;
  const metricsUrl =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?.trim() ||
    `${base}/v1/metrics`;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "api-gateway",
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
