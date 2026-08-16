import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useLogSocket } from '../hooks/useLogSocket';
import { Trash2, Copy, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { systemApi} from '../api';
import { AppSettings } from '../types';;

interface LogTerminalProps {
  stackId: string;
  service?: string;
  customWsUrl?: string;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ stackId, service, customWsUrl }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { logs, status, reconnectCount, clearLogs } = useLogSocket({
    stackId,
    service,
    customWsUrl,
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => systemApi.getSettings(),
  });
  const engine = settings?.container_engine ?? 'docker';

  // Initialise xterm.js instance
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#6366f1',
        selectionBackground: '#334155',
        black: '#090d16',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[36m>>> Connected to GitOps log engine stream for [${stackId}]\x1b[0m`);

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Ignore container zero-dimension errors on unmount
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [stackId]);

  // Append incoming log lines to xterm
  const lastLogIndexRef = useRef(0);
  useEffect(() => {
    if (!xtermRef.current) return;

    const term = xtermRef.current;
    if (logs.length < lastLogIndexRef.current) {
      // Logs were cleared
      term.clear();
      lastLogIndexRef.current = 0;
    }

    const newLines = logs.slice(lastLogIndexRef.current);
    newLines.forEach((line) => {
      term.writeln(line);
    });

    lastLogIndexRef.current = logs.length;
  }, [logs]);

  const handleClear = () => {
    clearLogs();
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const handleCopyLogs = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-800 bg-dark-950 shadow-2xl">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-dark-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="text-slate-400 font-mono text-xs">{engine} compose logs --follow --timestamps</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-dark-950">
            {status === 'connected' && (
              <>
                <Wifi size={12} className="text-emerald-400" />
                <span className="text-emerald-400">Live Stream</span>
              </>
            )}
            {status === 'connecting' && (
              <>
                <RefreshCw size={12} className="text-indigo-400 animate-spin" />
                <span className="text-indigo-400">Connecting...</span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <WifiOff size={12} className="text-slate-400" />
                <span className="text-slate-400">Disconnected</span>
              </>
            )}
            {status === 'error' && (
              <>
                <WifiOff size={12} className="text-rose-400" />
                <span className="text-rose-400">
                  {reconnectCount > 0 ? `Reconnecting (${reconnectCount})...` : 'Error'}
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Copy logs to clipboard"
          >
            <Copy size={14} />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            title="Clear terminal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Canvas Container */}
      <div className="flex-1 p-3 min-h-[350px] relative">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};
