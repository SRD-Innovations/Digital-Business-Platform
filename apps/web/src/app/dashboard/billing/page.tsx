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
      <div className="page-head">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Billing</h1>
        <p className="lede">
          Trial, plan limits, and PayHere checkout.{" "}
          <Link href="/dashboard">Dashboard</Link>
          {user.is_platform_admin ? (
            <>
              {" · "}
              <Link href="/dashboard/admin">Platform admin</Link>
            </>
          ) : null}
        </p>
      </div>

      {subscription?.trial_ends_at && subscription.status === "trialing" ? (
        <div className="banner banner-warning" style={{ marginBottom: 12 }}>
          Trial until {new Date(subscription.trial_ends_at).toLocaleDateString()}. Choose a plan to
          continue after the trial.
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 12 }}>
        <p className="panel-label">Current subscription</p>
        {subscription ? (
          <p style={{ margin: 0 }}>
            {subscription.plan.name} · {subscription.status}
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
          <div className="chip-row" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="chip"
              data-active={interval === "monthly" ? "true" : "false"}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className="chip"
              data-active={interval === "yearly" ? "true" : "false"}
              onClick={() => setInterval("yearly")}
            >
              Yearly
            </button>
          </div>
          <div className="plan-grid">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="plan-card"
                data-current={subscription?.plan.code === plan.code ? "true" : "false"}
              >
                <p className="panel-label" style={{ margin: 0 }}>
                  {plan.name}
                </p>
                <p className="display-num" style={{ margin: 0 }}>
                  Rs {interval === "yearly" ? plan.price_yearly_lkr : plan.price_monthly_lkr}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  per {interval === "yearly" ? "year" : "month"}
                </p>
                <div className="chip-row">
                  {plan.includes_trade ? <span className="badge badge-trade">Trade</span> : null}
                  {plan.includes_manufacturing ? (
                    <span className="badge badge-manufacturing">Manufacturing</span>
                  ) : null}
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {plan.max_branches} branches · {plan.max_users} users
                </p>
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() => choosePlan(plan.code)}
                >
                  {pending ? "Opening…" : "PayHere checkout"}
                </button>
              </div>
            ))}
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
