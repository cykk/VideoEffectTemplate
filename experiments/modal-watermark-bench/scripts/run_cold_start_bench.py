from __future__ import annotations

import argparse
import time
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bench.client import ModalBenchClient
from bench.config import CONFIG
from bench.io_utils import append_csv_row, ensure_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure cold-start latency against Modal.")
    parser.add_argument("--image", required=True, help="Path to a single input image")
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--sleep-seconds", type=int, default=120)
    parser.add_argument("--endpoint", default=CONFIG.endpoint_url)
    parser.add_argument("--api-token", default=CONFIG.api_token)
    parser.add_argument("--threshold", type=float, default=CONFIG.default_threshold)
    parser.add_argument("--dilation", type=int, default=CONFIG.default_dilation)
    parser.add_argument("--feather", type=int, default=CONFIG.default_feather)
    args = parser.parse_args()

    image_path = Path(args.image)
    client = ModalBenchClient(args.endpoint, args.api_token)
    report_csv = ensure_dir(CONFIG.outputs_dir / "reports") / "benchmark_runs.csv"
    fieldnames = [
        "mode",
        "iteration",
        "image",
        "sleep_seconds",
        "request_wall_ms",
        "pipeline_total_ms",
        "segformer_ms",
        "mask_postprocess_ms",
        "lama_ms",
        "watermark_detected",
    ]

    for index in range(1, args.iterations + 1):
        response, wall_ms = client.post_auto_remove(
            image_path,
            threshold=args.threshold,
            dilation_iters=args.dilation,
            feather_radius=args.feather,
        )
        append_csv_row(
            report_csv,
            fieldnames,
            {
                "mode": "cold",
                "iteration": index,
                "image": image_path.name,
                "sleep_seconds": args.sleep_seconds,
                "request_wall_ms": round(wall_ms, 3),
                "pipeline_total_ms": response["timings_ms"].get("total", 0.0),
                "segformer_ms": response["timings_ms"].get("segformer_inference", 0.0),
                "mask_postprocess_ms": response["timings_ms"].get("mask_postprocess", 0.0),
                "lama_ms": response["timings_ms"].get("lama_inpainting", 0.0),
                "watermark_detected": response["watermark_detected"],
            },
        )
        print(f"[cold {index}/{args.iterations}] wall={wall_ms:.1f}ms")
        if index < args.iterations:
            time.sleep(args.sleep_seconds)


if __name__ == "__main__":
    main()
