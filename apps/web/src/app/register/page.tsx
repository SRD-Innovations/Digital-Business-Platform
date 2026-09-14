"use client";

import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm idPrefix="register-" />
    </AuthShell>
  );
}
