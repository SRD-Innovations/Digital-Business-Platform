"use client";

import { useEffect, useState } from "react";

import { API_URL, apiFetch } from "@/lib/api";
import { IconFacebook, IconGoogle, IconTikTok } from "@/components/Icons";

const PROVIDERS = [
  { id: "google" as const, label: "Google", Icon: IconGoogle },
  { id: "facebook" as const, label: "Facebook", Icon: IconFacebook },
  { id: "tiktok" as const, label: "TikTok", Icon: IconTikTok },
];

type Provider = (typeof PROVIDERS)[number]["id"];

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
      <div className="social-row">
        {PROVIDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="btn btn-secondary social-btn"
            onClick={() => start(id)}
            aria-label={`Continue with ${label}`}
          >
            <Icon />
            <span className="social-btn-label">{label}</span>
          </button>
        ))}
      </div>
      {!configured ? <p className="muted social-hint">Connect social apps in API settings to enable.</p> : null}
    </div>
  );
}
