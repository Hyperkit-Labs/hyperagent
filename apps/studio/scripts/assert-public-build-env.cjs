"use strict";

function isLoopbackHostname(hostname) {
  const h = String(hostname || "").trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function isProductionLikeChannel(appEnv) {
  const raw = String(appEnv || "").trim().toLowerCase();
  return raw === "staging" || raw === "stage" || raw === "production" || raw === "prod";
}

function parseUrl(urlish) {
  const raw = String(urlish || "").trim();
  if (!raw) {
    throw new Error("NEXT_PUBLIC_API_URL is required.");
  }
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL must be a valid URL. Received "${raw}".`);
  }
}

function parseNamedUrl(name, urlish) {
  const raw = String(urlish || "").trim();
  if (!raw) {
    throw new Error(`${name} is required.`);
  }
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error(`${name} must be a valid URL. Received "${raw}".`);
  }
}

function validateStudioPublicBuildEnv(env, opts = {}) {
  const requireExplicitEnv = opts.requireExplicitEnv !== false;
  const requirePublicAuthEnv = opts.requirePublicAuthEnv !== false;
  const errors = [];

  const apiUrl = String(env.NEXT_PUBLIC_API_URL || "").trim();
  const thirdwebClientId = String(env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "").trim();
  const appEnv = String(env.NEXT_PUBLIC_ENV || "").trim();
  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const productionLikeChannel = isProductionLikeChannel(appEnv);

  let parsedApiUrl = null;
  try {
    parsedApiUrl = parseUrl(apiUrl);
  } catch (error) {
    errors.push(error.message);
  }

  if (!thirdwebClientId) {
    errors.push("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required.");
  }

  if (requireExplicitEnv && !appEnv) {
    errors.push("NEXT_PUBLIC_ENV is required for Studio image builds.");
  }

  if (requirePublicAuthEnv && productionLikeChannel) {
    try {
      parseNamedUrl("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    } catch (error) {
      errors.push(error.message);
    }
    if (!supabaseAnonKey) {
      errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
    }
  }

  if (
    parsedApiUrl &&
    productionLikeChannel &&
    isLoopbackHostname(parsedApiUrl.hostname)
  ) {
    errors.push(
      `NEXT_PUBLIC_API_URL must not point to loopback for NEXT_PUBLIC_ENV=${appEnv}. Received "${apiUrl}".`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    apiUrl,
    thirdwebClientId,
    appEnv,
    supabaseUrl,
  };
}

function assertStudioPublicBuildEnv(env, opts = {}) {
  const result = validateStudioPublicBuildEnv(env, opts);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result;
}

if (require.main === module) {
  try {
    const result = assertStudioPublicBuildEnv(process.env, {
      requireExplicitEnv: true,
      requirePublicAuthEnv: true,
    });
    const maskedClientId = `${result.thirdwebClientId.slice(0, 6)}...`;
    console.log(
      `[studio-build-env] ok env=${result.appEnv} api=${result.apiUrl} thirdweb=${maskedClientId}`,
    );
  } catch (error) {
    console.error("[studio-build-env] invalid Studio public build env");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  assertStudioPublicBuildEnv,
  isLoopbackHostname,
  isProductionLikeChannel,
  validateStudioPublicBuildEnv,
};
