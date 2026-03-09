'use client';

import { useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const MIN_ROWS = 1;
const MAX_ROWS = 8;

const textareaBaseClass =
  'w-full bg-transparent text-[var(--color-text-primary)] text-[13px] px-3 py-3 min-h-[50px] max-h-[200px] focus:outline-none resize-none placeholder:text-[var(--color-text-muted)] disabled:opacity-60';

export interface PromptInputTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function PromptInputTextarea({
  value,
  onChange,
  placeholder = 'Describe your contract or ask a question...',
  disabled = false,
  className = '',
  onKeyDown,
}: PromptInputTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const rows = Math.min(Math.max(MIN_ROWS, el.value.split('\n').length), MAX_ROWS);
    el.style.height = `${rows * lineHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      rows={MIN_ROWS}
      className={`${textareaBaseClass} ${className}`}
      onKeyDown={onKeyDown}
    />
  );
}

export function PromptInputButton({
  disabled,
  className = '',
}: {
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-mid)] text-[var(--color-text-primary)] disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-md ${className}`}
      aria-label="Send"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}

export function PromptInputAttachments({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-2 flex flex-wrap gap-2 border-b border-[var(--color-border-subtle)]">{children}</div>;
}

export function PromptInputFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between px-2 pb-2 pt-1">{children}</div>;
}

export interface PromptInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  attachments?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PromptInput({
  value = '',
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Describe your contract or ask a question...',
  attachments,
  footer,
  children,
  className = '',
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  useEffect(() => {
    if (children) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const rows = Math.min(Math.max(MIN_ROWS, el.value.split('\n').length), MAX_ROWS);
    el.style.height = `${rows * lineHeight}px`;
  }, [value, children]);

  if (children) {
    return (
      <form onSubmit={handleSubmit} className={`p-4 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-subtle)] ${className}`}>
        <div className="relative rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-sm focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
          {children}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-4 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-subtle)] ${className}`}>
      <div className="relative rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-sm focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
        {attachments}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={MIN_ROWS}
          className={textareaBaseClass}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!disabled && value.trim()) onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
        />
        {footer ?? (
          <div className="flex items-center justify-end px-2 pb-2">
            <PromptInputButton disabled={disabled || !value.trim()} />
          </div>
        )}
      </div>
    </form>
  );
}
