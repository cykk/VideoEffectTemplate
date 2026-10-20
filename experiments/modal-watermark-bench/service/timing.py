from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field


@dataclass
class TimingCollector:
    values_ms: dict[str, float] = field(default_factory=dict)

    @contextmanager
    def stage(self, name: str):
        started = time.perf_counter()
        try:
            yield
        finally:
            self.values_ms[name] = round((time.perf_counter() - started) * 1000.0, 3)
