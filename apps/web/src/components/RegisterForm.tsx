"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { homePathForUser } from "@/lib/roles";
import { SocialButtons } from "@/components/SocialButtons";

type Props = {
  idPrefix?: string;
};

export function RegisterForm({ idPrefix = "" }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const businessId = `${idPrefix}business_name`;

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
      router.push(homePathForUser(auth.user));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the business");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="eyebrow">Owner signup</p>
      <h1>Create business</h1>
      <form className="panel form" onSubmit={onSubmit} id={`${idPrefix}register-form`}>
        <label>
          Business name
          <input
            id={businessId}
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
          (document.getElementById(businessId) as HTMLInputElement | null)?.value ?? ""
        }
      />
      <p className="form-foot">
        Already have an account?{" "}
        <Link href="/login" className="link-underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
