from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class BenchConfig:
    endpoint_url: str = os.getenv("MODAL_BENCH_ENDPOINT_URL", "").strip()
    api_token: str = os.getenv("MODAL_BENCH_API_TOKEN", "").strip()
    inputs_dir: Path = ROOT_DIR / os.getenv("MODAL_BENCH_INPUTS_DIR", "data/inputs")
    outputs_dir: Path = ROOT_DIR / os.getenv("MODAL_BENCH_OUTPUTS_DIR", "outputs")
    default_threshold: float = float(os.getenv("MODAL_BENCH_DEFAULT_THRESHOLD", "0.5"))
    default_dilation: int = int(os.getenv("MODAL_BENCH_DEFAULT_DILATION", "3"))
    default_feather: int = int(os.getenv("MODAL_BENCH_DEFAULT_FEATHER", "2"))


CONFIG = BenchConfig()
