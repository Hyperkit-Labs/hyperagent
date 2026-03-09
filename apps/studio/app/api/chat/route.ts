/**
 * Chat API route - streams assistant replies for useChat (Vercel AI SDK).
 *
 * BYOK resolution order:
 *   1. X-LLM-Provider + X-LLM-Api-Key headers (pass-through, never stored).
 *      If either header is present we require both; never fall back to env.
 *   2. Server env (dev only): OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY.
 *      In production (NODE_ENV=production or REQUIRE_AUTH=true), server env is NOT used per BYOK policy.
 *   3. No key -> return a user-facing placeholder message with CTA to add keys in Settings.
 */

import { streamText, createDataStreamResponse, formatDataStreamPart, tool, jsonSchema } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { jwtVerify } from 'jose';
import { getApiBase } from '@/lib/api';
import { validateInput as guardrailValidateInput } from '@/lib/input-guardrail';
import { FALLBACK_DEFAULT_NETWORK_ID } from '@/constants/defaults';

export const maxDuration = 60;

const JWT_SECRET = process.env.AUTH_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
const jwtSecretKey = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

async function extractUserIdFromJwt(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (jwtSecretKey) {
    try {
      const { payload } = await jwtVerify(token, jwtSecretKey);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

const SUPPORTED_PROVIDERS = ['openai', 'google', 'anthropic'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/** Never log raw API keys. Use this for any key-related debug output. */
function mask(key: string | undefined | null): string {
  if (!key) return '(empty)';
  return key.length > 6 ? `${key.slice(0, 4)}...${key.slice(-2)}` : '***';
}

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'test') console.info('[chat]', ...args);
}

function logError(...args: unknown[]) {
  console.error('[chat]', ...args);
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

function buildModel(provider: SupportedProvider, apiKey: string): LanguageModelV1 {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })('gpt-4o-mini');
    case 'google':
      return createGoogleGenerativeAI({ apiKey })('gemini-2.0-flash');
    case 'anthropic':
      return createAnthropic({ apiKey })('claude-3-5-sonnet-20241022');
  }
}

const PROVIDER_LABELS: Record<SupportedProvider, string> = {
  openai: 'OpenAI',
  google: 'Google Gemini',
  anthropic: 'Anthropic',
};

interface ResolvedModel {
  model: LanguageModelV1;
  provider: SupportedProvider;
  label: string;
}

function resolveModel(req: Request): ResolvedModel | Response | null {
  const rawProvider = req.headers.get('x-llm-provider')?.toLowerCase().trim() ?? '';
  const rawKey = req.headers.get('x-llm-api-key')?.trim() ?? '';
  const hasByokIntent = Boolean(rawProvider || rawKey);

  log('resolve provider=%s hasKey=%s keyMask=%s', rawProvider || '(none)', Boolean(rawKey), mask(rawKey));

  if (hasByokIntent) {
    if (!rawProvider || !rawKey) {
      return new Response(
        JSON.stringify({
          error: `Incomplete BYOK: ${!rawProvider ? 'X-LLM-Provider missing' : 'X-LLM-Api-Key missing'}. Both headers are required.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (!SUPPORTED_PROVIDERS.includes(rawProvider as SupportedProvider)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported provider "${rawProvider}". Use one of: ${SUPPORTED_PROVIDERS.join(', ')}.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const provider = rawProvider as SupportedProvider;
    return { model: buildModel(provider, rawKey), provider, label: PROVIDER_LABELS[provider] };
  }

  const isProduction = process.env.NODE_ENV === 'production' || process.env.REQUIRE_AUTH === 'true';
  if (!isProduction) {
    for (const [envVar, provider] of [
      ['OPENAI_API_KEY', 'openai'],
      ['GOOGLE_GENERATIVE_AI_API_KEY', 'google'],
      ['ANTHROPIC_API_KEY', 'anthropic'],
    ] as const) {
      const key = process.env[envVar];
      if (key?.trim()) {
        log('using env %s (dev only)', envVar);
        return { model: buildModel(provider, key.trim()), provider, label: PROVIDER_LABELS[provider] };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeContent(c: unknown): string {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    const textPart = (c as Array<{ type?: string; text?: unknown }>).find((p) => p.type === 'text');
    const val = textPart?.text;
    if (val == null) return '';
    return typeof val === 'string' ? val : String(val);
  }
  return '';
}

function toModelMessage(m: { role: string; content: string | unknown }) {
  return { role: m.role as 'user' | 'assistant' | 'system', content: normalizeContent(m.content) };
}

async function callBackendWorkflow(
  body: { nlp_input: string; network?: string; template_id?: string; api_keys?: Record<string, string> },
  authHeader: string | null,
  userId?: string | null,
): Promise<{ workflow_id: string }> {
  const base = getApiBase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  if (userId) headers['X-User-Id'] = userId;
  const res = await fetch(`${base}/workflows/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nlp_input: body.nlp_input,
      network: body.network || FALLBACK_DEFAULT_NETWORK_ID,
      ...(body.template_id ? { template_id: body.template_id } : {}),
      ...(body.api_keys && Object.keys(body.api_keys).length > 0 ? { api_keys: body.api_keys } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text || `Workflow create failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { detail?: string; error?: string };
      msg = j.detail ?? j.error ?? msg;
    } catch { /* keep */ }
    if (res.status === 402) {
      msg = msg.trim();
      if (!msg.toLowerCase().includes('payments') && !msg.toLowerCase().includes('top up')) {
        msg += ' Top up in Payments.';
      }
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ workflow_id: string }>;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const byokProvider = req.headers.get('x-llm-provider')?.toLowerCase().trim() ?? '';
  const byokApiKey = req.headers.get('x-llm-api-key')?.trim() ?? '';
  const userId = await extractUserIdFromJwt(authHeader);

  const byokKeysForPipeline: Record<string, string> = {};
  if (byokProvider && byokApiKey) {
    byokKeysForPipeline[byokProvider] = byokApiKey;
  }

  let parsed: { messages: Array<{ role: string; content: string | unknown }>; network?: string };
  try {
    parsed = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages: uiMessages, network: bodyNetwork } = parsed;
  const lastMessage = uiMessages?.[uiMessages.length - 1];
  const content = normalizeContent(lastMessage?.content);

  if (!content.trim()) {
    return new Response(JSON.stringify({ error: 'Message content required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const MAX_MESSAGE_LENGTH = 10_000;
  if (content.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const guardrail = guardrailValidateInput(content);
  if (!guardrail.passed) {
    return new Response(
      JSON.stringify({ error: guardrail.violation ?? 'Security policy violation' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const defaultNetwork = bodyNetwork || FALLBACK_DEFAULT_NETWORK_ID;

  const resolved = resolveModel(req);
  if (resolved instanceof Response) return resolved;

  if (resolved) {
    log('streaming with %s', resolved.label);
    const providerLabel = resolved.label;
    try {
      const streamResult = streamText({
        model: resolved.model,
        system:
          'You are a helpful assistant for the HyperAgent smart contract platform. Be concise and professional. When users ask to create a workflow or smart contract, use the create_workflow tool.',
        messages: uiMessages.map(toModelMessage),
        tools: {
          create_workflow: tool({
            description:
              'Create a new workflow (smart contract generation) from a natural language prompt. Returns workflow_id.',
            parameters: jsonSchema<{ prompt: string; network?: string; template_id?: string }>({
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Natural language description of the smart contract to create.' },
                network: { type: 'string', description: 'Target blockchain network (e.g. skalebase-sepolia).' },
                template_id: { type: 'string', description: 'Optional template id.' },
              },
              required: ['prompt'],
            }),
            execute: async ({ prompt, network, template_id }) => {
              try {
                const result = await callBackendWorkflow(
                  { nlp_input: prompt, network: network || defaultNetwork, template_id, api_keys: byokKeysForPipeline },
                  authHeader,
                  userId,
                );
                return { workflow_id: result.workflow_id, message: `Workflow created. View at /workflows/${result.workflow_id}` };
              } catch (toolErr) {
                const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
                logError('create_workflow tool error:', msg);
                return { workflow_id: null, message: `Workflow creation failed: ${msg}` };
              }
            },
          }),
        },
      });
      return streamResult.toDataStreamResponse({
        getErrorMessage: (error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
          const combined = [msg, cause].filter(Boolean).join(' | ').slice(0, 500);
          logError('stream error provider=%s: %s', providerLabel, combined);
          return combined || `${providerLabel} request failed. Check your API key and quota.`;
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
      const combined = [message, cause].filter(Boolean).join(' | ').slice(0, 500);
      logError('pre-stream error provider=%s: %s', providerLabel, combined, err);
      return new Response(
        JSON.stringify({ error: combined || 'LLM request failed. Check your API key and quota.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  log('no model available, returning placeholder');
  const placeholder =
    'No LLM key detected for this request. Open Settings (gear icon) and add an API key (OpenAI, Gemini, or Anthropic), then try again.';
  return createDataStreamResponse({
    headers: { 'X-Vercel-AI-Data-Stream': 'v1' },
    execute: (writer) => {
      writer.write(formatDataStreamPart('text', placeholder));
      writer.write(formatDataStreamPart('finish_message', { finishReason: 'stop' }));
    },
  });
}
