import { useCallback, useEffect, useRef, useState } from "react";
import { isCompleteCode, lookupStreamCode, normalizeCode } from "../lib/streamCode";
import { subscribeStream, type StreamState } from "../lib/stream";

export type LivePhase = "idle" | "joining" | "connecting" | "live" | "ended" | "error";

/** How long to wait for room data after joining before calling the stream dead. */
const CONNECT_GRACE_MS = 15_000;

// Survives a reload but not a tab close, so F5 on the display resumes the stream
// while genuinely reopening /live starts from the code prompt.
const ROOM_KEY = "squadcalc-live-room";
const CODE_KEY = "squadcalc-live-code";

function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Private mode; the display just won't survive a reload.
  }
}

export interface LiveDisplay {
  phase: LivePhase;
  code: string;
  error: string | null;
  stream: StreamState | null;
  join: (code: string) => void;
  leave: () => void;
}

/**
 * Controller for the `/live` display page: takes the 6-digit code shown on the
 * host, resolves it to a room, and mirrors that room until it goes away.
 */
export function useLiveDisplay(): LiveDisplay {
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [code, setCode] = useState(() => readStored(CODE_KEY) ?? "");
  const [roomId, setRoomId] = useState<string | null>(() => readStored(ROOM_KEY));
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamState | null>(null);

  const graceRef = useRef<number | undefined>(undefined);

  const join = useCallback((raw: string) => {
    const clean = normalizeCode(raw);
    if (!isCompleteCode(clean)) return;

    setCode(clean);
    setError(null);
    setPhase("joining");

    lookupStreamCode(clean)
      .then((room) => {
        if (!room) {
          setError("No stream is using that code.");
          setPhase("error");
          return;
        }
        writeStored(CODE_KEY, clean);
        writeStored(ROOM_KEY, room);
        setRoomId(room);
      })
      .catch((err) => {
        console.error("Code lookup failed:", err);
        setError("Couldn't reach the streaming server.");
        setPhase("error");
      });
  }, []);

  const leave = useCallback(() => {
    writeStored(ROOM_KEY, null);
    writeStored(CODE_KEY, null);
    setRoomId(null);
    setStream(null);
    setCode("");
    setError(null);
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setPhase("connecting");
    const unsub = subscribeStream(roomId, setStream);
    return () => {
      unsub();
      setStream(null);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setPhase(stream ? "live" : "connecting");
  }, [roomId, stream]);

  // The room never arrived, or the host went away. The grace window covers a host
  // reload and brief drops; after it, drop back to the code prompt.
  useEffect(() => {
    window.clearTimeout(graceRef.current);
    if (phase !== "connecting") return;
    graceRef.current = window.setTimeout(() => {
      writeStored(ROOM_KEY, null);
      setRoomId(null);
      setPhase("ended");
    }, CONNECT_GRACE_MS);
    return () => window.clearTimeout(graceRef.current);
  }, [phase]);

  useEffect(() => () => window.clearTimeout(graceRef.current), []);

  return { phase, code, error, stream, join, leave };
}
