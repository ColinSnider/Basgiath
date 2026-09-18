import type { GoalSettings } from "./goal-settings.ts";
type FinishedRead = {
  userBookId: string;
  title: string;
  finishedAt: Date | null;
  unit: string;
  total: number | null;
  state?: string;
  authors?: string[];
  timedReads?: Array<{ startedAt: string; endedAt: string; seconds: number }>;
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
  goal: { metric: string; timeframe: string; target: number; details?: GoalSettings },
  reads: FinishedRead[],
  timeZone: string,
  now = new Date(),
) {
  const today = localDay(now, timeZone);
  const date = new Date(today);
  const year = /^\d{4}$/.test(goal.timeframe) ? Number(goal.timeframe) : date.getUTCFullYear();
  let start = Date.UTC(year, 0, 1);
  let end = Date.UTC(year + 1, 0, 1);
  if (goal.timeframe === "all_time") {
    start = Date.UTC(1900, 0, 1);
    end = Date.UTC(9999, 0, 1);
  } else if (goal.timeframe === "day") {
    start = today;
    end = today + dayMs;
  } else if (goal.timeframe === "month") {
    start = Date.UTC(year, date.getUTCMonth(), 1);
    end = Date.UTC(year, date.getUTCMonth() + 1, 1);
  } else if (goal.timeframe === "week") {
    // Keep Basgiath's Sunday-to-Saturday week, in the reader's time zone.
    start = today - date.getUTCDay() * dayMs;
    end = start + 7 * dayMs;
  }
  const matching = reads.filter((read) => {
    if ((read.state && read.state !== "completed") || !read.finishedAt || read.finishedAt > now)
      return false;
    const day = localDay(read.finishedAt, timeZone);
    return day >= start && day < end;
  });
  const completionMetric = ["books", "pages", "minutes", "unique_books", "authors"].includes(
    goal.metric,
  );
  const relevant = matching.filter(
    (read) =>
      !["pages", "minutes"].includes(goal.metric) ||
      read.unit === (goal.metric === "pages" ? "page" : "second"),
  );
  type Contribution = { userBookId: string; title: string; amount: number; finishedAt: string };
  let contributions: Contribution[] = [];
  if (completionMetric) {
    const seen = new Set<string>();
    for (const read of relevant) {
      if (goal.metric === "unique_books") {
        if (seen.has(read.userBookId)) continue;
        seen.add(read.userBookId);
      }
      if (goal.metric === "authors") {
        for (const author of read.authors ?? []) {
          if (seen.has(author)) continue;
          seen.add(author);
          contributions.push({
            userBookId: read.userBookId,
            title: author,
            amount: 1,
            finishedAt: read.finishedAt!.toISOString(),
          });
        }
      } else {
        // Legacy "minutes" targets have always represented audiobook hours.
        const amount =
          goal.metric === "pages"
            ? (read.total ?? 0)
            : goal.metric === "minutes"
              ? (read.total ?? 0) / 3600
              : 1;
        if (amount > 0)
          contributions.push({
            userBookId: read.userBookId,
            title: read.title,
            amount,
            finishedAt: read.finishedAt!.toISOString(),
          });
      }
    }
  } else if (goal.metric === "custom") {
    const first = new Date(start).toISOString().slice(0, 10);
    const last = new Date(Math.min(today + dayMs, end)).toISOString().slice(0, 10);
    contributions = (goal.details?.entries ?? [])
      .filter((entry) => entry.date >= first && entry.date < last)
      .map((entry) => ({
        userBookId: "",
        title: entry.note || goal.details?.title || "Progress",
        amount: entry.amount,
        finishedAt: `${entry.date}T12:00:00Z`,
      }));
  } else {
    const days = new Set<number>();
    for (const read of reads)
      for (const timer of read.timedReads ?? []) {
        const ended = new Date(timer.endedAt);
        const day = localDay(ended, timeZone);
        if (ended > now || day < start || day >= end || timer.seconds <= 0) continue;
        if (goal.metric === "reading_days" && days.has(day)) continue;
        days.add(day);
        contributions.push({
          userBookId: read.userBookId,
          title: read.title,
          amount: goal.metric === "reading_days" ? 1 : timer.seconds / 60,
          finishedAt: timer.endedAt,
        });
      }
  }
  contributions.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const current = Math.max(
    0,
    contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
  );
  const remaining = Math.max(0, goal.target - current);
  return {
    current,
    unlimited: goal.timeframe === "all_time",
    remaining,
    percent: Math.min(100, Math.round((current / goal.target) * 100)),
    achieved: current >= goal.target,
    start: new Date(start).toISOString().slice(0, 10),
    end: new Date(end - dayMs).toISOString().slice(0, 10),
    daysRemaining: Math.max(0, (end - Math.max(start, today)) / dayMs),
    upcoming: today < start,
    ended: today >= end,
    undated: completionMetric
      ? reads.filter(
          (read) =>
            (!read.state || read.state === "completed") &&
            !read.finishedAt &&
            (!["pages", "minutes"].includes(goal.metric) ||
              read.unit === (goal.metric === "pages" ? "page" : "second")),
        ).length
      : 0,
    missingLength: ["pages", "minutes"].includes(goal.metric)
      ? relevant.filter((read) => !read.total).length
      : 0,
    contributions: contributions.slice(0, 12),
    contributionCount: contributions.length,
  };
}
