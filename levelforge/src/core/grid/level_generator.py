"""
Main-path level generator using footholds.

A Foothold (x, y, width) is a standable platform segment:
  - x          : left edge column
  - y          : player's feet row (player stands here)
  - surface_y  : y + 1 (the SOLID tile the player stands on)
  - clearance  : rows y and y-1 must not be SOLID (for player_height=2)

Generation algorithm
────────────────────
1. Place first foothold near left edge (x=2..5, y≈grid-centre ± spread).
2. Iteratively pick next foothold guaranteeing forward x-progress toward
   GOAL_X_MIN=26.  dx and dy are constrained by MovementSpec.
3. Reject a candidate if its solid surface would occupy the clearance zone
   of an already-placed foothold, or vice-versa.
4. After all footholds are placed, convert to SemanticGrid32 and run the
   ReachabilityValidator.
5. Retry up to MAX_RETRIES times (seed+attempt), raising RuntimeError on
   total failure.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional

from semantic_grid import Cell, SemanticGrid32
from reachability import PlayerConfig, ReachabilityReport, ReachabilityValidator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

W              = SemanticGrid32.WIDTH    # 32
H              = SemanticGrid32.HEIGHT   # 32
PLAYER_HEIGHT  = 2
MAX_RETRIES    = 40          # outer: whole-level retries
MAX_STEP_TRIES = 50          # inner: attempts per individual foothold
GOAL_X_MIN     = 26          # last foothold's left edge must reach this


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Foothold:
    x:     int   # left edge column
    y:     int   # player feet row
    width: int   # number of tile columns wide

    @property
    def surface_y(self) -> int:
        """Row of the SOLID surface tile."""
        return self.y + 1

    @property
    def right(self) -> int:
        """Rightmost column (inclusive)."""
        return self.x + self.width - 1

    def x_cols(self) -> range:
        return range(self.x, self.x + self.width)

    def clearance_rows(self) -> range:
        """Rows that must stay SOLID-free for a player standing here."""
        return range(self.y - PLAYER_HEIGHT + 1, self.y + 1)


@dataclass
class MovementSpec:
    max_jump_height:   int = 4
    max_jump_distance: int = 5
    max_safe_drop:     int = 6


@dataclass
class GeneratorKnobs:
    target_foothold_count: int   = 8
    min_foothold_width:    int   = 2
    max_foothold_width:    int   = 6
    verticality:           float = 0.5   # 0 = flat,  1 = highly vertical
    difficulty:            float = 0.3   # 0 = easy (wide/close), 1 = hard


@dataclass
class GenerationResult:
    grid:      SemanticGrid32
    footholds: list[Foothold]
    report:    ReachabilityReport
    seed_used: int
    attempts:  int


# ---------------------------------------------------------------------------
# Helper: minimum dx needed to still have a chance of reaching target_x
# ---------------------------------------------------------------------------

def _min_dx_for_progress(current_x: int, steps_remaining: int,
                          target_x: int, max_dx: int) -> int:
    needed = target_x - current_x
    if needed <= 0 or steps_remaining <= 0:
        return 1
    return max(1, min(max_dx, -(-needed // steps_remaining)))  # ceiling div


# ---------------------------------------------------------------------------
# Helper: clearance-conflict detection
# ---------------------------------------------------------------------------

def _clearance_ok(existing: list[Foothold], new_fh: Foothold) -> bool:
    """
    Return False if new_fh's solid surface falls inside any existing
    foothold's clearance zone, or if any existing surface falls inside
    new_fh's clearance zone.
    """
    new_xs   = set(new_fh.x_cols())
    new_clr  = new_fh.clearance_rows()

    for fh in existing:
        if not (new_xs & set(fh.x_cols())):
            continue  # no column overlap → no conflict

        # New surface row vs existing clearance
        if fh.clearance_rows().start <= new_fh.surface_y <= fh.clearance_rows().stop - 1:
            return False

        # Existing surface row vs new clearance
        if new_clr.start <= fh.surface_y <= new_clr.stop - 1:
            return False

    return True


# ---------------------------------------------------------------------------
# Foothold sequence generator
# ---------------------------------------------------------------------------

def _generate_footholds(
    rng:   random.Random,
    knobs: GeneratorKnobs,
    spec:  MovementSpec,
) -> Optional[list[Foothold]]:
    """Try once to produce a valid foothold list; return None on failure."""

    N = knobs.target_foothold_count

    # ── First foothold ──────────────────────────────────────────────────────
    mid_y   = H // 2
    y_lo    = max(PLAYER_HEIGHT, mid_y - 5)
    y_hi    = min(H - 3,          mid_y + 5)
    first_y = rng.randint(y_lo, y_hi)
    first_x = rng.randint(2, 5)
    first_w = min(
        rng.randint(knobs.min_foothold_width, knobs.max_foothold_width),
        W - 2 - first_x,
    )
    first_w = max(knobs.min_foothold_width, first_w)
    footholds: list[Foothold] = [Foothold(first_x, first_y, first_w)]

    # ── Subsequent footholds ─────────────────────────────────────────────────
    for i in range(1, N):
        prev       = footholds[-1]
        is_last    = (i == N - 1)

        # dx: must make enough progress to reach GOAL_X_MIN by the last step
        prog_min   = _min_dx_for_progress(prev.x, N - i, GOAL_X_MIN, spec.max_jump_distance)
        # difficulty adds a small extra minimum gap
        diff_min   = round(spec.max_jump_distance * 0.25 * knobs.difficulty)
        min_dx     = min(max(prog_min, diff_min, 1), spec.max_jump_distance)

        # dy: scaled by verticality (0 = flat, 1 = full range)
        max_up   = max(0, round(spec.max_jump_height * knobs.verticality))
        max_down = max(0, round(spec.max_safe_drop   * knobs.verticality))

        # platform width: difficulty narrows the upper bound
        eff_max_w = max(
            knobs.min_foothold_width,
            knobs.max_foothold_width - round(
                knobs.difficulty * (knobs.max_foothold_width - knobs.min_foothold_width)
            ),
        )

        placed = False
        for _ in range(MAX_STEP_TRIES):
            dx    = rng.randint(min_dx, spec.max_jump_distance)
            dy    = rng.randint(-max_up, max_down) if (max_up + max_down) > 0 else 0
            w     = rng.randint(knobs.min_foothold_width, eff_max_w)
            new_x = prev.x + dx
            new_y = prev.y + dy

            # Grid bounds
            if new_x < 1 or new_x + w - 1 > W - 2:
                continue
            if new_y < PLAYER_HEIGHT:          # head (y-1) would leave grid
                continue
            if new_y + 1 > H - 2:             # surface must sit above floor row
                continue

            # Last foothold must reach the right side
            if is_last and new_x < GOAL_X_MIN:
                continue

            # Clearance conflict
            if not _clearance_ok(footholds, Foothold(new_x, new_y, w)):
                continue

            footholds.append(Foothold(new_x, new_y, w))
            placed = True
            break

        if not placed:
            return None

    return footholds


# ---------------------------------------------------------------------------
# Grid builder
# ---------------------------------------------------------------------------

def footholds_to_grid(
    footholds:     list[Foothold],
    player_height: int = PLAYER_HEIGHT,
) -> SemanticGrid32:
    """
    Convert a foothold list into a SemanticGrid32.

    Phases:
      1. Safety floor at y=31.
      2. Place SOLID at each foothold's surface_y row.
      3. Clear SOLID in each foothold's clearance zone (preserving surfaces
         from other footholds that the generator has already validated as
         non-conflicting).
      4. Mark START (center of first foothold) and GOAL (center of last).
    """
    grid = SemanticGrid32()

    # Phase 1 — safety floor
    grid.applyRect(0, H - 1, W, 1, Cell.SOLID)

    # Phase 2 — surfaces
    surface_cells: set[tuple[int, int]] = set()
    for fh in footholds:
        for x in fh.x_cols():
            if 0 <= x < W and 0 <= fh.surface_y < H:
                grid.addFlags(x, fh.surface_y, Cell.SOLID)
                surface_cells.add((x, fh.surface_y))

    # Phase 3 — clearance (never erase another foothold's surface)
    for fh in footholds:
        for x in fh.x_cols():
            for row in fh.clearance_rows():
                if 0 <= row < H and (x, row) not in surface_cells:
                    grid.removeFlags(x, row, Cell.SOLID)

    # Phase 4 — markers
    first = footholds[0]
    last  = footholds[-1]
    grid.set(first.x + first.width // 2, first.y, Cell.START)
    grid.set(last.x  + last.width  // 2, last.y,  Cell.GOAL)

    return grid


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_level(
    seed:  int,
    knobs: Optional[GeneratorKnobs] = None,
    spec:  Optional[MovementSpec]   = None,
) -> GenerationResult:
    """
    Generate a valid, traversable level.

    Retries up to MAX_RETRIES times using seed+attempt as the sub-seed.
    Each attempt uses a fresh Random instance, so results are deterministic
    for a given (seed, knobs, spec) triple.

    Raises RuntimeError if all attempts fail.
    """
    knobs = knobs or GeneratorKnobs()
    spec  = spec  or MovementSpec()

    cfg = PlayerConfig(
        height=PLAYER_HEIGHT,
        max_jump_height=spec.max_jump_height,
        max_jump_distance=spec.max_jump_distance,
        max_safe_drop=spec.max_safe_drop,
    )
    validator = ReachabilityValidator(cfg)

    for attempt in range(MAX_RETRIES):
        rng       = random.Random(seed + attempt)
        footholds = _generate_footholds(rng, knobs, spec)
        if footholds is None:
            continue

        grid   = footholds_to_grid(footholds)
        report = validator.validate(grid)
        if report.reachable:
            return GenerationResult(
                grid=grid,
                footholds=footholds,
                report=report,
                seed_used=seed + attempt,
                attempts=attempt + 1,
            )

    raise RuntimeError(
        f"Level generation failed after {MAX_RETRIES} attempts "
        f"(seed={seed}, knobs={knobs})"
    )
