import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck, FolderArchive, ShieldCheck, Trash2, Upload } from "lucide-react";
import { rowanSettings, rowanArchive, rowanImportLegacy } from "@/lib/rowan-fns";
import { parseRowanArchive } from "../../../shared/rowan-archive";
import { parseImportJson, type ExportData } from "@/lib/user-preferences";
import { useAccountMutation } from "./useAccountMutation";
import { ProfileSettings } from "./ProfileSettings";
import { AppearanceSettings } from "./AppearanceSettings";

export function AccountSettings({
  sessionId,
  onReplaced,
  standalone = false,
}: {
  sessionId: string;
  onReplaced: () => void;
  standalone?: boolean;
}) {
  const query = useQuery({
    queryKey: ["rowan", sessionId, "settings"],
    queryFn: () => rowanSettings({ data: { sessionId } }),
    retry: false,
  });
  const [file, setFile] = useState<{
    raw: string;
    name: string;
    books: number;
    sessions: number;
    margins: number;
    kind: "rowan" | "basgiath";
    legacy?: ExportData;
  } | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [clearConfirmation, setClearConfirmation] = useState("");
  const [error, setError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const save = useAccountMutation(sessionId);
  const cache = useQueryClient();
  const legacyImport = useMutation({
    mutationFn: (data: ExportData) =>
      rowanImportLegacy({
        data: {
          sessionId,
          data: {
            books: data.books,
            margins: data.margins,
            goals: data.goals,
            settings: data.settings,
          },
        },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
      cancelRestore();
      setImportNotice("Basgiath export imported into Rowan.");
      onReplaced();
    },
  });
  const replace = useAccountMutation(sessionId, () => {
    setFile(null);
    setRestoreConfirmation("");
    setClearConfirmation("");
    if (fileInput.current) fileInput.current.value = "";
    onReplaced();
  });
  const settings = query.data?.settings;
  const busy = save.busy || replace.busy || legacyImport.isPending || exporting || readingFile;
  function cancelRestore() {
    selection.current++;
    setReadingFile(false);
    setFile(null);
    setRestoreConfirmation("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  return (
    <div className="reader-settings">
      <div className="reader-settings-columns">
        <div className="space-y-6">
          <ProfileSettings sessionId={sessionId} />
        </div>
        <div>
          {query.isPending && (
            <p role="status" className="reader-state">
              Loading your preferences…
            </p>
          )}
          {query.isError && (
            <p role="alert" className="reader-state">
              Preferences could not load.{" "}
              <button onClick={() => void query.refetch()}>Try again</button>
            </p>
          )}
          {settings && (
            <AppearanceSettings
              key={JSON.stringify(settings)}
              settings={settings}
              save={save}
              disabled={busy}
            />
          )}
        </div>
      </div>

      <section className="reader-card" aria-labelledby="backup-heading">
        <header className="reader-card-heading">
          <div className="reader-section-title">
            <span className="reader-icon reader-icon-gold">
              <FolderArchive size={20} />
            </span>
            <div>
              <h2 id="backup-heading">Your library, in your hands</h2>
              <p>Take a copy with you, or bring a backup home.</p>
            </div>
          </div>
        </header>
        <div className="reader-backup-grid reader-card-body">
          <div className="space-y-4">
            <Download size={24} className="text-primary" aria-hidden="true" />
            <h3>Download a backup</h3>
            <p className="reader-muted">
              Keep your books, reading history, shelves, series, reading queue, margins, goals, and preferences in a Rowan
              archive.
            </p>
            <button
              className="reader-button"
              disabled={busy}
              onClick={async () => {
                setExporting(true);
                setExportNotice("");
                try {
                  const raw = await rowanArchive({ data: { sessionId } });
                  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `rowan-archive-${new Date().toISOString().slice(0, 10)}.json`;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setExportNotice("Backup download started.");
                } catch {
                  setExportNotice("Backup could not be downloaded. Please try again.");
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download size={16} />
              {exporting ? "Preparing backup…" : "Download backup"}
            </button>
            <p role="status" className="reader-muted">
              {exportNotice}
            </p>
            <p className="reader-backup-note">
              <ShieldCheck size={16} />
              Account passwords are not included.
            </p>
          </div>
          <div className="space-y-4">
            <Upload size={24} className="text-primary" aria-hidden="true" />
            <h3>Restore from an archive</h3>
            <p className="reader-muted">
              Choose a Rowan backup or Basgiath export to check its contents. Nothing changes until
              you confirm the restore.
            </p>
            <label className="reader-file-label">
              Choose archive (JSON, up to 20 MB)
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={async (event) => {
                  const selected = event.target.files?.[0];
                  const request = ++selection.current;
                  setFile(null);
                  setError("");
                  setImportNotice("");
                  setRestoreConfirmation("");
                  if (!selected) return;
                  setReadingFile(true);
                  try {
                    if (selected.size > 20 * 1024 * 1024) throw new Error("Archive exceeds 20 MB.");
                    const raw = await selected.text();
                    try {
                      const data = parseRowanArchive(raw);
                      if (request === selection.current)
                        setFile({
                          raw,
                          name: selected.name,
                          books: data.userBooks.length,
                          sessions: data.readingSessions.length,
                          margins: data.margins.length,
                          kind: "rowan",
                        });
                    } catch {
                      const data = parseImportJson(raw);
                      if (request === selection.current)
                        setFile({
                          raw,
                          name: selected.name,
                          books: data.books.length,
                          sessions: data.books.reduce(
                            (total, book) => total + (book.reads?.length ?? 0),
                            0,
                          ),
                          margins: data.margins.length,
                          kind: "basgiath",
                          legacy: data,
                        });
                    }
                  } catch (cause) {
                    if (request === selection.current)
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Choose a valid Rowan or Basgiath JSON archive. No data was changed.",
                      );
                  } finally {
                    if (request === selection.current) setReadingFile(false);
                  }
                }}
              />
            </label>
            {readingFile && <p role="status">Checking archive…</p>}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {legacyImport.isError && (
              <p role="alert" className="text-destructive">
                {legacyImport.error instanceof Error
                  ? legacyImport.error.message
                  : "Basgiath export could not be imported. No data was changed."}
              </p>
            )}
            {importNotice && <p role="status">{importNotice}</p>}
            {file && (
              <form
                className="reader-restore-review space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy && restoreConfirmation === "RESTORE") {
                    if (file.kind === "basgiath" && file.legacy) {
                      legacyImport.mutate(file.legacy);
                    } else {
                      replace.run({
                        type: "restore",
                        key: crypto.randomUUID(),
                        raw: file.raw,
                        confirmation: "RESTORE",
                      });
                    }
                  }
                }}
              >
                <p className="flex items-center gap-2">
                  <FileCheck size={18} />
                  <strong className="break-all">{file.name}</strong>
                </p>
                <p>
                  {file.books} books · {file.sessions} reading sessions · {file.margins} margins
                </p>
                <p className="reader-muted">
                  {file.kind === "basgiath"
                    ? "This imports your Basgiath books, reading history, margins, goals, and preferences into Rowan. Your existing Rowan data stays until the import completes."
                    : "This replaces your current library, goals, shelves, series, reading queue, and preferences. Download a backup before continuing."}
                </p>
                <label className="reader-setting-form">
                  Type RESTORE to {file.kind === "basgiath" ? "import this data" : "replace your data"}
                  <input
                    value={restoreConfirmation}
                    onChange={(event) => setRestoreConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
                <div className="reader-field-action">
                  <button
                    className="reader-button"
                    disabled={busy || restoreConfirmation !== "RESTORE"}
                  >
                    {file.kind === "basgiath" ? "Import into Rowan" : "Restore this archive"}
                  </button>
                  <button
                    type="button"
                    className="reader-button reader-button-quiet"
                    onClick={cancelRestore}
                    disabled={replace.busy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
      {!standalone && (
        <p className="reader-muted">
          {query.data?.mirrorPaused
            ? "Automatic legacy import is paused for this Rowan library."
            : "Your legacy library is imported automatically. Personal Rowan changes are retained."}
        </p>
      )}
      <section className="reader-card reader-danger" aria-labelledby="clear-heading">
        <details className="reader-card-body reader-disclosure">
          <summary id="clear-heading">
            <Trash2 size={18} />
            Clear library data
          </summary>
          <div className="space-y-4 mt-4">
            <p>
              This removes your Rowan library, reading history, margins, shelves, series, reading queue, goals, and saved
              preferences. Your sign-in account remains.
            </p>
            <p className="reader-muted">
              This cannot be undone without a backup. Download an archive above before clearing your
              library.
            </p>
            <form
              className="reader-setting-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && clearConfirmation === "CLEAR")
                  replace.run({ type: "clear", key: crypto.randomUUID(), confirmation: "CLEAR" });
              }}
            >
              <label htmlFor="clear-confirmation">Type CLEAR to confirm</label>
              <div className="reader-field-action">
                <input
                  id="clear-confirmation"
                  autoComplete="off"
                  value={clearConfirmation}
                  onChange={(event) => setClearConfirmation(event.target.value)}
                  disabled={busy}
                />
                <button
                  className="reader-button reader-button-danger"
                  disabled={busy || clearConfirmation !== "CLEAR"}
                >
                  Clear library data
                </button>
              </div>
            </form>
          </div>
        </details>
      </section>
      <p role="status">{replace.message}</p>
      {replace.uncertain && (
        <button className="reader-button" onClick={replace.retry}>
          Retry the same request
        </button>
      )}
    </div>
  );
}
