/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.CHROMA_BASE_URL = "http://localhost:8000";
process.env.PYTHON_BACKEND_URL = "http://localhost:8000";

// Mock Winston logger to reduce test noise
jest.mock("../core/logger", () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logNodeExecution: jest.fn(),
  logError: jest.fn(),
  logWorkflowProgress: jest.fn(),
}));

// Mock console methods to reduce test noise
global.console = {
  ...console,
  // Uncomment to silence console.log in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

