import { useEffect, useRef, useState } from "react";
import { useStreamStore } from "../store/useStreamStore";
import { removeStream } from "../lib/stream";
import { StreamIcon } from "./icons";

/** How long the copy popup stays up before auto-hiding, per spec (10s). */
const POPUP_MS = 10000;

export default function StreamButton() {
  const roomId = useStreamStore((s) => s.roomId);
  const start = useStreamStore((s) => s.start);
  const stop = useStreamStore((s) => s.stop);

  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = roomId ? `${window.location.origin}/?watch=${roomId}` : "";

  function armAutoHide(ms: number) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPopup(null), ms);
  }

  function openPopup() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPopup({ x: r.left, y: r.bottom + 8 });
    setCopied(false);
    armAutoHide(POPUP_MS);
  }

  function handleClick() {
    if (!roomId) start();
    openPopup();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      armAutoHide(1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); keep the popup open.
      armAutoHide(POPUP_MS);
    }
  }

  function handleStop() {
    if (roomId) removeStream(roomId).catch(() => {});
    stop();
    setPopup(null);
    window.clearTimeout(timerRef.current);
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <>
      <button
        ref={btnRef}
        className={`toolbar__btn toolbar__stream ${roomId ? "toolbar__stream--live" : ""}`}
        onClick={handleClick}
        title={
          roomId
            ? "Streaming live — click to copy the link again"
            : "Stream this map live to a shareable link"
        }
      >
        <StreamIcon />
        {roomId ? "Live" : "Stream"}
      </button>

      {popup && (
        <div className="stream-popup" style={{ left: popup.x, top: popup.y }}>
          <button className="stream-popup__copy" onClick={copyLink}>
            {copied ? "Copied!" : "Tap to copy link"}
          </button>
          <button className="stream-popup__stop" onClick={handleStop}>
            Stop streaming
          </button>
        </div>
      )}
    </>
  );
}
