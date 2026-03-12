"""
One-time script to download the UI-DETR-1 model weights.

Usage:
    pip install huggingface_hub
    python scripts/export-model.py

This will download model.pth to the model/ directory.
"""

import os
from pathlib import Path
from huggingface_hub import hf_hub_download

MODEL_ID = "racineai/UI-DETR-1"
OUTPUT_DIR = Path(__file__).parent.parent / "model"


def main():
    print(f"Downloading {MODEL_ID}...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = hf_hub_download(
        repo_id=MODEL_ID,
        filename="model.pth",
        local_dir=str(OUTPUT_DIR),
    )

    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"Downloaded to {path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
