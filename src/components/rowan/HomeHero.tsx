import { useQuery } from "@tanstack/react-query";
import { BookOpen, Flame, Library, Sparkles, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { rowanHome } from "@/lib/rowan-fns";

type HomeData = Awaited<ReturnType<typeof rowanHome>>;

export function HomeHero() {
  const { sessionId } = useAuth();
  const query = useQuery({
    queryKey: ["rowan", sessionId, "home"],
    queryFn: () => rowanHome({ data: { sessionId: sessionId! } }),
    enabled: !!sessionId,
    retry: false,
  });

  if (!sessionId)
    return (
      <section className="reader-hero reader-hero-dashboard" aria-labelledby="hero-title">
        <div className="reader-hero-copy">
          <p className="reader-hero-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Reading at a glance
          </p>
          <h2 id="hero-title">Make room for your next chapter.</h2>
          <p>Sign in to see your reading year, momentum, and library breakdown.</p>
        </div>
      </section>
    );

  if (query.isPending)
    return (
      <section className="reader-hero reader-hero-dashboard" aria-label="Reading overview">
        <p role="status">Building your reading overview…</p>
      </section>
    );

  if (query.isError || !query.data)
    return (
      <section className="reader-hero reader-hero-dashboard" aria-label="Reading overview">
        <p role="alert">Your reading overview could not load.</p>
      </section>
    );

  return <ReadingOverview data={query.data} />;
}

function ReadingOverview({ data }: { data: HomeData }) {
  const { metrics } = data;
  const maxMonth = Math.max(1, ...metrics.monthlyReads);
  const statuses = [
    { label: "Current", value: metrics.currentReads, icon: BookOpen },
    { label: "Finished", value: metrics.finishedBooks, icon: Library },
    { label: "Up next", value: metrics.tbr, icon: Target },
    { label: "DNF", value: metrics.dnf, icon: Flame },
  ];
  return (
    <section className="reader-hero reader-hero-dashboard" aria-labelledby="hero-title">
      <div className="reader-hero-copy">
        <p className="reader-hero-eyebrow">
          <Sparkles size={15} aria-hidden="true" /> Reading at a glance
        </p>
        <h2 id="hero-title">
          <strong>{metrics.finishedThisYear}</strong> chapters closed
          <br />
          <em>in {metrics.year}.</em>
        </h2>
        <p>
          Your reading life, in motion. {metrics.lifetimeReads} completed read
          {metrics.lifetimeReads === 1 ? "" : "s"} across the library.
        </p>
        <div className="reader-hero-stat-grid">
          {statuses.map(({ label, value, icon: Icon }) => (
            <div className="reader-hero-stat" key={label}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="reader-hero-breakdown" aria-label={`${metrics.year} reading breakdown`}>
        <div className="reader-hero-breakdown-heading">
          <span>Monthly rhythm</span>
          <strong>{metrics.libraryCount} books in library</strong>
        </div>
        <div className="reader-month-bars">
          {metrics.monthlyReads.map((count, index) => (
            <div className="reader-month-bar" key={index} title={`${count} finished`}>
              <div style={{ height: `${Math.max(8, (count / maxMonth) * 100)}%` }}>
                {count > 0 && <span>{count}</span>}
              </div>
              <small>
                {new Date(Date.UTC(2020, index, 1)).toLocaleString(undefined, {
                  month: "narrow",
                  timeZone: "UTC",
                })}
              </small>
            </div>
          ))}
        </div>
        <div className="reader-hero-breakdown-footer">
          <span>Finished reads this year</span>
          <strong>{metrics.finishedThisYear}</strong>
        </div>
      </div>
    </section>
  );
}
