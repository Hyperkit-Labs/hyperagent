const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findUp(startDir, predicate) {
  let dir = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function defaultRootPredicate(dir) {
  // Prefer a directory that looks like the repo root.
  // We key off .env.example (the standardized template) or a root package.json.
  if (fileExists(path.join(dir, ".env.example"))) {
    return true;
  }
  if (fileExists(path.join(dir, "package.json")) && fileExists(path.join(dir, "ts"))) {
    return true;
  }
  return false;
}

/**
 * Load repo-root .env into process.env.
 *
 * This is intentionally tolerant:
 * - If .env doesn't exist, it will not throw unless required=true.
 */
function loadRootEnv(opts) {
  const options = opts || {};
  const cwd = options.cwd || process.cwd();
  const override = Boolean(options.override);
  const required = Boolean(options.required);
  const envFileName = options.envFileName || ".env";

  const rootDir = findUp(cwd, options.rootPredicate || defaultRootPredicate);
  if (!rootDir) {
    if (required) {
      throw new Error(`@hyperagent/env: failed to locate repo root from cwd=${cwd}`);
    }
    return { loaded: false, rootDir: null, envPath: null, error: "repo_root_not_found" };
  }

  const envPath = path.join(rootDir, envFileName);
  const result = dotenv.config({ path: envPath, override });

  if (result.error && required) {
    throw result.error;
  }

  return {
    loaded: !result.error,
    rootDir,
    envPath,
    error: result.error ? String(result.error) : null,
  };
}

module.exports = { loadRootEnv };
