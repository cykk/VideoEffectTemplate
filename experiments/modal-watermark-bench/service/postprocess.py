from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_dilation


def build_masks(
    probability_map: np.ndarray,
    *,
    threshold: float,
    dilation_iters: int,
    feather_radius: int,
) -> tuple[Image.Image, Image.Image, np.ndarray]:
    raw_binary = probability_map > threshold
    raw_mask = Image.fromarray((raw_binary.astype(np.uint8) * 255), mode="L")

    refined_binary = raw_binary
    if dilation_iters > 0:
        refined_binary = binary_dilation(
            refined_binary,
            structure=np.ones((3, 3), dtype=bool),
            iterations=dilation_iters,
        )

    refined_mask = Image.fromarray((refined_binary.astype(np.uint8) * 255), mode="L")
    if feather_radius > 0:
        refined_mask = refined_mask.filter(ImageFilter.GaussianBlur(feather_radius))
        refined_binary = np.array(refined_mask) > 0
        refined_mask = Image.fromarray((refined_binary.astype(np.uint8) * 255), mode="L")

    return raw_mask, refined_mask, refined_binary
