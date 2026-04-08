"""
Small CLI to exercise the Python samplers locally.

Usage examples:

    # Normal mode (4 categories) with V2 sampler
    python -m python.run_sampler --mode normal

    # Advanced mode (3 categories + 4 decoys)
    python -m python.run_sampler --mode advanced

    # V1 sampler (disjoint categories, normal only)
    python -m python.run_sampler --version 1

    # Custom config path
    python -m python.run_sampler --mode normal --config configs/category-templates.json
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys

from .game_sampler import sample_game_v1
from .game_sampler_v2 import sample_game_v2


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample a game using the Python samplers.")
    parser.add_argument(
        "--version",
        "-v",
        choices=["1", "2"],
        default="2",
        help="Sampler version (1 = disjoint seeds, 2 = private categories). Default: 2.",
    )
    parser.add_argument(
        "--mode",
        "-m",
        choices=["normal", "advanced"],
        default="normal",
        help="Game mode: normal = 4 categories, advanced = 3 categories + 4 decoys.",
    )
    parser.add_argument(
        "--config",
        "-c",
        default="configs/category-templates.json",
        help="Path to category-templates.json (relative to repo root).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed for reproducibility.",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=500,
        help="Maximum number of attempts before giving up.",
    )

    args = parser.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else random.Random()

    config_path = os.path.abspath(args.config)
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    num_categories = 4 if args.mode == "normal" else 3

    if args.version == "1":
        if num_categories != 4:
            raise SystemExit("V1 sampler only supports normal mode (4 categories).")
        game = sample_game_v1(config, rng=rng, max_retries=args.max_retries)
    else:
        game = sample_game_v2(
            config, num_categories=num_categories,
            rng=rng, max_retries=args.max_retries,
        )

    if game is None:
        raise SystemExit("Failed to sample a valid game within the retry limit.")

    json.dump(game, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

