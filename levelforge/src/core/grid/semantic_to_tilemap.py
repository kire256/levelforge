"""
Mapper: SemanticGrid32 → 32×32 tile-ID grid.

Precedence (highest → lowest):
    SOLID   → solid tile (optionally autotiled via 4-neighbor bitmask)
    HAZARD  → hazard tile
    ONEWAY  → one-way platform tile
    LADDER  → ladder tile
    GOAL    → goal_marker tile  (skipped when goal_marker == 0)
    START   → start_marker tile (skipped when start_marker == 0)
    (empty) → empty tile

4-neighbor autotile bitmask for SOLID cells
───────────────────────────────────────────
Populate TileIds.solid_variants to enable autotiling.
Each key is the OR of whichever NEIGHBOR_* constants apply:

    NEIGHBOR_N = 0b0001  ← north neighbour (y-1) is SOLID
    NEIGHBOR_E = 0b0010  ← east  neighbour (x+1) is SOLID
    NEIGHBOR_S = 0b0100  ← south neighbour (y+1) is SOLID
    NEIGHBOR_W = 0b1000  ← west  neighbour (x-1) is SOLID

Out-of-bounds positions count as SOLID (prevents seams at grid edges).
Unrecognised bitmasks fall back to TileIds.solid_base.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from semantic_grid import Cell, SemanticGrid32

# ---------------------------------------------------------------------------
# Neighbour bitmask constants
# ---------------------------------------------------------------------------

NEIGHBOR_N = 0b0001
NEIGHBOR_E = 0b0010
NEIGHBOR_S = 0b0100
NEIGHBOR_W = 0b1000


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class TileIds:
    """
    Tile-ID mapping used by SemanticToTilemap.

    solid_base
        Used for every SOLID cell when solid_variants is empty,
        and as a fallback for any bitmask absent from solid_variants.

    solid_variants
        dict[int, int] — maps 4-neighbour bitmasks (0–15) to tile IDs.
        Leave empty to disable autotiling.

    start_marker / goal_marker
        Set to 0 (default) to leave those semantic cells as empty tiles.
    """
    solid_base:      int            = 1
    solid_variants:  dict[int, int] = field(default_factory=dict)
    oneway:          int            = 2
    hazard:          int            = 3
    ladder:          int            = 4
    start_marker:    int            = 0   # 0 → no tile placed
    goal_marker:     int            = 0   # 0 → no tile placed
    empty:           int            = 0


# ---------------------------------------------------------------------------
# Mapper
# ---------------------------------------------------------------------------

class SemanticToTilemap:
    """
    Converts a SemanticGrid32 into a 32×32 tile-ID grid.

    result = SemanticToTilemap(tile_ids).convert(grid)
    # result[y][x] → int tile ID
    """

    def __init__(self, tile_ids: Optional[TileIds] = None) -> None:
        self.tile_ids = tile_ids or TileIds()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def convert(self, grid: SemanticGrid32) -> list[list[int]]:
        """
        Return a row-major 32×32 list of tile IDs.

        result[y][x] = tile ID at column x, row y.
        """
        W = SemanticGrid32.WIDTH
        H = SemanticGrid32.HEIGHT
        result: list[list[int]] = [[self.tile_ids.empty] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                result[y][x] = self._resolve(grid, x, y)
        return result

    def neighbor_mask(self, grid: SemanticGrid32, x: int, y: int) -> int:
        """
        Return the 4-neighbour SOLID bitmask for cell (x, y).

        Useful for debugging and building custom solid_variants tables.
        Out-of-bounds positions are treated as solid.
        """
        return self._neighbor_mask(grid, x, y)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _resolve(self, grid: SemanticGrid32, x: int, y: int) -> int:
        flags = grid.get(x, y)
        t = self.tile_ids
        if flags & Cell.SOLID:
            return self._solid_tile(grid, x, y)
        if flags & Cell.HAZARD:
            return t.hazard
        if flags & Cell.ONEWAY:
            return t.oneway
        if flags & Cell.LADDER:
            return t.ladder
        if (flags & Cell.GOAL) and t.goal_marker:
            return t.goal_marker
        if (flags & Cell.START) and t.start_marker:
            return t.start_marker
        return t.empty

    def _solid_tile(self, grid: SemanticGrid32, x: int, y: int) -> int:
        t = self.tile_ids
        if not t.solid_variants:
            return t.solid_base
        mask = self._neighbor_mask(grid, x, y)
        return t.solid_variants.get(mask, t.solid_base)

    def _neighbor_mask(self, grid: SemanticGrid32, x: int, y: int) -> int:
        W = SemanticGrid32.WIDTH
        H = SemanticGrid32.HEIGHT

        def is_solid(nx: int, ny: int) -> bool:
            if nx < 0 or nx >= W or ny < 0 or ny >= H:
                return True  # treat boundary as solid
            return bool(grid.get(nx, ny) & Cell.SOLID)

        mask = 0
        if is_solid(x,     y - 1): mask |= NEIGHBOR_N
        if is_solid(x + 1, y    ): mask |= NEIGHBOR_E
        if is_solid(x,     y + 1): mask |= NEIGHBOR_S
        if is_solid(x - 1, y    ): mask |= NEIGHBOR_W
        return mask
