from __future__ import annotations

from typing import Iterable

import pandas as pd


def summarize_numeric(values: Iterable[float]) -> dict[str, float]:
    series = pd.Series(list(values), dtype="float64")
    if series.empty:
        return {
            "count": 0.0,
            "mean": 0.0,
            "p50": 0.0,
            "p95": 0.0,
            "max": 0.0,
        }
    return {
        "count": float(series.count()),
        "mean": float(series.mean()),
        "p50": float(series.quantile(0.50)),
        "p95": float(series.quantile(0.95)),
        "max": float(series.max()),
    }
