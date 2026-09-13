"use client";

import { useEffect, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "https://digital-business-platform.onrender.com";

type ApiState = "loading" | "ok" | "down";

export function ApiStatus() {
  const [state, setState] = useState<ApiState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/v1/health`, { signal: controller.signal })
      .then((response) => {
        setState(response.ok ? "ok" : "down");
      })
      .catch(() => setState("down"));
    return () => controller.abort();
  }, []);

  const label =
    state === "loading"
      ? "Checking API…"
      : state === "ok"
        ? "API connected"
        : "API unreachable";

  return (
    <p className="status" data-state={state === "loading" ? undefined : state}>
      <span className="dot" aria-hidden />
      {label}
    </p>
  );
}
