"use client";

import { API_URL } from "@/lib/api";
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
            className="btn btn-secondary social-btn social-btn-icon"
            onClick={() => start(id)}
            aria-label={`Continue with ${label}`}
            title={label}
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  );
}
