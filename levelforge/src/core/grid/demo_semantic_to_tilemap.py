"""
Demo / test runner for SemanticToTilemap.

Run directly:
    python demo_semantic_to_tilemap.py
"""

import sys
from semantic_grid import Cell, SemanticGrid32
from semantic_to_tilemap import (
    TileIds, SemanticToTilemap,
    NEIGHBOR_N, NEIGHBOR_E, NEIGHBOR_S, NEIGHBOR_W,
)

# ---------------------------------------------------------------------------
# Tile ID assignments used throughout this demo
# ---------------------------------------------------------------------------

#  Solid autotile variants: one tile ID per 4-neighbour bitmask (0–15).
#  In a real tileset these would be sprite-sheet indices; here we just use
#  10 + mask so the numbers are easy to reason about.
SOLID_VARIANTS: dict[int, int] = {mask: 10 + mask for mask in range(16)}

DEMO_TILE_IDS = TileIds(
    solid_base=10,          # fallback (mask 0 = isolated solid)
    solid_variants=SOLID_VARIANTS,
    oneway=30,
    hazard=31,
    ladder=32,
    start_marker=40,
    goal_marker=41,
    empty=0,
)

# ASCII chars for rendering tile IDs in the terminal
DISPLAY: dict[int, str] = {
    0:  '.',
    **{v: '#' for v in SOLID_VARIANTS.values()},
    30: '=',
    31: '^',
    32: 'H',
    40: 'S',
    41: 'G',
}

# ---------------------------------------------------------------------------
# Shared level layout
# ---------------------------------------------------------------------------

def build_level() -> SemanticGrid32:
    g = SemanticGrid32()

    # Bounding walls and floor
    g.applyRect(0,  0, 32,  1, Cell.SOLID)   # ceiling
    g.applyRect(0, 31, 32,  1, Cell.SOLID)   # floor
    g.applyRect(0,  0,  1, 32, Cell.SOLID)   # left wall
    g.applyRect(31, 0,  1, 32, Cell.SOLID)   # right wall

    # One-way platforms
    g.applyRect(5,  24, 8, 1, Cell.ONEWAY)
    g.applyRect(18, 18, 8, 1, Cell.ONEWAY)

    # Hazard spikes on the floor
    g.applyRect(14, 30, 4, 1, Cell.HAZARD)

    # Ladder connecting floor to first platform
    g.applyRect(10, 24, 1, 7, Cell.LADDER)

    # Start (bottom-left open space) and goal (bottom-right)
    g.set(2,  30, Cell.START)
    g.set(29, 30, Cell.GOAL)

    return g


# ---------------------------------------------------------------------------
# ASCII rendering helpers
# ---------------------------------------------------------------------------

def render_semantic(grid: SemanticGrid32) -> str:
    """Render raw semantic flags as single characters for visual inspection."""
    chars = {
        int(Cell.SOLID):  '#',
        int(Cell.ONEWAY): '=',
        int(Cell.HAZARD): '^',
        int(Cell.LADDER): 'H',
        int(Cell.GOAL):   'G',
        int(Cell.START):  'S',
        int(Cell.EMPTY):  '.',
    }
    rows = []
    for y in range(SemanticGrid32.HEIGHT):
        row = []
        for x in range(SemanticGrid32.WIDTH):
            f = int(grid.get(x, y))
            # pick highest-priority flag for display
            ch = '.'
            for flag in (Cell.SOLID, Cell.HAZARD, Cell.ONEWAY,
                         Cell.LADDER, Cell.GOAL, Cell.START):
                if f & flag:
                    ch = chars[int(flag)]
                    break
            row.append(ch)
        rows.append(''.join(row))
    return '\n'.join(rows)


def render_tilemap(tile_grid: list[list[int]], display: dict[int, str]) -> str:
    return '\n'.join(
        ''.join(display.get(tid, '?') for tid in row)
        for row in tile_grid
    )


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

_passed = _failed = 0

def _assert(condition: bool, msg: str) -> None:
    global _passed, _failed
    if condition:
        _passed += 1
    else:
        _failed += 1
        print(f"  FAIL  {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Demo 1 — flat solid_base (no autotile)
# ---------------------------------------------------------------------------

def demo_flat() -> None:
    print("-" * 34)
    print("Demo 1 - flat solid (no autotile)")
    print("-" * 34)

    ids = TileIds(
        solid_base=1,
        oneway=30, hazard=31, ladder=32,
        start_marker=40, goal_marker=41,
        empty=0,
    )
    display = {0: '.', 1: '#', 30: '=', 31: '^', 32: 'H', 40: 'S', 41: 'G'}

    grid   = build_level()
    mapper = SemanticToTilemap(ids)
    tiles  = mapper.convert(grid)

    print("\nSemantic grid:")
    print(render_semantic(grid))
    print("\nTile grid:")
    print(render_tilemap(tiles, display))

    # Spot-checks
    _assert(tiles[31][0]  == 1,  "left wall+floor corner -> solid_base")
    _assert(tiles[30][2]  == 40, "START cell -> start_marker")
    _assert(tiles[30][29] == 41, "GOAL cell -> goal_marker")
    _assert(tiles[30][14] == 31, "hazard -> hazard tile")
    _assert(tiles[24][5]  == 30, "oneway -> oneway tile")
    _assert(tiles[24][10] == 32, "ladder -> ladder tile")
    _assert(tiles[15][15] == 0,  "empty interior -> empty tile")


# ---------------------------------------------------------------------------
# Demo 2 — 4-neighbour autotile
# ---------------------------------------------------------------------------

def demo_autotile() -> None:
    print("\n" + "-" * 34)
    print("Demo 2 - autotile (solid_variants)")
    print("-" * 34)

    grid   = build_level()
    mapper = SemanticToTilemap(DEMO_TILE_IDS)
    tiles  = mapper.convert(grid)

    print("\nTile grid:")
    print(render_tilemap(tiles, DISPLAY))

    print("\nAutotile bitmask samples:")
    print(f"  {'cell':>8}  {'mask':>10}  {'tile_id':>8}  desc")
    print(f"  {'----':>8}  {'----------':>10}  {'-------':>8}  ----")

    samples = [
        # (x, y, expected description)
        (0,  0,  "top-left corner (wall+ceiling)"),
        (1,  0,  "ceiling interior"),
        (0,  1,  "left wall interior"),
        (0, 31,  "bottom-left corner (wall+floor)"),
        (5, 31,  "floor top (E+S+W solid)"),
        (15, 31, "floor top (E+S+W solid)"),
    ]
    for x, y, desc in samples:
        mask = mapper.neighbor_mask(grid, x, y)
        tile = tiles[y][x]
        flags_str = (
            ('N' if mask & NEIGHBOR_N else '_') +
            ('E' if mask & NEIGHBOR_E else '_') +
            ('S' if mask & NEIGHBOR_S else '_') +
            ('W' if mask & NEIGHBOR_W else '_')
        )
        print(f"  ({x:2},{y:2})      {flags_str}={mask:2d}   tile={tile:3d}   {desc}")

    # Correctness checks
    # All solid tiles must use a variant from SOLID_VARIANTS (10-25)
    for y in range(SemanticGrid32.HEIGHT):
        for x in range(SemanticGrid32.WIDTH):
            if grid.get(x, y) & Cell.SOLID:
                _assert(
                    10 <= tiles[y][x] <= 25,
                    f"({x},{y}) solid tile ID {tiles[y][x]} not in variant range 10–25",
                )

    # Floor interior at (5,31): neighbours are N=empty, E=solid, S=OOB, W=solid
    # → mask = E|S|W = 2|4|8 = 14 → tile = 10+14 = 24
    mask_5_31 = mapper.neighbor_mask(grid, 5, 31)
    _assert(mask_5_31 == (NEIGHBOR_E | NEIGHBOR_S | NEIGHBOR_W),
            f"floor cell (5,31) mask = {mask_5_31:#06b} (expected NESW=_ESW=14)")
    _assert(tiles[31][5] == 24, "floor cell (5,31) → tile 24")

    # Corner at (0,0): all four OOB neighbours → mask = 15 → tile = 25
    mask_0_0 = mapper.neighbor_mask(grid, 0, 0)
    _assert(mask_0_0 == 15, f"top-left corner mask = {mask_0_0} (expected 15)")
    _assert(tiles[0][0] == 25, "top-left corner → tile 25 (interior)")

    # Non-solid cells must not use a solid tile ID
    # (15, 15) is a guaranteed empty interior cell
    _assert(tiles[15][15] == 0,  "empty interior cell (15,15) -> 0")
    _assert(tiles[30][2]  == 40, "START -> startMarker 40")
    _assert(tiles[30][29] == 41, "GOAL  -> goalMarker 41")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run() -> None:
    print("=== SemanticToTilemap Demo ===\n")
    demo_flat()
    demo_autotile()
    print(f"\nAssertions: {_passed} passed, {_failed} failed")
    if _failed:
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    run()
