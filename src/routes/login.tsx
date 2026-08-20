import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { STUDIO_EMAIL, STUDIO_NAME } from "@/lib/auth/email-password";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (password !== "1234") {
        setError("Wrong password.");
        return;
      }
      const signedIn = await authClient.signIn.email({
        email: STUDIO_EMAIL,
        password,
      });
      if (!signedIn.error) {
        navigate({ to: "/" });
        return;
      }

      const created = await authClient.signUp.email({
        email: STUDIO_EMAIL,
        password,
        name: STUDIO_NAME,
      });
      if (created.error) {
        setError("Wrong password.");
        return;
      }
      navigate({ to: "/" });
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrandMark className="mx-auto size-16" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
            Curtis
          </p>
          <h1 className="mt-1 font-serif text-4xl text-fg">Image Studio</h1>
          <p className="mt-3 text-sm text-muted">
            Lock a face. Name a topic. NVIDIA writes the scene. One Instagram post a day.
          </p>
        </div>
        {authEnabled ? (
          <form className="space-y-3 text-left" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            {error ? <p className="text-sm text-primary">{error}</p> : null}
            <Button type="submit" variant="navy" className="w-full" disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
