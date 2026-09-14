import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page">
      <section className="hero" aria-label="SRD Biz">
        <div className="hero-plane" aria-hidden />
        <div className="hero-content">
          <p className="brand-mark">SRD Biz</p>
          <h1 className="hero-headline">Run the shop. Keep the stock. Stay open when the line drops.</h1>
          <p className="hero-lede">
            One English workspace for sales, inventory, trade, and production — built for Sri Lankan
            counters that cannot wait on perfect internet.
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/register">
              Start free trial
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="home-band">
        <h2>Works when the line drops</h2>
        <p>
          Sell from a cached catalogue, queue checkouts on the counter, and sync when power and data
          return — so a Colombo pharmacy and a regional mill can share the same calm workflow.
        </p>
      </section>
    </div>
  );
}
