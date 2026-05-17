import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { db } from "../../server/db";
import { users, sessions, userSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

function newSessionId() {
  return crypto.randomUUID();
}

export const register = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(3), password: z.string().min(6), displayName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const existing = await db.select().from(users).where(eq(users.username, data.username.toLowerCase()));
    if (existing.length > 0) throw new Error("Username already taken");
    const hashed = await bcryptjs.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username.toLowerCase(),
      password: hashed,
      displayName: data.displayName,
    }).returning();
    await db.insert(userSettings).values({ userId: user.id });
    const sessionId = newSessionId();
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    return { sessionId, user: { id: user.id, username: user.username, displayName: user.displayName } };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.username, data.username.toLowerCase()));
    if (!user) throw new Error("Invalid username or password");
    const valid = await bcryptjs.compare(data.password, user.password);
    if (!valid) throw new Error("Invalid username or password");
    const sessionId = newSessionId();
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    return { sessionId, user: { id: user.id, username: user.username, displayName: user.displayName } };
  });

export const getMe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date()) return null;
    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) return null;
    return { id: user.id, username: user.username, displayName: user.displayName };
  });

export const logout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    await db.delete(sessions).where(eq(sessions.id, data.sessionId));
    return { ok: true };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), displayName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date()) throw new Error("Unauthorized");
    const [user] = await db.update(users).set({ displayName: data.displayName }).where(eq(users.id, session.userId)).returning();
    return { displayName: user.displayName };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), currentPassword: z.string(), newPassword: z.string().min(6) }))
  .handler(async ({ data }) => {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date()) throw new Error("Unauthorized");
    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) throw new Error("User not found");
    const valid = await bcryptjs.compare(data.currentPassword, user.password);
    if (!valid) throw new Error("Current password is incorrect");
    const hashed = await bcryptjs.hash(data.newPassword, 10);
    await db.update(users).set({ password: hashed }).where(eq(users.id, session.userId));
    return { ok: true };
  });
