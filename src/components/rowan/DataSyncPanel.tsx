import { useQuery } from "@tanstack/react-query";
import { rowanSyncConflicts, rowanSyncStatus } from "@/lib/rowan-fns";

export function DataSyncPanel({ sessionId }: { sessionId: string }) {
  const status = useQuery({
    queryKey: ["rowan", sessionId, "sync-status"],
    queryFn: () => rowanSyncStatus({ data: { sessionId } }),
  });
  const conflicts = useQuery({
    queryKey: ["rowan", sessionId, "sync-conflicts"],
    queryFn: () => rowanSyncConflicts({ data: { sessionId } }),
  });
  const button = "rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <section id="data-sync" className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Data sync</h2>
          <p className="text-sm text-muted-foreground">
            Legacy Basgiath data is mirrored into Rowan before cutover.
          </p>
        </div>
        <button
          className={button}
          onClick={() => {
            void status.refetch();
            void conflicts.refetch();
          }}
        >
          Refresh
        </button>
      </div>
      {status.isPending && <p role="status">Checking both databases…</p>}
      {status.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries({
            "Legacy books": status.data.legacy.books,
            "Rowan books": status.data.v2.books,
            "Legacy margins": status.data.legacy.margins,
            "Rowan margins": status.data.v2.margins,
            "Legacy goals": status.data.legacy.goals,
            "Rowan goals": status.data.v2.goals,
            "Rowan shelves": status.data.v2.shelves,
          }).map(([label, value]) => (
            <div className="rounded-lg bg-background p-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>
      )}
      {conflicts.data && (
        <div className="space-y-2">
          <p className="text-sm">
            {conflicts.data.changed.length + conflicts.data.removed.length} source changes need
            review · {conflicts.data.localEdits.length} Rowan records have local edits.
          </p>
          {(conflicts.data.changed.length > 0 || conflicts.data.removed.length > 0) && (
            <ul className="text-sm text-muted-foreground">
              {[...conflicts.data.changed, ...conflicts.data.removed].slice(0, 10).map((item) => (
                <li key={`${item.kind}:${item.sourceId}`}>
                  {item.kind} {item.sourceId}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
