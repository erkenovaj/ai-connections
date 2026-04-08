"""
Shared helpers for sampling valid Connections-style games from a config file.

This module is intentionally dependency-free (std lib only) so it runs under
Pyodide / WebAssembly in the browser.

Config format (matches configs/category-templates-new.json):
- List of item dicts with keys:
    - "name": item name (string)
    - "description": human-readable description (string, optional)
    - "tags": list of category/tag strings the item belongs to

The samplers use two indices:
- item_to_categories: item -> set of category names it appears in
- category_to_members: category name -> list of item strings
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple
import random


DIFFICULTIES: Tuple[str, str, str, str] = ("easy", "medium", "hard", "harder")


@dataclass(frozen=True)
class CategoryTemplate:
    """Internal representation of a category from the JSON config."""

    name: str
    members: Tuple[str, ...]


def build_indices(
    config: Sequence[Mapping[str, object]],
) -> Tuple[Dict[str, Set[str]], Dict[str, List[str]], List[CategoryTemplate]]:
    """
    Build helper indices from the raw config.

    Args:
        config: Sequence of item dicts with keys:
            - \"name\": item name (string)
            - \"tags\": iterable of category/tag strings

    Returns:
        item_to_categories: item -> set of category names it belongs to.
        category_to_members: category name -> list of member item strings.
        categories: list of CategoryTemplate (one per category/tag).
    """
    item_to_categories: Dict[str, Set[str]] = {}
    category_to_members: Dict[str, List[str]] = {}
    categories: List[CategoryTemplate] = []

    # First pass: build item -> categories and category -> members from items
    for raw_item in config:
        item_name_obj = raw_item.get("name")
        if not item_name_obj:
            continue
        item_name = str(item_name_obj)

        raw_tags = raw_item.get("tags") or []
        # Normalise tags to strings and ignore falsy values
        tags: List[str] = [str(t) for t in raw_tags if t]

        if not tags:
            # Items with no tags cannot participate in any category-based game.
            continue

        if item_name not in item_to_categories:
            item_to_categories[item_name] = set()

        for tag in tags:
            item_to_categories[item_name].add(tag)
            if tag not in category_to_members:
                category_to_members[tag] = []
            category_to_members[tag].append(item_name)

    # Second pass: build CategoryTemplate objects from the category_to_members map
    for category_name, members in category_to_members.items():
        categories.append(CategoryTemplate(name=category_name, members=tuple(members)))

    return item_to_categories, category_to_members, categories


def _build_game_structure(
    category_assignments: List[Tuple[str, str, List[str]]],
    extra_board_items: Optional[List[str]] = None,
) -> Dict[str, object]:
    """
    Build the final game dict from sampled assignments.

    Args:
        category_assignments: list of tuples
            (difficulty_key, category_name, members_list_of_4)
        extra_board_items: optional list of additional items to place on
            the board (e.g. decoys in advanced mode). These items are NOT
            part of any category in the solution.

    Returns:
        Game dict compatible with the JS code:
        {
            "board": [N items],
            "categories": { difficulty: { name, members, difficulty }, ... },
            "numCategories": <number of categories>,
        }
    """
    board: List[str] = []
    for _, _, members in category_assignments:
        board.extend(members)

    if extra_board_items:
        board.extend(extra_board_items)

    random.shuffle(board)

    categories_obj: Dict[str, Dict[str, object]] = {}
    for difficulty, cat_name, members in category_assignments:
        categories_obj[difficulty] = {
            "name": cat_name,
            "members": list(members),
            "difficulty": difficulty,
        }

    return {
        "board": board,
        "categories": categories_obj,
        "numCategories": len(category_assignments),
    }


def complete_category_to_four(
    seed_item: str,
    category_name: str,
    category_to_members: Mapping[str, Sequence[str]],
    used_items: Set[str],
    rng: Optional[random.Random] = None,
) -> Optional[List[str]]:
    """
    Given a chosen seed item and category, sample 3 additional members
    from that category so that the total is 4 items for the group.

    Sampling is without replacement across the *entire* game:
    - `used_items` contains any items already committed to groups (including
      all seed items before completing any category).

    Args:
        seed_item: The item that anchors this category.
        category_name: Name of the category we are completing.
        category_to_members: Mapping category -> sequence of all its members.
        used_items: Set of items already used in any group.
        rng: Optional random.Random for deterministic testing.

    Returns:
        List of 4 items (seed + 3 sampled) if successful, otherwise None
        if the category doesn't have enough remaining members.
    """
    if rng is None:
        rng = random

    all_members = category_to_members.get(category_name, ())

    # Exclude anything already used *except* the seed itself, which we
    # explicitly include as part of this group.
    available = [m for m in all_members if m not in used_items or m == seed_item]

    # Ensure the seed is in the available list
    if seed_item not in available:
        return None

    # We need seed + 3 more = 4 total
    # First remove the seed from the candidates for the extra 3
    extra_candidates = [m for m in available if m != seed_item]
    if len(extra_candidates) < 3:
        return None

    chosen_extras = rng.sample(extra_candidates, 3)
    group_members = [seed_item] + chosen_extras
    return group_members


__all__ = [
    "CategoryTemplate",
    "DIFFICULTIES",
    "build_indices",
    "complete_category_to_four",
    "_build_game_structure",
]

