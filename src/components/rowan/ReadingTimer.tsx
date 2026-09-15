import { useEffect, useState } from "react";
import type { rowanHistory, RowanCommand } from "@/lib/rowan-fns";

const duration = (seconds: number) =>
  `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export function ReadingTimer({
  sessions,
  run,
  busy,
}: {
  sessions: Awaited<ReturnType<typeof rowanHistory>>["sessions"];
  run: (command: RowanCommand) => void;
  busy: boolean;
}) {
  const active = sessions.find((s) => s.state === "active" || s.state === "paused");
  const started = active?.timerStartedAt;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!started) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [started]);
  const elapsed = started ? Math.max(0, Math.floor((now - Date.parse(started)) / 1000)) : 0;
  const saved = sessions.reduce((total, session) => total + session.readingSeconds, 0);
  const logs = sessions
    .flatMap((s) => s.timedReads)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  return (
    <section className="rowan-reading-timer" aria-label="Reading timer">
      <div>
        <p className="rowan-eyebrow">Time with your book</p>
        <h3 className="font-display text-xl">Reading timer</h3>
      </div>
      <output className="rowan-timer-clock" aria-label="Current reading time" aria-live="off">
        {duration(elapsed)}
      </output>
      <p>
        {duration(saved)} saved across {logs.length} timed reads
      </p>
      {active ? (
        <button
          className="reader-button"
          disabled={busy || (!started && active.state !== "active")}
          onClick={() =>
            run({
              type: "timer",
              key: crypto.randomUUID(),
              sessionId: active.id,
              expectedVersion: active.version,
              action: started ? "stop" : "start",
            })
          }
        >
          {started ? "Stop & save time" : "Start timer"}
        </button>
      ) : (
        <p>Start reading this book to use the timer.</p>
      )}
      <p className="text-sm text-muted-foreground">
        {started
          ? "Your timer keeps running if you leave this page or lock your screen. Stop it when you finish reading."
          : "Only time you choose to track is counted."}
      </p>
      {!!logs.length && (
        <details>
          <summary>Timed reading history</summary>
          <ol>
            {logs.map((log, i) => (
              <li key={`${log.startedAt}:${i}`}>
                <time dateTime={log.startedAt}>{new Date(log.startedAt).toLocaleString()}</time>
                <span>{duration(log.seconds)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
