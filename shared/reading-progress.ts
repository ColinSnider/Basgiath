/** Resolve retained audit entries into the effective, chronological reading history. */
export type ProgressRecord = {
  id: string;
  supersedesId: string | null;
  voided: boolean;
  kind: "baseline" | "observation";
  position: number;
  occurredAt: Date | string | null;
  createdAt: Date | string;
};
const time = (date: Date | string | null) => date === null ? -Infinity : new Date(date).getTime();
export function effectiveProgress<T extends ProgressRecord>(entries: readonly T[]): T[] {
  const replaced = new Set(entries.map((entry) => entry.supersedesId).filter(Boolean));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const anchors = new Map<string, T>();
  const anchor = (entry: T): T => {
    const path: T[] = [];
    const seen = new Set<string>();
    let root = entry;
    while (root.supersedesId && byId.has(root.supersedesId) && !seen.has(root.id) && !anchors.has(root.id)) {
      seen.add(root.id); path.push(root); root = byId.get(root.supersedesId)!;
    }
    root = anchors.get(root.id) ?? root;
    for (const item of path) anchors.set(item.id, root);
    return root;
  };
  return entries.filter((entry) => !entry.voided && !replaced.has(entry.id)).sort((a, b) => {
    const at = time(a.occurredAt), bt = time(b.occurredAt);
    const ar = anchor(a), br = anchor(b);
    return (at === bt ? 0 : at < bt ? -1 : 1) || time(ar.createdAt) - time(br.createdAt) || ar.id.localeCompare(br.id);
  });
}

export function loggedProgress(entries: readonly ProgressRecord[]) {
  let previous: number | null = null;
  let total = 0;
  for (const entry of effectiveProgress(entries)) {
    if (entry.kind === "observation" && previous !== null) total += Math.max(0, entry.position - previous);
    previous = entry.position;
  }
  return total;
}
