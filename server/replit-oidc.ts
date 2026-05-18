import * as oidc from "openid-client";

let configCache: oidc.Configuration | null = null;

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!configCache) {
    configCache = await oidc.discovery(
      new URL("https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  }
  return configCache;
}

export function getCallbackUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/callback`;
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.trim().indexOf("=");
    if (idx === -1) continue;
    result[part.trim().slice(0, idx)] = decodeURIComponent(part.trim().slice(idx + 1));
  }
  return result;
}

export function sessionCookieHeader(sessionId: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  return `basgiath_sid=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
  return "basgiath_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}
