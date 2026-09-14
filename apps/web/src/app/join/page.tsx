"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { SocialButtons } from "@/components/SocialButtons";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const auth = await apiFetch<AuthResponse>("/v1/invites/accept", {
        method: "POST",
        body: JSON.stringify({
          token: form.get("token"),
          full_name: form.get("full_name"),
          password: form.get("password"),
        }),
      });
      saveSession(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="auth-brand-inner">
            <p className="brand-mark">BizNet</p>
            <p>You were invited to a team. Set a password and you are on the floor.</p>
          </div>
        </aside>
        <div className="auth-panel">
          <main className="shell form-shell">
            <p className="eyebrow">Join team</p>
            <h1>Accept invite</h1>
            <p className="lede">
              Choose a name and password for phone sign-in, or continue with a social account.
            </p>
            <form className="panel form" onSubmit={onSubmit}>
              <input type="hidden" name="token" value={token} />
              <label>
                Your name
                <input name="full_name" required minLength={2} autoComplete="name" />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="btn" type="submit" disabled={pending || !token}>
                {pending ? "Joining…" : "Join business"}
              </button>
            </form>
            {token ? (
              <>
                <div className="or-rule">or</div>
                <SocialButtons intent="join" inviteToken={token} />
              </>
            ) : (
              <p className="form-error">This invite link is missing a token.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
