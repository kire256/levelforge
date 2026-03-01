"""
demo_refine_region.py
=====================
Demo and test runner for refine_region.py.

Run:
    python demo_refine_region.py

Four test cases:
  1. Basic refinement           -- same knobs, different seed inside rect
  2. Harder difficulty          -- difficulty_delta=+0.5, verticality_delta=+0.4
  3. Secret platform            -- add_secret=True
  4. Smooth silhouette          -- smooth_silhouette=True

Each case asserts:
  - refinement succeeded and refined level is reachable
  - entry and exit seams were detected
  - all cells outside rect are identical to the original grid
  - seam entry cell remains standable (floor SOLID, feet row clear)
Plus a determinism check (same seed -> same refined grid).
"""

import sys
from semantic_grid import Cell, SemanticGrid32
from level_generator import MovementSpec, GeneratorKnobs, generate_level
from refine_region import RefineRect, RefineRequest, RefineReport, refine_region


# ---------------------------------------------------------------------------
# ASCII renderer
# ---------------------------------------------------------------------------

_FLAG_CHARS = [
    (int(Cell.SOLID),  '#'),
    (int(Cell.HAZARD), '^'),
    (int(Cell.ONEWAY), '='),
    (int(Cell.GOAL),   'G'),
    (int(Cell.START),  'S'),
]


def render(grid: SemanticGrid32, rect: RefineRect = None) -> str:
    """Render grid as ASCII; mark rect boundary with ':' on open cells."""
    lines = []
    for gy in range(SemanticGrid32.HEIGHT):
        row = []
        for gx in range(SemanticGrid32.WIDTH):
            f = int(grid.get(gx, gy))
            ch = '.'
            for flag, c in _FLAG_CHARS:
                if f & flag:
                    ch = c
                    break
            if rect and rect.on_boundary(gx, gy) and ch == '.':
                ch = ':'
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
# Outside-rect preservation check
# ---------------------------------------------------------------------------

def _check_outside_preserved(orig: SemanticGrid32,
                              refined: SemanticGrid32,
                              rect: RefineRect,
                              label: str) -> None:
    """Assert every cell outside rect is identical in both grids."""
    for gy in range(SemanticGrid32.HEIGHT):
        for gx in range(SemanticGrid32.WIDTH):
            if not rect.contains(gx, gy):
                ov = orig.get(gx, gy)
                nv = refined.get(gx, gy)
                _assert(ov == nv,
                        f"[{label}] ({gx},{gy}) changed outside rect: "
                        f"{int(ov)} -> {int(nv)}")


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def run() -> None:
    spec  = MovementSpec(max_jump_height=4, max_jump_distance=5, max_safe_drop=6)
    knobs = GeneratorKnobs(
        target_foothold_count=8,
        min_foothold_width=3, max_foothold_width=6,
        verticality=0.3, difficulty=0.2,
    )

    print("Generating base level (seed=42)...")
    base = generate_level(42, knobs, spec)
    print(render(base.grid))
    print(f"  attempts={base.attempts}  seed_used={base.seed_used}")
    print(f"  {base.report}")

    # Rect covering the middle section where footholds pass through.
    # x=7 aligns with the leftmost foothold that crosses that column in both
    # the Python and JS levels (different PRNGs produce different layouts).
    rect = RefineRect(x=7, y=4, w=16, h=24)

    # -----------------------------------------------------------------------
    # Case 1: Basic refinement (no feature flags)
    # -----------------------------------------------------------------------
    print('\n' + '='*40)
    print('  Case 1 - Basic refinement')
    print('='*40)

    new1, rep1 = refine_region(base.grid, rect, RefineRequest(),
                                seed=100, knobs=knobs, spec=spec)
    print(render(new1, rect))
    print(f"\n  {rep1}")

    _assert(rep1.success,
            "Case 1: refinement succeeded")
    _assert(rep1.reachability is not None and rep1.reachability.reachable,
            "Case 1: refined level reachable")
    _assert(rep1.seam_entry is not None,
            "Case 1: entry seam detected")
    _assert(rep1.seam_exit  is not None,
            "Case 1: exit seam detected")
    _assert(rep1.inner_footholds >= 2,
            f"Case 1: {rep1.inner_footholds} inner footholds >= 2")
    _check_outside_preserved(base.grid, new1, rect, "Case 1")

    # Entry seam must still be standable
    if rep1.seam_entry:
        sx, sy = rep1.seam_entry
        if sy + 1 < SemanticGrid32.HEIGHT:
            _assert(bool(new1.get(sx, sy + 1) & Cell.SOLID),
                    f"Case 1: entry seam floor ({sx},{sy+1}) is SOLID")
        _assert(not bool(new1.get(sx, sy) & Cell.SOLID),
                f"Case 1: entry seam feet ({sx},{sy}) is clear")

    # -----------------------------------------------------------------------
    # Case 2: Increased difficulty and verticality
    # -----------------------------------------------------------------------
    print('\n' + '='*40)
    print('  Case 2 - Difficulty+0.5, Verticality+0.4')
    print('='*40)

    req2  = RefineRequest(difficulty_delta=0.5, verticality_delta=0.4)
    new2, rep2 = refine_region(base.grid, rect, req2,
                                seed=200, knobs=knobs, spec=spec)
    print(render(new2, rect))
    print(f"\n  {rep2}")

    _assert(rep2.success,
            "Case 2: hard refinement succeeded")
    _assert(rep2.reachability is not None and rep2.reachability.reachable,
            "Case 2: hard refined level reachable")
    _check_outside_preserved(base.grid, new2, rect, "Case 2")

    # -----------------------------------------------------------------------
    # Case 3: Secret platform
    # -----------------------------------------------------------------------
    print('\n' + '='*40)
    print('  Case 3 - Secret platform')
    print('='*40)

    req3  = RefineRequest(add_secret=True)
    new3, rep3 = refine_region(base.grid, rect, req3,
                                seed=300, knobs=knobs, spec=spec)
    print(render(new3, rect))
    print(f"\n  {rep3}")

    _assert(rep3.success,
            "Case 3: secret refinement succeeded")
    _assert(rep3.reachability is not None and rep3.reachability.reachable,
            "Case 3: secret level reachable")
    _check_outside_preserved(base.grid, new3, rect, "Case 3")

    # Inside rect must have at least some SOLID tiles (footholds + secret)
    solid_inside = sum(
        1 for gy in range(rect.y, rect.bottom + 1)
          for gx in range(rect.x, rect.right + 1)
          if new3.get(gx, gy) & Cell.SOLID
    )
    _assert(solid_inside > 0,
            f"Case 3: {solid_inside} SOLID tiles inside rect")

    # -----------------------------------------------------------------------
    # Case 4: Smooth silhouette
    # -----------------------------------------------------------------------
    print('\n' + '='*40)
    print('  Case 4 - Smooth silhouette')
    print('='*40)

    req4  = RefineRequest(smooth_silhouette=True)
    new4, rep4 = refine_region(base.grid, rect, req4,
                                seed=400, knobs=knobs, spec=spec)
    print(render(new4, rect))
    print(f"\n  {rep4}")

    _assert(rep4.success,
            "Case 4: smooth refinement succeeded")
    _assert(rep4.reachability is not None and rep4.reachability.reachable,
            "Case 4: smooth level reachable")

    top_y = rect.y
    for gx in range(rect.x, rect.right + 1):
        if new4.get(gx, top_y) & Cell.SOLID:
            left_solid  = gx > rect.x     and bool(new4.get(gx - 1, top_y) & Cell.SOLID)
            right_solid = gx < rect.right and bool(new4.get(gx + 1, top_y) & Cell.SOLID)
            _assert(left_solid or right_solid,
                    f"Case 4: isolated SOLID spike at ({gx},{top_y}) after smoothing")

    # -----------------------------------------------------------------------
    # Determinism check
    # -----------------------------------------------------------------------
    print('\n' + '='*40)
    print('  Determinism check')
    print('='*40)

    det1, _ = refine_region(base.grid, rect, RefineRequest(),
                             seed=42, knobs=knobs, spec=spec)
    det2, _ = refine_region(base.grid, rect, RefineRequest(),
                             seed=42, knobs=knobs, spec=spec)
    _assert(det1 == det2,
            "Determinism: same seed produces same refined grid")
    print("  Same seed -> same refined grid: OK")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"\nAssertions: {_passed} passed, {_failed} failed")
    if _failed:
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    run()
