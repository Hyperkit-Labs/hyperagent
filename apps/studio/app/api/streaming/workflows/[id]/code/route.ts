/**
 * Next.js API route for proxying workflow code generation streaming.
 * Proxies backend SSE to AI SDK 5 UI message stream (SSE) for useCompletion.
 */

import { NextRequest } from "next/server";
import { generateId, UI_MESSAGE_STREAM_HEADERS, type UIMessageChunk } from "ai";
import { streamingWorkflowCodePath } from "@hyperagent/api-contracts";
import { getApiBase, joinApiUrlForFetch } from "@/lib/api";

function createRequestId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sseDataLine(part: UIMessageChunk): Uint8Array {
  const s = `data: ${JSON.stringify(part)}\n\n`;
  return new TextEncoder().encode(s);
}

async function runWorkflowCodeStream(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workflowId } = await params;
  const requestId = request.headers.get("x-request-id") ?? createRequestId();

  if (!workflowId) {
    return new Response(
      JSON.stringify({ error: "Workflow ID required", requestId }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  }

  const backendBase = getApiBase();
  const streamUrl = joinApiUrlForFetch(
    backendBase,
    streamingWorkflowCodePath(workflowId),
  );

  try {
    const response = await fetch(streamUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        ...(request.headers.get("authorization") && {
          authorization: request.headers.get("authorization")!,
        }),
        ...(request.headers.get("cookie") && {
          cookie: request.headers.get("cookie")!,
        }),
        "x-request-id": requestId,
      },
    });

    if (!response.ok) {
      const backendRequestId =
        response.headers.get("x-request-id") ?? requestId;
      const body = JSON.stringify({
        error: `Backend streaming error: ${response.statusText}`,
        requestId: backendRequestId,
      });
      return new Response(body, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": backendRequestId,
        },
      });
    }

    const textId = generateId();
    let textStarted = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        const send = (part: UIMessageChunk) => {
          controller.enqueue(sseDataLine(part));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              if (textStarted) {
                send({ type: "text-end", id: textId });
              }
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as {
                    done?: boolean;
                    text?: unknown;
                    error?: unknown;
                  };
                  if (data.done) {
                    if (textStarted) {
                      send({ type: "text-end", id: textId });
                    }
                    controller.close();
                    return;
                  }
                  if (data.text != null) {
                    const textStr =
                      typeof data.text === "string"
                        ? data.text
                        : String(data.text);
                    if (!textStarted) {
                      send({ type: "text-start", id: textId });
                      textStarted = true;
                    }
                    send({
                      type: "text-delta",
                      id: textId,
                      delta: textStr,
                    });
                  } else if (data.error) {
                    send({
                      type: "error",
                      errorText:
                        typeof data.error === "string"
                          ? data.error
                          : String(data.error),
                    });
                    controller.close();
                    return;
                  }
                } catch {
                  continue;
                }
              } else if (line.trim() === "") {
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
        ...UI_MESSAGE_STREAM_HEADERS,
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    console.error("[streaming]", requestId, error);
    const body = JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      requestId,
    });
    return new Response(body, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    });
  }
}

export function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return runWorkflowCodeStream(request, context);
}

export function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return runWorkflowCodeStream(request, context);
}
