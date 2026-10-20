from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Any

import httpx


class ModalBenchClient:
    def __init__(self, endpoint_url: str, api_token: str, timeout_seconds: float = 300.0):
        if not endpoint_url:
            raise ValueError("Missing MODAL_BENCH_ENDPOINT_URL")
        if not api_token:
            raise ValueError("Missing MODAL_BENCH_API_TOKEN")
        self.endpoint_url = endpoint_url
        self.api_token = api_token
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def post_auto_remove(
        self,
        image_path: Path,
        *,
        threshold: float,
        dilation_iters: int,
        feather_radius: int,
    ) -> tuple[dict[str, Any], float]:
        image_bytes = image_path.read_bytes()
        payload = {
            "image_base64": base64.b64encode(image_bytes).decode("ascii"),
            "filename": image_path.name,
            "threshold": threshold,
            "dilation_iters": dilation_iters,
            "feather_radius": feather_radius,
        }
        started = time.perf_counter()
        response = httpx.post(
            self.endpoint_url,
            headers=self._headers(),
            json=payload,
            timeout=self.timeout_seconds,
        )
        wall_ms = (time.perf_counter() - started) * 1000.0
        response.raise_for_status()
        return response.json(), wall_ms
