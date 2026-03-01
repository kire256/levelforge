/**
 * Platformer reachability validator for SemanticGrid32.
 *
 * Position convention
 * ───────────────────
 * A player "position" [x, y] means their feet tile is at column x, row y
 * (y increases downward).  Body extends upward for cfg.height tiles:
 * feet at y, head at y - (height - 1).
 *
 * Standable cell [x, y]
 *   - (x, y+1) is SOLID or ONEWAY    — surface beneath feet
 *   - (x, y)   is not SOLID or HAZARD — feet cell is occupiable
 *
 * Clearance at [x, y]
 *   All body tiles (x, y) … (x, y-height+1) must not be SOLID.
 *
 * Movement model (coarse/conservative)
 *   Every (dx, dy) within configured limits is tested; a linear-interpolated
 *   body trajectory must not intersect any SOLID tile.
 */

import { Cell } from './semanticGrid.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export class PlayerConfig {
  /**
   * @param {object} [opts]
   * @param {number} [opts.width=1]
   * @param {number} [opts.height=2]
   * @param {number} [opts.maxJumpHeight=4]   max tiles upward per jump
   * @param {number} [opts.maxJumpDistance=5] max horizontal tiles per move
   * @param {number} [opts.maxSafeDrop=6]     max tiles downward without lethal fall
   */
  constructor({
    width           = 1,
    height          = 2,
    maxJumpHeight   = 4,
    maxJumpDistance = 5,
    maxSafeDrop     = 6,
  } = {}) {
    this.width           = width;
    this.height          = height;
    this.maxJumpHeight   = maxJumpHeight;
    this.maxJumpDistance = maxJumpDistance;
    this.maxSafeDrop     = maxSafeDrop;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export class ReachabilityReport {
  /**
   * @param {object} opts
   * @param {boolean}  opts.reachable
   * @param {number}   [opts.pathLength=0]
   * @param {number}   [opts.jumpCount=0]
   * @param {number}   [opts.minLandingWidth=0]
   * @param {string[]} [opts.reasons=[]]
   */
  constructor({ reachable, pathLength = 0, jumpCount = 0,
                minLandingWidth = 0, reasons = [] }) {
    this.reachable        = reachable;
    this.pathLength       = pathLength;
    this.jumpCount        = jumpCount;
    this.minLandingWidth  = minLandingWidth;
    this.reasons          = reasons;
  }

  toString() {
    if (this.reachable) {
      return `REACHABLE  path=${this.pathLength} nodes | ` +
             `jumps=${this.jumpCount} | min_platform=${this.minLandingWidth} tiles`;
    }
    return 'UNREACHABLE: ' + this.reasons.join(' | ');
  }
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export class ReachabilityValidator {
  /** @param {PlayerConfig} [cfg] */
  constructor(cfg = new PlayerConfig()) {
    this.cfg = cfg;
  }

  // -------------------------------------------------------------------------
  // Public API — masks
  // -------------------------------------------------------------------------

  /**
   * mask[y][x] = true when player feet can safely occupy (x, y):
   *   - (x, y+1) provides a surface (SOLID or ONEWAY)
   *   - (x, y)   is not SOLID or HAZARD
   * @param {import('./semanticGrid.js').SemanticGrid32} grid
   * @returns {boolean[][]}
   */
  computeStandableMask(grid) {
    const { WIDTH, HEIGHT } = grid.constructor;
    const surfaceMask = Cell.SOLID | Cell.ONEWAY;
    const badFeet     = Cell.SOLID | Cell.HAZARD;
    const m = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(false));
    for (let y = 0; y < HEIGHT - 1; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if ((grid.get(x, y + 1) & surfaceMask) && !(grid.get(x, y) & badFeet)) {
          m[y][x] = true;
        }
      }
    }
    return m;
  }

  /**
   * mask[y][x] = true when cfg.height cells from (x, y) upward are SOLID-free.
   * Cells above the grid boundary fail clearance.
   * @param {import('./semanticGrid.js').SemanticGrid32} grid
   * @returns {boolean[][]}
   */
  computeClearanceMask(grid) {
    const h = this.cfg.height;
    const { WIDTH, HEIGHT } = grid.constructor;
    const m = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(false));
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        let ok = true;
        for (let dh = 0; dh < h; dh++) {
          const ny = y - dh;
          if (ny < 0 || (grid.get(x, ny) & Cell.SOLID)) { ok = false; break; }
        }
        m[y][x] = ok;
      }
    }
    return m;
  }

  // -------------------------------------------------------------------------
  // Public API — validation
  // -------------------------------------------------------------------------

  /**
   * Determine whether goal is reachable from start.
   *
   * @param {import('./semanticGrid.js').SemanticGrid32} grid
   * @param {[number,number]|null} [start]  overrides START flag when provided
   * @param {[number,number]|null} [goal]   overrides GOAL flag when provided
   * @returns {ReachabilityReport}
   */
  validate(grid, start = null, goal = null) {
    const reasons = [];
    if (!start) start = this._findFlag(grid, Cell.START);
    if (!goal)  goal  = this._findFlag(grid, Cell.GOAL);
    if (!start) reasons.push('No START marker found in grid');
    if (!goal)  reasons.push('No GOAL marker found in grid');
    if (reasons.length) return new ReachabilityReport({ reachable: false, reasons });

    const stand = this.computeStandableMask(grid);
    const clear = this.computeClearanceMask(grid);
    const { WIDTH, HEIGHT } = grid.constructor;
    const valid = Array.from({ length: HEIGHT }, (_, y) =>
      Array.from({ length: WIDTH }, (_, x) => stand[y][x] && clear[y][x])
    );

    const [sx, sy] = start, [gx, gy] = goal;
    if (!valid[sy][sx]) reasons.push(`START [${start}] is not a valid standing position`);
    if (!valid[gy][gx]) reasons.push(`GOAL [${goal}] is not a valid standing position`);
    if (reasons.length) return new ReachabilityReport({ reachable: false, reasons });

    const path = this._bfs(grid, valid, start, goal);
    if (!path) {
      return new ReachabilityReport({
        reachable: false,
        reasons: this._diagnose(grid, valid, start, goal),
      });
    }

    return new ReachabilityReport({
      reachable:       true,
      pathLength:      path.length,
      jumpCount:       this._countJumps(path),
      minLandingWidth: this._minLandingWidth(valid, path),
    });
  }

  // -------------------------------------------------------------------------
  // Internal — graph search
  // -------------------------------------------------------------------------

  /** @returns {[number,number]|null} */
  _findFlag(grid, flag) {
    const { WIDTH, HEIGHT } = grid.constructor;
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++)
        if (grid.get(x, y) & flag) return [x, y];
    return null;
  }

  _key(pos) { return `${pos[0]},${pos[1]}`; }

  /** @returns {[number,number][]|null} */
  _bfs(grid, valid, start, goal) {
    const goalKey = this._key(goal);
    const parent  = new Map([[this._key(start), null]]);
    const queue   = [start];
    let   head    = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      if (this._key(cur) === goalKey) return this._reconstruct(parent, goal);
      for (const nxt of this._reachableFrom(grid, valid, cur)) {
        const k = this._key(nxt);
        if (!parent.has(k)) {
          parent.set(k, cur);
          queue.push(nxt);
        }
      }
    }
    return null;
  }

  /** @returns {[number,number][]} */
  _reachableFrom(grid, valid, pos) {
    const [x1, y1] = pos;
    const { maxJumpDistance: D, maxJumpHeight: H, maxSafeDrop: S } = this.cfg;
    const { WIDTH, HEIGHT } = grid.constructor;
    const out = [];

    for (let dx = -D; dx <= D; dx++) {
      for (let dy = -H; dy <= S; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x2 = x1 + dx, y2 = y1 + dy;
        if (x2 < 0 || x2 >= WIDTH || y2 < 0 || y2 >= HEIGHT) continue;
        if (!valid[y2][x2]) continue;
        if (this._corridorOk(grid, x1, y1, x2, y2)) out.push([x2, y2]);
      }
    }
    return out;
  }

  /**
   * Linear body-trajectory check.
   * Returns false if any SOLID tile intersects the player body en route.
   */
  _corridorOk(grid, x1, y1, x2, y2) {
    const ph = this.cfg.height;
    const { WIDTH, HEIGHT } = grid.constructor;
    const dx = x2 - x1;

    const bodyClear = (ix, iy) => {
      for (let dh = 0; dh < ph; dh++) {
        const cy = iy - dh;
        if (cy >= 0 && cy < HEIGHT && ix >= 0 && ix < WIDTH &&
            (grid.get(ix, cy) & Cell.SOLID)) return false;
      }
      return true;
    };

    if (dx === 0) {
      for (let cy = Math.min(y1, y2); cy <= Math.max(y1, y2); cy++)
        if (!bodyClear(x1, cy)) return false;
      return true;
    }

    const step = dx > 0 ? 1 : -1;
    for (let ix = x1; ix !== x2 + step; ix += step) {
      const t  = (ix - x1) / dx;
      const iy = Math.round(y1 + t * (y2 - y1));
      if (!bodyClear(ix, iy)) return false;
    }
    return true;
  }

  /** @returns {[number,number][]} */
  _reconstruct(parent, goal) {
    const path = [];
    let node = goal;
    while (node !== null) {
      path.push(node);
      node = parent.get(this._key(node));
    }
    return path.reverse();
  }

  // -------------------------------------------------------------------------
  // Internal — path statistics
  // -------------------------------------------------------------------------

  _countJumps(path) {
    let n = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i], [x2, y2] = path[i + 1];
      if (y2 !== y1 || Math.abs(x2 - x1) > 1) n++;
    }
    return n;
  }

  _minLandingWidth(valid, path) {
    const W = valid[0].length;
    let minW = W;
    for (const [x, y] of path) {
      const row = valid[y];
      let lo = x, hi = x;
      while (lo > 0 && row[lo - 1]) lo--;
      while (hi < W - 1 && row[hi + 1]) hi++;
      minW = Math.min(minW, hi - lo + 1);
    }
    return minW;
  }

  // -------------------------------------------------------------------------
  // Internal — diagnostics
  // -------------------------------------------------------------------------

  _diagnose(grid, valid, start, goal) {
    // Full BFS to count reachable positions
    const visited = new Set([this._key(start)]);
    const queue   = [start];
    let   head    = 0;
    while (head < queue.length) {
      const p = queue[head++];
      for (const nxt of this._reachableFrom(grid, valid, p)) {
        const k = this._key(nxt);
        if (!visited.has(k)) { visited.add(k); queue.push(nxt); }
      }
    }

    const cfg = this.cfg;
    const [sx, sy] = start, [gx, gy] = goal;
    const msgs = [
      `GOAL [${goal}] unreachable from START [${start}]`,
      `${visited.size} valid position(s) reachable from START`,
    ];
    const hGap = Math.abs(gx - sx);
    const vUp  = sy - gy;
    const vDn  = gy - sy;
    if (hGap > cfg.maxJumpDistance)
      msgs.push(`Horizontal gap ~${hGap} > maxJumpDistance ${cfg.maxJumpDistance}`);
    if (vUp > cfg.maxJumpHeight)
      msgs.push(`Height gain ~${vUp} > maxJumpHeight ${cfg.maxJumpHeight}`);
    if (vDn > cfg.maxSafeDrop)
      msgs.push(`Drop ~${vDn} > maxSafeDrop ${cfg.maxSafeDrop}`);
    return msgs;
  }
}
