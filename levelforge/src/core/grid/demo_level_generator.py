"""
Demo for level_generator.py.

Generates three levels with different knobs and prints ASCII output,
foothold tables, and validation reports.

Run:
    python demo_level_generator.py
"""

import sys
from semantic_grid import Cell, SemanticGrid32
from level_generator import (
    MovementSpec, GeneratorKnobs, GenerationResult,
    generate_level,
)

# ---------------------------------------------------------------------------
# ASCII rendering
# ---------------------------------------------------------------------------

_FLAG_CHARS = [
    (int(Cell.SOLID),  '#'),
    (int(Cell.HAZARD), '^'),
    (int(Cell.ONEWAY), '='),
    (int(Cell.GOAL),   'G'),
    (int(Cell.START),  'S'),
]


def render(grid: SemanticGrid32) -> str:
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
# Single case runner
# ---------------------------------------------------------------------------

def run_case(label: str, seed: int, knobs: GeneratorKnobs,
             spec: MovementSpec) -> GenerationResult:
    print(f"\n{'='*40}")
    print(f"  {label}  (seed={seed})")
    print('='*40)

    result = generate_level(seed, knobs, spec)

    print(render(result.grid))

    print(f"\n  Footholds ({len(result.footholds)}):")
    for i, fh in enumerate(result.footholds):
        tag = " <-- START" if i == 0 else (" <-- GOAL" if i == len(result.footholds) - 1 else "")
        print(f"    [{i}] x={fh.x:2}..{fh.right:2}  y={fh.y:2}  w={fh.width}{tag}")

    print(f"\n  {result.report}")
    print(f"  attempts={result.attempts}  seed_used={result.seed_used}")

    # Invariant checks
    fhs = result.footholds
    _assert(result.report.reachable,
            f"[{label}] level must be reachable")
    _assert(len(fhs) == knobs.target_foothold_count,
            f"[{label}] foothold count {len(fhs)} != {knobs.target_foothold_count}")
    _assert(fhs[0].x >= 2 and fhs[0].x <= 5,
            f"[{label}] first foothold x={fhs[0].x} not in [2,5]")
    _assert(fhs[-1].x >= 26,
            f"[{label}] last foothold x={fhs[-1].x} < 26")
    _assert(result.report.path_length >= 2,
            f"[{label}] path_length {result.report.path_length} too short")

    # All footholds within grid bounds
    for i, fh in enumerate(fhs):
        _assert(0 <= fh.x and fh.right <= 30,
                f"[{label}] foothold {i} x-range {fh.x}..{fh.right} out of bounds")
        _assert(2 <= fh.y <= 29,
                f"[{label}] foothold {i} y={fh.y} out of [2,29]")

    # START and GOAL are in the grid
    from reachability import ReachabilityValidator, PlayerConfig
    v = ReachabilityValidator(PlayerConfig(
        height=2,
        max_jump_height=spec.max_jump_height,
        max_jump_distance=spec.max_jump_distance,
        max_safe_drop=spec.max_safe_drop,
    ))
    start_pos = v._find_flag(result.grid, Cell.START)
    goal_pos  = v._find_flag(result.grid, Cell.GOAL)
    _assert(start_pos is not None, f"[{label}] no START marker in grid")
    _assert(goal_pos  is not None, f"[{label}] no GOAL marker in grid")

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run() -> None:
    spec = MovementSpec(max_jump_height=4, max_jump_distance=5, max_safe_drop=6)

    run_case(
        "Easy flat",
        seed=42,
        knobs=GeneratorKnobs(
            target_foothold_count=8,
            min_foothold_width=3, max_foothold_width=6,
            verticality=0.2, difficulty=0.1,
        ),
        spec=spec,
    )

    run_case(
        "Medium",
        seed=100,
        knobs=GeneratorKnobs(
            target_foothold_count=9,
            min_foothold_width=2, max_foothold_width=5,
            verticality=0.5, difficulty=0.4,
        ),
        spec=spec,
    )

    run_case(
        "Hard vertical",
        seed=777,
        knobs=GeneratorKnobs(
            target_foothold_count=10,
            min_foothold_width=2, max_foothold_width=4,
            verticality=0.9, difficulty=0.7,
        ),
        spec=spec,
    )

    # Determinism check: same seed+knobs -> same result
    r1 = generate_level(42, GeneratorKnobs(), spec)
    r2 = generate_level(42, GeneratorKnobs(), spec)
    _assert(r1.grid == r2.grid, "determinism: same seed produces same grid")
    _assert(r1.seed_used == r2.seed_used, "determinism: same seed_used")

    print(f"\nAssertions: {_passed} passed, {_failed} failed")
    if _failed:
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    run()
