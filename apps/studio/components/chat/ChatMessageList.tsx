'use client';

import { Conversation, ConversationContent, ConversationScrollButton, Message, Tool, Shimmer } from '@/components/ai-elements';
import { GlowingBorder } from '@/components/ui';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ToolInvocation {
  toolCallId?: string;
  toolName?: string;
  state?: string;
  result?: { workflow_id?: string; message?: string } | null;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  toolInvocations?: ToolInvocation[];
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingContent?: string;
  emptyMessage?: string;
  onDownloadMarkdown?: () => void;
}

export function ChatMessageList({
  messages,
  isLoading = false,
  streamingContent,
  emptyMessage = 'No messages yet. Describe your contract or ask a question.',
  onDownloadMarkdown,
}: ChatMessageListProps) {
  const handleDownloadMarkdown = () => {
    if (onDownloadMarkdown) {
      onDownloadMarkdown();
      return;
    }
    const lines = messages.map((m) => {
      const role = m.role === 'user' ? 'User' : 'HyperAgent';
      return `## ${role}\n\n${m.content}`;
    });
    const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-export.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Conversation
      emptyMessage={emptyMessage}
      onDownloadMarkdown={messages.length > 0 ? handleDownloadMarkdown : undefined}
    >
      <ConversationContent>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <Message from={msg.role} content={typeof msg.content === 'string' ? msg.content : ''}>
              {msg.role === 'assistant' &&
                msg.toolInvocations?.map((inv, i) => (
                  <Tool
                    key={inv.toolCallId ?? i}
                    toolName={inv.toolName ?? 'create_workflow'}
                    status={inv.state === 'result' ? 'result' : inv.state === 'partial' ? 'running' : 'result'}
                    result={inv.result}
                  />
                ))}
            </Message>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start gap-2 max-w-full w-full">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded bg-indigo-500/30 flex items-center justify-center">
                <Shimmer height="h-2.5" width="w-2.5" rounded="full" />
              </div>
              <span className="text-[11px] font-semibold text-indigo-400">
                HyperAgent
              </span>
            </div>
            <GlowingBorder active={true} className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 backdrop-blur-sm px-4 py-3 max-w-[90%] w-full">
              <div className="rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] leading-relaxed overflow-hidden">
                <div className="px-2 py-1.5 border-b border-white/5 text-[var(--color-text-muted)]">
                  HyperAgent is thinking
                </div>
                <div className="px-2 py-2 space-y-1 text-[var(--color-text-tertiary)]">
                  <div className="animate-pulse">[Firecracker] Booting VM...</div>
                  <div className="animate-pulse" style={{ animationDelay: '150ms' }}>[Solc] Compiling...</div>
                  <div className="animate-pulse" style={{ animationDelay: '300ms' }}>[Pipeline] Running design step...</div>
                </div>
              </div>
              {streamingContent != null && streamingContent !== '' && (
                <div className="mt-3 text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {typeof streamingContent === 'string' ? streamingContent : String(streamingContent)}
                </div>
              )}
            </GlowingBorder>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
