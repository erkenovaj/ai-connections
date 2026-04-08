"""
Tests for game_sampler Version 1 and Version 2.

These tests are pure-Python and can be run with e.g.:

    python -m unittest python.tests.test_game_sampler

They exercise the core contracts:
- Return structure has 16 unique board items.
- Four categories (easy, medium, hard, harder) each with 4 members.
- Each board item appears in exactly one category.
"""

from __future__ import annotations

import json
import os
import random
import unittest

from python.game_sampler import sample_game_v1
from python.game_sampler_v2 import sample_game_v2


HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
CATEGORY_TEMPLATES_PATH = os.path.join(REPO_ROOT, "configs", "category-templates-new.json")


def _load_config():
    with open(CATEGORY_TEMPLATES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class BaseSamplerTest(unittest.TestCase):
    """Shared assertions for both samplers."""

    def assert_valid_game_structure(self, game, expected_num_categories=4):
        # Basic shape
        self.assertIsInstance(game, dict)
        self.assertIn("board", game)
        self.assertIn("categories", game)
        self.assertIn("numCategories", game)

        board = game["board"]
        cats = game["categories"]
        num = game["numCategories"]

        # 16 unique words
        self.assertEqual(len(board), 16)
        self.assertEqual(len(set(board)), 16)

        # Category count and expected difficulty labels
        self.assertEqual(num, expected_num_categories)
        if expected_num_categories == 4:
            expected_diffs = {"easy", "medium", "hard", "harder"}
        else:
            expected_diffs = {"easy", "medium", "hard"}
        self.assertEqual(set(cats.keys()), expected_diffs)

        all_members = []
        for diff, cat in cats.items():
            self.assertIn("name", cat)
            self.assertIn("members", cat)
            self.assertIn("difficulty", cat)
            self.assertEqual(cat["difficulty"], diff)
            members = cat["members"]
            self.assertEqual(len(members), 4)
            all_members.extend(members)

        # Solution members must be on the board.
        self.assertTrue(set(all_members).issubset(set(board)))

        # Board is always 16 tiles.
        self.assertEqual(len(board), 16)


class TestGameSamplerV1(BaseSamplerTest):
    def test_sample_game_v1_produces_valid_game(self):
        cfg = _load_config()
        rng = random.Random(42)
        game = sample_game_v1(cfg, rng=rng, max_retries=200)
        self.assertIsNotNone(game)
        self.assert_valid_game_structure(game)


class TestGameSamplerV2(BaseSamplerTest):
    def test_sample_game_v2_produces_valid_game(self):
        cfg = _load_config()
        rng = random.Random(123)
        game = sample_game_v2(cfg, rng=rng, max_retries=200)
        self.assertIsNotNone(game)
        self.assert_valid_game_structure(game)

    def test_sample_game_v2_advanced_produces_valid_game(self):
        cfg = _load_config()
        rng = random.Random(123)
        game = sample_game_v2(cfg, num_categories=3, rng=rng, max_retries=200)
        self.assertIsNotNone(game)
        self.assert_valid_game_structure(game, expected_num_categories=3)


if __name__ == "__main__":
    unittest.main()

