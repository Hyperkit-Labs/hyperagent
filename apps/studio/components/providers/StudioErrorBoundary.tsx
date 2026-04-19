"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return {
      hasError: true,
      message: err.message || "Something went wrong in the Studio UI.",
    };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error("[StudioErrorBoundary]", err, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {this.state.message}
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg btn-primary-gradient text-sm font-medium text-white"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
