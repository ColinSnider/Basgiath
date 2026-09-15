import { z } from "zod";
const id = z.string().uuid();
export const organizationAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seriesSave"), seriesId: id, name: z.string().trim().min(1).max(120), completionState: z.enum(["unknown", "open", "complete"]), sourceNote: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ action: z.literal("seriesDelete"), seriesId: id }).strict(),
  z.object({ action: z.literal("seriesBook"), seriesId: id, userBookId: id, sequenceLabel: z.string().trim().max(40), optional: z.boolean() }).strict(),
  z.object({ action: z.literal("seriesRemoveBook"), seriesId: id, userBookId: id }).strict(),
  z.object({ action: z.literal("seriesMove"), seriesId: id, userBookId: id, direction: z.enum(["up", "down"]) }).strict(),
  z.object({ action: z.literal("queueAdd"), userBookId: id }).strict(),
  z.object({ action: z.literal("queueRemove"), userBookId: id }).strict(),
  z.object({ action: z.literal("queuePin"), userBookId: id, pinned: z.boolean() }).strict(),
  z.object({ action: z.literal("queueMove"), userBookId: id, direction: z.enum(["up", "down"]) }).strict(),
]);
export const organizationCommand = z.object({
  key: id, expectedVersion: z.number().int().nonnegative(), change: organizationAction,
}).strict();
export type OrganizationAction = z.infer<typeof organizationAction>;
