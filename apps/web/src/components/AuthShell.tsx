"use client";

import type { ReactNode } from "react";

import { LandingSlideshow } from "@/components/LandingSlideshow";

type Props = {
  children: ReactNode;
  /** Anchor id for signup forms on the home page */
  panelId?: string;
};

/** Shared split layout: animated BizNet stage (left) + auth form (right). */
export function AuthShell({ children, panelId }: Props) {
  return (
    <div className="page landing-page">
      <section className="landing-split" aria-label="BizNet">
        <div className="landing-visual">
          <LandingSlideshow />
        </div>
        <div className="landing-signup" id={panelId}>
          <main className="shell form-shell landing-signup-inner">{children}</main>
        </div>
      </section>
    </div>
  );
}
