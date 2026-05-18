import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as oidc from "openid-client";
import { db } from "../../server/db";
import { users, sessions, userSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

let _config: oidc.Configuration | null = null;

async function getConfig(): Promise<oidc.Configuration> {
  if (!_config) {
    _config = await oidc.discovery(
      new URL("https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  }
  return _config;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 30);
}

function userPublic(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email ?? undefined,
    profileImageUrl: user.profileImageUrl ?? undefined,
    isReplitUser: !!user.replitId,
  };
}

// Step 1: generate the auth URL + PKCE params on the server
export const startReplitAuth = createServerFn({ method: "POST" })
  .inputValidator(z.object({ redirectUri: z.string() }))
  .handler(async ({ data }) => {
    const config = await getConfig();
    const state = oidc.randomState();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const authUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: data.redirectUri,
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login consent",
    });

    return { authUrl: authUrl.href, state, codeVerifier };
  });

// Step 2: exchange the code for tokens on the server, create a session
export const exchangeReplitCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fullCallbackUrl: z.string(),
      codeVerifier: z.string(),
      expectedState: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const config = await getConfig();

    const tokens = await oidc.authorizationCodeGrant(
      config,
      new URL(data.fullCallbackUrl),
      {
        pkceCodeVerifier: data.codeVerifier,
        expectedState: data.expectedState,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims();
    if (!claims?.sub) throw new Error("No user identity from Replit.");

    const replitId = String(claims.sub);
    const email = claims.email ? String(claims.email) : null;
    const firstName = (claims as any)["first_name"] ?? null;
    const lastName = (claims as any)["last_name"] ?? null;
    const profileImageUrl = (claims as any)["profile_image_url"] ?? null;
    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      email?.split("@")[0] ||
      "Replit User";

    // Find or create user by replitId
    let [user] = await db.select().from(users).where(eq(users.replitId, replitId));

    if (!user) {
      const base = email
        ? slugify(email.split("@")[0])
        : `replit_${replitId.slice(0, 8)}`;
      let username = base;
      let attempt = 0;
      while (true) {
        const [existing] = await db.select().from(users).where(eq(users.username, username));
        if (!existing) break;
        attempt++;
        username = `${base}_${attempt}`;
      }
      [user] = await db
        .insert(users)
        .values({ username, displayName, email, replitId, profileImageUrl })
        .returning();
      await db.insert(userSettings).values({ userId: user.id });
    } else {
      [user] = await db
        .update(users)
        .set({
          displayName: user.displayName !== "Reader" ? user.displayName : displayName,
          email: user.email ?? email,
          profileImageUrl,
        })
        .where(eq(users.id, user.id))
        .returning();
    }

    const sessionId = crypto.randomUUID();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { sessionId, user: userPublic(user) };
  });
