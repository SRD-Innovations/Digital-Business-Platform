"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getStoredUser, getToken } from "@/lib/auth";
import { homePathForUser } from "@/lib/roles";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    router.replace(homePathForUser(stored));
  }, [router]);

  return <p className="lede">Opening your workspace…</p>;
}
