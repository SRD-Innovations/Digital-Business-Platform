"use client";

import { RegisterForm } from "@/components/RegisterForm";
import { LandingSlideshow } from "@/components/LandingSlideshow";

export default function HomePage() {
  return (
    <div className="page landing-page">
      <section className="landing-split" aria-label="BizNet">
        <div className="landing-visual">
          <LandingSlideshow />
        </div>
        <div className="landing-signup" id="signup">
          <main className="shell form-shell landing-signup-inner">
            <RegisterForm compact idPrefix="home-" />
          </main>
        </div>
      </section>
    </div>
  );
}
