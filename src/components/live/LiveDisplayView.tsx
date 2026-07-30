import { useEffect, useRef, useState } from "react";
import { getMap } from "../../data/maps";
import { isCompleteCode, normalizeCode } from "../../lib/streamCode";
import { useLiveDisplay } from "../../hooks/useLiveDisplay";
import StreamMap, { LiveBanner } from "../watch/StreamMap";

/** Six single-character boxes that behave like one input. */
function CodeInput({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Typing the sixth digit is unambiguous intent — don't also make them hit Enter.
  function update(raw: string) {
    const next = normalizeCode(raw);
    setValue(next);
    if (isCompleteCode(next)) onSubmit(next);
  }

  return (
    <form
      className="live__code-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (isCompleteCode(value)) onSubmit(value);
      }}
    >
      {/* One real input behind six boxes: keeps mobile keyboards and paste working. */}
      <input
        ref={inputRef}
        className="live__code-field"
        value={value}
        onChange={(e) => update(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={busy}
        aria-label="Six-digit stream code"
      />
      <div className="live__code" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`live__code-char ${i === value.length && !busy ? "live__code-char--active" : ""}`}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </form>
  );
}

/**
 * The `/live` page: a fixed URL a second screen can sit on permanently. Type the
 * code shown on the planning PC and it mirrors that map.
 */
export default function LiveDisplayView() {
  const { phase, error, stream, join, leave } = useLiveDisplay();

  if (phase === "live" && stream) {
    return (
      <div className="live live--streaming">
        <StreamMap
          stream={stream}
          banner={
            <LiveBanner
              text={`${stream.sessionName || "Live view"} · ${getMap(stream.mapId).name}`}
            />
          }
        />
        <button className="live__disconnect" onClick={leave} title="Leave this stream">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="live">
      <div className="live__panel">
        {phase === "connecting" ? (
          <>
            <p className="live__title">Connecting…</p>
            <p className="live__hint">Waiting for the stream to start sending.</p>
            <button className="live__cancel" onClick={leave}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="live__title">
              {phase === "joining"
                ? "Checking code…"
                : phase === "ended"
                  ? "Stream ended"
                  : "Not connected"}
            </p>
            <CodeInput onSubmit={join} busy={phase === "joining"} />
            <p className="live__hint">
              On your planning PC, press <strong>Stream</strong> and type the 6-digit code it
              shows here.
            </p>
            {error && <p className="live__warn">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
