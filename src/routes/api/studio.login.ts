import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { STUDIO_EMAIL, STUDIO_NAME, STUDIO_PASSWORD } from "@/lib/auth/email-password";

export const Route = createFileRoute("/api/studio/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let password = "";
        try {
          const body = (await request.json()) as { password?: string };
          password = String(body.password ?? "");
        } catch {
          return Response.json({ ok: false, error: "Wrong password." }, { status: 400 });
        }
        if (password !== STUDIO_PASSWORD) {
          return Response.json({ ok: false, error: "Wrong password." }, { status: 401 });
        }

        const signIn = await auth.api.signInEmail({
          body: { email: STUDIO_EMAIL, password },
          headers: request.headers,
          asResponse: true,
        });
        if (signIn.ok) return signIn;

        await auth.api.signUpEmail({
          body: { email: STUDIO_EMAIL, password, name: STUDIO_NAME },
          headers: request.headers,
          asResponse: true,
        });

        return auth.api.signInEmail({
          body: { email: STUDIO_EMAIL, password },
          headers: request.headers,
          asResponse: true,
        });
      },
    },
  },
});
