import { ApiStatus } from "@/components/ApiStatus";

export default function HomePage() {
  return (
    <div className="page">
      <main className="shell">
        <p className="eyebrow">SRD Innovations</p>
        <h1>Digital Business Platform</h1>
        <p className="lede">
          A web-based operating system for a business — EPOS and ERP together —
          not a till with extras bolted on.
        </p>
        <div className="panel">
          <ul>
            <li>MVP: core, POS, ERP, Trade, Manufacturing, Solo</li>
            <li>Web only, offline-first</li>
            <li>Next.js · FastAPI · Supabase · Bun · Vercel · Render</li>
          </ul>
        </div>
        <ApiStatus />
      </main>
    </div>
  );
}
