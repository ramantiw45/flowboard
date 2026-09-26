import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Client, type IStompSocket, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_URL } from '../api/client';
import { useAuth } from './AuthContext';
import type { BoardEvent } from '../types';

type EventListener = (event: BoardEvent) => void;

interface TopicEntry {
  subscription?: StompSubscription;
  listeners: Set<EventListener>;
}

interface WebSocketContextValue {
  connected: boolean;
  /** Subscribe to /topic/board/{boardId}; returns an unsubscribe function. */
  subscribeBoard: (boardId: string, listener: EventListener) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  subscribeBoard: () => () => undefined,
});

export function useWebSocket(): WebSocketContextValue {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, logout } = useAuth();
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const topicsRef = useRef<Map<string, TopicEntry>>(new Map());

  useEffect(() => {
    if (!token) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      setConnected(false);
      return;
    }

    const client = new Client({
      // SockJS transport (matches backend /ws-board endpoint with SockJS fallback).
      webSocketFactory: () => new SockJS(WS_URL) as unknown as IStompSocket,
      // JWT travels on the STOMP CONNECT frame; JwtChannelInterceptor validates it.
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => undefined,
    });

    client.onConnect = () => {
      setConnected(true);
      // (Re-)subscribe every active board topic after (re)connection.
      topicsRef.current.forEach((entry, boardId) => {
        entry.subscription?.unsubscribe();
        entry.subscription = client.subscribe(`/topic/board/${boardId}`, (message) => {
          try {
            const event = JSON.parse(message.body) as BoardEvent;
            entry.listeners.forEach((listener) => listener(event));
          } catch {
            // Malformed frame — ignore.
          }
        });
      });
    };

    client.onWebSocketClose = () => setConnected(false);
    client.onStompError = (frame) => {
      setConnected(false);
      // The server rejects CONNECT when the JWT is missing, malformed or
      // expired. Without this the client would reconnect every 5s with the
      // same dead token forever and the UI would just show 'Reconnecting',
      // so the user could never sign in again without a manual reload.
      const reason = (frame.headers.message ?? '').toLowerCase();
      if (reason.includes('jwt') || reason.includes('authorization') || reason.includes('authenticated')) {
        client.deactivate();
        logout();
      }
    };

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
      topicsRef.current.forEach((entry) => {
        entry.subscription = undefined;
      });
    };
  }, [token, logout]);

  const subscribeBoard = useCallback((boardId: string, listener: EventListener) => {
    let entry = topicsRef.current.get(boardId);
    if (!entry) {
      entry = { listeners: new Set() };
      topicsRef.current.set(boardId, entry);
    }
    entry.listeners.add(listener);

    // Subscribe immediately if the socket is already up.
    const client = clientRef.current;
    if (client && client.connected && !entry.subscription) {
      entry.subscription = client.subscribe(`/topic/board/${boardId}`, (message) => {
        try {
          const event = JSON.parse(message.body) as BoardEvent;
          entry!.listeners.forEach((l) => l(event));
        } catch {
          // ignore
        }
      });
    }

    return () => {
      const current = topicsRef.current.get(boardId);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        current.subscription?.unsubscribe();
        topicsRef.current.delete(boardId);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, subscribeBoard }}>
      {children}
    </WebSocketContext.Provider>
  );
}
