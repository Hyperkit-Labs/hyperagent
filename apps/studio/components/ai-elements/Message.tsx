'use client';

import { Bot } from 'lucide-react';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageProps {
  role?: MessageRole;
  from?: MessageRole;
  content: string;
  label?: string;
  children?: React.ReactNode;
}

/** Renders message text; use for plain or markdown-ready content. Streamdown-style rich markdown can be wired here later. */
export function MessageContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[13px] text-[var(--color-text-secondary)] leading-relaxed space-y-2 whitespace-pre-wrap ${className}`}>
      {children}
    </div>
  );
}

/** Assistant message body with optional streaming content. Use for markdown/code; aligns with registry MessageResponse (Streamdown). */
export function MessageResponse({
  content,
  children,
  className = '',
}: {
  content?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const body = children ?? (content ? <MessageContent>{content}</MessageContent> : null);
  return <div className={className}>{body}</div>;
}

export function Message({ role: roleProp, from, content, label, children }: MessageProps) {
  const role = from ?? roleProp ?? 'assistant';
  if (role === 'user') {
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="bg-[var(--color-primary-alpha-15)] text-[var(--color-text-primary)] px-4 py-2.5 rounded-2xl rounded-tr-sm border border-[var(--color-primary-alpha-25)] max-w-[90%] text-sm leading-relaxed shadow-sm">
          {content}
        </div>
      </div>
    );
  }

  if (role === 'system') {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] italic max-w-[90%]">
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 max-w-full w-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded bg-indigo-500/30 flex items-center justify-center">
          <Bot className="w-2.5 h-2.5 text-indigo-400" />
        </div>
        <span className="text-[11px] font-semibold text-indigo-400">
          {label ?? 'HyperAgent'}
        </span>
      </div>
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 backdrop-blur-sm px-4 py-2.5 shadow-sm max-w-[90%]">
        <MessageResponse content={content} />
        {children}
      </div>
    </div>
  );
}
