/**
 * Maps gateway bootstrap / auth error codes to user-safe copy (recovery hints).
 */

export function messageForBootstrapCode(
  code: string | undefined,
  _rawMessage: string,
): string | null {
  if (!code) return null;
  switch (code.toUpperCase()) {
    case "SCHEMA_MISSING":
    case "WALLET_UPSERT_FAILED":
    case "WALLET_UPSERT_NO_ID":
      return "Sign-in is not fully set up on the server. Ask an operator to run database migrations and check wallet storage.";
    case "AUTH_NOT_CONFIGURED":
      return "Server sign-in is not configured. Ask an operator to set AUTH_JWT_SECRET on the gateway.";
    case "SUPABASE_NOT_CONFIGURED":
      return "Server database is not configured. Ask an operator to set Supabase environment variables on the gateway.";
    case "INVALID_SIGNATURE":
    case "SIWE_PAYLOAD_REQUIRED":
    case "SIWE_SIGNATURE_INVALID_FORMAT":
      return "Your wallet proof could not be verified. Please sign the message again.";
    case "THIRDWEB_TOKEN_INVALID":
    case "THIRDWEB_TOKEN_REQUIRED":
    case "WALLET_ADDRESS_MISMATCH":
      return "Your in-app wallet session expired. Reconnect and sign in again.";
    case "INVALID_AUTH_METHOD":
      return "This sign-in request was not valid. Refresh the page and try again.";
    case "WALLET_RECORD_FAILED":
      return "We could not save your account. Try again or contact support.";
    default:
      return null;
  }
}
