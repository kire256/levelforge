"""
Semantic grid data model for a 32x32 platformer level.

SemanticCell flags (bitflags, uint8):
    SOLID  = 0x01 — fully blocking terrain
    ONEWAY = 0x02 — passable from below, solid from above
    HAZARD = 0x04 — kills the player on contact
    LADDER = 0x08 — climbable surface
    GOAL   = 0x10 — level exit / win condition
    START  = 0x20 — player spawn point

Bounds policy: raises IndexError on out-of-bounds for get/set/addFlags/removeFlags.
applyRect silently skips cells outside the grid.
"""

from __future__ import annotations

import base64
import json
from enum import IntFlag
from typing import Literal


class Cell(IntFlag):
    EMPTY  = 0
    SOLID  = 0x01
    ONEWAY = 0x02
    HAZARD = 0x04
    LADDER = 0x08
    GOAL   = 0x10
    START  = 0x20


ApplyMode = Literal["overwrite", "add", "remove"]


class SemanticGrid32:
    """Fixed 32x32 semantic tile grid. Each cell stores a Cell bitflag (uint8)."""

    WIDTH  = 32
    HEIGHT = 32

    def __init__(self) -> None:
        self._cells: list[int] = [0] * (self.WIDTH * self.HEIGHT)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _index(self, x: int, y: int) -> int:
        """Return flat index; raises IndexError if (x, y) is out of bounds."""
        if not (0 <= x < self.WIDTH and 0 <= y < self.HEIGHT):
            raise IndexError(
                f"({x}, {y}) is out of bounds for {self.WIDTH}x{self.HEIGHT} grid"
            )
        return y * self.WIDTH + x

    # ------------------------------------------------------------------
    # Cell access
    # ------------------------------------------------------------------

    def get(self, x: int, y: int) -> Cell:
        """Return the Cell flags at (x, y). Raises IndexError if out of bounds."""
        return Cell(self._cells[self._index(x, y)])

    def set(self, x: int, y: int, flags: int) -> None:
        """Overwrite the cell at (x, y) with flags. Raises IndexError if out of bounds."""
        self._cells[self._index(x, y)] = int(flags) & 0xFF

    def addFlags(self, x: int, y: int, flags: int) -> None:
        """OR flags into the cell at (x, y). Raises IndexError if out of bounds."""
        idx = self._index(x, y)
        self._cells[idx] = (self._cells[idx] | int(flags)) & 0xFF

    def removeFlags(self, x: int, y: int, flags: int) -> None:
        """Clear specific flags from the cell at (x, y). Raises IndexError if out of bounds."""
        idx = self._index(x, y)
        self._cells[idx] = (self._cells[idx] & ~int(flags)) & 0xFF

    # ------------------------------------------------------------------
    # Bulk operations
    # ------------------------------------------------------------------

    def fill(self, flags: int) -> None:
        """Set every cell to flags."""
        v = int(flags) & 0xFF
        for i in range(len(self._cells)):
            self._cells[i] = v

    def clear(self) -> None:
        """Zero every cell (equivalent to fill(Cell.EMPTY))."""
        for i in range(len(self._cells)):
            self._cells[i] = 0

    def copy(self) -> SemanticGrid32:
        """Return a deep copy of this grid."""
        g = SemanticGrid32()
        g._cells = self._cells[:]
        return g

    def applyRect(
        self,
        x: int,
        y: int,
        w: int,
        h: int,
        flags: int,
        mode: ApplyMode = "overwrite",
    ) -> None:
        """
        Apply flags to the rectangle with top-left (x, y), width w, height h.

        Cells outside the 32x32 boundary are silently skipped (no error).

        mode:
            "overwrite" — replace cell value with flags
            "add"       — OR flags into existing value
            "remove"    — clear specified flags from existing value
        """
        f = int(flags) & 0xFF
        for ry in range(y, y + h):
            for rx in range(x, x + w):
                if not (0 <= rx < self.WIDTH and 0 <= ry < self.HEIGHT):
                    continue
                idx = ry * self.WIDTH + rx
                if mode == "overwrite":
                    self._cells[idx] = f
                elif mode == "add":
                    self._cells[idx] = (self._cells[idx] | f) & 0xFF
                elif mode == "remove":
                    self._cells[idx] = (self._cells[idx] & ~f) & 0xFF

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def toJSON(self) -> dict:
        """
        Serialize to a dict with:
            width, height — grid dimensions
            cells         — base64-encoded raw bytes (1 byte per cell, row-major)
        """
        raw = bytes(self._cells)
        return {
            "width": self.WIDTH,
            "height": self.HEIGHT,
            "cells": base64.b64encode(raw).decode("ascii"),
        }

    @classmethod
    def fromJSON(cls, data: dict) -> SemanticGrid32:
        """Deserialize from a dict produced by toJSON(). Raises ValueError on size mismatch."""
        w, h = data["width"], data["height"]
        if w != cls.WIDTH or h != cls.HEIGHT:
            raise ValueError(
                f"Expected {cls.WIDTH}x{cls.HEIGHT} grid, got {w}x{h}"
            )
        raw = base64.b64decode(data["cells"])
        if len(raw) != cls.WIDTH * cls.HEIGHT:
            raise ValueError(
                f"Expected {cls.WIDTH * cls.HEIGHT} bytes, got {len(raw)}"
            )
        g = cls()
        g._cells = list(raw)
        return g

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        return isinstance(other, SemanticGrid32) and self._cells == other._cells

    def __repr__(self) -> str:
        non_empty = sum(1 for c in self._cells if c)
        return f"SemanticGrid32({self.WIDTH}x{self.HEIGHT}, {non_empty} non-empty cells)"
