"""
Version 1 sampler: mutually disjoint categories for seed items.

Algorithm (high-level):
1) Build indices from config (see shared.build_indices).
2) Repeatedly:
   a) Sample 4 "seed" items such that the sets of categories for each seed
      are pairwise disjoint (no category name appears for more than one seed).
   b) For each seed, choose one of its categories (it is unique among seeds
      by construction) and complete that category to 4 items total using
      complete_category_to_four, sampling without replacement across the game.
   c) If any step fails (not enough items left in a category, or cannot find
      a new disjoint seed item), restart from (a) up to max_retries times.
3) Build the final game structure (board + categories + numCategories).

This module exposes:

- sample_game_v1(config, *, rng=None, max_retries=500) -> dict | None
"""

from __future__ import annotations

from typing import Dict, List, Mapping, Optional, Sequence, Set, Tuple
import random

from .shared import (
    DIFFICULTIES,
    build_indices,
    complete_category_to_four,
    _build_game_structure,
)


def _find_disjoint_seeds(
    item_to_categories: Mapping[str, Set[str]],
    rng: Optional[random.Random] = None,
) -> Optional[List[str]]:
    """
    Try to pick 4 seed items such that the categories of each item are
    pairwise disjoint (no category reused across seeds).

    Returns:
        List of 4 item strings if successful; otherwise None.
    """
    if rng is None:
        rng = random

    items = list(item_to_categories.keys())
    if len(items) < 4:
        return None

    # We repeatedly shuffle and attempt greedy construction; this keeps
    # the logic simple while still exploring the space.
    rng.shuffle(items)

    seeds: List[str] = []
    used_categories: Set[str] = set()

    for item in items:
        cats = item_to_categories.get(item, set())
        if not cats:
            continue
        if cats.isdisjoint(used_categories):
            seeds.append(item)
            used_categories.update(cats)
            if len(seeds) == 4:
                return seeds

    return None


def sample_game_v1(
    config: Sequence[Mapping[str, object]],
    *,
    rng: Optional[random.Random] = None,
    max_retries: int = 500,
) -> Optional[Dict[str, object]]:
    """
    Sample a valid game using Version 1 of the procedure.

    Version 1 requirement for the 4 seed items:
    - Their category sets are pairwise disjoint (no overlap).

    For each seed item, we then:
    - Choose one of its categories (any – it's unique among seeds),
    - Complete that category to 4 items using complete_category_to_four,
      sampling without replacement across the entire game.

    If at any point we cannot satisfy the constraints (e.g. category
    has fewer than 3 remaining items), we restart the whole procedure
    up to `max_retries` times.

    Args:
        config: Sequence of category dicts (name + members).
        rng: Optional random.Random for deterministic tests.
        max_retries: How many times to restart before giving up.

    Returns:
        Game dict compatible with the JS side on success, or None if
        we failed to construct such a game within `max_retries` attempts.
    """
    if rng is None:
        rng = random

    item_to_categories, category_to_members, _ = build_indices(config)

    if len(item_to_categories) < 16:
        # Not even enough distinct items to fill the board.
        return None

    for _ in range(max_retries):
        # Step 1: sample seeds with mutually disjoint category sets.
        seeds = _find_disjoint_seeds(item_to_categories, rng=rng)
        if seeds is None:
            continue

        # We'll accumulate the final groups here.
        assignments: List[Tuple[str, str, List[str]]] = []
        used_items: Set[str] = set(seeds)

        success = True

        for idx, seed in enumerate(seeds):
            categories_for_seed = list(item_to_categories.get(seed, ()))
            if not categories_for_seed:
                success = False
                break

            # In version 1, by construction any category of the seed is
            # unique among the four seeds, so we can just choose arbitrarily.
            chosen_category = rng.choice(categories_for_seed)

            group_members = complete_category_to_four(
                seed_item=seed,
                category_name=chosen_category,
                category_to_members=category_to_members,
                used_items=used_items,
                rng=rng,
            )
            if group_members is None:
                success = False
                break

            # Mark all items in this group as used globally.
            used_items.update(group_members)
            difficulty_key = DIFFICULTIES[idx]
            assignments.append((difficulty_key, chosen_category, group_members))

        if not success:
            # Retry from scratch.
            continue

        # At this point we have 4 groups of 4 items each; build the game.
        return _build_game_structure(assignments)

    # Failed after max_retries.
    return None


__all__ = ["sample_game_v1"]

