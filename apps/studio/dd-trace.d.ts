/**
 * Ambient typings for dd-trace (runtime optional; package may be absent until pnpm install).
 * @see https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/nodejs/
 */
declare module "dd-trace" {
  interface DatadogSpan {
    setTag(key: string, value: string | number | boolean): this;
  }

  interface DatadogScope {
    active(): DatadogSpan | null | undefined;
  }

  interface DatadogTracer {
    scope(): DatadogScope;
  }

  const tracer: DatadogTracer;
  export default tracer;
}

declare module "dd-trace/initialize.mjs" {
  const _init: unknown;
  export default _init;
}
