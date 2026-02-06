/**
 * Structured logging for orchestrator
 * Uses Winston for production-ready logging
 */

import winston from "winston";
import { config } from "../config/env";

/**
 * Log levels
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

/**
 * Create Winston logger instance
 */
function createLogger(): winston.Logger {
  const isDevelopment = config.NODE_ENV === "development";

  return winston.createLogger({
    levels: LOG_LEVELS,
    level: isDevelopment ? "debug" : "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    defaultMeta: {
      service: "hyperagent-orchestrator",
      environment: config.NODE_ENV,
    },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: isDevelopment
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.printf((info: winston.Logform.TransformableInfo) => {
                const { timestamp, level, message, ...meta } = info;
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
              }),
            )
          : winston.format.json(),
      }),
    ],
  });
}

/**
 * Singleton logger instance
 */
export const logger = createLogger();

/**
 * Log node execution
 */
export function logNodeExecution(
  nodeName: string,
  state: { workflowId?: string; status?: string },
  message: string,
  level: "info" | "warn" | "error" = "info",
): void {
  logger.log(level, message, {
    node: nodeName,
    workflowId: state.workflowId,
    status: state.status,
  });
}

/**
 * Log error with context
 */
export function logError(
  error: Error,
  context: { node?: string; workflowId?: string; [key: string]: unknown },
): void {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

/**
 * Log workflow progress
 */
export function logWorkflowProgress(
  workflowId: string,
  step: string,
  status: string,
  metadata?: Record<string, unknown>,
): void {
  logger.info(`Workflow ${step}`, {
    workflowId,
    step,
    status,
    ...metadata,
  });
}

