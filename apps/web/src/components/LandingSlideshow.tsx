"use client";

import Image from "next/image";

export function LandingSlideshow() {
  return (
    <div className="landing-stage landing-stage-hero">
      <div className="landing-hero-media" aria-hidden>
        <Image
          src="/landing-page.jpeg"
          alt=""
          fill
          priority
          sizes="(max-width: 900px) 100vw, 55vw"
          className="landing-hero-img"
        />
        <div className="landing-photo-shade" />
      </div>

      <div className="landing-stage-inner landing-welcome">
        <div className="landing-stage-mid">
          <p className="landing-welcome-label anim-fade-up">Welcome</p>
          <h2 className="landing-slide-title anim-fade-up anim-delay-1">
            Welcome to your Digital Business Platform
          </h2>
        </div>
      </div>
    </div>
  );
}
