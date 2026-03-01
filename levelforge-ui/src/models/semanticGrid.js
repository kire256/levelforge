/**
 * Semantic grid data model for a 32x32 platformer level.
 *
 * Cell flags (bitflags, stored as uint8):
 *   SOLID  0x01 — fully blocking terrain
 *   ONEWAY 0x02 — passable from below, solid from above
 *   HAZARD 0x04 — kills the player on contact
 *   LADDER 0x08 — climbable surface
 *   GOAL   0x10 — level exit / win condition
 *   START  0x20 — player spawn point
 *
 * Bounds policy: get/set/addFlags/removeFlags throw RangeError on out-of-bounds.
 * applyRect silently skips cells outside the 32x32 boundary.
 */

/** @enum {number} */
export const Cell = Object.freeze({
  EMPTY:  0,
  SOLID:  0x01,
  ONEWAY: 0x02,
  HAZARD: 0x04,
  LADDER: 0x08,
  GOAL:   0x10,
  START:  0x20,
});

/** @typedef {'overwrite'|'add'|'remove'} ApplyMode */

export class SemanticGrid32 {
  static WIDTH  = 32;
  static HEIGHT = 32;

  constructor() {
    /** @type {Uint8Array} Row-major: index = y * WIDTH + x */
    this._cells = new Uint8Array(SemanticGrid32.WIDTH * SemanticGrid32.HEIGHT);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** @throws {RangeError} if (x, y) is outside the grid */
  _index(x, y) {
    if (x < 0 || x >= SemanticGrid32.WIDTH || y < 0 || y >= SemanticGrid32.HEIGHT) {
      throw new RangeError(
        `(${x}, ${y}) is out of bounds for ${SemanticGrid32.WIDTH}x${SemanticGrid32.HEIGHT} grid`
      );
    }
    return y * SemanticGrid32.WIDTH + x;
  }

  // -------------------------------------------------------------------------
  // Cell access
  // -------------------------------------------------------------------------

  /** Return the flag byte at (x, y). Throws RangeError if out of bounds. */
  get(x, y) {
    return this._cells[this._index(x, y)];
  }

  /** Overwrite the cell at (x, y) with flags. Throws RangeError if out of bounds. */
  set(x, y, flags) {
    this._cells[this._index(x, y)] = flags & 0xFF;
  }

  /** OR flags into the cell at (x, y). Throws RangeError if out of bounds. */
  addFlags(x, y, flags) {
    const i = this._index(x, y);
    this._cells[i] = (this._cells[i] | flags) & 0xFF;
  }

  /** Clear specific flags from the cell at (x, y). Throws RangeError if out of bounds. */
  removeFlags(x, y, flags) {
    const i = this._index(x, y);
    this._cells[i] = (this._cells[i] & ~flags) & 0xFF;
  }

  // -------------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------------

  /** Set every cell to flags. */
  fill(flags) {
    this._cells.fill(flags & 0xFF);
  }

  /** Zero every cell. */
  clear() {
    this._cells.fill(0);
  }

  /** Return a deep copy of this grid. */
  copy() {
    const g = new SemanticGrid32();
    g._cells.set(this._cells);
    return g;
  }

  /**
   * Apply flags to the rectangle with top-left (x, y), width w, height h.
   * Cells outside the 32x32 boundary are silently skipped (no error thrown).
   *
   * @param {number} x       Top-left column (inclusive)
   * @param {number} y       Top-left row (inclusive)
   * @param {number} w       Width in cells
   * @param {number} h       Height in cells
   * @param {number} flags   Cell flags to apply
   * @param {ApplyMode} mode "overwrite" | "add" | "remove" (default: "overwrite")
   */
  applyRect(x, y, w, h, flags, mode = 'overwrite') {
    const f = flags & 0xFF;
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        if (rx < 0 || rx >= SemanticGrid32.WIDTH || ry < 0 || ry >= SemanticGrid32.HEIGHT) {
          continue;
        }
        const i = ry * SemanticGrid32.WIDTH + rx;
        if      (mode === 'overwrite') this._cells[i] = f;
        else if (mode === 'add')       this._cells[i] = (this._cells[i] | f)  & 0xFF;
        else if (mode === 'remove')    this._cells[i] = (this._cells[i] & ~f) & 0xFF;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize to a plain object with:
   *   width, height — grid dimensions
   *   cells         — base64-encoded raw bytes (1 byte per cell, row-major)
   * @returns {{ width: number, height: number, cells: string }}
   */
  toJSON() {
    // Build binary string then base64-encode it
    let binary = '';
    for (let i = 0; i < this._cells.length; i++) {
      binary += String.fromCharCode(this._cells[i]);
    }
    return {
      width:  SemanticGrid32.WIDTH,
      height: SemanticGrid32.HEIGHT,
      cells:  btoa(binary),
    };
  }

  /**
   * Deserialize from an object produced by toJSON().
   * @param {{ width: number, height: number, cells: string }} data
   * @returns {SemanticGrid32}
   * @throws {Error} on size mismatch or corrupt data
   */
  static fromJSON(data) {
    const { width, height, cells } = data;
    if (width !== SemanticGrid32.WIDTH || height !== SemanticGrid32.HEIGHT) {
      throw new Error(
        `Expected ${SemanticGrid32.WIDTH}x${SemanticGrid32.HEIGHT} grid, got ${width}x${height}`
      );
    }
    const binary = atob(cells);
    if (binary.length !== SemanticGrid32.WIDTH * SemanticGrid32.HEIGHT) {
      throw new Error(`Corrupt cells data: unexpected byte count ${binary.length}`);
    }
    const g = new SemanticGrid32();
    for (let i = 0; i < binary.length; i++) {
      g._cells[i] = binary.charCodeAt(i);
    }
    return g;
  }

  // -------------------------------------------------------------------------
  // Comparison
  // -------------------------------------------------------------------------

  /** Deep equality check. */
  equals(other) {
    if (!(other instanceof SemanticGrid32)) return false;
    for (let i = 0; i < this._cells.length; i++) {
      if (this._cells[i] !== other._cells[i]) return false;
    }
    return true;
  }
}
