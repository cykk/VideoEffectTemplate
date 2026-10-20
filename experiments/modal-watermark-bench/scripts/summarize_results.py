from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bench.io_utils import write_lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize auto batch runs into markdown.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", default=str(ROOT / "outputs/reports/quality-summary.md"))
    args = parser.parse_args()

    frame = pd.read_csv(args.csv)
    total = len(frame)
    detected = int(frame["watermark_detected"].fillna(False).astype(bool).sum()) if total else 0

    lines = [
        "# Quality Summary",
        "",
        f"- Samples: {total}",
        f"- Watermark detected: {detected}",
        "",
    ]

    if total:
        lines.extend(
            [
                "## Timing",
                "",
                f"- Mean request wall ms: {frame['request_wall_ms'].mean():.2f}",
                f"- Mean pipeline total ms: {frame['pipeline_total_ms'].mean():.2f}",
                f"- Mean SegFormer ms: {frame['segformer_ms'].mean():.2f}",
                f"- Mean LaMa ms: {frame['lama_ms'].mean():.2f}",
                "",
                "## By Category",
                "",
            ]
        )

        if "category" in frame.columns:
            for category, group in frame.groupby("category"):
                lines.append(
                    f"- `{category}`: count={len(group)}, "
                    f"mean_wall={group['request_wall_ms'].mean():.2f}, "
                    f"detected={int(group['watermark_detected'].fillna(False).astype(bool).sum())}"
                )

    write_lines(Path(args.out), lines)
    print(f"Summary written to {args.out}")


if __name__ == "__main__":
    main()
