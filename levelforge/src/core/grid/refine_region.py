"""
refine_region.py
================
Region-limited level refinement for SemanticGrid32.

API
---
    refine_region(grid, rect, request, seed,
                  knobs=None, spec=None)
    -> (new_grid: SemanticGrid32, report: RefineReport)

Algorithm
---------
1.  Validate the original grid; abort if unreachable.
2.  Detect entry seam (left rect boundary) and exit seam (right rect
    boundary) via BFS from START on the full, unmodified grid.
    Falls back to any reachable boundary cell when a preferred edge
    yields no candidates.
3.  Apply difficulty_delta / verticality_delta to a copy of knobs.
4.  Clear the rect interior, generate inner footholds entry->exit
    constrained to rect, then optionally add a secret platform or
    smooth the top-edge silhouette.
5.  Validate full-grid reachability.  Retry up to MAX_INNER_RETRIES.

Seam locking
------------
The entry seam (rect.x, ey) and exit seam (rect.right, ex_y) must
remain standable after refinement:
  - entry floor (rect.x, ey+1) stays SOLID -- painted by entry foothold
  - exit  floor (rect.right, ex_y+1) stays SOLID -- painted by exit foothold
  - both feet cells remain non-SOLID (cleared from rect, not repainted)
Cells outside rect are copied verbatim from the original grid.
"""

from __future__ import annotations

import random
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from semantic_grid import Cell, SemanticGrid32
from reachability import PlayerConfig, ReachabilityReport, ReachabilityValidator
from level_generator import (
    Foothold, MovementSpec, GeneratorKnobs,
    PLAYER_HEIGHT, MAX_STEP_TRIES,
    _clearance_ok, _min_dx_for_progress,
)

W = SemanticGrid32.WIDTH    # 32
H = SemanticGrid32.HEIGHT   # 32
MAX_INNER_RETRIES = 30


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class RefineRect:
    x: int   # left  column, inclusive
    y: int   # top   row,    inclusive
    w: int   # width  in columns
    h: int   # height in rows

    @property
    def right(self) -> int:  return self.x + self.w - 1
    @property
    def bottom(self) -> int: return self.y + self.h - 1

    def contains(self, cx: int, cy: int) -> bool:
        return self.x <= cx <= self.right and self.y <= cy <= self.bottom

    def on_boundary(self, cx: int, cy: int) -> bool:
        if not self.contains(cx, cy): return False
        return (cx == self.x or cx == self.right or
                cy == self.y or cy == self.bottom)


@dataclass
class RefineRequest:
    difficulty_delta:  float = 0.0   # added to knobs.difficulty  (result clamped 0..1)
    verticality_delta: float = 0.0   # added to knobs.verticality (result clamped 0..1)
    add_secret:        bool  = False  # plant one extra hidden bonus platform
    smooth_silhouette: bool  = False  # remove isolated SOLID spikes at top row of rect


@dataclass
class RefineReport:
    success:         bool
    seam_entry:      Optional[tuple[int, int]] = None  # (x, y) absolute
    seam_exit:       Optional[tuple[int, int]] = None  # (x, y) absolute
    inner_footholds: int                        = 0
    reachability:    Optional[ReachabilityReport] = None
    reasons:         list[str] = field(default_factory=list)

    def __repr__(self) -> str:
        ok    = "OK" if self.success else "FAIL"
        reach = self.reachability.reachable if self.reachability else '?'
        return (f"RefineReport({ok} entry={self.seam_entry} "
                f"exit={self.seam_exit} inner={self.inner_footholds} "
                f"reachable={reach})")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _find_flag_pos(grid: SemanticGrid32,
                   flag: Cell) -> Optional[tuple[int, int]]:
    """Return (x, y) of the first cell carrying the given flag, or None."""
    for gy in range(H):
        for gx in range(W):
            if grid.get(gx, gy) & flag:
                return (gx, gy)
    return None


def _linear_corridor_ok(grid: SemanticGrid32,
                         x1: int, y1: int, x2: int, y2: int,
                         player_height: int) -> bool:
    """
    Simplified corridor check: linearly interpolate the player's feet
    position from (x1,y1) to (x2,y2) and return False if any body tile
    (feet row down to feet-height+1) crosses a SOLID cell.
    Out-of-bounds columns are treated as open (walls are encoded in grid).
    """
    dx    = x2 - x1
    dy    = y2 - y1
    steps = max(abs(dx), 1)
    for step in range(1, steps + 1):
        cx = x1 + round(dx * step / steps)
        cy = y1 + round(dy * step / steps)
        for body_row in range(cy - player_height + 1, cy + 1):
            if not (0 <= cx < W and 0 <= body_row < H):
                continue   # out-of-bounds = open
            if grid.get(cx, body_row) & Cell.SOLID:
                return False
    return True


def _bfs_reachable(grid: SemanticGrid32,
                   valid: set[tuple[int, int]],
                   start: tuple[int, int],
                   spec: MovementSpec) -> frozenset[tuple[int, int]]:
    """BFS from start over valid positions; return every reachable position."""
    visited: set[tuple[int, int]] = {start}
    queue: deque[tuple[int, int]] = deque([start])
    while queue:
        cx, cy = queue.popleft()
        for dx in range(-spec.max_jump_distance, spec.max_jump_distance + 1):
            for dy in range(-spec.max_jump_height, spec.max_safe_drop + 1):
                if dx == 0 and dy == 0:
                    continue
                pos = (cx + dx, cy + dy)
                if pos in visited or pos not in valid:
                    continue
                if _linear_corridor_ok(grid, cx, cy, *pos, PLAYER_HEIGHT):
                    visited.add(pos)
                    queue.append(pos)
    return frozenset(visited)


def _find_seams(
    grid:      SemanticGrid32,
    rect:      RefineRect,
    validator: ReachabilityValidator,
    spec:      MovementSpec,
) -> tuple[Optional[tuple[int, int]], Optional[tuple[int, int]]]:
    """
    Return (seam_entry, seam_exit): standable rect-boundary cells on the
    player's reachable set from START.

    Preferred: left-boundary entry, right-boundary exit.
    Fallback: any reachable boundary cell (sorted by x).
    """
    standable = validator.compute_standable_mask(grid)
    clearance  = validator.compute_clearance_mask(grid)
    valid: set[tuple[int, int]] = {
        (gx, gy)
        for gy in range(H) for gx in range(W)
        if standable[gy][gx] and clearance[gy][gx]
    }
    start = _find_flag_pos(grid, Cell.START)
    if start is None or start not in valid:
        return None, None

    reachable = _bfs_reachable(grid, valid, start, spec)
    mid_y = (rect.y + rect.bottom) // 2

    left_cands  = [(rect.x,     gy) for gy in range(rect.y, rect.bottom + 1)
                   if (rect.x,     gy) in reachable]
    right_cands = [(rect.right,  gy) for gy in range(rect.y, rect.bottom + 1)
                   if (rect.right, gy) in reachable]

    seam_entry = (min(left_cands,  key=lambda p: abs(p[1] - mid_y))
                  if left_cands  else None)
    seam_exit  = (min(right_cands, key=lambda p: abs(p[1] - mid_y))
                  if right_cands else None)

    # Fallback: any reachable boundary cell, sorted by x
    if seam_entry is None or seam_exit is None:
        top_bot = [(gx, gy)
                   for gy in [rect.y, rect.bottom]
                   for gx in range(rect.x, rect.right + 1)
                   if (gx, gy) in reachable]
        all_cands = sorted(set(left_cands + right_cands + top_bot),
                           key=lambda p: p[0])
        if all_cands:
            if seam_entry is None: seam_entry = all_cands[0]
            if seam_exit  is None: seam_exit  = all_cands[-1]

    return seam_entry, seam_exit


def _apply_deltas(base: GeneratorKnobs,
                  req:  RefineRequest) -> GeneratorKnobs:
    """Return a new GeneratorKnobs with deltas applied, clamped to [0, 1]."""
    return GeneratorKnobs(
        target_foothold_count = base.target_foothold_count,
        min_foothold_width    = base.min_foothold_width,
        max_foothold_width    = base.max_foothold_width,
        verticality = max(0.0, min(1.0, base.verticality + req.verticality_delta)),
        difficulty  = max(0.0, min(1.0, base.difficulty  + req.difficulty_delta)),
    )


def _generate_inner_footholds(
    rng:        random.Random,
    knobs:      GeneratorKnobs,
    spec:       MovementSpec,
    rect:       RefineRect,
    entry:      tuple[int, int],   # absolute (x, y) -- on rect left boundary
    exit_point: tuple[int, int],   # absolute (x, y) -- on rect right boundary
) -> Optional[list[Foothold]]:
    """
    Generate a foothold chain from entry to exit_point, all within rect.

    Entry foothold: left-aligned at entry[0], extends rightward.
    Exit  foothold: right-aligned at exit_point[0], extends leftward so
                    the seam column is always covered with valid width.
    Returns None if any step fails within MAX_STEP_TRIES.
    """
    dx_total = exit_point[0] - entry[0]
    if dx_total <= 0:
        return None

    avg_hop = max(1, (spec.max_jump_distance + 1) // 2)
    n_inter = max(0, min(6, dx_total // avg_hop - 1))

    # -- Entry foothold (left-aligned to seam) --------------------------------
    e_w = min(
        max(knobs.min_foothold_width,
            rng.randint(knobs.min_foothold_width, knobs.max_foothold_width)),
        rect.right - entry[0] + 1,
    )
    footholds: list[Foothold] = [Foothold(entry[0], entry[1], e_w)]

    # -- Intermediate footholds -----------------------------------------------
    max_up   = max(0, round(spec.max_jump_height * knobs.verticality))
    max_down = max(0, round(spec.max_safe_drop   * knobs.verticality))
    eff_max_w = max(
        knobs.min_foothold_width,
        knobs.max_foothold_width - round(
            knobs.difficulty * (knobs.max_foothold_width - knobs.min_foothold_width)
        ),
    )

    for step in range(n_inter):
        prev       = footholds[-1]
        steps_left = n_inter - step + 1   # hops until exit (inclusive)
        target_x   = exit_point[0]

        prog_min = _min_dx_for_progress(prev.x, steps_left, target_x,
                                        spec.max_jump_distance)
        diff_min = round(spec.max_jump_distance * 0.25 * knobs.difficulty)
        min_dx   = min(max(prog_min, diff_min, 1), spec.max_jump_distance)

        placed = False
        for _ in range(MAX_STEP_TRIES):
            max_dx = min(spec.max_jump_distance, target_x - prev.x - 1)
            if max_dx < min_dx:
                break  # can't progress without overshooting exit

            dx = rng.randint(min_dx, max_dx)
            dy = rng.randint(-max_up, max_down) if (max_up + max_down) > 0 else 0
            w  = rng.randint(knobs.min_foothold_width, eff_max_w)
            nx = prev.x + dx
            ny = prev.y + dy

            if nx < rect.x or nx + w - 1 > rect.right: continue
            if ny < rect.y + PLAYER_HEIGHT:             continue
            if ny + 1 > rect.bottom:                    continue

            cand = Foothold(nx, ny, w)
            if not _clearance_ok(footholds, cand): continue

            footholds.append(cand)
            placed = True
            break

        if not placed:
            return None

    # -- Exit foothold (right-aligned to seam) --------------------------------
    last = footholds[-1]
    x_w  = min(
        max(knobs.min_foothold_width,
            rng.randint(knobs.min_foothold_width, knobs.max_foothold_width)),
        exit_point[0] - rect.x + 1,   # can extend left as far as rect allows
    )
    x_w = max(1, x_w)                 # at least 1 column at the seam
    exit_x = exit_point[0] - x_w + 1  # left edge of exit foothold

    dy_to_exit   = exit_point[1] - last.y
    min_jump_dx  = max(0, exit_x - (last.x + last.width - 1))  # 0 if overlap

    if min_jump_dx > spec.max_jump_distance:              return None
    if dy_to_exit  > spec.max_safe_drop:                  return None
    if dy_to_exit  < -spec.max_jump_height:               return None

    exit_fh = Foothold(exit_x, exit_point[1], x_w)
    if not _clearance_ok(footholds, exit_fh):             return None

    footholds.append(exit_fh)
    return footholds


def _clear_rect(grid: SemanticGrid32, rect: RefineRect) -> None:
    """Zero every cell inside rect (all four sides inclusive)."""
    for ry in range(rect.y, rect.bottom + 1):
        for rx in range(rect.x, rect.right + 1):
            grid.set(rx, ry, Cell.EMPTY)


def _paint_inner_footholds(
    grid:      SemanticGrid32,
    footholds: list[Foothold],
    rect:      RefineRect,
) -> None:
    """
    Paint foothold surfaces (SOLID) and clear headspace, clipped to rect.

    Phase 1 — add SOLID at each foothold's surface_y row.
    Phase 2 — remove SOLID from each foothold's clearance rows, skipping
              cells that are another foothold's surface (no conflict by
              construction, but tracked for safety).
    """
    surface_cells: set[tuple[int, int]] = set()
    for fh in footholds:
        sy = fh.surface_y
        for fx in fh.x_cols():
            if rect.x <= fx <= rect.right and rect.y <= sy <= rect.bottom:
                grid.addFlags(fx, sy, Cell.SOLID)
                surface_cells.add((fx, sy))

    for fh in footholds:
        for fx in fh.x_cols():
            for row in fh.clearance_rows():
                if (rect.x <= fx <= rect.right and
                        rect.y <= row <= rect.bottom and
                        (fx, row) not in surface_cells):
                    grid.removeFlags(fx, row, Cell.SOLID)


def _smooth_silhouette(grid: SemanticGrid32, rect: RefineRect) -> None:
    """Remove isolated SOLID tiles at the very top row of the rect."""
    top_y = rect.y
    for fx in range(rect.x, rect.right + 1):
        if not (grid.get(fx, top_y) & Cell.SOLID):
            continue
        left_solid  = fx > rect.x     and bool(grid.get(fx - 1, top_y) & Cell.SOLID)
        right_solid = fx < rect.right and bool(grid.get(fx + 1, top_y) & Cell.SOLID)
        if not left_solid and not right_solid:
            grid.removeFlags(fx, top_y, Cell.SOLID)


def _add_secret(
    grid:      SemanticGrid32,
    footholds: list[Foothold],
    rect:      RefineRect,
    rng:       random.Random,
) -> None:
    """Attempt to place one hidden bonus platform above the main-path footholds."""
    if not footholds:
        return
    base_fh = footholds[rng.randint(0, len(footholds) - 1)]
    for _ in range(20):
        sx = base_fh.x + rng.randint(-1, 1)
        sy = base_fh.y - rng.randint(3, 5)   # well above base foothold
        sw = rng.randint(2, 3)
        if sx < rect.x or sx + sw - 1 > rect.right:             continue
        if sy < rect.y + PLAYER_HEIGHT or sy + 1 > rect.bottom: continue

        secret = Foothold(sx, sy, sw)
        if not _clearance_ok(footholds, secret):                 continue

        # Paint surface
        for fx in secret.x_cols():
            if rect.x <= fx <= rect.right and rect.y <= secret.surface_y <= rect.bottom:
                grid.addFlags(fx, secret.surface_y, Cell.SOLID)
        # Clear headspace (safe: _clearance_ok guarantees no conflict)
        for fx in secret.x_cols():
            for row in secret.clearance_rows():
                if rect.x <= fx <= rect.right and rect.y <= row <= rect.bottom:
                    grid.removeFlags(fx, row, Cell.SOLID)
        break   # one secret platform is enough


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def refine_region(
    grid:    SemanticGrid32,
    rect:    RefineRect,
    request: RefineRequest,
    seed:    int,
    knobs:   Optional[GeneratorKnobs] = None,
    spec:    Optional[MovementSpec]   = None,
) -> tuple[SemanticGrid32, RefineReport]:
    """
    Regenerate the interior of rect while preserving everything outside.

    Parameters
    ----------
    grid     : original SemanticGrid32 (never modified)
    rect     : the rectangular region to replace
    request  : refinement parameters (deltas, optional features)
    seed     : base RNG seed; retries use seed + attempt index
    knobs    : base generator knobs (default: GeneratorKnobs())
    spec     : player movement spec   (default: MovementSpec())

    Returns
    -------
    (new_grid, report)
    On failure, new_grid == grid.copy() so the caller always has a valid grid.
    """
    knobs = knobs or GeneratorKnobs()
    spec  = spec  or MovementSpec()

    cfg = PlayerConfig(
        height            = PLAYER_HEIGHT,
        max_jump_height   = spec.max_jump_height,
        max_jump_distance = spec.max_jump_distance,
        max_safe_drop     = spec.max_safe_drop,
    )
    validator = ReachabilityValidator(cfg)

    # 1. Validate original
    orig_report = validator.validate(grid)
    if not orig_report.reachable:
        return grid.copy(), RefineReport(
            success      = False,
            reasons      = ["Original grid is not reachable"],
            reachability = orig_report,
        )

    # 2. Detect seams
    seam_entry, seam_exit = _find_seams(grid, rect, validator, spec)
    if seam_entry is None or seam_exit is None:
        return grid.copy(), RefineReport(
            success      = False,
            seam_entry   = seam_entry,
            seam_exit    = seam_exit,
            reasons      = ["Could not detect seam points on rect boundary"],
            reachability = orig_report,
        )

    # 3. Adjusted knobs
    inner_knobs = _apply_deltas(knobs, request)

    # 4. Remember whether START / GOAL are inside rect (must be re-placed)
    orig_start   = _find_flag_pos(grid, Cell.START)
    orig_goal    = _find_flag_pos(grid, Cell.GOAL)
    start_inside = orig_start is not None and rect.contains(*orig_start)
    goal_inside  = orig_goal  is not None and rect.contains(*orig_goal)

    # 5. Retry loop
    for attempt in range(MAX_INNER_RETRIES):
        rng = random.Random(seed + attempt)

        inner_fhs = _generate_inner_footholds(
            rng, inner_knobs, spec, rect, seam_entry, seam_exit,
        )
        if inner_fhs is None:
            continue

        new_grid = grid.copy()
        _clear_rect(new_grid, rect)
        _paint_inner_footholds(new_grid, inner_fhs, rect)

        if start_inside:
            fh = inner_fhs[0]
            new_grid.set(fh.x + fh.width // 2, fh.y, Cell.START)
        if goal_inside:
            fh = inner_fhs[-1]
            new_grid.set(fh.x + fh.width // 2, fh.y, Cell.GOAL)

        if request.add_secret:
            _add_secret(new_grid, inner_fhs, rect, rng)
        if request.smooth_silhouette:
            _smooth_silhouette(new_grid, rect)

        report = validator.validate(new_grid)
        if report.reachable:
            return new_grid, RefineReport(
                success         = True,
                seam_entry      = seam_entry,
                seam_exit       = seam_exit,
                inner_footholds = len(inner_fhs),
                reachability    = report,
            )

    # All attempts exhausted
    return grid.copy(), RefineReport(
        success      = False,
        seam_entry   = seam_entry,
        seam_exit    = seam_exit,
        reasons      = [f"All {MAX_INNER_RETRIES} refinement attempts failed"],
        reachability = orig_report,
    )
