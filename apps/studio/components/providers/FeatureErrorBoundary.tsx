"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown in the fallback UI for support context */
  contextLabel?: string;
};

type State = { hasError: boolean; message: string };

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return {
      hasError: true,
      message: err.message || "This section failed to render.",
    };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    const label = this.props.contextLabel ?? "feature";
    console.error(`[FeatureErrorBoundary:${label}]`, err, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const label = this.props.contextLabel;
      return (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-6 space-y-3"
        >
          {label ? (
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {label}
            </p>
          ) : null}
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {this.state.message}
          </p>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
