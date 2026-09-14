"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    title: "Built for the counter",
    image:
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1600&q=80",
    alt: "Retail counter with a customer paying",
  },
  {
    title: "Stock that stays honest",
    image:
      "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&q=80",
    alt: "Warehouse aisles with inventory shelves",
  },
  {
    title: "Trade on your terms",
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1600&q=80",
    alt: "Fresh market produce and shoppers",
  },
  {
    title: "Make what you sell",
    image:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=80",
    alt: "Production floor and manufacturing work",
  },
] as const;

export function LandingSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [paused]);

  function goTo(next: number) {
    setIndex(next);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 9000);
  }

  const slide = SLIDES[index];

  return (
    <div className="landing-stage landing-stage-photos">
      <div className="landing-photos" aria-hidden>
        {SLIDES.map((item, i) => (
          <div
            key={item.image}
            className="landing-photo"
            data-active={i === index ? "true" : "false"}
          >
            <Image
              src={item.image}
              alt=""
              fill
              priority={i === 0}
              sizes="(max-width: 900px) 100vw, 55vw"
              className="landing-photo-img"
            />
          </div>
        ))}
        <div className="landing-photo-shade" />
      </div>

      <div className="landing-stage-inner landing-welcome">
        <div className="landing-stage-top">
          <p className="landing-brand">BizNet</p>
          <p className="landing-kicker">SRD Innovations</p>
        </div>

        <div className="landing-stage-mid" key={slide.title}>
          <p className="landing-welcome-label">Welcome</p>
          <h2 className="landing-slide-title">Welcome to your business OS</h2>
          <p className="landing-welcome-body">
            Sell, stock, and grow from one calm workspace — built for Sri Lankan shops, trade, and
            production floors.
          </p>
          <p className="landing-slide-caption">{slide.title}</p>
        </div>

        <div className="landing-dots" role="tablist" aria-label="Gallery">
          {SLIDES.map((item, i) => (
            <button
              key={item.image}
              type="button"
              className="landing-dot"
              data-active={i === index ? "true" : "false"}
              aria-label={item.alt}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
