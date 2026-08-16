import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal, Shield } from 'lucide-react';
import { getStoredToken } from '../api/client';;;

interface ExecTerminalProps {
  stackId: string;
  service: string;
}

export const ExecTerminal: React.FC<ExecTerminalProps> = ({ stackId, service }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#1e293b',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[38;2;56;189;248m=== DockOps Interactive Shell Exec ===\x1b[0m`);
    term.writeln(`\x1b[90mConnecting to container \x1b[33m${stackId}/${service}\x1b[90m via WebSocket...\x1b[0m\r\n`);

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getStoredToken();
    let wsUrl = `${protocol}//${host}/api/exec/${encodeURIComponent(stackId)}/${encodeURIComponent(service)}`;
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln(`\x1b[32m✔ Connected to ${service} container shell.\x1b[0m\r\n`);
      // Send initial newline to prompt shell
      ws.send('\n');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = () => {
      term.writeln(`\r\n\x1b[31m✖ Exec WebSocket Connection Error.\x1b[0m`);
    };

    ws.onclose = () => {
      term.writeln(`\r\n\x1b[90m--- Shell session closed ---\x1b[0m`);
    };

    // Forward terminal keystrokes to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [stackId, service]);

  return (
    <div className="flex flex-col h-full bg-dark-950 rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 font-mono">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span>Container Shell: <strong className="text-white">{service}</strong></span>
        </div>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <Shield size={11} className="text-brand-400" /> Interactive sh/bash
        </span>
      </div>

      <div ref={terminalRef} className="flex-1 p-3 min-h-[300px]" />
    </div>
  );
};
