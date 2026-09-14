"use client";

import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="page">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="auth-brand-inner">
            <p className="brand-mark">BizNet</p>
            <p>
              Open a trial in minutes. Invite staff by phone later — they do not need email to join
              the till.
            </p>
          </div>
        </aside>
        <div className="auth-panel">
          <main className="shell form-shell">
            <RegisterForm idPrefix="register-" />
          </main>
        </div>
      </div>
    </div>
  );
}
