/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Studio login uses a single password on /login. The email is a fixed
 * local account (`studio@curtis.local`) so the visitor only types the password.
 */
export const emailAndPasswordEnabled = true;

export const STUDIO_EMAIL = "studio@curtis.local";
export const STUDIO_NAME = "Studio";
export const STUDIO_PASSWORD = process.env.APP_PASSWORD?.trim() || "1234";
export const minPasswordLength = 4;
