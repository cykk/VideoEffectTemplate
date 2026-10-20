from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Any

import modal

from service.config import CONFIG
from service.postprocess import build_masks
from service.timing import TimingCollector


APP = modal.App(CONFIG.app_name)
MODEL_DIR = Path("/models")
MODEL_VOLUME = modal.Volume.from_name(CONFIG.volume_name, create_if_missing=True)

RUNTIME_IMAGE = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libglib2.0-0", "libsm6", "libxrender1", "libxext6")
    .pip_install(
        "numpy>=2.1.0",
        "Pillow>=10.4.0",
        "scipy>=1.14.0",
        "simple-lama-inpainting==0.1.0",
        "transformers==4.40.0",
        "torch==2.1.0",
        "torchvision==0.16.0",
        index_url="https://download.pytorch.org/whl/cu121",
        extra_index_url="https://pypi.org/simple",
    )
)


def _require_authorization(header_value: str | None) -> None:
    expected = os.environ.get("MODAL_BENCH_API_TOKEN", "").strip()
    if not expected:
        raise RuntimeError("Missing MODAL_BENCH_API_TOKEN inside Modal secret")
    if header_value != f"Bearer {expected}":
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Unauthorized")


def _decode_image(image_base64: str):
    from PIL import Image

    return Image.open(io.BytesIO(base64.b64decode(image_base64))).convert("RGB")


def _encode_png(image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


@APP.cls(
    gpu=CONFIG.gpu,
    image=RUNTIME_IMAGE,
    volumes={str(MODEL_DIR): MODEL_VOLUME},
    min_containers=CONFIG.min_containers,
    scaledown_window=CONFIG.scaledown_window,
    timeout=CONFIG.timeout_seconds,
    enable_memory_snapshot=CONFIG.enable_snapshot,
    secrets=[modal.Secret.from_name(CONFIG.secret_name)],
)
class WatermarkBenchService:
    @modal.enter(snap=CONFIG.enable_snapshot)
    def load_models(self):
        import torch
        from simple_lama_inpainting import SimpleLama
        from transformers import (
            SegformerForSemanticSegmentation,
            SegformerImageProcessor,
        )

        model_path = MODEL_DIR / CONFIG.model_subdir
        if not (model_path / "config.json").exists():
            raise RuntimeError(
                f"SegFormer checkpoint not found at {model_path}. "
                "Upload a trained checkpoint to the Modal volume first."
            )

        self.device = torch.device("cuda")
        self.processor = SegformerImageProcessor.from_pretrained(str(model_path))
        self.segformer = (
            SegformerForSemanticSegmentation.from_pretrained(str(model_path))
            .to(self.device)
            .eval()
        )
        self.lama = SimpleLama()

    @modal.method()
    def auto_remove(
        self,
        image_base64: str,
        *,
        filename: str,
        threshold: float,
        dilation_iters: int,
        feather_radius: int,
    ) -> dict[str, Any]:
        import torch
        import torch.nn as nn

        timing = TimingCollector()
        with timing.stage("total"):
            with timing.stage("decode_image"):
                image = _decode_image(image_base64)

            with timing.stage("segformer_inference"):
                inputs = self.processor(images=image, return_tensors="pt").to(self.device)
                with torch.no_grad():
                    logits = self.segformer(**inputs).logits
                upsampled = nn.functional.interpolate(
                    logits,
                    size=(image.height, image.width),
                    mode="bilinear",
                    align_corners=False,
                )
                probability_map = torch.softmax(upsampled, dim=1)[0, 1].detach().cpu().numpy()

            with timing.stage("mask_postprocess"):
                raw_mask, refined_mask, refined_binary = build_masks(
                    probability_map,
                    threshold=threshold,
                    dilation_iters=dilation_iters,
                    feather_radius=feather_radius,
                )
                watermark_ratio = float(refined_binary.sum() / refined_binary.size)

            if watermark_ratio < CONFIG.no_watermark_ratio:
                result_image = image.copy()
                watermark_detected = False
                timing.values_ms["lama_inpainting"] = 0.0
            else:
                watermark_detected = True
                with timing.stage("lama_inpainting"):
                    result_image = self.lama(image, refined_mask)

            with timing.stage("encode_outputs"):
                response = {
                    "success": True,
                    "filename": filename,
                    "watermark_detected": watermark_detected,
                    "watermark_ratio": round(watermark_ratio, 6),
                    "image_width": image.width,
                    "image_height": image.height,
                    "config": {
                        "threshold": threshold,
                        "dilation_iters": dilation_iters,
                        "feather_radius": feather_radius,
                        "gpu": CONFIG.gpu,
                        "min_containers": CONFIG.min_containers,
                        "snapshot_enabled": CONFIG.enable_snapshot,
                    },
                    "timings_ms": dict(timing.values_ms),
                    "images": {
                        "raw_mask_png_base64": _encode_png(raw_mask),
                        "refined_mask_png_base64": _encode_png(refined_mask),
                        "result_png_base64": _encode_png(result_image),
                    },
                }
        return response


@APP.function(
    image=RUNTIME_IMAGE,
    secrets=[modal.Secret.from_name(CONFIG.secret_name)],
)
@modal.fastapi_endpoint(method="POST", docs=True)
async def auto_remove_endpoint(request):
    from fastapi import HTTPException

    _require_authorization(request.headers.get("Authorization"))
    payload = await request.json()

    image_base64 = str(payload.get("image_base64", "")).strip()
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    threshold = float(payload.get("threshold", 0.5))
    dilation_iters = int(payload.get("dilation_iters", 3))
    feather_radius = int(payload.get("feather_radius", 2))
    filename = str(payload.get("filename", "input.png")).strip() or "input.png"

    service = WatermarkBenchService()
    return service.auto_remove.remote(
        image_base64,
        filename=filename,
        threshold=threshold,
        dilation_iters=dilation_iters,
        feather_radius=feather_radius,
    )


@APP.local_entrypoint()
def smoke_test(
    image_path: str,
    threshold: float = 0.5,
    dilation_iters: int = 3,
    feather_radius: int = 2,
):
    image_bytes = Path(image_path).read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    service = WatermarkBenchService()
    result = service.auto_remove.remote(
        image_base64,
        filename=Path(image_path).name,
        threshold=threshold,
        dilation_iters=dilation_iters,
        feather_radius=feather_radius,
    )
    print(
        {
            "filename": result["filename"],
            "watermark_detected": result["watermark_detected"],
            "watermark_ratio": result["watermark_ratio"],
            "timings_ms": result["timings_ms"],
        }
    )
