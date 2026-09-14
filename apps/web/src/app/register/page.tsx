"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { SocialButtons } from "@/components/SocialButtons";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const auth = await apiFetch<AuthResponse>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          business_name: form.get("business_name"),
          full_name: form.get("full_name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      saveSession(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the business");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="auth-brand-inner">
            <p className="brand-mark">SRD Biz</p>
            <p>
              Open a trial in minutes. Invite staff by phone later — they do not need email to join
              the till.
            </p>
          </div>
        </aside>
        <div className="auth-panel">
          <main className="shell form-shell">
            <p className="eyebrow">Get started</p>
            <h1>Create your business</h1>
            <p className="lede">Owners start with email. Cashiers can join with a mobile invite.</p>
            <form className="panel form" onSubmit={onSubmit} id="register-form">
              <label>
                Business name
                <input
                  id="business_name"
                  name="business_name"
                  required
                  minLength={2}
                  placeholder="Nuwara Rice Mill"
                  autoComplete="organization"
                />
              </label>
              <label>
                Your name
                <input
                  name="full_name"
                  required
                  minLength={2}
                  placeholder="Amal Perera"
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="owner@business.lk"
                  autoComplete="email"
                />
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
              <button type="submit" className="btn" disabled={pending}>
                {pending ? "Creating…" : "Create business"}
              </button>
            </form>
            <div className="or-rule">or</div>
            <SocialButtons
              intent="register"
              getBusinessName={() =>
                (document.getElementById("business_name") as HTMLInputElement | null)?.value ?? ""
              }
            />
            <p className="form-foot">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
