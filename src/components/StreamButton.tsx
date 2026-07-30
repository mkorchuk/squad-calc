import { useEffect, useRef, useState } from "react";
import { useStreamStore } from "../store/useStreamStore";
import StreamPopup from "./stream/StreamPopup";
import { StreamIcon } from "./icons";

/** How long the popup lingers before auto-hiding. Generous: it holds the code. */
const POPUP_MS = 20000;

export default function StreamButton() {
  const phase = useStreamStore((s) => s.phase);
  const roomId = useStreamStore((s) => s.roomId);
  const start = useStreamStore((s) => s.start);

  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const live = phase === "live";
  const link = roomId ? `${window.location.origin}/?watch=${roomId}` : "";

  function armAutoHide(ms: number) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPopup(null), ms);
  }

  function handleClick() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPopup({ x: r.left, y: r.bottom + 8 });
    setCopied(false);
    armAutoHide(POPUP_MS);
    if (phase === "off") void start();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      armAutoHide(POPUP_MS);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); keep the popup open.
      armAutoHide(POPUP_MS);
    }
  }

  // Stopping mid-popup would otherwise leave an empty code panel on screen.
  useEffect(() => {
    if (phase === "off") setPopup(null);
  }, [phase]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <>
      <button
        ref={btnRef}
        className={`toolbar__btn toolbar__stream ${live ? "toolbar__stream--live" : ""}`}
        onClick={handleClick}
        title={
          live ? "Streaming live — click to see the code again" : "Stream this map to a /live screen"
        }
      >
        <StreamIcon />
        {live ? "Live" : "Stream"}
      </button>

      {popup && (
        <div className="stream-popup" style={{ left: popup.x, top: popup.y }}>
          <StreamPopup onCopyLink={copyLink} copied={copied} />
        </div>
      )}
    </>
  );
}
