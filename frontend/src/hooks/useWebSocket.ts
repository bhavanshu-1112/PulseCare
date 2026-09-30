import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  updateType?: string;
  data?: any;
  timestamp?: string;
  clientId?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (apiUrl && apiUrl.startsWith('http')) {
        try {
          const urlObj = new URL(apiUrl);
          const wsProto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProto}//${urlObj.host}/ws`;
        } catch {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${protocol}//${window.location.host}/ws`;
        }
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);
        if (msg.type === 'update') {
          setMessages(prev => [msg, ...prev].slice(0, 100)); // Keep last 100
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected, reconnecting in 3s...');
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { isConnected, lastMessage, messages };
}
