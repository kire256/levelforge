"""
Demo / unit-test runner for SemanticGrid32.

Run directly:
    python demo_semantic_grid.py

No external dependencies required.
"""

import json
import sys
import traceback
from semantic_grid import Cell, SemanticGrid32


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

_passed = 0
_failed = 0


def _assert(condition: bool, msg: str) -> None:
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  PASS  {msg}")
    else:
        _failed += 1
        print(f"  FAIL  {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def test_basic_set_get() -> None:
    print("\n[test_basic_set_get]")
    g = SemanticGrid32()
    g.set(0, 0, Cell.SOLID)
    _assert(g.get(0, 0) == Cell.SOLID, "get returns SOLID after set")
    _assert(g.get(1, 0) == Cell.EMPTY, "adjacent cell is still EMPTY")


def test_add_remove_flags() -> None:
    print("\n[test_add_remove_flags]")
    g = SemanticGrid32()
    g.set(5, 5, Cell.SOLID)
    g.addFlags(5, 5, Cell.HAZARD)
    _assert(g.get(5, 5) == Cell.SOLID | Cell.HAZARD, "addFlags ORs correctly")
    g.removeFlags(5, 5, Cell.SOLID)
    _assert(g.get(5, 5) == Cell.HAZARD, "removeFlags clears only the specified flag")


def test_fill_and_clear() -> None:
    print("\n[test_fill_and_clear]")
    g = SemanticGrid32()
    g.fill(Cell.SOLID)
    _assert(g.get(15, 15) == Cell.SOLID, "fill sets every cell")
    g.clear()
    _assert(g.get(15, 15) == Cell.EMPTY, "clear zeros every cell")


def test_copy() -> None:
    print("\n[test_copy]")
    g = SemanticGrid32()
    g.set(3, 3, Cell.LADDER)
    h = g.copy()
    _assert(g == h, "copy is equal to original")
    h.set(3, 3, Cell.GOAL)
    _assert(g.get(3, 3) == Cell.LADDER, "original not mutated by copy modification")


def test_apply_rect_modes() -> None:
    print("\n[test_apply_rect_modes]")
    g = SemanticGrid32()

    # overwrite
    g.applyRect(0, 31, 32, 1, Cell.SOLID)
    _assert(g.get(0, 31) == Cell.SOLID, "applyRect overwrite: leftmost cell")
    _assert(g.get(31, 31) == Cell.SOLID, "applyRect overwrite: rightmost cell")
    _assert(g.get(0, 30) == Cell.EMPTY,  "applyRect overwrite: row above is untouched")

    # add
    g.applyRect(0, 31, 4, 1, Cell.HAZARD, mode="add")
    _assert(g.get(0, 31) == (Cell.SOLID | Cell.HAZARD), "applyRect add: merges HAZARD into SOLID")
    _assert(g.get(4, 31) == Cell.SOLID, "applyRect add: cell outside rect is unchanged")

    # remove
    g.applyRect(0, 31, 4, 1, Cell.HAZARD, mode="remove")
    _assert(g.get(0, 31) == Cell.SOLID, "applyRect remove: strips HAZARD")

    # out-of-bounds clipping
    g.applyRect(30, 30, 10, 10, Cell.GOAL)   # extends past edge — should not raise
    _assert(g.get(31, 31) == Cell.GOAL, "applyRect clips to boundary: corner cell set")


def test_bounds_error() -> None:
    print("\n[test_bounds_error]")
    g = SemanticGrid32()
    try:
        g.get(32, 0)
        _assert(False, "get(32,0) should raise IndexError")
    except IndexError:
        _assert(True, "get(32,0) raises IndexError as expected")

    try:
        g.set(-1, 0, Cell.SOLID)
        _assert(False, "set(-1,0) should raise IndexError")
    except IndexError:
        _assert(True, "set(-1,0) raises IndexError as expected")


def test_serialization_roundtrip() -> None:
    print("\n[test_serialization_roundtrip]")
    g = SemanticGrid32()

    # Build a representative level layout
    g.applyRect(0, 31, 32, 1, Cell.SOLID)          # solid floor
    g.set(1, 30, Cell.START)                        # player spawn
    g.set(30, 30, Cell.GOAL)                        # level exit
    g.applyRect(10, 25, 5, 1, Cell.ONEWAY)         # one-way platform
    g.set(15, 20, Cell.LADDER)                      # climbable tile
    g.set(20, 29, Cell.HAZARD)                      # spike

    data = g.toJSON()
    _assert("width" in data and data["width"] == 32,  "toJSON has width=32")
    _assert("height" in data and data["height"] == 32, "toJSON has height=32")
    _assert("cells" in data, "toJSON has cells key")

    json_str = json.dumps(data)
    loaded = SemanticGrid32.fromJSON(json.loads(json_str))

    _assert(g == loaded,                                    "roundtrip: grid equality")
    _assert(loaded.get(0, 31) == Cell.SOLID,               "roundtrip: floor solid")
    _assert(loaded.get(1, 30) == Cell.START,               "roundtrip: START preserved")
    _assert(loaded.get(30, 30) == Cell.GOAL,               "roundtrip: GOAL preserved")
    _assert(loaded.get(10, 25) == Cell.ONEWAY,             "roundtrip: ONEWAY platform")
    _assert(loaded.get(15, 20) == Cell.LADDER,             "roundtrip: LADDER")
    _assert(loaded.get(20, 29) == Cell.HAZARD,             "roundtrip: HAZARD")
    _assert(loaded.get(15, 15) == Cell.EMPTY,              "roundtrip: empty interior cell")

    print(f"  JSON payload size: {len(json_str)} bytes")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_all() -> None:
    print("=== SemanticGrid32 Demo ===")
    try:
        test_basic_set_get()
        test_add_remove_flags()
        test_fill_and_clear()
        test_copy()
        test_apply_rect_modes()
        test_bounds_error()
        test_serialization_roundtrip()
    except Exception:
        traceback.print_exc()
        sys.exit(1)

    print(f"\nResults: {_passed} passed, {_failed} failed")
    if _failed:
        sys.exit(1)
    else:
        print("All tests passed.")


if __name__ == "__main__":
    run_all()
