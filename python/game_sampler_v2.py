"""
Version 2 sampler: weaker seed constraints with private categories.

Differences from Version 1:
- Instead of requiring the seed items to have pairwise disjoint
  category sets, we require:
    1) No single category contains ALL N seed items.
    2) For each seed item, at least one category contains that item
       and *none* of the other seeds (a "private" category).

Normal mode (num_categories=4):
- Sample 4 seeds, complete each private category to 4 items, build game.

Advanced mode (num_categories=3):
- Sample 3 seeds + complete to 3 groups of 4 (12 items).
- Pick 4 decoy items that do NOT complete any unchosen category on the
  board. Decoys are biased toward items that share a category with
  real items (red herrings) to make the puzzle harder.
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
    Given N seed items, check Version 2 constraints and compute
    each seed's private categories.

    Version 2 constraints:
    - No single category contains all N seeds.
    - For each seed, at least one category contains that seed but
      none of the other seeds ("private" category).

    Returns:
        Mapping seed_item -> list of private category names, or None if
        the constraints are not satisfied.
    """
    if len(seeds) < 2:
        return None

    n = len(seeds)
    cat_sets: Dict[str, Set[str]] = {
        item: set(item_to_categories.get(item, set())) for item in seeds
    }

    if any(not cats for cats in cat_sets.values()):
        return None

    # Category frequency among the seeds.
    cat_freq: Dict[str, int] = {}
    for cats in cat_sets.values():
        for c in cats:
            cat_freq[c] = cat_freq.get(c, 0) + 1

    # No category may contain ALL N seeds.
    if any(count == n for count in cat_freq.values()):
        return None

    # For each seed, collect categories private to that seed
    # (frequency == 1 among the seed set).
    private: Dict[str, List[str]] = {item: [] for item in seeds}
    for item in seeds:
        for c in cat_sets[item]:
            if cat_freq.get(c, 0) == 1:
                private[item].append(c)

    if any(len(v) == 0 for v in private.values()):
        return None

    return private


def _sample_seeds_v2(
    item_to_categories: Mapping[str, Set[str]],
    num_seeds: int = 4,
    rng: Optional[random.Random] = None,
) -> Optional[Tuple[List[str], Dict[str, List[str]]]]:
    """
    Try to sample `num_seeds` seed items that satisfy Version 2 constraints.

    Returns:
        (seeds_list, private_categories_map) on success, or None.
    """
    if rng is None:
        rng = random

    items = [item for item, cats in item_to_categories.items() if cats]
    if len(items) < num_seeds:
        return None

    max_inner_tries = min(200, len(items) * 10)
    for _ in range(max_inner_tries):
        seeds = rng.sample(items, num_seeds)
        private = _find_private_categories_for_seeds(seeds, item_to_categories)
        if private is not None:
            return seeds, private

    return None


def _pick_decoys(
    used_items: Set[str],
    chosen_cat_names: Set[str],
    item_to_categories: Mapping[str, Set[str]],
    category_to_members: Mapping[str, Sequence[str]],
    num_decoys: int,
    rng: Optional[random.Random] = None,
) -> Optional[List[str]]:
    """
    Pick `num_decoys` items from the pool that are NOT already used,
    such that no unchosen category ends up with 4+ members on the board.

    Items that share a category with items already on the board are
    preferred (red-herring bias) to make the puzzle harder.

    Returns:
        List of decoy items, or None if no valid set can be found.
    """
    if rng is None:
        rng = random

    candidates = [
        item for item in item_to_categories if item not in used_items
    ]
    if len(candidates) < num_decoys:
        return None

    # Pre-compute how many members of each unchosen category are
    # already on the board (i.e. in used_items).
    unchosen_cats: Dict[str, int] = {}
    for cat_name, members in category_to_members.items():
        if cat_name in chosen_cat_names:
            continue
        count = sum(1 for m in members if m in used_items)
        unchosen_cats[cat_name] = count

    # Partition candidates into "red herrings" (share a category with
    # a board item) and "neutral" (no category overlap).
    red_herrings: List[str] = []
    neutral: List[str] = []

    for item in candidates:
        cats = item_to_categories.get(item, set())
        shares_category = any(c in chosen_cat_names for c in cats)
        if shares_category:
            red_herrings.append(item)
        else:
            neutral.append(item)

    # Shuffle both pools; try red herrings first, then neutral.
    rng.shuffle(red_herrings)
    rng.shuffle(neutral)
    ordered_pool = red_herrings + neutral

    # Greedy selection: pick items one at a time, checking the <4 constraint.
    decoys: List[str] = []
    # Track running count of unchosen-category members that would be on board.
    running_counts = dict(unchosen_cats)

    for item in ordered_pool:
        cats = item_to_categories.get(item, set())

        # Check: would adding this item push any unchosen category to 4?
        ok = True
        for c in cats:
            if c in chosen_cat_names:
                continue
            if c in running_counts and running_counts[c] + 1 >= 4:
                ok = False
                break

        if not ok:
            continue

        decoys.append(item)
        for c in cats:
            if c not in chosen_cat_names and c in running_counts:
                running_counts[c] += 1

        if len(decoys) == num_decoys:
            return decoys

    return None


def sample_game_v2(
    config: Sequence[Mapping[str, object]],
    *,
    num_categories: int = 4,
    rng: Optional[random.Random] = None,
    max_retries: int = 500,
) -> Optional[Dict[str, object]]:
    """
    Sample a valid game using Version 2 of the procedure.

    Args:
        config: Raw config (list of item dicts).
        num_categories: 4 for normal mode, 3 for advanced mode.
        rng: Optional random.Random for deterministic tests.
        max_retries: How many restarts before giving up.

    Normal mode (num_categories=4):
        4 seeds -> 4 groups of 4 = 16 items, no decoys.

    Advanced mode (num_categories=3):
        3 seeds -> 3 groups of 4 = 12 items + 4 decoys.
        Decoys are red-herring-biased and constrained so that no
        unchosen category has 4+ members on the 16-item board.
    """
    if rng is None:
        rng = random

    item_to_categories, category_to_members, _ = build_indices(config)

    if len(item_to_categories) < 16:
        return None

    for _ in range(max_retries):
        # Step 1: sample seeds satisfying Version 2 conditions.
        result = _sample_seeds_v2(
            item_to_categories, num_seeds=num_categories, rng=rng,
        )
        if result is None:
            continue

        seeds, private_categories = result

        assignments: List[Tuple[str, str, List[str]]] = []
        used_items: Set[str] = set(seeds)
        chosen_cat_names: Set[str] = set()
        success = True

        # Step 2: for each seed, pick a private category and complete to 4.
        for idx, seed in enumerate(seeds):
            priv_cats = private_categories.get(seed, [])
            if not priv_cats:
                success = False
                break

            chosen_category = rng.choice(priv_cats)
            chosen_cat_names.add(chosen_category)

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

        # Step 3: for advanced mode, pick decoys.
        decoys: Optional[List[str]] = None
        if num_categories < 4:
            num_decoys = 16 - (num_categories * 4)
            decoys = _pick_decoys(
                used_items=used_items,
                chosen_cat_names=chosen_cat_names,
                item_to_categories=item_to_categories,
                category_to_members=category_to_members,
                num_decoys=num_decoys,
                rng=rng,
            )
            if decoys is None:
                continue

        return _build_game_structure(assignments, extra_board_items=decoys)

    return None


__all__ = ["sample_game_v2"]

