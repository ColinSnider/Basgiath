import { useState, type CSSProperties } from "react";

export const generatedCoverHue = (title: string) =>
  Array.from(title).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 0);

/** One cover shape, including unavailable and broken provider images. */
export function BookCover({
  title,
  authors = [],
  src,
  className = "",
  onImageError,
}: {
  title: string;
  authors?: string[];
  src: string | null;
  className?: string;
  onImageError?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const hue = generatedCoverHue(title);
  return (
    <span
      className={`rowan-cover ${className}`}
      style={{ "--cover-hue": hue } as CSSProperties}
      role="img"
      aria-label={`Cover of ${title}`}
    >
      <span className="rowan-cover-type" aria-hidden="true">
        <span>{authors.join(", ") || "Rowan library"}</span>
        <strong>{title}</strong>
        <span>◆</span>
      </span>
      {src && failed !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => {
            setFailed(src);
            onImageError?.();
          }}
        />
      )}
    </span>
  );
}
