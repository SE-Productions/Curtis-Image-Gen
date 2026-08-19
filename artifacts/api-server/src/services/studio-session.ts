import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight single-operator session for the Curtis Image Studio.
 *
 * The studio has no multi-user account system: it is operated by one trusted
 * person. To keep persisted scenes from being read or deleted by arbitrary
 * public callers, scene endpoints are gated behind a signed, HTTP-only session
 * cookie that is only issued after the operator authenticates with the
 * STUDIO_ACCESS_PASSWORD secret.
 *
 * When STUDIO_ACCESS_PASSWORD is not configured (e.g. local development), the
 * studio runs in open mode so nothing breaks locally. In that mode `required`
 * is reported as false and the gate allows every request.
 */

const COOKIE_NAME = "curtis_studio_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function accessPassword(): string | null {
  const value = process.env.STUDIO_ACCESS_PASSWORD?.trim();
  return value ? value : null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isAccessPasswordConfigured(): boolean {
  return accessPassword() !== null;
}

/**
 * Local development can run without a password. Production cannot: persisted
 * images must never become publicly readable just because a deployment secret
 * was missed.
 */
export function studioAccessIsAvailable(): boolean {
  return isAccessPasswordConfigured() || !isProduction();
}

function signingSecret(): string {
  // SESSION_SECRET is provisioned in this environment; fall back to the access
  // password so a signed cookie is always possible when auth is enabled.
  return (
    process.env.SESSION_SECRET?.trim() ||
    accessPassword() ||
    "curtis-studio-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Validate the operator password using a constant-time comparison. */
export function verifyPassword(candidate: string): boolean {
  const expected = accessPassword();
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

/** Build a signed session token that encodes its own expiry. */
function issueToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

function tokenIsValid(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
}

/** True when the request carries a valid operator session cookie. */
export function hasValidSession(req: Request): boolean {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  return tokenIsValid(token);
}

export function setSessionCookie(res: Response): void {
  res.cookie(COOKIE_NAME, issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Gate middleware for scene endpoints. In open mode (no password configured)
 * it allows everything; otherwise a valid session cookie is required.
 */
export function requireStudioSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isAccessPasswordConfigured()) {
    if (studioAccessIsAvailable()) {
      next();
      return;
    }
    res.status(503).json({
      error: "Studio access protection is not configured.",
    });
    return;
  }
  if (hasValidSession(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "The studio is locked. Unlock it to continue." });
}
