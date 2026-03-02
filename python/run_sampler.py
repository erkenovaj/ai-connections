"""
Small CLI to exercise the Python samplers locally.

Usage examples:

    # Use Version 1 with default config path
    python -m python.run_sampler --version 1

    # Use Version 2 with explicit config path
    python -m python.run_sampler --version 2 --config configs/category-templates.json
"""

from __future__ import annotations

import argparse
import json
import os
import random
from typing import Any, Dict

from .game_sampler import sample_game_v1
from .game_sampler_v2 import sample_game_v2


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample a game using the Python samplers.")
    parser.add_argument(
        "--version",
        "-v",
        choices=["1", "2"],
        default="1",
        help="Sampler version to use (1 = disjoint, 2 = private categories).",
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

    if args.seed is not None:
        rng = random.Random(args.seed)
    else:
        rng = random.Random()

    # Resolve config path relative to current working directory.
    config_path = os.path.abspath(args.config)
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if args.version == "1":
        game = sample_game_v1(config, rng=rng, max_retries=args.max_retries)
    else:
        game = sample_game_v2(config, rng=rng, max_retries=args.max_retries)

    if game is None:
        raise SystemExit("Failed to sample a valid game within the retry limit.")

    # Pretty-print JSON result to stdout
    import sys
    json.dump(game, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

