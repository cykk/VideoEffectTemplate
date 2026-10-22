"use client";

import { useEffect } from "react";
import { apiFetch } from "@markless/shared/src/lib/http/client";

export function FirstTouchCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("_landing_path", window.location.pathname);
    params.set("_source_host", window.location.host);
    void apiFetch(`/api/attribution?${params.toString()}`, { cache: "no-store" });
  }, []);

  return null;
}
