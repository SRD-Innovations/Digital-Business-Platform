"use client";

import { useEffect, useState, type CSSProperties } from "react";

const SLIDES = [
  { title: "Sell at the counter", visual: "pos" as const },
  { title: "Keep stock clear", visual: "stock" as const },
  { title: "Stay open offline", visual: "sync" as const },
  { title: "Make and trade", visual: "make" as const },
];

function SlideArt({ kind }: { kind: (typeof SLIDES)[number]["visual"] }) {
  if (kind === "pos") {
    return (
      <div className="slide-art" aria-hidden>
        <div className="art-card art-receipt">
          <span className="art-line art-line-wide" />
          <span className="art-line" />
          <span className="art-line art-line-mid" />
          <span className="art-total">Rs 4,250</span>
        </div>
        <div className="art-float art-scan">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (kind === "stock") {
    return (
      <div className="slide-art" aria-hidden>
        <div className="art-card art-chart">
          <div className="art-bars">
            <i style={{ "--h": "42%" } as CSSProperties} />
            <i style={{ "--h": "68%" } as CSSProperties} />
            <i style={{ "--h": "55%" } as CSSProperties} />
            <i style={{ "--h": "88%" } as CSSProperties} />
            <i style={{ "--h": "72%" } as CSSProperties} />
          </div>
          <div className="art-spark">
            <svg viewBox="0 0 120 36" preserveAspectRatio="none">
              <path
                d="M0 28 C20 26 28 8 48 12 C68 16 78 30 100 6 L120 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "sync") {
    return (
      <div className="slide-art" aria-hidden>
        <div className="art-card art-sync">
          <div className="art-pulse" />
          <div className="art-queue">
            <span />
            <span />
            <span />
          </div>
          <p className="art-caption">Sync</p>
        </div>
      </div>
    );
  }
  return (
    <div className="slide-art" aria-hidden>
      <div className="art-card art-bom">
        <div className="art-nodes">
          <span className="art-node" />
          <span className="art-node art-node-mid" />
          <span className="art-node" />
        </div>
        <div className="art-bars art-bars-sm">
          <i style={{ "--h": "50%" } as CSSProperties} />
          <i style={{ "--h": "75%" } as CSSProperties} />
          <i style={{ "--h": "40%" } as CSSProperties} />
        </div>
      </div>
    </div>
  );
}

export function LandingSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 4800);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="landing-stage" data-tone={["a", "b", "c", "d"][index]}>
      <div className="landing-stage-glow" aria-hidden />
      <div className="landing-orb landing-orb-a" aria-hidden />
      <div className="landing-orb landing-orb-b" aria-hidden />

      <div className="landing-stage-inner landing-welcome">
        <div className="landing-stage-mid" key={`${slide.title}-${index}`}>
          <SlideArt kind={slide.visual} />
          <p className="landing-welcome-label anim-fade-up">Welcome</p>
          <h2 className="landing-slide-title anim-fade-up anim-delay-1">
            Welcome to your Digital Business Platform
          </h2>
          <p className="landing-slide-caption anim-fade-up anim-delay-2">{slide.title}</p>
        </div>

        <div className="landing-dots" role="tablist" aria-label="Highlights">
          {SLIDES.map((item, i) => (
            <button
              key={item.title}
              type="button"
              className="landing-dot"
              data-active={i === index ? "true" : "false"}
              aria-label={item.title}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
