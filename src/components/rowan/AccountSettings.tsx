import { PRESET_THEMES } from "@/lib/user-preferences";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanSettings, rowanArchive } from "@/lib/rowan-fns";
import { parseRowanArchive } from "../../../shared/rowan-archive";
import { useAccountMutation } from "./useAccountMutation";

const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function AccountSettings({
  sessionId,
  onReplaced,
}: {
  sessionId: string;
  onReplaced: () => void;
}) {
  const query = useQuery({
    queryKey: ["rowan", sessionId, "settings"],
    queryFn: () => rowanSettings({ data: { sessionId } }),
    retry: false,
  });
  const save = useAccountMutation(sessionId);
  const replace = useAccountMutation(sessionId, () => {
    setFile(null);
    setConfirmation("");
    onReplaced();
  });
  const [file, setFile] = useState<{
    raw: string;
    name: string;
    books: number;
    sessions: number;
    margins: number;
  } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const settings = query.data?.settings;
  const busy = save.busy || replace.busy || exporting;
  return (
    <section id="rowan-settings" className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-display text-2xl">Settings and backups</h2>
      {query.isPending && <p>Loading settings…</p>}
      {query.isError && (
        <p role="alert">
          Settings could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {settings && (
        <form
          key={JSON.stringify(settings)}
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            save.run({
              type: "settings",
              key: crypto.randomUUID(),
              settings: {
                darkMode: data.has("dark"),
                compactMode: data.has("compact"),
                accentColor: String(data.get("accent")),
                fontScale: data.get("scale") as "sm" | "md" | "lg",
              },
            });
          }}
        >
          <label>
            <input name="dark" type="checkbox" defaultChecked={settings.darkMode} /> Dark mode
          </label>
          <label>
            <input name="compact" type="checkbox" defaultChecked={settings.compactMode} /> Compact
            layout
          </label>
          <label className="grid gap-1">
            Accent
            <select className={control} name="accent" defaultValue={settings.accentColor}>
              {PRESET_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Text size
            <select className={control} name="scale" defaultValue={settings.fontScale}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
          <button className={control} disabled={busy}>
            Save settings
          </button>
        </form>
      )}
      <p role="status">{save.message}</p>
      {save.uncertain && (
        <button className={control} onClick={save.retry}>
          Retry settings save
        </button>
      )}
      <p className="text-sm">
        {query.data?.mirrorPaused
          ? "Automatic legacy import is paused for this Rowan library after clear or restore."
          : "Your legacy library is imported automatically. Personal Rowan changes are retained."}
      </p>
      <button
        className={control}
        disabled={busy}
        onClick={async () => {
          setExporting(true);
          setError("");
          try {
            const raw = await rowanArchive({ data: { sessionId } });
            const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `rowan-archive-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch {
            setError("Backup could not be downloaded. Try again.");
          } finally {
            setExporting(false);
          }
        }}
      >
        Download backup
      </button>
      <label className="grid gap-2">
        Restore a Rowan archive
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            setFile(null);
            setError("");
            setConfirmation("");
            if (!selected) return;
            try {
              if (selected.size > 20 * 1024 * 1024) throw new Error("Archive exceeds 20 MB.");
              const raw = await selected.text();
              const data = parseRowanArchive(raw);
              setFile({
                raw,
                name: selected.name,
                books: data.userBooks.length,
                sessions: data.readingSessions.length,
                margins: data.margins.length,
              });
            } catch {
              setError(
                "This file is not a valid Rowan v2 archive. No data was changed. Legacy exports still use the Basgiath importer.",
              );
            }
          }}
        />
      </label>
      {file && (
        <p>
          {file.name}: {file.books} books, {file.sessions} reading sessions, {file.margins} margins.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Restore replaces this Rowan library, goals, shelves, and settings. Clear removes them. Both
        pause automatic legacy import; the legacy database is preserved. Download a backup first.
      </p>
      <label className="grid gap-1">
        Type {file ? "RESTORE" : "CLEAR"} to confirm
        <input
          className={control}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <button
        className={`${control} text-destructive`}
        disabled={busy || confirmation !== (file ? "RESTORE" : "CLEAR")}
        onClick={() => {
          replace.run(
            file
              ? {
                  type: "restore",
                  key: crypto.randomUUID(),
                  raw: file.raw,
                  confirmation: "RESTORE",
                }
              : { type: "clear", key: crypto.randomUUID(), confirmation: "CLEAR" },
          );
        }}
      >
        {file ? "Replace library from archive" : "Clear Rowan data"}
      </button>
      {file && (
        <button
          className={control}
          disabled={busy}
          onClick={() => {
            setFile(null);
            setConfirmation("");
          }}
        >
          Cancel restore
        </button>
      )}
      <p role="status">{error || replace.message}</p>
      {replace.uncertain && (
        <button className={control} onClick={replace.retry}>
          Retry the same request
        </button>
      )}
    </section>
  );
}
