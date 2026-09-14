"use client";

import { RegisterForm } from "@/components/RegisterForm";
import { AuthShell } from "@/components/AuthShell";

export default function HomePage() {
  return (
    <AuthShell panelId="signup">
      <RegisterForm idPrefix="home-" />
    </AuthShell>
  );
}
