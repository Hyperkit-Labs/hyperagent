import pino from "pino";

const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug");

export function createLogger(service: string): pino.Logger {
  return pino({
    name: service,
    level: LOG_LEVEL,
    ...(NODE_ENV !== "production" && {
      transport: { target: "pino/file", options: { destination: 1 } },
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
    }),
    ...(NODE_ENV === "production" && {
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  });
}
