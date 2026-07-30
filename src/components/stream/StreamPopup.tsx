import { useStreamStore } from "../../store/useStreamStore";

/**
 * The Stream button's dropdown. While live it shows the 6-digit code to type into
 * `/live` on the other screen, plus the `?watch=` link for anyone off-network.
 */
export default function StreamPopup({
  onCopyLink,
  copied,
}: {
  onCopyLink: () => void;
  copied: boolean;
}) {
  const phase = useStreamStore((s) => s.phase);
  const code = useStreamStore((s) => s.code);
  const error = useStreamStore((s) => s.error);
  const start = useStreamStore((s) => s.start);
  const stop = useStreamStore((s) => s.stop);

  if (phase === "starting") {
    return (
      <p className="stream-popup__state">
        <span className="stream-popup__spinner" />
        Starting…
      </p>
    );
  }

  if (phase === "error") {
    return (
      <>
        <p className="stream-popup__error">{error ?? "Something went wrong."}</p>
        <button className="stream-popup__retry" onClick={() => void start()}>
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      <p className="stream-popup__note">Enter this code on the /live screen</p>
      <div className="stream-popup__code">
        {(code ?? "").split("").map((ch, i) => (
          <span key={i} className="stream-popup__code-char">
            {ch}
          </span>
        ))}
      </div>
      <button className="stream-popup__copy" onClick={onCopyLink}>
        {copied ? "Copied!" : "Copy share link"}
      </button>
      <button className="stream-popup__stop" onClick={() => void stop()}>
        Stop streaming
      </button>
    </>
  );
}
