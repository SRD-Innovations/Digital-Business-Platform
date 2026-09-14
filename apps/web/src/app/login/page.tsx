"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { homePathForUser } from "@/lib/roles";
import { AuthShell } from "@/components/AuthShell";
import { SocialButtons } from "@/components/SocialButtons";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const auth = await apiFetch<AuthResponse>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });
      saveSession(auth);
      router.push(homePathForUser(auth.user));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in</h1>
      <form className="panel form" onSubmit={onSubmit}>
        <label>
          Email or mobile number
          <input
            name="identifier"
            required
            autoComplete="username"
            placeholder="owner@business.lk or 0771234567"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="or-rule">or</div>
      <SocialButtons intent="login" />
      <p className="form-foot">
        New business?{" "}
        <Link href="/" className="link-underline">
          Create business
        </Link>
      </p>
    </AuthShell>
  );
}
