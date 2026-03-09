# Vercel AI SDK Usage in Studio

The Studio uses the [Vercel AI SDK](https://sdk.vercel.ai) so we don't reimplement chat, streaming, or tool-calling from scratch.

## What We Use

- **`useChat`** (`ai/react`) – Chat state, streaming, and message list. Configured in `hooks/useAppChat.ts` with `/api/chat`, optional `body: { network }`, and `Authorization` header for BYOK.
- **`streamText`** (`ai`) – Server-side streaming in `app/api/chat/route.ts` with OpenAI and a `create_workflow` tool that calls the gateway.
- **`useCompletion`** (`ai/react`) – Used in `hooks/useWorkflowStreaming.ts` for workflow code generation streaming.

## Maximizing the SDK

1. **Reuse SDK primitives**  
   Prefer SDK hooks and types instead of custom chat state. Our `ChatMessageList` and `Message` components consume the same message shape that `useChat` provides; we normalize `content` (string or parts array) so rendering always receives a string.

2. **Message content**  
   The SDK can send `content` as a string or as an array of parts (e.g. `[{ type: 'text', text: '...' }, { type: 'tool-create_workflow', ... }]`). We normalize in:
   - **Server** (`app/api/chat/route.ts`): `normalizeContent()` and `toModelMessage()` so `streamText` always gets `{ role, content: string }`.
   - **Client** (`app/page.tsx`): `messageContent()` so we always pass a string into `ChatMessageList` and `Message`. This avoids "text parts expect a string value" when the SDK hands us parts.

3. **Tool parts**  
   For type-safe tool UI, the SDK recommends typed parts (`tool-create_workflow`) and `part.input` / `part.output` instead of generic `tool-invocation` and `args`/`result`. Our `Tool` component and `toolInvocations` on messages align with that; we map SDK tool invocations into `ToolInvocation` for display.

4. **Stream format**  
   The chat route currently uses `result.toDataStreamResponse()`. For full compatibility with `useChat`’s expected stream format (and to avoid stream-parse errors like "text parts expect a string value"), use `result.toUIMessageStreamResponse()` when your AI SDK version exports it. If the error persists, upgrade the `ai` package to a version that provides `toUIMessageStreamResponse()` and use it in `app/api/chat/route.ts`.

5. **Existing components**  
   We already use SDK-aligned building blocks:
   - `useAppChat` → `useChat` with API, body, and headers.
   - `ChatMessageList` + `Message` + `Tool` from `@/components/chat` and `@/components/ai-elements` for rendering messages and tool invocations.
   - `PromptInput` and `Conversation` for input and layout.

Adding new chat or streaming features should be done by extending these hooks and components and reusing the SDK’s message/part types instead of reimplementing them.
