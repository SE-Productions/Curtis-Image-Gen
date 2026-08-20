import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
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
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="navy"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
