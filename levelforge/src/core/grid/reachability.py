"""
Platformer reachability validator for SemanticGrid32.

Position convention
───────────────────
A player "position" (x, y) means their feet tile is at column x, row y
(y increases downward, row 0 = top).  Their body extends upward for
cfg.height tiles: feet at y, head at y - (height - 1).

Standable cell (x, y)
    The player can stand here when:
      • (x, y+1) is SOLID or ONEWAY  — surface beneath feet
      • (x, y)   is not SOLID or HAZARD — feet cell is occupiable

Clearance at (x, y)
    All body tiles (x, y) … (x, y-height+1) must not be SOLID.

Movement model (coarse/conservative)
    For every (dx, dy) pair within configured limits, the move is
    accepted if the linear-interpolated body trajectory does not
    intersect any SOLID tile.  HAZARD cells are only excluded at the
    feet/landing level; flying through hazard air is not penalised.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from semantic_grid import Cell, SemanticGrid32

Pos = tuple[int, int]   # (x=col, y=row)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class PlayerConfig:
    """Movement capabilities of the player."""
    width:             int = 1   # tile width (currently reserved; assumed 1)
    height:            int = 2   # tile height (feet + body above)
    max_jump_height:   int = 4   # max tiles upward in one jump   (dy negative)
    max_jump_distance: int = 5   # max horizontal tiles per jump/step
    max_safe_drop:     int = 6   # max tiles downward without lethal fall damage


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

@dataclass
class ReachabilityReport:
    reachable:         bool
    path_length:       int        = 0    # nodes start → goal inclusive
    jump_count:        int        = 0    # moves with dy≠0 or |dx|>1
    min_landing_width: int        = 0    # narrowest horizontal platform run along path
    reasons:           list[str]  = field(default_factory=list)

    def __str__(self) -> str:
        if self.reachable:
            return (
                f"REACHABLE  path={self.path_length} nodes | "
                f"jumps={self.jump_count} | "
                f"min_platform={self.min_landing_width} tiles"
            )
        return "UNREACHABLE: " + " | ".join(self.reasons)


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

class ReachabilityValidator:
    """
    Usage:
        v = ReachabilityValidator(cfg)
        report = v.validate(grid)         # reads START/GOAL flags
        report = v.validate(grid, start=(2,30), goal=(28,30))
    """

    def __init__(self, cfg: Optional[PlayerConfig] = None) -> None:
        self.cfg = cfg or PlayerConfig()

    # -----------------------------------------------------------------------
    # Public API — masks
    # -----------------------------------------------------------------------

    def compute_standable_mask(self, grid: SemanticGrid32) -> list[list[bool]]:
        """
        mask[y][x] = True when player feet can safely occupy (x, y):
          - (x, y+1) provides a surface (SOLID or ONEWAY)
          - (x, y)   is not SOLID or HAZARD
        """
        W, H = SemanticGrid32.WIDTH, SemanticGrid32.HEIGHT
        m = [[False] * W for _ in range(H)]
        solid_or_oneway = int(Cell.SOLID | Cell.ONEWAY)
        bad_feet        = int(Cell.SOLID | Cell.HAZARD)
        for y in range(H - 1):
            for x in range(W):
                if (int(grid.get(x, y + 1)) & solid_or_oneway) and \
                   not (int(grid.get(x, y)) & bad_feet):
                    m[y][x] = True
        return m

    def compute_clearance_mask(self, grid: SemanticGrid32) -> list[list[bool]]:
        """
        mask[y][x] = True when player_height cells from (x, y) upward are SOLID-free.
        Cells above the grid boundary fail clearance.
        """
        h = self.cfg.height
        W, H = SemanticGrid32.WIDTH, SemanticGrid32.HEIGHT
        solid = int(Cell.SOLID)
        m = [[False] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                ok = True
                for dh in range(h):
                    ny = y - dh
                    if ny < 0 or (int(grid.get(x, ny)) & solid):
                        ok = False
                        break
                m[y][x] = ok
        return m

    # -----------------------------------------------------------------------
    # Public API — validation
    # -----------------------------------------------------------------------

    def validate(
        self,
        grid:  SemanticGrid32,
        start: Optional[Pos] = None,
        goal:  Optional[Pos] = None,
    ) -> ReachabilityReport:
        """
        Determine whether goal is reachable from start.

        start / goal override grid-embedded START/GOAL flags when provided.
        Returned report includes diagnostics when unreachable.
        """
        reasons: list[str] = []

        if start is None:
            start = self._find_flag(grid, Cell.START)
        if goal is None:
            goal = self._find_flag(grid, Cell.GOAL)

        if start is None:
            reasons.append("No START marker found in grid")
        if goal is None:
            reasons.append("No GOAL marker found in grid")
        if reasons:
            return ReachabilityReport(reachable=False, reasons=reasons)

        stand = self.compute_standable_mask(grid)
        clear = self.compute_clearance_mask(grid)
        valid = [
            [stand[y][x] and clear[y][x] for x in range(SemanticGrid32.WIDTH)]
            for y in range(SemanticGrid32.HEIGHT)
        ]

        sx, sy = start
        gx, gy = goal
        if not valid[sy][sx]:
            reasons.append(f"START {start} is not a valid standing position")
        if not valid[gy][gx]:
            reasons.append(f"GOAL {goal} is not a valid standing position")
        if reasons:
            return ReachabilityReport(reachable=False, reasons=reasons)

        path = self._bfs(grid, valid, start, goal)
        if path is None:
            return ReachabilityReport(
                reachable=False,
                reasons=self._diagnose(grid, valid, start, goal),
            )

        return ReachabilityReport(
            reachable=True,
            path_length=len(path),
            jump_count=self._count_jumps(path),
            min_landing_width=self._min_landing_width(valid, path),
        )

    # -----------------------------------------------------------------------
    # Internal — graph search
    # -----------------------------------------------------------------------

    def _find_flag(self, grid: SemanticGrid32, flag: Cell) -> Optional[Pos]:
        for y in range(SemanticGrid32.HEIGHT):
            for x in range(SemanticGrid32.WIDTH):
                if int(grid.get(x, y)) & int(flag):
                    return (x, y)
        return None

    def _bfs(
        self, grid, valid: list[list[bool]], start: Pos, goal: Pos
    ) -> Optional[list[Pos]]:
        parent: dict[Pos, Optional[Pos]] = {start: None}
        q: deque[Pos] = deque([start])
        while q:
            cur = q.popleft()
            if cur == goal:
                return self._reconstruct(parent, goal)
            for nxt in self._reachable_from(grid, valid, cur):
                if nxt not in parent:
                    parent[nxt] = cur
                    q.append(nxt)
        return None

    def _reachable_from(
        self, grid, valid: list[list[bool]], pos: Pos
    ) -> list[Pos]:
        x1, y1 = pos
        cfg = self.cfg
        W, H = SemanticGrid32.WIDTH, SemanticGrid32.HEIGHT
        out: list[Pos] = []
        for dx in range(-cfg.max_jump_distance, cfg.max_jump_distance + 1):
            for dy in range(-cfg.max_jump_height, cfg.max_safe_drop + 1):
                if dx == 0 and dy == 0:
                    continue
                x2, y2 = x1 + dx, y1 + dy
                if 0 <= x2 < W and 0 <= y2 < H and valid[y2][x2]:
                    if self._corridor_ok(grid, x1, y1, x2, y2):
                        out.append((x2, y2))
        return out

    def _corridor_ok(
        self, grid, x1: int, y1: int, x2: int, y2: int
    ) -> bool:
        """
        Linearly sample the player body along the path from (x1,y1) to (x2,y2).
        Returns False if any SOLID tile intersects the body en route.
        Out-of-bounds grid positions count as clear (the grid has solid walls
        embedded, so the edge cells already block).
        """
        W, H = SemanticGrid32.WIDTH, SemanticGrid32.HEIGHT
        ph   = self.cfg.height
        solid = int(Cell.SOLID)
        dx   = x2 - x1

        def body_clear(ix: int, iy: int) -> bool:
            for dh in range(ph):
                cy = iy - dh
                if 0 <= cy < H and 0 <= ix < W and (int(grid.get(ix, cy)) & solid):
                    return False
            return True

        if dx == 0:
            # Vertical move: check every row between y1 and y2
            for cy in range(min(y1, y2), max(y1, y2) + 1):
                if not body_clear(x1, cy):
                    return False
            return True

        step = 1 if dx > 0 else -1
        for ix in range(x1, x2 + step, step):
            t  = (ix - x1) / dx
            iy = round(y1 + t * (y2 - y1))
            if not body_clear(ix, iy):
                return False
        return True

    # -----------------------------------------------------------------------
    # Internal — path statistics
    # -----------------------------------------------------------------------

    def _reconstruct(
        self, parent: dict[Pos, Optional[Pos]], goal: Pos
    ) -> list[Pos]:
        path: list[Pos] = []
        node: Optional[Pos] = goal
        while node is not None:
            path.append(node)
            node = parent[node]
        path.reverse()
        return path

    def _count_jumps(self, path: list[Pos]) -> int:
        """Moves where dy != 0 or |dx| > 1 (not a simple floor-level step)."""
        return sum(
            1 for i in range(len(path) - 1)
            if path[i + 1][1] != path[i][1] or abs(path[i + 1][0] - path[i][0]) > 1
        )

    def _min_landing_width(
        self, valid: list[list[bool]], path: list[Pos]
    ) -> int:
        """Minimum horizontal run of valid cells at the same row as any path node."""
        W     = SemanticGrid32.WIDTH
        min_w = W
        for x, y in path:
            row = valid[y]
            lo, hi = x, x
            while lo > 0 and row[lo - 1]:
                lo -= 1
            while hi < W - 1 and row[hi + 1]:
                hi += 1
            min_w = min(min_w, hi - lo + 1)
        return min_w

    # -----------------------------------------------------------------------
    # Internal — diagnostics
    # -----------------------------------------------------------------------

    def _diagnose(
        self, grid, valid: list[list[bool]], start: Pos, goal: Pos
    ) -> list[str]:
        """Full BFS from start to count reachable positions and suggest causes."""
        visited: set[Pos] = {start}
        q: deque[Pos] = deque([start])
        while q:
            p = q.popleft()
            for nxt in self._reachable_from(grid, valid, p):
                if nxt not in visited:
                    visited.add(nxt)
                    q.append(nxt)

        cfg = self.cfg
        sx, sy = start
        gx, gy = goal
        msgs = [
            f"GOAL {goal} unreachable from START {start}",
            f"{len(visited)} valid position(s) reachable from START",
        ]
        h_gap = abs(gx - sx)
        v_up  = sy - gy   # positive = goal is higher (smaller y)
        v_dn  = gy - sy   # positive = goal is lower  (larger  y)
        if h_gap > cfg.max_jump_distance:
            msgs.append(
                f"Horizontal gap ~{h_gap} > max_jump_distance {cfg.max_jump_distance}"
            )
        if v_up > cfg.max_jump_height:
            msgs.append(
                f"Height gain ~{v_up} > max_jump_height {cfg.max_jump_height}"
            )
        if v_dn > cfg.max_safe_drop:
            msgs.append(
                f"Drop ~{v_dn} > max_safe_drop {cfg.max_safe_drop}"
            )
        return msgs
