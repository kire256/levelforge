/**
 * Mapper: SemanticGrid32 → 32×32 tile-ID grid.
 *
 * Precedence (highest → lowest):
 *   SOLID   → solid tile (optionally autotiled via 4-neighbor bitmask)
 *   HAZARD  → hazard tile
 *   ONEWAY  → one-way platform tile
 *   LADDER  → ladder tile
 *   GOAL    → goalMarker tile  (skipped when goalMarker === 0)
 *   START   → startMarker tile (skipped when startMarker === 0)
 *   (empty) → empty tile
 *
 * 4-neighbor autotile bitmask for SOLID cells
 * ────────────────────────────────────────────
 * Populate TileIds.solidVariants to enable autotiling.
 * Each key is the OR of whichever NEIGHBOR values apply:
 *
 *   NEIGHBOR.N = 0b0001  ← north neighbor (y-1) is SOLID
 *   NEIGHBOR.E = 0b0010  ← east  neighbor (x+1) is SOLID
 *   NEIGHBOR.S = 0b0100  ← south neighbor (y+1) is SOLID
 *   NEIGHBOR.W = 0b1000  ← west  neighbor (x-1) is SOLID
 *
 * Out-of-bounds positions count as SOLID (prevents seams at grid edges).
 * Unrecognised bitmasks fall back to TileIds.solidBase.
 */

import { Cell } from './semanticGrid.js';

// ---------------------------------------------------------------------------
// Neighbor bitmask constants
// ---------------------------------------------------------------------------

export const NEIGHBOR = Object.freeze({
  N: 0b0001,
  E: 0b0010,
  S: 0b0100,
  W: 0b1000,
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export class TileIds {
  /**
   * @param {object} [opts]
   * @param {number}              [opts.solidBase=1]     Fallback for unlisted bitmasks
   * @param {Record<number,number>} [opts.solidVariants={}] bitmask→tileId map (0–15)
   * @param {number}              [opts.oneway=2]
   * @param {number}              [opts.hazard=3]
   * @param {number}              [opts.ladder=4]
   * @param {number}              [opts.startMarker=0]   0 = leave cell empty
   * @param {number}              [opts.goalMarker=0]    0 = leave cell empty
   * @param {number}              [opts.empty=0]
   */
  constructor({
    solidBase     = 1,
    solidVariants = {},
    oneway        = 2,
    hazard        = 3,
    ladder        = 4,
    startMarker   = 0,
    goalMarker    = 0,
    empty         = 0,
  } = {}) {
    this.solidBase     = solidBase;
    this.solidVariants = solidVariants;
    this.oneway        = oneway;
    this.hazard        = hazard;
    this.ladder        = ladder;
    this.startMarker   = startMarker;
    this.goalMarker    = goalMarker;
    this.empty         = empty;
  }
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

export class SemanticToTilemap {
  /**
   * @param {TileIds} [tileIds]
   */
  constructor(tileIds = new TileIds()) {
    this.tileIds = tileIds;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Convert a SemanticGrid32 to a row-major 32×32 tile-ID array.
   *
   * @param {import('./semanticGrid.js').SemanticGrid32} grid
   * @returns {number[][]} result[y][x] = tile ID
   */
  convert(grid) {
    const { WIDTH, HEIGHT } = grid.constructor;
    const result = Array.from({ length: HEIGHT }, () =>
      new Array(WIDTH).fill(this.tileIds.empty)
    );
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        result[y][x] = this._resolve(grid, x, y);
      }
    }
    return result;
  }

  /**
   * Return the 4-neighbor SOLID bitmask for cell (x, y).
   * Useful for debugging and building solidVariants tables.
   *
   * @param {import('./semanticGrid.js').SemanticGrid32} grid
   * @param {number} x
   * @param {number} y
   * @returns {number} bitmask 0–15
   */
  neighborMask(grid, x, y) {
    return this._neighborMask(grid, x, y);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  _resolve(grid, x, y) {
    const flags = grid.get(x, y);
    const t = this.tileIds;
    if (flags & Cell.SOLID)                      return this._solidTile(grid, x, y);
    if (flags & Cell.HAZARD)                     return t.hazard;
    if (flags & Cell.ONEWAY)                     return t.oneway;
    if (flags & Cell.LADDER)                     return t.ladder;
    if ((flags & Cell.GOAL)  && t.goalMarker)    return t.goalMarker;
    if ((flags & Cell.START) && t.startMarker)   return t.startMarker;
    return t.empty;
  }

  _solidTile(grid, x, y) {
    const t = this.tileIds;
    if (Object.keys(t.solidVariants).length === 0) return t.solidBase;
    const mask = this._neighborMask(grid, x, y);
    return t.solidVariants[mask] ?? t.solidBase;
  }

  _neighborMask(grid, x, y) {
    const { WIDTH, HEIGHT } = grid.constructor;

    const isSolid = (nx, ny) => {
      if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) return true;
      return (grid.get(nx, ny) & Cell.SOLID) !== 0;
    };

    let mask = 0;
    if (isSolid(x,     y - 1)) mask |= NEIGHBOR.N;
    if (isSolid(x + 1, y    )) mask |= NEIGHBOR.E;
    if (isSolid(x,     y + 1)) mask |= NEIGHBOR.S;
    if (isSolid(x - 1, y    )) mask |= NEIGHBOR.W;
    return mask;
  }
}
