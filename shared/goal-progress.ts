type FinishedRead = {
  userBookId: string;
  title: string;
  finishedAt: Date | null;
  unit: string;
  total: number | null;
};

const dayMs = 86_400_000;
function localDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (part: string) => Number(parts.find((p) => p.type === part)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

export function goalProgress(
  goal: { metric: string; timeframe: string; target: number },
  reads: FinishedRead[],
  timeZone: string,
  now = new Date(),
) {
  const today = localDay(now, timeZone);
  const date = new Date(today);
  const year = /^\d{4}$/.test(goal.timeframe) ? Number(goal.timeframe) : date.getUTCFullYear();
  let start = Date.UTC(year, 0, 1);
  let end = Date.UTC(year + 1, 0, 1);
  if (goal.timeframe === "month") {
    start = Date.UTC(year, date.getUTCMonth(), 1);
    end = Date.UTC(year, date.getUTCMonth() + 1, 1);
  } else if (goal.timeframe === "week") {
    // Keep Basgiath's Sunday-to-Saturday week, in the reader's time zone.
    start = today - date.getUTCDay() * dayMs;
    end = start + 7 * dayMs;
  }
  const matching = reads.filter((read) => {
    if (!read.finishedAt || read.finishedAt > now) return false;
    const day = localDay(read.finishedAt, timeZone);
    return day >= start && day < end;
  });
  const relevant = matching.filter(
    (read) =>
      goal.metric === "books" || read.unit === (goal.metric === "pages" ? "page" : "second"),
  );
  // The legacy metric key is "minutes", but its target and progress were hours.
  const amount = (read: FinishedRead) =>
    goal.metric === "books" ? 1 : (read.total ?? 0) / (goal.metric === "minutes" ? 3600 : 1);
  const current = relevant.reduce((sum, read) => sum + amount(read), 0);
  const remaining = Math.max(0, goal.target - current);
  return {
    current,
    remaining,
    percent: Math.min(100, Math.round((current / goal.target) * 100)),
    achieved: current >= goal.target,
    start: new Date(start).toISOString().slice(0, 10),
    end: new Date(end - dayMs).toISOString().slice(0, 10),
    daysRemaining: Math.max(0, (end - Math.max(start, today)) / dayMs),
    upcoming: today < start,
    ended: today >= end,
    undated: reads.filter(
      (read) =>
        !read.finishedAt &&
        (goal.metric === "books" || read.unit === (goal.metric === "pages" ? "page" : "second")),
    ).length,
    missingLength: goal.metric === "books" ? 0 : relevant.filter((read) => !read.total).length,
    contributions: relevant
      .filter((read) => amount(read) > 0)
      .slice(0, 12)
      .map((read) => ({
        userBookId: read.userBookId,
        title: read.title,
        amount: amount(read),
        finishedAt: read.finishedAt!.toISOString(),
      })),
    contributionCount: relevant.filter((read) => amount(read) > 0).length,
  };
}
