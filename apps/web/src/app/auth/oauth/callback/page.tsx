"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, apiFetch, type User } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { homePathForUser } from "@/lib/roles";

function OAuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = params.get("access_token");
    const oauthError = params.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!accessToken) {
      setError("Social login did not return a session");
      return;
    }
    apiFetch<User>("/v1/auth/me", { token: accessToken })
      .then((user) => {
        saveSession({ access_token: accessToken, token_type: "bearer", user });
        router.replace(homePathForUser(user));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not finish social login"));
  }, [params, router]);

  return (
    <div className="page">
      <main className="shell">
        <h1>Signing in…</h1>
        {error ? <p className="form-error">{error}</p> : <p className="lede">Please wait.</p>}
      </main>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback />
    </Suspense>
  );
}
