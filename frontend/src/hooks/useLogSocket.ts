import { useState, useEffect, useRef, useCallback } from 'react';
import { getStoredToken } from '../api/client';;;

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseLogSocketOptions {
  stackId: string | null;
  service?: string | null;
  onLogReceived?: (line: string) => void;
  maxReconnectAttempts?: number;
  customWsUrl?: string;
}

/**
 * Custom hook for streaming live Docker logs via WebSocket with automatic reconnect.
 */
export function useLogSocket({
  stackId,
  service,
  onLogReceived,
  maxReconnectAttempts = 5,
  customWsUrl,
}: UseLogSocketOptions) {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const [reconnectCount, setReconnectCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onLogRef = useRef(onLogReceived);

  // Keep callback reference updated
  useEffect(() => {
    onLogRef.current = onLogReceived;
  }, [onLogReceived]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!stackId) {
      setStatus('disconnected');
      return;
    }

    let isSubscribed = true;

    const connect = () => {
      if (!isSubscribed) return;

      setStatus('connecting');
      setLogs([]); // Clear previous logs when connecting to a new stream
      setReconnectCount(0);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const token = getStoredToken();
      let wsUrl = customWsUrl 
        ? `${protocol}//${host}${customWsUrl}`
        : `${protocol}//${host}/api/logs/${encodeURIComponent(stackId)}`;
        
      const queryParams: string[] = [];
      if (token) queryParams.push(`token=${encodeURIComponent(token)}`);
      if (service && !customWsUrl) queryParams.push(`service=${encodeURIComponent(service)}`);
      if (queryParams.length > 0) {
        wsUrl += (wsUrl.includes('?') ? '&' : '?') + queryParams.join('&');
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isSubscribed) return;
        setStatus('connected');
        setReconnectCount(0);

        // Send token as first auth message if token exists (browser WS headers can be limited)
        const token = getStoredToken();
        if (token) {
          // Keep-alive or optional auth payload
        }

        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('PING');
          }
        }, 15000);
      };

      socket.onmessage = (event) => {
        if (!isSubscribed) return;
        const data = event.data;
        if (typeof data === 'string') {
          setLogs((prev) => [...prev.slice(-2000), data]); // Keep last 2000 lines
          if (onLogRef.current) {
            onLogRef.current(data);
          }
        }
      };

      socket.onerror = (err) => {
        if (!isSubscribed) return;
        console.error('WebSocket Error:', err);
        setStatus('error');
      };

      socket.onclose = (event) => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (!isSubscribed) return;
        setStatus('disconnected');
        socketRef.current = null;

        // Exponential backoff reconnect strategy if not closed normally (code 1000)
        if (event.code !== 1000) {
          setReconnectCount((prevCount) => {
            const nextCount = prevCount + 1;
            if (nextCount <= maxReconnectAttempts) {
              const delay = Math.min(1000 * Math.pow(2, prevCount), 10000);
              console.log(`Log socket disconnected. Reconnecting in ${delay}ms (attempt ${nextCount}/${maxReconnectAttempts})...`);
              reconnectTimeoutRef.current = setTimeout(connect, delay);
            }
            return nextCount;
          });
        }
      };
    };

    connect();

    return () => {
      isSubscribed = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted');
        socketRef.current = null;
      }
    };
  }, [stackId, service, maxReconnectAttempts, customWsUrl]);

  return {
    logs,
    status,
    reconnectCount,
    clearLogs,
    isConnected: status === 'connected',
  };
}
