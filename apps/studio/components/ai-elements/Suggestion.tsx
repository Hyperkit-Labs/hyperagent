'use client';

export interface SuggestionItem {
  label: string;
  prompt: string;
}

const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
  { label: 'Create ERC20', prompt: 'Create an ERC20 token with name MyToken and symbol MTK' },
  { label: 'Audit contract', prompt: 'Audit my smart contract for security issues' },
  { label: 'Deploy to testnet', prompt: 'Deploy my contract to the testnet' },
];

export interface SuggestionProps {
  suggestion: string;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function Suggestion({ suggestion, onClick, className = '', children }: SuggestionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary-alpha-20)] transition-colors ${className}`}
    >
      {children}
      {suggestion}
    </button>
  );
}

export interface SuggestionsProps {
  items?: SuggestionItem[];
  onSelect: (prompt: string) => void;
  className?: string;
}

export function Suggestions({
  items = DEFAULT_SUGGESTIONS,
  onSelect,
  className = '',
}: SuggestionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 p-2 border-b border-[var(--color-border-subtle)] ${className}`}>
      {items.map((item) => (
        <Suggestion
          key={item.label}
          suggestion={item.label}
          onClick={() => onSelect(item.prompt)}
        />
      ))}
    </div>
  );
}
