from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bench.client import ModalBenchClient
from bench.config import CONFIG
from bench.io_utils import (
    append_csv_row,
    decode_base64_to_file,
    ensure_dir,
    read_manifest,
    write_json,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run batch quality tests against Modal.")
    parser.add_argument("--manifest", required=True, help="CSV manifest path")
    parser.add_argument("--endpoint", default=CONFIG.endpoint_url)
    parser.add_argument("--api-token", default=CONFIG.api_token)
    parser.add_argument("--threshold", type=float, default=CONFIG.default_threshold)
    parser.add_argument("--dilation", type=int, default=CONFIG.default_dilation)
    parser.add_argument("--feather", type=int, default=CONFIG.default_feather)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    rows = read_manifest(manifest_path)
    if args.limit > 0:
        rows = rows[: args.limit]

    output_root = ensure_dir(CONFIG.outputs_dir / "auto_remove")
    reports_dir = ensure_dir(CONFIG.outputs_dir / "reports")
    report_csv = reports_dir / "auto_batch_runs.csv"

    client = ModalBenchClient(args.endpoint, args.api_token)
    fieldnames = [
        "sample_id",
        "filename",
        "category",
        "watermark_type",
        "request_wall_ms",
        "pipeline_total_ms",
        "segformer_ms",
        "mask_postprocess_ms",
        "lama_ms",
        "watermark_detected",
        "watermark_ratio",
    ]

    for row in rows:
        sample_id = row["id"]
        image_path = CONFIG.inputs_dir / row["filename"]
        if not image_path.exists():
            raise FileNotFoundError(f"Missing input image: {image_path}")

        response, wall_ms = client.post_auto_remove(
            image_path,
            threshold=args.threshold,
            dilation_iters=args.dilation,
            feather_radius=args.feather,
        )

        sample_dir = ensure_dir(output_root / sample_id)
        decode_base64_to_file(response["images"]["raw_mask_png_base64"], sample_dir / "segment_raw_mask.png")
        decode_base64_to_file(response["images"]["refined_mask_png_base64"], sample_dir / "segment_refined_mask.png")
        decode_base64_to_file(response["images"]["result_png_base64"], sample_dir / "modal_result.png")
        write_json(sample_dir / "timing.json", response["timings_ms"])
        write_json(sample_dir / "meta.json", response)

        append_csv_row(
            report_csv,
            fieldnames,
            {
                "sample_id": sample_id,
                "filename": row["filename"],
                "category": row.get("category", ""),
                "watermark_type": row.get("watermark_type", ""),
                "request_wall_ms": round(wall_ms, 3),
                "pipeline_total_ms": response["timings_ms"].get("total", 0.0),
                "segformer_ms": response["timings_ms"].get("segformer_inference", 0.0),
                "mask_postprocess_ms": response["timings_ms"].get("mask_postprocess", 0.0),
                "lama_ms": response["timings_ms"].get("lama_inpainting", 0.0),
                "watermark_detected": response["watermark_detected"],
                "watermark_ratio": response["watermark_ratio"],
            },
        )

        print(
            f"[auto] {sample_id} | wall={wall_ms:.1f}ms | "
            f"pipeline={response['timings_ms'].get('total', 0.0):.1f}ms | "
            f"detected={response['watermark_detected']}"
        )


if __name__ == "__main__":
    main()
