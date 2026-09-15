import { Pause } from "lucide-react";

export type ReadingProgress = {
  position: number;
  total: number | null;
  unit: "page" | "second" | "percent" | string;
  state?: "active" | "paused" | string;
};

export function ReadingProgressBar({
  progress,
  compact = false,
}: {
  progress: ReadingProgress | null | undefined;
  compact?: boolean;
}) {
  if (!progress) return null;
  const total = progress.unit === "percent" ? 100 : progress.total;
  const percent = total && total > 0 ? Math.min(100, Math.round((progress.position / total) * 100)) : null;
  return (
    <div className={`reader-progress ${compact ? "reader-progress-compact" : ""}`}>
      <div className="reader-progress-label">
        <span>
          {progress.state === "paused" && (
            <span className="reader-paused">
              <Pause size={12} /> Paused ·{" "}
            </span>
          )}
          {positionLabel(progress.position, progress.unit)}
          {progress.unit !== "percent" && total !== null
            ? ` of ${positionLabel(total, progress.unit)}`
            : ""}
        </span>
        {percent !== null && <strong>{percent}%</strong>}
      </div>
      {percent !== null ? (
        <progress value={progress.position} max={total!} aria-label="Reading progress" />
      ) : (
        <p className="reader-caption">Book length not set</p>
      )}
    </div>
  );
}

function positionLabel(position: number, unit: string) {
  if (unit === "second") {
    const hours = Math.floor(position / 3600);
    const minutes = Math.floor((position % 3600) / 60);
    return `${hours ? `${hours}h ` : ""}${minutes}m`;
  }
  return unit === "percent" ? `${position}%` : `${position} pages`;
}
