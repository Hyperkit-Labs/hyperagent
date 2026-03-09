/**
 * Next.js API route for proxying workflow code generation streaming.
 * Proxies backend SSE to a format compatible with Vercel AI SDK (useCompletion / data stream).
 */

import { NextRequest } from 'next/server';
import { formatDataStreamPart } from 'ai';
import { getApiBase } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workflowId } = await params;

  if (!workflowId) {
    return new Response('Workflow ID required', { status: 400 });
  }

  const backendBase = getApiBase();
  const streamUrl = `${backendBase}/streaming/workflows/${workflowId}/code`;

  try {
    // Forward the request to backend streaming endpoint
    // Include credentials for authenticated requests
    const response = await fetch(streamUrl, {
      credentials: 'include',
      headers: {
        // Forward authorization headers if present
        ...(request.headers.get('authorization') && {
          authorization: request.headers.get('authorization')!,
        }),
        // Forward cookie for session/auth
        ...(request.headers.get('cookie') && {
          cookie: request.headers.get('cookie')!,
        }),
      },
    });

    if (!response.ok) {
      return new Response(
        `Backend streaming error: ${response.statusText}`,
        { status: response.status }
      );
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
    console.error('Streaming proxy error:', error);
    return new Response(
      `Streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
