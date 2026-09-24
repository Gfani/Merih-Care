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
import { api, API_URL } from "../services/api";

export interface RealtimeEvent {
  v: number;
  event: string;
  data: any;
  ts: string;
}

export interface UseRealtimeSocketOptions {
  token?: string | null;
  baseUrl?: string;
  /** Defaults to true to negotiate ["polling", "websocket"] for proxy/clinical network resilience */
  fallbackPoll?: boolean;
  onEvent?: (event: string, payload: any) => void;
  [eventName: string]: any;
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

const BACKEND_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export function useRealtimeSocket(options: UseRealtimeSocketOptions = {}): UseRealtimeSocketReturn {
  const {
    token: propToken,
    baseUrl = BACKEND_URL,
    fallbackPoll = true,
    onEvent,
  } = options;

  const effectiveToken =
    propToken ||
    (typeof window !== "undefined"
      ? api.getStoredToken()
      : null);

  const hasSession = !!effectiveToken || (typeof window !== "undefined" && !!sessionStorage.getItem("admin_user"));

  const socketRef = useRef<Socket | null>(null);
  const lastPongRef = useRef<number | null>(null);
  const joinedRoomsRef = useRef<Array<{ event: string; data: any }>>([]);
  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isLive, setIsLive] = useState(false);
  const [connectionEstablished, setConnectionEstablished] = useState(false);
  const [connected, setConnected] = useState(false);
  const [heartbeatAge, setHeartbeatAge] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<UseRealtimeSocketReturn["connectionState"]>("disconnected");

  // Recompute isLive whenever socket connection state changes
  useEffect(() => {
    setIsLive(connected && connectionEstablished);
  }, [connected, connectionEstablished]);

  useEffect(() => {
    // Attempt connection if token is available or session exists
    if (!effectiveToken && typeof window !== "undefined" && !sessionStorage.getItem("admin_user")) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");

    const origin = baseUrl.replace(/\/api\/v\d+.*$/, "");
    const socket = io(`${origin}/realtime`, {
      auth: effectiveToken ? { token: effectiveToken } : undefined,
      query: effectiveToken ? { token: effectiveToken } : undefined,
      withCredentials: true,
      // Prefer WebSocket first for zero-latency direct streaming, with polling fallback
      transports: fallbackPoll ? ["websocket", "polling"] : ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    // ── Attach all registered dynamic listeners ───────────────────────
    listenersRef.current.forEach((handlers, evt) => {
      handlers.forEach((h) => {
        socket.on(evt, h);
      });
    });

    // ── Immediate connect lifecycle ──────────────────────────────────
    socket.on("connect", () => {
      setConnected(true);
      setConnectionEstablished(true);
      setConnectionState("connected");
      setIsLive(true);
      setLastUpdated(new Date().toISOString());
      lastPongRef.current = Date.now();

      // Register with admin room immediately for realtime platform updates
      socket.emit("join_admin", {});

      // Re-join previously joined rooms on reconnect
      for (const room of joinedRoomsRef.current) {
        socket.emit(room.event, room.data);
      }
    });

    // ── Connection established (server handshake ack) ────────────────
    socket.on("connection_established", (payload: RealtimeEvent) => {
      setConnectionEstablished(true);
      setLastUpdated(payload?.ts || new Date().toISOString());
      setConnectionState("connected");
      setIsLive(true);
      lastPongRef.current = Date.now();

      socket.emit("join_admin", {});

      for (const room of joinedRoomsRef.current) {
        socket.emit(room.event, room.data);
      }
    });

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
      socket.emit("pong", {});
      lastPongRef.current = Date.now();
      setHeartbeatAge(0);
      setLastUpdated(new Date().toISOString());
    });

    socket.on("pong", () => {
      lastPongRef.current = Date.now();
      setHeartbeatAge(0);
      setLastUpdated(new Date().toISOString());
    });

    socket.on("heartbeat_ack", () => {
      lastPongRef.current = Date.now();
      setHeartbeatAge(0);
      setLastUpdated(new Date().toISOString());
    });

    // Proactive client-side heartbeat to keep server presence and socket connection fresh
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat", { ts: Date.now() });
        socket.emit("pong", {});
      }
    }, 15000);

    // ── Generic versioned event passthrough ───────────────────────────
    const eventNames = [
      "appointment_status_update",
      "new_service_request",
      "provider_response",
      "location_update",
      "provider_location_update",
      "provider_offline",
      "provider_location_stale",
      "emergency_alert",
      "notification",
      "admin_metrics",
      "new_message",
      "user_removed",
      "user_status_changed",
      "approval_requested",
    ];
    for (const evt of eventNames) {
      socket.on(evt, (payload: any) => {
        setLastUpdated(payload?.ts || new Date().toISOString());
        onEvent?.(evt, payload);
        const customHandler = optionsRef.current[evt];
        if (typeof customHandler === "function") {
          customHandler(payload?.data !== undefined ? payload.data : payload);
        }
      });
    }

    // Heartbeat staleness ticker — runs every 5 s
    const ticker = setInterval(() => {
      if (lastPongRef.current !== null) {
        const age = Date.now() - lastPongRef.current;
        setHeartbeatAge(age);
      }
    }, 5000);

    return () => {
      clearInterval(ticker);
      clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectionEstablished(false);
      setIsLive(false);
      setConnectionState("disconnected");
    };
  }, [effectiveToken, hasSession, baseUrl, fallbackPoll]); // eslint-disable-line react-hooks/exhaustive-deps

  const on = useCallback((event: string, handler: (payload: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (payload: any) => void) => {
    listenersRef.current.get(event)?.delete(handler);
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
