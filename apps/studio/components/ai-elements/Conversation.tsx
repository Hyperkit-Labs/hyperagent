"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  Children,
  cloneElement,
} from "react";

export function ConversationContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface ConversationProps {
  children: React.ReactNode;
  emptyMessage?: string;
  onDownloadMarkdown?: () => void;
  stickToBottom?: boolean;
  className?: string;
}

const SCROLL_THRESHOLD = 80;

export function ConversationScrollButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
      aria-label="Scroll to bottom"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </button>
  );
}

function getContentAndScrollButton(children: React.ReactNode): {
  content: ReactNode;
  hasScrollButton: boolean;
} {
  let content: ReactNode = null;
  let hasScrollButton = false;
  Children.forEach(children, (child) => {
    if (
      child &&
      typeof child === "object" &&
      "type" in child &&
      (child as { type: unknown }).type === ConversationContent
    ) {
      content = (child as React.ReactElement<{ children?: ReactNode }>).props
        .children;
    } else if (
      child &&
      typeof child === "object" &&
      "type" in child &&
      (child as { type: unknown }).type === ConversationScrollButton
    ) {
      hasScrollButton = true;
    }
  });
  return { content: content ?? children, hasScrollButton };
}

export function Conversation({
  children,
  emptyMessage = "No messages yet. Describe your contract or ask a question.",
  onDownloadMarkdown,
  stickToBottom = true,
  className = "",
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const wasNearBottom = useRef(true);
  const { content, hasScrollButton } = getContentAndScrollButton(children);
  const childCount = Array.isArray(content) ? content.length : content ? 1 : 0;
  const isEmpty = childCount === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom && wasNearBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [content, stickToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
      wasNearBottom.current = nearBottom;
      setShowScrollButton(!nearBottom);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [childCount]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    wasNearBottom.current = true;
  }, []);

  const scrollButtonElement = hasScrollButton
    ? Children.map(children, (child) =>
        child &&
        typeof child === "object" &&
        "type" in child &&
        (child as { type: unknown }).type === ConversationScrollButton
          ? cloneElement(
              child as React.ReactElement<{ onClick?: () => void }>,
              { onClick: scrollToBottom },
            )
          : null,
      )?.find(Boolean)
    : null;

  return (
    <div className={`flex-1 flex flex-col min-h-0 relative ${className}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[var(--color-text-tertiary)] text-sm">
              {emptyMessage}
            </p>
          </div>
        )}
        {content}
      </div>
      <div className="absolute right-6 bottom-4 flex items-center gap-2">
        {showScrollButton &&
          (scrollButtonElement ?? (
            <ConversationScrollButton onClick={scrollToBottom} />
          ))}
        {onDownloadMarkdown && !isEmpty && (
          <button
            type="button"
            onClick={onDownloadMarkdown}
            className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors text-xs"
          >
            Download Markdown
          </button>
        )}
      </div>
    </div>
  );
}
