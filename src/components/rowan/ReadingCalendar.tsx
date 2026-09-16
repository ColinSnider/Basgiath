import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanCalendar } from "@/lib/rowan-fns";

type Event = Awaited<ReturnType<typeof rowanCalendar>>["events"][number];
const control = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";

export function ReadingCalendar({
  sessionId,
  openBook,
}: {
  sessionId: string;
  openBook: (book: Event["book"]) => void;
}) {
  const [month, setMonth] = useState<Date | null>(null);
  useEffect(() => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);
  return (
    <section
      aria-label="Reading calendar"
      className="rounded-2xl border border-border bg-card p-5 space-y-4"
    >
      <div>
        <h2 className="font-display text-3xl">Reading calendar</h2>
        <p className="text-sm text-muted-foreground">
          Recorded starts, progress, finishes, notes, and quotes. Dates use your device’s time zone.
        </p>
      </div>
      {month ? (
        <Month
          key={month.getTime()}
          month={month}
          setMonth={setMonth}
          sessionId={sessionId}
          openBook={openBook}
        />
      ) : (
        <p role="status">Loading calendar…</p>
      )}
    </section>
  );
}

function Month({
  month,
  setMonth,
  sessionId,
  openBook,
}: {
  month: Date;
  setMonth: (date: Date) => void;
  sessionId: string;
  openBook: (book: Event["book"]) => void;
}) {
  const year = month.getFullYear(),
    monthIndex = month.getMonth();
  const from = month.toISOString(),
    to = new Date(year, monthIndex + 1, 1).toISOString();
  const now = new Date();
  const [day, setDay] = useState(
    now.getFullYear() === year && now.getMonth() === monthIndex ? now.getDate() : 1,
  );
  const activity = useQuery({
    queryKey: ["rowan", sessionId, "calendar", from, to],
    queryFn: () => rowanCalendar({ data: { sessionId, from, to } }),
    retry: false,
  });
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const eventsByDay = new Map<number, Event[]>();
  for (const event of activity.data?.events ?? []) {
    const date = new Date(event.at).getDate();
    eventsByDay.set(date, [...(eventsByDay.get(date) ?? []), event]);
  }
  const selected = eventsByDay.get(day) ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className={control}
          aria-label="Previous month"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        >
          Previous
        </button>
        <h3 className="font-medium" aria-live="polite">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <button
            className={control}
            onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
          >
            This month
          </button>
          <button
            className={control}
            aria-label="Next month"
            onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
          >
            Next
          </button>
        </div>
      </div>
      {activity.isPending && <p role="status">Loading recorded activity…</p>}
      {activity.isError && (
        <p role="alert">
          Calendar activity could not load.{" "}
          <button className={control} onClick={() => void activity.refetch()}>
            Retry
          </button>
        </p>
      )}
      {activity.data && (
        <>
          {activity.data.truncated && (
            <p role="status" className="text-sm">
              This busy month exceeds the display limit. Some activity is omitted; book histories
              retain the full records.
            </p>
          )}
          <div className="grid grid-cols-7 gap-1" aria-label="Days of the month">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span className="text-center text-xs text-muted-foreground" key={label}>
                {label}
              </span>
            ))}
            {Array.from({ length: month.getDay() }, (_, index) => (
              <span key={`blank:${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }, (_, index) => index + 1).map((date) => {
              const count = eventsByDay.get(date)?.length ?? 0;
              return (
                <button
                  key={date}
                  className={`min-h-14 rounded-lg border p-1 text-center ${date === day ? "border-primary bg-primary/10" : "border-border"}`}
                  aria-pressed={date === day}
                  aria-label={`${new Date(year, monthIndex, date).toLocaleDateString(undefined, { dateStyle: "full" })}, ${count} recorded events`}
                  onClick={() => setDay(date)}
                >
                  <span className="block text-sm">{date}</span>
                  <span aria-hidden="true" className="block h-4 text-xs text-primary">
                    {count ? `${count} •` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite" className="space-y-3">
            <h4 className="font-medium">
              {new Date(year, monthIndex, day).toLocaleDateString(undefined, { dateStyle: "full" })}
            </h4>
            {!selected.length && (
              <p className="text-sm text-muted-foreground">
                {activity.data.truncated
                  ? "No activity shown for this day in the limited results."
                  : "No activity recorded for this day."}
              </p>
            )}
            <ul className="space-y-2">
              {selected.map((event) => (
                <li key={event.id}>
                  <button
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
                    onClick={() => openBook(event.book)}
                  >
                    <span className="block font-medium">{event.book.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {eventLabel(event)} ·{" "}
                      {new Date(event.at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Progress shows the position you logged, not pages or minutes read that day. Unrecorded
            dates aren’t filled in.
          </p>
        </>
      )}
    </>
  );
}

function eventLabel(event: Event) {
  if (event.kind === "note") return "Wrote a margin";
  if (event.kind === "quote") return "Saved a quote";
  if (event.kind === "start") return "Started reading";
  if (event.kind === "finish") return "Finished reading";
  if (event.kind === "dnf") return "Stopped without finishing";
  if (event.unit === "percent") return `Progress: ${event.position}%`;
  if (event.unit === "second")
    return `Audio position: ${Math.floor(event.position! / 3600)}h ${Math.floor((event.position! % 3600) / 60)}m ${event.position! % 60}s`;
  return `Progress: page ${event.position}`;
}
