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
    parser = argparse.ArgumentParser(description="Summarize benchmark CSV into a markdown report.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", default=str(ROOT / "outputs/reports/benchmark-summary.md"))
    args = parser.parse_args()

    frame = pd.read_csv(args.csv)
    lines = ["# Benchmark Summary", ""]
    for mode, group in frame.groupby("mode"):
        lines.append(f"## {mode}")
        lines.append("")
        for column in ["request_wall_ms", "pipeline_total_ms", "segformer_ms", "mask_postprocess_ms", "lama_ms"]:
            series = group[column].dropna()
            if series.empty:
                continue
            lines.append(
                f"- `{column}`: count={int(series.count())}, "
                f"mean={series.mean():.2f}, p50={series.quantile(0.50):.2f}, "
                f"p95={series.quantile(0.95):.2f}, max={series.max():.2f}"
            )
        lines.append("")

    write_lines(Path(args.out), lines)
    print(f"Summary written to {args.out}")


if __name__ == "__main__":
    main()
