"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Plan, type Subscription, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function load(tokenValue: string) {
    const [nextPlans, nextSub] = await Promise.all([
      apiFetch<Plan[]>("/v1/billing/plans", { token: tokenValue }),
      apiFetch<Subscription | null>("/v1/billing/subscription", { token: tokenValue }),
    ]);
    setPlans(nextPlans);
    setSubscription(nextSub);
  }

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    load(storedToken).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load billing"),
    );
  }, [router]);

  async function choosePlan(planCode: string) {
    if (!token || !canManage(user?.role ?? "")) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const checkout = await apiFetch<{ mode: string; message: string }>("/v1/billing/payhere/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ plan_code: planCode, billing_interval: interval }),
      });
      const next = await apiFetch<Subscription>("/v1/billing/subscribe", {
        method: "POST",
        token,
        body: JSON.stringify({ plan_code: planCode, billing_interval: interval }),
      });
      setSubscription(next);
      setMessage(`${checkout.message} Plan set to ${next.plan.name}.`);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update plan");
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  return (
    <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Billing</h1>
        <p className="lede">
          Trial and plan limits for branches / users / modules.{" "}
          <Link href="/dashboard">Dashboard</Link>
          {user.is_platform_admin ? (
            <>
              {" · "}
              <Link href="/dashboard/admin">Platform admin</Link>
            </>
          ) : null}
        </p>

        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <p className="panel-label">Current subscription</p>
          {subscription ? (
            <p>
              {subscription.plan.name} · {subscription.status}
              {subscription.trial_ends_at
                ? ` · trial until ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
                : ""}
              <span className="muted">
                {" "}
                · max {subscription.plan.max_branches} branches / {subscription.plan.max_users} users
              </span>
            </p>
          ) : (
            <p className="muted">No subscription</p>
          )}
        </div>

        {canManage(user.role) ? (
          <>
            <div className="panel form" style={{ marginBottom: "1.25rem" }}>
              <p className="panel-label">Billing interval</p>
              <select value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="panel">
              <p className="panel-label">Plans</p>
              <ul className="row-list">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <span>
                      {plan.name}
                      <span className="muted">
                        {" "}
                        · Rs {interval === "yearly" ? plan.price_yearly_lkr : plan.price_monthly_lkr}/
                        {interval === "yearly" ? "yr" : "mo"}
                        {plan.includes_trade ? " · Trade" : ""}
                        {plan.includes_manufacturing ? " · Mfg" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pending}
                      onClick={() => choosePlan(plan.code)}
                    >
                      Choose
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="muted">Only owners/managers can change plans.</p>
        )}

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
      </main>
  );
}
