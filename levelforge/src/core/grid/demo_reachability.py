"""
Demo / test runner for ReachabilityValidator.

Three test cases:
  1. Reachable  — player walks and jumps over a hazard gap.
  2. Unreachable — solid wall bisects the level; GOAL isolated.
  3. Platform chain — player must hop up three stepped platforms.

Run directly:
    python demo_reachability.py
"""

import sys
from semantic_grid import Cell, SemanticGrid32
from reachability import PlayerConfig, ReachabilityReport, ReachabilityValidator

# ---------------------------------------------------------------------------
# Shared player config
# ---------------------------------------------------------------------------

CFG = PlayerConfig(
    height=2,
    max_jump_height=4,
    max_jump_distance=5,
    max_safe_drop=6,
)

# ---------------------------------------------------------------------------
# Level builders
# ---------------------------------------------------------------------------

def _boundary(g: SemanticGrid32) -> None:
    """Apply solid boundary (ceiling + floor + walls)."""
    g.applyRect(0,  0, 32,  1, Cell.SOLID)   # ceiling
    g.applyRect(0, 31, 32,  1, Cell.SOLID)   # floor
    g.applyRect(0,  0,  1, 32, Cell.SOLID)   # left wall
    g.applyRect(31, 0,  1, 32, Cell.SOLID)   # right wall


def build_hazard_gap() -> SemanticGrid32:
    """
    Open floor with a 4-tile hazard gap at x=14-17.
    START=(2,30), GOAL=(28,30).
    Player must jump dx=5 from (13,30) to (18,30).
    """
    g = SemanticGrid32()
    _boundary(g)
    g.applyRect(14, 30, 4, 1, Cell.HAZARD)   # spike strip
    g.set(2,  30, Cell.START)
    g.set(28, 30, Cell.GOAL)
    return g


def build_walled_off() -> SemanticGrid32:
    """
    Same as hazard_gap but a solid wall (x=15, y=1-30) completely
    separates the two halves.  GOAL is unreachable.
    """
    g = build_hazard_gap()
    g.applyRect(15, 1, 1, 30, Cell.SOLID)    # sealing wall
    return g


def build_platform_chain() -> SemanticGrid32:
    """
    Three stepped platforms — player must jump up each one.

    Platform A: y=27 solid at x=5-10  → feet at y=26  (+4 from floor y=30)
    Platform B: y=23 solid at x=13-18 → feet at y=22  (+4 from platform A y=26)
    Platform C: y=19 solid at x=21-26 → feet at y=18  (+4 from platform B y=22)
    GOAL=(25,18) atop platform C.

    Each vertical step is exactly max_jump_height=4; horizontal steps ≤5.
    """
    g = SemanticGrid32()
    _boundary(g)
    g.applyRect(5,  27, 6, 1, Cell.SOLID)    # platform A
    g.applyRect(13, 23, 6, 1, Cell.SOLID)    # platform B
    g.applyRect(21, 19, 6, 1, Cell.SOLID)    # platform C
    g.set(2,  30, Cell.START)
    g.set(25, 18, Cell.GOAL)
    return g


# ---------------------------------------------------------------------------
# ASCII rendering
# ---------------------------------------------------------------------------

_FLAG_CHARS = [
    (int(Cell.SOLID),  '#'),
    (int(Cell.HAZARD), '^'),
    (int(Cell.ONEWAY), '='),
    (int(Cell.LADDER), 'H'),
    (int(Cell.GOAL),   'G'),
    (int(Cell.START),  'S'),
]

def render_grid(grid: SemanticGrid32, valid: list[list[bool]] | None = None) -> str:
    lines = []
    for y in range(SemanticGrid32.HEIGHT):
        row = []
        for x in range(SemanticGrid32.WIDTH):
            f = int(grid.get(x, y))
            ch = '.'
            for flag, c in _FLAG_CHARS:
                if f & flag:
                    ch = c
                    break
            # Mark reachable/non-reachable empty cells differently
            if ch == '.' and valid is not None:
                ch = '+' if valid[y][x] else '.'
            row.append(ch)
        lines.append(''.join(row))
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

_passed = _failed = 0

def _assert(cond: bool, msg: str) -> None:
    global _passed, _failed
    if cond:
        _passed += 1
    else:
        _failed += 1
        print(f"  FAIL  {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

def run_case(
    name: str,
    grid: SemanticGrid32,
    expect_reachable: bool,
    **extra_asserts,
) -> ReachabilityReport:
    print(f"\n{'='*40}")
    print(f"  {name}")
    print('='*40)

    v = ReachabilityValidator(CFG)

    stand = v.compute_standable_mask(grid)
    clear = v.compute_clearance_mask(grid)
    valid = [
        [stand[y][x] and clear[y][x] for x in range(SemanticGrid32.WIDTH)]
        for y in range(SemanticGrid32.HEIGHT)
    ]

    print(render_grid(grid, valid))
    report = v.validate(grid)
    print(f"\n  {report}")

    _assert(report.reachable == expect_reachable,
            f"[{name}] expected reachable={expect_reachable}")
    if expect_reachable:
        _assert(report.path_length >= 2,
                f"[{name}] path_length {report.path_length} < 2")
        _assert(report.min_landing_width >= 1,
                f"[{name}] min_landing_width {report.min_landing_width} < 1")
    else:
        _assert(len(report.reasons) > 0,
                f"[{name}] unreachable report should contain reasons")

    for attr, (op, val) in extra_asserts.items():
        actual = getattr(report, attr)
        ok = op(actual, val)
        _assert(ok, f"[{name}] {attr}={actual} failed check against {val}")

    return report


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run() -> None:
    print("=== ReachabilityValidator Demo ===")
    print(f"PlayerConfig: height={CFG.height}, "
          f"jump_height={CFG.max_jump_height}, "
          f"jump_dist={CFG.max_jump_distance}, "
          f"drop={CFG.max_safe_drop}")
    print("\nLegend:  # solid  ^ hazard  = oneway  S start  G goal")
    print("         + valid standing position  . open air")

    import operator as op

    run_case(
        "Case 1 — Hazard gap (REACHABLE)",
        build_hazard_gap(),
        expect_reachable=True,
        jump_count=(op.ge, 1),          # must jump at least once
    )

    run_case(
        "Case 2 — Walled off (UNREACHABLE)",
        build_walled_off(),
        expect_reachable=False,
    )

    run_case(
        "Case 3 — Platform chain (REACHABLE)",
        build_platform_chain(),
        expect_reachable=True,
        jump_count=(op.ge, 3),          # at least 3 platform jumps
    )

    print(f"\nAssertions: {_passed} passed, {_failed} failed")
    if _failed:
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    run()
