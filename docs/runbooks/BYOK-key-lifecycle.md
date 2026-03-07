# BYOK key lifecycle and rotation

Runbook for operator and security: how LLM keys are stored, encrypted, and rotated. No raw keys after write.

---

## Storage and encryption

- **Where**: `wallet_users.encrypted_llm_keys` (Supabase). One row per user (keyed by wallet_users.id = gateway X-User-Id); keys are stored encrypted.
- **Encryption**: Fernet (symmetric) using `LLM_KEY_ENCRYPTION_KEY` (env). The orchestrator encrypts before write and never returns plaintext to the client.
- **No raw keys after write**: After a key is saved, the API only returns which providers are configured (e.g. `configured_providers: ["openai", "anthropic"]`). Key values are never sent back in responses.

---

## Key lifecycle

1. **Write**: Client (Studio) sends keys to `POST /api/v1/workspaces/current/llm-keys`. Orchestrator encrypts with `LLM_KEY_ENCRYPTION_KEY` (or KMS) and stores in `wallet_users.encrypted_llm_keys` (by X-User-Id = wallet_users.id).
2. **Read (metadata only)**: `GET /api/v1/workspaces/current/llm-keys` returns `configured_providers` only. Used to show "OpenAI configured" in UI.
3. **Use**: Pipeline runs use stored keys server-side (orchestrator decrypts with `LLM_KEY_ENCRYPTION_KEY` when building agent context). Keys are not exposed to the frontend after storage.
4. **Delete**: `DELETE /api/v1/workspaces/current/llm-keys?provider=openai` removes that provider’s key for the user.

---

## Rotation

### Rotating `LLM_KEY_ENCRYPTION_KEY`

If you change the encryption key, existing encrypted blobs in the DB become unreadable. Options:

1. **Re-key**: Before rotating, run a migration (or one-off job) that decrypts each row with the old key and re-encrypts with the new key. Then switch env to the new key.
2. **User re-entry**: Rotate the key and document that users must re-add their LLM keys in Studio (old ciphertext is discarded).

Recommendation: Re-key in a maintenance window and keep the old key in env only for the migration; remove it after.

### Rotating user LLM API keys (OpenAI, Anthropic, etc.)

Users rotate their own API keys in the provider’s dashboard, then update the key in Studio (Settings > LLM keys). The old value is overwritten; no separate “rotation” API.

---

## Security checklist

- [ ] Production sets `LLM_KEY_ENCRYPTION_KEY` (strong secret, not default).
- [ ] Production sets `AUTH_JWT_SECRET` so gateway enforces JWT; BYOK endpoints require valid JWT and set `X-User-Id`.
- [ ] No logging of key values or decrypted payloads; only “BYOK read/write” event and user_id in security logs.
- [ ] Access to `wallet_users` (encrypted_llm_keys) is RLS-protected; only the owning user (by auth) can read/update their row.

---

## References

- Orchestrator: `llm_keys_supabase`, `llm_keys_encryption` (Fernet).
- Gateway: JWT validation in `auth.ts`; `X-User-Id` forwarded to orchestrator.
- Studio: Settings page and `lib/api.ts` for GET/POST/DELETE llm-keys.
