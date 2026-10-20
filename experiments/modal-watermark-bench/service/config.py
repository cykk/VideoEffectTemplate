from __future__ import annotations

import os
from dataclasses import dataclass


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ServiceConfig:
    app_name: str = os.getenv("MODAL_BENCH_APP_NAME", "watermark-bench")
    volume_name: str = os.getenv("MODAL_BENCH_VOLUME_NAME", "watermark-models")
    secret_name: str = os.getenv("MODAL_BENCH_SECRET_NAME", "watermark-bench-secret")
    gpu: str = os.getenv("MODAL_BENCH_GPU", "L4")
    min_containers: int = int(os.getenv("MODAL_BENCH_MIN_CONTAINERS", "0"))
    scaledown_window: int = int(os.getenv("MODAL_BENCH_SCALEDOWN_WINDOW", "60"))
    timeout_seconds: int = int(os.getenv("MODAL_BENCH_TIMEOUT_SECONDS", "180"))
    enable_snapshot: bool = _as_bool(os.getenv("MODAL_BENCH_ENABLE_SNAPSHOT"), False)
    model_subdir: str = os.getenv("SEGFORMER_MODEL_SUBDIR", "segformer_best")
    no_watermark_ratio: float = float(os.getenv("MODAL_BENCH_NO_WATERMARK_RATIO", "0.0001"))


CONFIG = ServiceConfig()
