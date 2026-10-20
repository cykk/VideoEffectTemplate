# Modal Watermark Bench

Independent benchmark project for validating `SegFormer + LaMa` on Modal before
touching the main product codebase.

## Scope

This project is intentionally isolated from:

- `apps/`
- `packages/`
- `ml/`

It is used to answer four questions:

1. Does `SegFormer + LaMa` beat the current production image pipeline?
2. How long is the true cold start on Modal?
3. How fast is the warm path?
4. Is the unit cost acceptable?

## What is included

- A clean Modal benchmark app under `service/`
- Batch runners under `scripts/`
- Input manifest samples under `data/manifests/`
- Reporting templates under `docs/`

## Expected model assets

The benchmark service expects a trained SegFormer checkpoint inside a Modal
Volume. By default it looks for:

- Volume name: `watermark-models`
- Model path inside volume: `/models/segformer_best`

This matches the current convention already used in `ml/deploy/`.

## Common commands

Create a local venv and install light dependencies:

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -e .
```

Deploy the benchmark service:

```bash
modal deploy service/modal_bench_app.py
```

Run a batch quality test:

```bash
python scripts/run_auto_batch.py --manifest data/manifests/sample_manifest.csv
```

Run a cold start benchmark:

```bash
python scripts/run_cold_start_bench.py --image data/inputs/logo_01.png
```

Run a warm start benchmark:

```bash
python scripts/run_warm_start_bench.py --image data/inputs/logo_01.png
```
