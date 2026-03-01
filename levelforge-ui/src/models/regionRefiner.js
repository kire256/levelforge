/**
 * regionRefiner.js
 * ─────────────────
 * Region-limited level refinement for SemanticGrid32.
 *
 * API
 * ---
 *   refineRegion(grid, rect, request, seed, knobs?, spec?)
 *   -> { newGrid: SemanticGrid32, report: RefineReport }
 *
 * Algorithm
 * ---------
 * 1. Validate the original grid; abort if unreachable.
 * 2. BFS from START to detect entry (left boundary) and exit (right boundary)
 *    seam points — standable rect-boundary cells on the reachable set.
 * 3. Apply difficultyDelta / verticalityDelta to a copy of knobs.
 * 4. Clear rect interior, regenerate inner footholds entry→exit, optionally
 *    add a secret platform or smooth the top-edge silhouette.
 * 5. Validate full-grid reachability.  Retry up to MAX_INNER_RETRIES.
 *
 * See refine_region.py for full docstrings and design notes.
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { PlayerConfig, ReachabilityValidator } from './reachability.js';
import { Foothold, MovementSpec, GeneratorKnobs } from './levelGenerator.js';

const W               = SemanticGrid32.WIDTH;    // 32
const H               = SemanticGrid32.HEIGHT;   // 32
const PLAYER_HEIGHT   = 2;
const MAX_STEP_TRIES  = 50;
const MAX_INNER_RETRIES = 30;

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (mirrors SeededRng in levelGenerator.js)
// ---------------------------------------------------------------------------

class SeededRng {
  constructor(seed) {
    this._s = (seed | 0) >>> 0;
    this._next(); this._next();   // warm-up
  }
  _next() {
    this._s = (this._s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  randInt(min, max) {
    return min + Math.floor(this._next() * (max - min + 1));
  }
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export class RefineRect {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  get right()  { return this.x + this.w - 1; }
  get bottom() { return this.y + this.h - 1; }

  contains(cx, cy) {
    return cx >= this.x && cx <= this.right && cy >= this.y && cy <= this.bottom;
  }
  onBoundary(cx, cy) {
    if (!this.contains(cx, cy)) return false;
    return cx === this.x || cx === this.right || cy === this.y || cy === this.bottom;
  }
}

export class RefineRequest {
  constructor({
    difficultyDelta  = 0,
    verticalityDelta = 0,
    addSecret        = false,
    smoothSilhouette = false,
  } = {}) {
    this.difficultyDelta  = difficultyDelta;
    this.verticalityDelta = verticalityDelta;
    this.addSecret        = addSecret;
    this.smoothSilhouette = smoothSilhouette;
  }
}

export class RefineReport {
  constructor({ success, seamEntry = null, seamExit = null,
                innerFootholds = 0, reachability = null, reasons = [] }) {
    this.success        = success;
    this.seamEntry      = seamEntry;       // [x, y] or null
    this.seamExit       = seamExit;        // [x, y] or null
    this.innerFootholds = innerFootholds;
    this.reachability   = reachability;
    this.reasons        = reasons;
  }
  toString() {
    const ok    = this.success ? 'OK' : 'FAIL';
    const reach = this.reachability ? this.reachability.reachable : '?';
    const entry = this.seamEntry ? `[${this.seamEntry}]` : 'none';
    const exit_ = this.seamExit  ? `[${this.seamExit}]`  : 'none';
    return (`RefineReport(${ok} entry=${entry} exit=${exit_} ` +
            `inner=${this.innerFootholds} reachable=${reach})`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _findFlagPos(grid, flag) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (grid.get(x, y) & flag) return [x, y];
  return null;
}

function _linearCorridorOk(grid, x1, y1, x2, y2, playerHeight) {
  const dx    = x2 - x1;
  const dy    = y2 - y1;
  const steps = Math.max(Math.abs(dx), 1);
  for (let step = 1; step <= steps; step++) {
    const cx = x1 + Math.round(dx * step / steps);
    const cy = y1 + Math.round(dy * step / steps);
    for (let bodyRow = cy - playerHeight + 1; bodyRow <= cy; bodyRow++) {
      if (cx < 0 || cx >= W || bodyRow < 0 || bodyRow >= H) continue;
      if (grid.get(cx, bodyRow) & Cell.SOLID) return false;
    }
  }
  return true;
}

function _bfsReachable(grid, validSet, startPos, spec) {
  const startKey = `${startPos[0]},${startPos[1]}`;
  const visited  = new Set([startKey]);
  const queue    = [startPos];
  let   head     = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    for (let dx = -spec.maxJumpDistance; dx <= spec.maxJumpDistance; dx++) {
      for (let dy = -spec.maxJumpHeight; dy <= spec.maxSafeDrop; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx  = cx + dx;
        const ny  = cy + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key) || !validSet.has(key)) continue;
        if (_linearCorridorOk(grid, cx, cy, nx, ny, PLAYER_HEIGHT)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }
  }
  return visited;   // Set<"x,y">
}

function _findSeams(grid, rect, validator, spec) {
  const standable = validator.computeStandableMask(grid);
  const clearance = validator.computeClearanceMask(grid);
  const validSet  = new Set();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (standable[y][x] && clearance[y][x]) validSet.add(`${x},${y}`);

  const startPos = _findFlagPos(grid, Cell.START);
  if (!startPos || !validSet.has(`${startPos[0]},${startPos[1]}`))
    return [null, null];

  const reachable = _bfsReachable(grid, validSet, startPos, spec);
  const midY = Math.floor((rect.y + rect.bottom) / 2);

  const leftCands  = [];
  const rightCands = [];
  for (let y = rect.y; y <= rect.bottom; y++) {
    if (reachable.has(`${rect.x},${y}`))     leftCands.push([rect.x,     y]);
    if (reachable.has(`${rect.right},${y}`)) rightCands.push([rect.right, y]);
  }

  const closest = (cands) => cands.length === 0 ? null :
    cands.reduce((best, p) => Math.abs(p[1] - midY) < Math.abs(best[1] - midY) ? p : best);

  let seamEntry = closest(leftCands);
  let seamExit  = closest(rightCands);

  // Fallback: any reachable boundary cell
  if (!seamEntry || !seamExit) {
    const allCands = [...leftCands, ...rightCands];
    for (const gy of [rect.y, rect.bottom])
      for (let x = rect.x; x <= rect.right; x++)
        if (reachable.has(`${x},${gy}`)) allCands.push([x, gy]);
    allCands.sort((a, b) => a[0] - b[0]);
    if (!seamEntry && allCands.length > 0) seamEntry = allCands[0];
    if (!seamExit  && allCands.length > 0) seamExit  = allCands[allCands.length - 1];
  }

  return [seamEntry, seamExit];
}

function _applyDeltas(knobs, request) {
  return new GeneratorKnobs({
    targetFootholdCount: knobs.targetFootholdCount,
    minFootholdWidth:    knobs.minFootholdWidth,
    maxFootholdWidth:    knobs.maxFootholdWidth,
    verticality: Math.max(0, Math.min(1, knobs.verticality + request.verticalityDelta)),
    difficulty:  Math.max(0, Math.min(1, knobs.difficulty  + request.difficultyDelta)),
  });
}

// Re-implemented locally (not exported from levelGenerator.js)
function _minDxForProgress(currentX, stepsRemaining, targetX, maxDx) {
  const needed = targetX - currentX;
  if (needed <= 0 || stepsRemaining <= 0) return 1;
  return Math.max(1, Math.min(maxDx, Math.ceil(needed / stepsRemaining)));
}

function _clearanceOk(existing, newFh) {
  const newXSet = new Set(newFh.xCols());
  const newClr  = newFh.clearanceRows();
  for (const fh of existing) {
    const fhXSet = new Set(fh.xCols());
    let overlap = false;
    for (const c of newXSet) { if (fhXSet.has(c)) { overlap = true; break; } }
    if (!overlap) continue;
    const fhClr = fh.clearanceRows();
    if (fhClr.start <= newFh.surfaceY && newFh.surfaceY <= fhClr.end) return false;
    if (newClr.start <= fh.surfaceY   && fh.surfaceY   <= newClr.end) return false;
  }
  return true;
}

function _generateInnerFootholds(rng, knobs, spec, rect, entry, exitPoint) {
  const dxTotal = exitPoint[0] - entry[0];
  if (dxTotal <= 0) return null;

  const avgHop = Math.max(1, Math.floor((spec.maxJumpDistance + 1) / 2));
  const nInter = Math.max(0, Math.min(6, Math.floor(dxTotal / avgHop) - 1));

  // -- Entry foothold (left-aligned to seam) ---------------------------------
  const eW = Math.min(
    Math.max(knobs.minFootholdWidth,
             rng.randInt(knobs.minFootholdWidth, knobs.maxFootholdWidth)),
    rect.right - entry[0] + 1,
  );
  const footholds = [new Foothold(entry[0], entry[1], eW)];

  const maxUp   = Math.max(0, Math.round(spec.maxJumpHeight * knobs.verticality));
  const maxDown = Math.max(0, Math.round(spec.maxSafeDrop   * knobs.verticality));
  const effMaxW = Math.max(
    knobs.minFootholdWidth,
    knobs.maxFootholdWidth - Math.round(
      knobs.difficulty * (knobs.maxFootholdWidth - knobs.minFootholdWidth)
    ),
  );

  // -- Intermediate footholds ------------------------------------------------
  for (let step = 0; step < nInter; step++) {
    const prev      = footholds[footholds.length - 1];
    const stepsLeft = nInter - step + 1;
    const targetX   = exitPoint[0];

    const progMin = _minDxForProgress(prev.x, stepsLeft, targetX, spec.maxJumpDistance);
    const diffMin = Math.round(spec.maxJumpDistance * 0.25 * knobs.difficulty);
    const minDx   = Math.min(Math.max(progMin, diffMin, 1), spec.maxJumpDistance);

    let placed = false;
    for (let t = 0; t < MAX_STEP_TRIES; t++) {
      const maxDx = Math.min(spec.maxJumpDistance, targetX - prev.x - 1);
      if (maxDx < minDx) break;

      const dx  = rng.randInt(minDx, maxDx);
      const dy  = (maxUp + maxDown > 0) ? rng.randInt(-maxUp, maxDown) : 0;
      const w   = rng.randInt(knobs.minFootholdWidth, effMaxW);
      const nx  = prev.x + dx;
      const ny  = prev.y + dy;

      if (nx < rect.x || nx + w - 1 > rect.right) continue;
      if (ny < rect.y + PLAYER_HEIGHT)             continue;
      if (ny + 1 > rect.bottom)                    continue;

      const cand = new Foothold(nx, ny, w);
      if (!_clearanceOk(footholds, cand)) continue;

      footholds.push(cand);
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  // -- Exit foothold (right-aligned to seam) ---------------------------------
  const last = footholds[footholds.length - 1];
  const xWRaw = rng.randInt(knobs.minFootholdWidth, knobs.maxFootholdWidth);
  const xW    = Math.max(1, Math.min(xWRaw, exitPoint[0] - rect.x + 1));
  const exitX = exitPoint[0] - xW + 1;   // left edge

  const dyToExit   = exitPoint[1] - last.y;
  const minJumpDx  = Math.max(0, exitX - (last.x + last.width - 1));

  if (minJumpDx > spec.maxJumpDistance)              return null;
  if (dyToExit  > spec.maxSafeDrop)                  return null;
  if (dyToExit  < -spec.maxJumpHeight)               return null;

  const exitFh = new Foothold(exitX, exitPoint[1], xW);
  if (!_clearanceOk(footholds, exitFh))              return null;

  footholds.push(exitFh);
  return footholds;
}

function _clearRect(grid, rect) {
  for (let y = rect.y; y <= rect.bottom; y++)
    for (let x = rect.x; x <= rect.right; x++)
      grid.set(x, y, 0);
}

function _paintInnerFootholds(grid, footholds, rect) {
  const surfaceCells = new Set();

  // Phase 1: surfaces
  for (const fh of footholds) {
    const sy = fh.surfaceY;
    for (const x of fh.xCols()) {
      if (x >= rect.x && x <= rect.right && sy >= rect.y && sy <= rect.bottom) {
        grid.addFlags(x, sy, Cell.SOLID);
        surfaceCells.add(`${x},${sy}`);
      }
    }
  }

  // Phase 2: clearance
  for (const fh of footholds) {
    const clr = fh.clearanceRows();
    for (const x of fh.xCols()) {
      for (let row = clr.start; row <= clr.end; row++) {
        if (x >= rect.x && x <= rect.right && row >= rect.y && row <= rect.bottom) {
          if (!surfaceCells.has(`${x},${row}`)) {
            grid.removeFlags(x, row, Cell.SOLID);
          }
        }
      }
    }
  }
}

function _smoothSilhouette(grid, rect) {
  const topY = rect.y;
  for (let x = rect.x; x <= rect.right; x++) {
    if (!(grid.get(x, topY) & Cell.SOLID)) continue;
    const leftSolid  = x > rect.x     && !!(grid.get(x - 1, topY) & Cell.SOLID);
    const rightSolid = x < rect.right && !!(grid.get(x + 1, topY) & Cell.SOLID);
    if (!leftSolid && !rightSolid) grid.removeFlags(x, topY, Cell.SOLID);
  }
}

function _addSecret(grid, innerFootholds, rect, rng) {
  if (!innerFootholds.length) return;
  const baseFh = innerFootholds[rng.randInt(0, innerFootholds.length - 1)];
  for (let attempt = 0; attempt < 20; attempt++) {
    const sx = baseFh.x + rng.randInt(-1, 1);
    const sy = baseFh.y - rng.randInt(3, 5);   // well above base foothold
    const sw = rng.randInt(2, 3);
    if (sx < rect.x || sx + sw - 1 > rect.right)              continue;
    if (sy < rect.y + PLAYER_HEIGHT || sy + 1 > rect.bottom)  continue;

    const secret = new Foothold(sx, sy, sw);
    if (!_clearanceOk(innerFootholds, secret)) continue;

    // Paint surface
    for (const x of secret.xCols()) {
      if (x >= rect.x && x <= rect.right &&
          secret.surfaceY >= rect.y && secret.surfaceY <= rect.bottom) {
        grid.addFlags(x, secret.surfaceY, Cell.SOLID);
      }
    }
    // Clear headspace
    const clr = secret.clearanceRows();
    for (const x of secret.xCols()) {
      for (let row = clr.start; row <= clr.end; row++) {
        if (x >= rect.x && x <= rect.right && row >= rect.y && row <= rect.bottom)
          grid.removeFlags(x, row, Cell.SOLID);
      }
    }
    break;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Regenerate the interior of rect while preserving everything outside.
 *
 * @param {SemanticGrid32}  grid    — original (never modified)
 * @param {RefineRect}      rect    — region to replace
 * @param {RefineRequest}   request — refinement parameters
 * @param {number}          seed    — base RNG seed; retries use seed+attempt
 * @param {GeneratorKnobs}  [knobs]
 * @param {MovementSpec}    [spec]
 * @returns {{ newGrid: SemanticGrid32, report: RefineReport }}
 *   On failure, newGrid == grid.copy() so the caller always gets a valid grid.
 */
export function refineRegion(grid, rect, request, seed,
                              knobs = null, spec = null) {
  knobs = knobs ?? new GeneratorKnobs();
  spec  = spec  ?? new MovementSpec();

  const cfg = new PlayerConfig({
    height:          PLAYER_HEIGHT,
    maxJumpHeight:   spec.maxJumpHeight,
    maxJumpDistance: spec.maxJumpDistance,
    maxSafeDrop:     spec.maxSafeDrop,
  });
  const validator = new ReachabilityValidator(cfg);

  // 1. Validate original
  const origReport = validator.validate(grid);
  if (!origReport.reachable) {
    return {
      newGrid: grid.copy(),
      report:  new RefineReport({
        success:      false,
        reasons:      ['Original grid is not reachable'],
        reachability: origReport,
      }),
    };
  }

  // 2. Detect seams
  const [seamEntry, seamExit] = _findSeams(grid, rect, validator, spec);
  if (!seamEntry || !seamExit) {
    return {
      newGrid: grid.copy(),
      report:  new RefineReport({
        success:      false,
        seamEntry, seamExit,
        reasons:      ['Could not detect seam points on rect boundary'],
        reachability: origReport,
      }),
    };
  }

  // 3. Adjusted knobs
  const innerKnobs = _applyDeltas(knobs, request);

  // 4. Note if START/GOAL are inside rect (must be re-placed after clearing)
  const origStart   = _findFlagPos(grid, Cell.START);
  const origGoal    = _findFlagPos(grid, Cell.GOAL);
  const startInside = origStart && rect.contains(origStart[0], origStart[1]);
  const goalInside  = origGoal  && rect.contains(origGoal[0],  origGoal[1]);

  // 5. Retry loop
  for (let attempt = 0; attempt < MAX_INNER_RETRIES; attempt++) {
    const rng = new SeededRng(seed + attempt);

    const innerFhs = _generateInnerFootholds(
      rng, innerKnobs, spec, rect, seamEntry, seamExit
    );
    if (!innerFhs) continue;

    const newGrid = grid.copy();
    _clearRect(newGrid, rect);
    _paintInnerFootholds(newGrid, innerFhs, rect);

    if (startInside) {
      const fh = innerFhs[0];
      newGrid.set(fh.x + Math.floor(fh.width / 2), fh.y, Cell.START);
    }
    if (goalInside) {
      const fh = innerFhs[innerFhs.length - 1];
      newGrid.set(fh.x + Math.floor(fh.width / 2), fh.y, Cell.GOAL);
    }

    if (request.addSecret)        _addSecret(newGrid, innerFhs, rect, rng);
    if (request.smoothSilhouette) _smoothSilhouette(newGrid, rect);

    const report = validator.validate(newGrid);
    if (report.reachable) {
      return {
        newGrid,
        report: new RefineReport({
          success:        true,
          seamEntry,
          seamExit,
          innerFootholds: innerFhs.length,
          reachability:   report,
        }),
      };
    }
  }

  // All attempts exhausted
  return {
    newGrid: grid.copy(),
    report:  new RefineReport({
      success:      false,
      seamEntry, seamExit,
      reasons:      [`All ${MAX_INNER_RETRIES} refinement attempts failed`],
      reachability: origReport,
    }),
  };
}
