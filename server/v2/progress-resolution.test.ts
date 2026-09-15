import test from "node:test";
import assert from "node:assert/strict";
import { effectiveProgress, loggedProgress, type ProgressRecord } from "../../shared/reading-progress.ts";
const entry = (id: string, position: number, overrides: Partial<ProgressRecord> = {}): ProgressRecord => ({
  id, position, kind: "observation", occurredAt: "2026-09-01T12:00:00Z", createdAt: `2026-09-01T12:00:0${id}Z`, supersedesId: null, voided: false, ...overrides,
});

test("equal-time corrections retain the original event order", () => {
  const entries = [entry("0", 40, { kind: "baseline" }), entry("1", 65), entry("2", 80), entry("3", 60, { supersedesId: "1" })];
  assert.deepEqual(effectiveProgress(entries.reverse()).map(e => e.position), [40, 60, 80]);
  assert.equal(loggedProgress(entries), 40);
});
test("correction chains and tombstones do not add activity", () => {
  const entries = [entry("0",40,{kind:"baseline",occurredAt:null}),entry("1",65),entry("2",60,{supersedesId:"1"}),entry("3",60,{supersedesId:"2",voided:true})];
  assert.equal(loggedProgress(entries), 0);
  assert.deepEqual(effectiveProgress(entries).map(e=>e.id), ["0"]);
});
test("baselines and observations without a prior position invent no activity", () => {
  assert.equal(loggedProgress([entry("1",80)]),0);
  assert.equal(loggedProgress([entry("0",40,{kind:"baseline"}),entry("1",60,{kind:"baseline"}),entry("2",80)]),20);
});
