"""
Version 2 sampler: weaker seed constraints with private categories.

Differences from Version 1:
- Instead of requiring the four seed items to have pairwise disjoint
  category sets, we require:
    1) There is no single category that contains all four items.
    2) For each item among the four, there exists at least one category
       that contains that item and *none* of the other three (a
       \"private\" category).

We then:
- For each seed item, choose one of its private categories,
- Complete that category to 4 items using complete_category_to_four,
  sampling without replacement across the game.

If any step fails, we restart from scratch up to max_retries times.
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


def _find_private_categories_for_seeds(
    seeds: Sequence[str],
    item_to_categories: Mapping[str, Set[str]],
) -> Optional[Dict[str, List[str]]]:
    """
    Given 4 seed items, check Version 2 constraints and compute
    each seed's private categories.

    Version 2 constraints:
    - No single category contains all 4 seeds.
    - For each seed, there is at least one category that contains that
      seed and none of the other seeds.

    Returns:
        Mapping seed_item -> list of private category names, or None if
        the constraints are not satisfied.
    """
    if len(seeds) != 4:
        return None

    seed_set = set(seeds)
    # Compute categories each item belongs to
    cat_sets: Dict[str, Set[str]] = {
        item: set(item_to_categories.get(item, set())) for item in seeds
    }

    # If any item has no categories, fail early
    if any(not cats for cats in cat_sets.values()):
        return None

    # Check 1: No category contains all 4 seeds.
    # Build a frequency map: category -> how many seeds contain it.
    cat_freq: Dict[str, int] = {}
    for cats in cat_sets.values():
        for c in cats:
            cat_freq[c] = cat_freq.get(c, 0) + 1

    if any(count == 4 for count in cat_freq.values()):
        return None

    # Check 2: For each seed, at least one \"private\" category that
    # contains this seed but none of the other three.
    private: Dict[str, List[str]] = {item: [] for item in seeds}
    for item in seeds:
        cats = cat_sets[item]
        for c in cats:
            if cat_freq.get(c, 0) == 1:
                private[item].append(c)

    if any(len(v) == 0 for v in private.values()):
        return None

    return private


def _sample_seeds_v2(
    item_to_categories: Mapping[str, Set[str]],
    rng: Optional[random.Random] = None,
) -> Optional[Tuple[List[str], Dict[str, List[str]]]]:
    """
    Try to sample 4 seed items that satisfy Version 2 constraints.

    Returns:
        (seeds_list_of_4, private_categories_map) on success, or None
        on failure.
    """
    if rng is None:
        rng = random

    items = [item for item, cats in item_to_categories.items() if cats]
    if len(items) < 4:
        return None

    # We'll try a limited number of random 4-combinations.
    max_inner_tries = min(200, len(items) * 10)
    for _ in range(max_inner_tries):
        seeds = rng.sample(items, 4)
        private = _find_private_categories_for_seeds(seeds, item_to_categories)
        if private is not None:
            return seeds, private

    return None


def sample_game_v2(
    config: Sequence[Mapping[str, object]],
    *,
    rng: Optional[random.Random] = None,
    max_retries: int = 500,
) -> Optional[Dict[str, object]]:
    """
    Sample a valid game using Version 2 of the procedure.

    See module docstring for the exact constraints.
    """
    if rng is None:
        rng = random

    item_to_categories, category_to_members, _ = build_indices(config)

    if len(item_to_categories) < 16:
        return None

    for _ in range(max_retries):
        # Step 1: sample 4 seeds satisfying Version 2 conditions.
        result = _sample_seeds_v2(item_to_categories, rng=rng)
        if result is None:
            continue

        seeds, private_categories = result

        assignments: List[Tuple[str, str, List[str]]] = []
        used_items: Set[str] = set(seeds)
        success = True

        for idx, seed in enumerate(seeds):
            priv_cats = private_categories.get(seed, [])
            if not priv_cats:
                success = False
                break

            chosen_category = rng.choice(priv_cats)

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

            used_items.update(group_members)
            difficulty_key = DIFFICULTIES[idx]
            assignments.append((difficulty_key, chosen_category, group_members))

        if not success:
            continue

        return _build_game_structure(assignments)

    return None


__all__ = ["sample_game_v2"]

