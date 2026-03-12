/**
 * Next.js API route for proxying workflow code generation streaming.
 * Proxies backend SSE to a format compatible with Vercel AI SDK (useCompletion / data stream).
 */

import { NextRequest } from 'next/server';
import { formatDataStreamPart } from 'ai';
import { getApiBase } from '@/lib/api';

function createRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workflowId } = await params;
  const requestId = request.headers.get('x-request-id') ?? createRequestId();

  if (!workflowId) {
    return new Response(
      JSON.stringify({ error: 'Workflow ID required', requestId }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId } }
    );
  }

  const backendBase = getApiBase();
  const streamUrl = `${backendBase}/streaming/workflows/${workflowId}/code`;

  try {
    const response = await fetch(streamUrl, {
      credentials: 'include',
      headers: {
        ...(request.headers.get('authorization') && {
          authorization: request.headers.get('authorization')!,
        }),
        ...(request.headers.get('cookie') && {
          cookie: request.headers.get('cookie')!,
        }),
        'x-request-id': requestId,
      },
    });

    if (!response.ok) {
      const backendRequestId = response.headers.get('x-request-id') ?? requestId;
      const body = JSON.stringify({
        error: `Backend streaming error: ${response.statusText}`,
        requestId: backendRequestId,
      });
      return new Response(body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': backendRequestId },
      });
    }

    // Create a readable stream that transforms SSE format for Vercel AI SDK
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }

            // Decode chunk
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.done) {
                    const enc = new TextEncoder();
                    controller.enqueue(enc.encode(formatDataStreamPart('finish_message', { finishReason: 'stop' }) + '\n'));
                    controller.close();
                    return;
                  }
                  if (data.text != null) {
                    const textStr = typeof data.text === 'string' ? data.text : String(data.text);
                    const enc = new TextEncoder();
                    controller.enqueue(enc.encode(formatDataStreamPart('text', textStr) + '\n'));
                  } else if (data.error) {
                    const enc = new TextEncoder();
                    controller.enqueue(enc.encode(formatDataStreamPart('error', typeof data.error === 'string' ? data.error : String(data.error)) + '\n'));
                    controller.close();
                    return;
                  }
                } catch {
                  continue;
                }
              } else if (line.trim() === '') {
                continue;
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch (error) {
    console.error('[streaming]', requestId, error);
    const body = JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
    return new Response(body, {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  }
}
