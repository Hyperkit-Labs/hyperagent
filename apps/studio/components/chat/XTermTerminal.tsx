'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface AgentDiscussionEvent {
  type?: string;
  stage?: string;
  message?: string;
  status?: string;
  [key: string]: unknown;
}

export interface XTermTerminalProps {
  events: AgentDiscussionEvent[];
  className?: string;
}

export function XTermTerminal({ events, className = '' }: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafafa',
      },
      fontSize: 11,
      fontFamily: 'ui-monospace, monospace',
      cursorBlink: false,
      cursorStyle: 'block',
      allowProposedApi: false,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;
    return () => {
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term || events.length <= lastCountRef.current) return;
    const newEvents = events.slice(lastCountRef.current);
    newEvents.forEach((ev) => {
      const msg = ev.message ?? ev.status ?? '';
      if (!msg) return;
      if (ev.type === 'log') {
        const stage = ev.stage ?? 'agent';
        const isError = (ev.status ?? '').toLowerCase() === 'error';
        const prefix = isError
          ? '\x1b[31m[ERROR]\x1b[0m '
          : `\x1b[1;34m[${String(stage).toUpperCase()}]\x1b[0m `;
        term.writeln(prefix + msg);
      } else {
        const prefix = ev.stage ? `\x1b[1;34m[${String(ev.stage).toUpperCase()}]\x1b[0m ` : '';
        term.writeln(prefix + msg);
      }
    });
    lastCountRef.current = events.length;
    term.scrollToBottom();
  }, [events]);

  return (
    <div
      ref={containerRef}
      className={`terminal-container min-h-[200px] ${className}`}
      role="log"
      aria-label="Agent build output"
    />
  );
}
