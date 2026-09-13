"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { saveSession } from "@/lib/auth";

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
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      saveSession(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <main className="shell form-shell">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="lede">Use the owner email you registered with.</p>
        <form className="panel form" onSubmit={onSubmit}>
          <label>
            Email
            <input name="email" type="email" required placeholder="owner@business.lk" />
          </label>
          <label>
            Password
            <input name="password" type="password" required minLength={8} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="form-foot">
          New business? <Link href="/register">Create an account</Link>
        </p>
      </main>
    </div>
  );
}
