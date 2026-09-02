/**
 * useRealtimeSocket — manages the /realtime Socket.IO connection lifecycle.
 *
 * LIVE indicator rules (per spec):
 *  - isLive = connected AND connectionEstablished AND heartbeatAge < 35s
 *  - The server only emits `connection_established` to fully authenticated sockets.
 *  - REST polling is NEVER triggered automatically; opt-in via { fallbackPoll: true }.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface RealtimeEvent {
  v: number;
  event: string;
  data: any;
  ts: string;
}

export interface UseRealtimeSocketOptions {
  token: string | null;
  baseUrl?: string;
  /** Only activate HTTP polling when the caller explicitly passes true */
  fallbackPoll?: boolean;
  onEvent?: (event: string, payload: RealtimeEvent) => void;
}

export interface UseRealtimeSocketReturn {
  /** True ONLY when socket is connected, auth was confirmed, and heartbeat is fresh (<35s) */
  isLive: boolean;
  /** ISO timestamp of the last server event received */
  lastUpdated: string | null;
  /** Number of ms since last heartbeat pong (null = not yet received) */
  heartbeatAge: number | null;
  /** Subscribe to a named socket event */
  on: (event: string, handler: (payload: any) => void) => void;
  /** Unsubscribe from a named socket event */
  off: (event: string, handler: (payload: any) => void) => void;
  /** Emit an event to the server, returns a promise with the ack */
  emit: (event: string, data?: any) => Promise<any>;
  /** Manually join a room */
  joinRoom: (event: string, data: any) => Promise<any>;
  /** Current socket connection state */
  connectionState: "disconnected" | "connecting" | "connected" | "auth_failed";
}

const HEARTBEAT_STALE_MS = 35_000;

const resolveSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/v1\/?$/, "");
  }
  if (typeof window !== "undefined" && import.meta.env.PROD) {
    return window.location.origin;
  }
  return "http://localhost:3000";
};

const BACKEND_URL = resolveSocketUrl();

export function useRealtimeSocket({
  token,
  baseUrl = BACKEND_URL,
  fallbackPoll = false,
  onEvent,
}: UseRealtimeSocketOptions): UseRealtimeSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const lastPongRef = useRef<number | null>(null);
  const joinedRoomsRef = useRef<Array<{ event: string; data: any }>>([]);

  const [isLive, setIsLive] = useState(false);
  const [connectionEstablished, setConnectionEstablished] = useState(false);
  const [connected, setConnected] = useState(false);
  const [heartbeatAge, setHeartbeatAge] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<UseRealtimeSocketReturn["connectionState"]>("disconnected");

  // Recompute isLive whenever any dependency changes
  useEffect(() => {
    const age = lastPongRef.current !== null ? Date.now() - lastPongRef.current : Infinity;
    setIsLive(connected && connectionEstablished && age < HEARTBEAT_STALE_MS);
  }, [connected, connectionEstablished, heartbeatAge]);

  useEffect(() => {
    if (!token) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");

    const origin = baseUrl.replace(/\/api\/v\d+.*$/, "");
    const socket = io(`${origin}/realtime`, {
      auth: { token },
      // ONLY use polling as a transport if fallbackPoll is explicitly true
      transports: fallbackPoll ? ["polling", "websocket"] : ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    socketRef.current = socket;

    // ── Connection established (auth confirmed by server) ─────────────
    socket.on("connection_established", (payload: RealtimeEvent) => {
      setConnectionEstablished(true);
      setLastUpdated(payload.ts);
      setConnectionState("connected");

      // Re-join previously joined rooms on reconnect
      for (const room of joinedRoomsRef.current) {
        socket.emit(room.event, room.data);
      }
    });

    socket.on("connect", () => setConnected(true));

    socket.on("disconnect", () => {
      setConnected(false);
      setConnectionEstablished(false);
      setIsLive(false);
      setConnectionState("disconnected");
    });

    socket.on("connect_error", (err: Error) => {
      if (err.message.includes("Unauthorized")) {
        setConnectionState("auth_failed");
      } else {
        setConnectionState("disconnected");
      }
    });

    // ── Heartbeat ─────────────────────────────────────────────────────
    socket.on("ping", () => {
      socket.emit("pong");
      lastPongRef.current = Date.now();
      setHeartbeatAge(0);
      setLastUpdated(new Date().toISOString());
    });

    // ── Generic versioned event passthrough ───────────────────────────
    const eventNames = [
      "appointment_status_update",
      "new_service_request",
      "provider_response",
      "location_update",
      "provider_location_stale",
      "emergency_alert",
      "notification",
      "admin_metrics",
      "new_message",
    ];
    for (const evt of eventNames) {
      socket.on(evt, (payload: RealtimeEvent) => {
        setLastUpdated(payload?.ts || new Date().toISOString());
        onEvent?.(evt, payload);
      });
    }

    // Heartbeat staleness ticker — runs every 5 s
    const ticker = setInterval(() => {
      if (lastPongRef.current !== null) {
        const age = Date.now() - lastPongRef.current;
        setHeartbeatAge(age);
        // If pong is stale, drop LIVE status
        if (age >= HEARTBEAT_STALE_MS) {
          setIsLive(false);
        }
      }
    }, 5000);

    return () => {
      clearInterval(ticker);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectionEstablished(false);
      setIsLive(false);
      setConnectionState("disconnected");
    };
  }, [token, baseUrl, fallbackPoll]); // eslint-disable-line react-hooks/exhaustive-deps

  const on = useCallback((event: string, handler: (payload: any) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (payload: any) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: any): Promise<any> => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        resolve({ ok: false, error: "Not connected" });
        return;
      }
      socketRef.current.emit(event, data, (ack: any) => resolve(ack));
    });
  }, []);

  const joinRoom = useCallback((event: string, data: any): Promise<any> => {
    // Remember for reconnect restoration
    if (!joinedRoomsRef.current.some((r) => r.event === event && JSON.stringify(r.data) === JSON.stringify(data))) {
      joinedRoomsRef.current.push({ event, data });
    }
    return emit(event, data);
  }, [emit]);

  return { isLive, lastUpdated, heartbeatAge, on, off, emit, joinRoom, connectionState };
}
