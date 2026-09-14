"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    title: "Sell at the counter",
    body: "Barcode scan, split pay, park bills, and print receipts — even when the line is long.",
    tone: "a",
  },
  {
    title: "Keep stock honest",
    body: "Purchases, batches, and movements stay tied to every sale so the shelf matches the books.",
    tone: "b",
  },
  {
    title: "Works when the line drops",
    body: "Cached catalogue and queued checkouts sync when power and data return.",
    tone: "c",
  },
  {
    title: "Trade and make",
    body: "Wholesale tiers, expiry batches, BOMs, and production runs on the same calm workspace.",
    tone: "d",
  },
] as const;

export function LandingSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="landing-stage" data-tone={slide.tone}>
      <div className="landing-stage-glow" aria-hidden />
      <div className="landing-stage-copy">
        <p className="brand-mark">BizNet</p>
        <p className="landing-kicker">By SRD Innovations</p>
        {SLIDES.map((item, i) => (
          <div
            key={item.title}
            className="landing-slide"
            data-active={i === index ? "true" : "false"}
            aria-hidden={i !== index}
          >
            <h2 className="landing-slide-title">{item.title}</h2>
            <p className="landing-slide-body">{item.body}</p>
          </div>
        ))}
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
