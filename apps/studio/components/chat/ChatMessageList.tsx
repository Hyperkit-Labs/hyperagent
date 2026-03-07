'use client';

import { Conversation, ConversationContent, ConversationScrollButton, Message, Tool, Shimmer } from '@/components/ai-elements';

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
              <div className="w-4 h-4 rounded bg-[var(--color-primary-alpha-20)] flex items-center justify-center">
                <Shimmer height="h-2.5" width="w-2.5" rounded="full" />
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-primary-light)]">
                HyperAgent
              </span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <Shimmer height="h-4" width="w-24" rounded="md" />
            </div>
            {streamingContent != null && streamingContent !== '' && (
              <div className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed whitespace-pre-wrap">
                {typeof streamingContent === 'string' ? streamingContent : String(streamingContent)}
              </div>
            )}
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
