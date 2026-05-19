import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { db } from "../../server/db";
import { users, sessions, userSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { authConfig, sessionExpiresAt } from "./auth-config";
import {
  guestUser,
  isGuestSessionId,
  isGuestSessionValid,
  FULL_AUTH_REQUIRED_MESSAGE,
  MISSING_OR_EXPIRED_SESSION_MESSAGE,
} from "./session-auth.js";
import { ensureUsernameAvailable, mapSignupDbError } from "./auth-signup.js";

function newSessionId() {
  return crypto.randomUUID();
}

// Explicit column selection guards against schema mismatches (e.g. stale
// legacy columns that may still exist in the DB but are no longer part of the
// Drizzle schema).
const authUserPublicColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  createdAt: users.createdAt,
};

const authUserCredentialColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  createdAt: users.createdAt,
  password: users.password,
};

function userPublic(user: {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email ?? undefined,
  };
}

export const register = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: z.string(),
      password: z.string().min(6),
      displayName: z.string().min(1),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const username = await ensureUsernameAvailable(data.username, async (normalizedUsername) => {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, normalizedUsername));
      return existing;
    });
    const hashed = await bcryptjs.hash(data.password, authConfig.bcryptRounds);
    let user;
    try {
      [user] = await db
        .insert(users)
        .values({
          username,
          password: hashed,
          displayName: data.displayName,
          email: data.email ?? null,
        })
        .returning(authUserPublicColumns);
    } catch (error) {
      throw mapSignupDbError(error);
    }
    await db.insert(userSettings).values({ userId: user.id });
    const sessionId = newSessionId();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: sessionExpiresAt(),
    });
    return { sessionId, user: userPublic(user) };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const [user] = await db
      .select(authUserCredentialColumns)
      .from(users)
      .where(eq(users.username, data.username.toLowerCase()));
    if (!user) throw new Error("Invalid username or password");
    if (!user.password) throw new Error("This account does not have a password set.");
    const valid = await bcryptjs.compare(data.password, user.password);
    if (!valid) throw new Error("Invalid username or password");
    const sessionId = newSessionId();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: sessionExpiresAt(),
    });
    return { sessionId, user: userPublic(user) };
  });

export const getMe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    if (isGuestSessionId(data.sessionId)) {
      if (!isGuestSessionValid(data.sessionId)) return null;
      return guestUser();
    }
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date()) return null;
    const [user] = await db
      .select(authUserPublicColumns)
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user) return null;
    return userPublic(user);
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
    if (isGuestSessionId(data.sessionId)) throw new Error(FULL_AUTH_REQUIRED_MESSAGE);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date())
      throw new Error(MISSING_OR_EXPIRED_SESSION_MESSAGE);
    const [user] = await db
      .update(users)
      .set({ displayName: data.displayName })
      .where(eq(users.id, session.userId))
      .returning({ displayName: users.displayName });
    return { displayName: user.displayName };
  });

export const updateEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), email: z.string().email() }))
  .handler(async ({ data }) => {
    if (isGuestSessionId(data.sessionId)) throw new Error(FULL_AUTH_REQUIRED_MESSAGE);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date())
      throw new Error(MISSING_OR_EXPIRED_SESSION_MESSAGE);
    const [user] = await db
      .update(users)
      .set({ email: data.email })
      .where(eq(users.id, session.userId))
      .returning({ email: users.email });
    return { email: user.email };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    }),
  )
  .handler(async ({ data }) => {
    if (isGuestSessionId(data.sessionId)) throw new Error(FULL_AUTH_REQUIRED_MESSAGE);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt < new Date())
      throw new Error(MISSING_OR_EXPIRED_SESSION_MESSAGE);
    const [user] = await db
      .select({ id: users.id, password: users.password })
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user) throw new Error("User not found");
    const valid = await bcryptjs.compare(data.currentPassword, user.password);
    if (!valid) throw new Error("Current password is incorrect");
    const hashed = await bcryptjs.hash(data.newPassword, authConfig.bcryptRounds);
    await db.update(users).set({ password: hashed }).where(eq(users.id, session.userId));
    return { ok: true };
  });
