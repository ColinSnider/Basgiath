import { useBlocker } from "@tanstack/react-router";

/** Covers route changes and browser reload/close without storing private drafts on disk. */
export function useUnsavedChanges(dirty: boolean) {
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("You have unsaved changes. Discard them and leave?"),
    enableBeforeUnload: dirty,
  });
}
