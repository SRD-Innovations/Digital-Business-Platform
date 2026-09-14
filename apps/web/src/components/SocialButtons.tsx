"use client";

import { useEffect, useState } from "react";

import { API_URL, apiFetch } from "@/lib/api";

const LABELS = {
  google: "Continue with Google",
  facebook: "Continue with Facebook",
  tiktok: "Continue with TikTok",
} as const;

type Provider = keyof typeof LABELS;

type Props = {
  intent: "login" | "register" | "join";
  inviteToken?: string;
  getBusinessName?: () => string;
};

export function SocialButtons({ intent, inviteToken, getBusinessName }: Props) {
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    apiFetch<Record<Provider, boolean>>("/v1/auth/oauth/providers")
      .then((providers) => setConfigured(Object.values(providers).some(Boolean)))
      .catch(() => undefined);
  }, []);

  function start(provider: Provider) {
    const params = new URLSearchParams({ intent });
    if (inviteToken) params.set("invite_token", inviteToken);
    if (intent === "register") {
      const name = getBusinessName?.().trim() ?? "";
      if (name.length < 2) {
        window.alert("Enter the business name first, then continue with Google, Facebook, or TikTok.");
        return;
      }
      params.set("business_name", name);
    }
    window.location.href = `${API_URL}/v1/auth/oauth/${provider}/start?${params.toString()}`;
  }

  return (
    <div className="social-stack">
      {(Object.keys(LABELS) as Provider[]).map((provider) => (
        <button key={provider} type="button" className="btn btn-secondary" onClick={() => start(provider)}>
          {LABELS[provider]}
        </button>
      ))}
      {!configured ? (
        <p className="muted">
          These buttons work after Google, Facebook, and TikTok app keys are added on the API.
        </p>
      ) : null}
    </div>
  );
}
