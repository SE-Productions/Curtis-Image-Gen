/**
 * The upstream identity providers this app offers for sign-in (via the broker).
 *
 * Social login is off. Sign-in is the studio password on /login.
 */
export type GrokProvider = {
  /** This app's local provider id; also the callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [];
