import type { EditionSummary, WorkSummary } from "../../shared/contracts/v2";

export type CatalogEvidence = {
  provider: string;
  entityKind: "work" | "edition" | "author";
  externalId: string;
  confidence: "strong" | "moderate" | "weak";
};

/** Loaded from trusted local mappings, never supplied by a search result/client. */
export type ResolvedMapping = {
  provider: string;
  entityKind: CatalogEvidence["entityKind"];
  externalId: string;
  workId: string;
  editionId: string | null;
};

export type CatalogCandidate = {
  work: WorkSummary;
  edition: EditionSummary | null;
  evidence: CatalogEvidence[];
};

export type CanonicalizationDecision =
  | { kind: "existing"; workId: string; editionId: string | null }
  | { kind: "provisional"; candidate: CatalogCandidate }
  | { kind: "review"; candidate: CatalogCandidate; reasons: string[] };

/**
 * Conservative policy placeholder. A provider mapping is strong evidence;
 * title/author similarity alone is intentionally review-only.
 */
export function decideCanonicalization(
  candidate: CatalogCandidate,
  mappings: ResolvedMapping[] = [],
): CanonicalizationDecision {
  const matching = mappings.filter(
    (mapping) =>
      mapping.entityKind !== "author" &&
      candidate.evidence.some(
        (ref) =>
          ref.provider === mapping.provider &&
          ref.entityKind === mapping.entityKind &&
          ref.externalId === mapping.externalId,
      ),
  );
  const workIds = new Set(matching.map((mapping) => mapping.workId));
  if (workIds.size > 1)
    return {
      kind: "review",
      candidate,
      reasons: ["Provider mappings disagree about the work identity."],
    };
  const editionIds = new Set(
    matching.flatMap((mapping) => (mapping.editionId ? [mapping.editionId] : [])),
  );
  if (editionIds.size > 1)
    return {
      kind: "review",
      candidate,
      reasons: ["Multiple editions require explicit selection."],
    };
  if (matching.length) {
    return {
      kind: "existing",
      workId: matching[0].workId,
      editionId: [...editionIds][0] ?? null,
    };
  }
  const hasOnlyWeakEvidence =
    candidate.evidence.length > 0 &&
    candidate.evidence.every((evidence) => evidence.confidence === "weak");
  return hasOnlyWeakEvidence
    ? { kind: "review", candidate, reasons: ["Only weak catalog evidence is available."] }
    : { kind: "provisional", candidate };
}
