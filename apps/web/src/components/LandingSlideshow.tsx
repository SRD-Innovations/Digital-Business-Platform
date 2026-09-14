"use client";

import { useEffect, useState, type CSSProperties } from "react";

const SLIDES = [
  {
    title: "Counter sales",
    tone: "a",
    visual: "pos",
  },
  {
    title: "Live stock",
    tone: "b",
    visual: "stock",
  },
  {
    title: "Offline ready",
    tone: "c",
    visual: "sync",
  },
  {
    title: "Make & trade",
    tone: "d",
    visual: "make",
  },
] as const;

function SlideVisual({ kind }: { kind: (typeof SLIDES)[number]["visual"] }) {
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
              <path d="M0 28 C20 26 28 8 48 12 C68 16 78 30 100 6 L120 6" fill="none" stroke="currentColor" strokeWidth="2.5" />
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
          <p className="art-caption">Queue · Sync</p>
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
    <div className="landing-stage" data-tone={slide.tone}>
      <div className="landing-stage-glow" aria-hidden />
      <div className="landing-stage-inner">
        <div className="landing-stage-top">
          <p className="landing-brand">BizNet</p>
          <p className="landing-kicker">SRD Innovations</p>
        </div>

        <div className="landing-stage-mid" key={slide.title}>
          <SlideVisual kind={slide.visual} />
          <h2 className="landing-slide-title">{slide.title}</h2>
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
