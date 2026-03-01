/**
 * Main-path level generator using footholds.
 *
 * A Foothold { x, y, width } is a standable platform segment:
 *   x          — left edge column
 *   y          — player's feet row (player stands here)
 *   surface_y  — y + 1  (the SOLID tile)
 *   clearance  — rows y and y-1 must not be SOLID (for playerHeight=2)
 *
 * Generation algorithm
 * ────────────────────
 * 1. Place first foothold near left edge, y ≈ grid-centre.
 * 2. Iteratively pick next foothold guaranteeing forward x-progress.
 *    dx and dy are constrained by MovementSpec.
 * 3. Reject candidates whose surfaces would land in an existing foothold's
 *    clearance zone (and vice-versa).
 * 4. Convert to SemanticGrid32 and validate with ReachabilityValidator.
 * 5. Retry up to MAX_RETRIES times (seed + attempt).
 *
 * RNG: deterministic mulberry32 PRNG seeded per attempt.
 * Note: Python and JS produce different sequences for the same numeric seed
 * because they use different PRNGs; both are independently deterministic.
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { PlayerConfig, ReachabilityValidator } from './reachability.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W             = SemanticGrid32.WIDTH;    // 32
const H             = SemanticGrid32.HEIGHT;   // 32
const PLAYER_HEIGHT = 2;
const MAX_RETRIES   = 40;
const MAX_STEP_TRIES = 50;
const GOAL_X_MIN    = 26;

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// ---------------------------------------------------------------------------

class SeededRng {
  /** @param {number} seed  integer */
  constructor(seed) {
    this._s = (seed | 0) >>> 0;
    // Warm up so seed=0 doesn't produce all-zeros early
    this._next(); this._next();
  }

  _next() {
    this._s = (this._s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  randInt(min, max) {
    return min + Math.floor(this._next() * (max - min + 1));
  }
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export class Foothold {
  /**
   * @param {number} x     left edge column
   * @param {number} y     player feet row
   * @param {number} width tile-column span
   */
  constructor(x, y, width) {
    this.x     = x;
    this.y     = y;
    this.width = width;
  }

  get surfaceY()  { return this.y + 1; }
  get right()     { return this.x + this.width - 1; }

  /** @yields {number} */
  *xCols() {
    for (let c = this.x; c < this.x + this.width; c++) yield c;
  }

  /** Rows that must stay SOLID-free for a standing player. */
  clearanceRows() {
    return { start: this.y - PLAYER_HEIGHT + 1, end: this.y };   // inclusive
  }
}

export class MovementSpec {
  constructor({ maxJumpHeight = 4, maxJumpDistance = 5, maxSafeDrop = 6 } = {}) {
    this.maxJumpHeight   = maxJumpHeight;
    this.maxJumpDistance = maxJumpDistance;
    this.maxSafeDrop     = maxSafeDrop;
  }
}

export class GeneratorKnobs {
  constructor({
    targetFootholdCount = 8,
    minFootholdWidth    = 2,
    maxFootholdWidth    = 6,
    verticality         = 0.5,
    difficulty          = 0.3,
  } = {}) {
    this.targetFootholdCount = targetFootholdCount;
    this.minFootholdWidth    = minFootholdWidth;
    this.maxFootholdWidth    = maxFootholdWidth;
    this.verticality         = verticality;
    this.difficulty          = difficulty;
  }
}

export class GenerationResult {
  constructor(grid, footholds, report, seedUsed, attempts) {
    this.grid      = grid;
    this.footholds = footholds;
    this.report    = report;
    this.seedUsed  = seedUsed;
    this.attempts  = attempts;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // Check column overlap
    let overlap = false;
    for (const c of newXSet) { if (fhXSet.has(c)) { overlap = true; break; } }
    if (!overlap) continue;

    const fhClr = fh.clearanceRows();

    // New surface row vs existing clearance
    if (fhClr.start <= newFh.surfaceY && newFh.surfaceY <= fhClr.end) return false;

    // Existing surface row vs new clearance
    if (newClr.start <= fh.surfaceY && fh.surfaceY <= newClr.end) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Foothold sequence generator
// ---------------------------------------------------------------------------

function _generateFootholds(rng, knobs, spec) {
  const N = knobs.targetFootholdCount;

  // ── First foothold ─────────────────────────────────────────────────────
  const midY   = Math.floor(H / 2);
  const yLo    = Math.max(PLAYER_HEIGHT, midY - 5);
  const yHi    = Math.min(H - 3,         midY + 5);
  const firstY = rng.randInt(yLo, yHi);
  const firstX = rng.randInt(2, 5);
  const firstW = Math.max(
    knobs.minFootholdWidth,
    Math.min(
      rng.randInt(knobs.minFootholdWidth, knobs.maxFootholdWidth),
      W - 2 - firstX,
    ),
  );
  const footholds = [new Foothold(firstX, firstY, firstW)];

  // ── Subsequent footholds ────────────────────────────────────────────────
  for (let i = 1; i < N; i++) {
    const prev   = footholds[footholds.length - 1];
    const isLast = i === N - 1;

    const progMin  = _minDxForProgress(prev.x, N - i, GOAL_X_MIN, spec.maxJumpDistance);
    const diffMin  = Math.round(spec.maxJumpDistance * 0.25 * knobs.difficulty);
    const minDx    = Math.min(Math.max(progMin, diffMin, 1), spec.maxJumpDistance);

    const maxUp   = Math.max(0, Math.round(spec.maxJumpHeight * knobs.verticality));
    const maxDown = Math.max(0, Math.round(spec.maxSafeDrop   * knobs.verticality));
    const effMaxW = Math.max(
      knobs.minFootholdWidth,
      knobs.maxFootholdWidth - Math.round(
        knobs.difficulty * (knobs.maxFootholdWidth - knobs.minFootholdWidth)
      ),
    );

    let placed = false;
    for (let t = 0; t < MAX_STEP_TRIES; t++) {
      const dx    = rng.randInt(minDx, spec.maxJumpDistance);
      const dy    = (maxUp + maxDown > 0) ? rng.randInt(-maxUp, maxDown) : 0;
      const w     = rng.randInt(knobs.minFootholdWidth, effMaxW);
      const newX  = prev.x + dx;
      const newY  = prev.y + dy;

      if (newX < 1 || newX + w - 1 > W - 2)   continue;
      if (newY < PLAYER_HEIGHT)                 continue;
      if (newY + 1 > H - 2)                    continue;
      if (isLast && newX < GOAL_X_MIN)          continue;

      const cand = new Foothold(newX, newY, w);
      if (!_clearanceOk(footholds, cand))       continue;

      footholds.push(cand);
      placed = true;
      break;
    }

    if (!placed) return null;
  }

  return footholds;
}

// ---------------------------------------------------------------------------
// Grid builder
// ---------------------------------------------------------------------------

export function footholdsToGrid(footholds, playerHeight = PLAYER_HEIGHT) {
  const grid = new SemanticGrid32();

  // Phase 1 — safety floor
  grid.applyRect(0, H - 1, W, 1, Cell.SOLID);

  // Phase 2 — surfaces
  const surfaceCells = new Set();
  for (const fh of footholds) {
    for (const x of fh.xCols()) {
      if (x >= 0 && x < W && fh.surfaceY >= 0 && fh.surfaceY < H) {
        grid.addFlags(x, fh.surfaceY, Cell.SOLID);
        surfaceCells.add(`${x},${fh.surfaceY}`);
      }
    }
  }

  // Phase 3 — clearance
  for (const fh of footholds) {
    const clr = fh.clearanceRows();
    for (const x of fh.xCols()) {
      for (let row = clr.start; row <= clr.end; row++) {
        if (row >= 0 && row < H && !surfaceCells.has(`${x},${row}`)) {
          grid.removeFlags(x, row, Cell.SOLID);
        }
      }
    }
  }

  // Phase 4 — markers
  const first = footholds[0];
  const last  = footholds[footholds.length - 1];
  grid.set(first.x + Math.floor(first.width / 2), first.y, Cell.START);
  grid.set(last.x  + Math.floor(last.width  / 2), last.y,  Cell.GOAL);

  return grid;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate a valid, traversable 32x32 level.
 *
 * @param {number}          seed
 * @param {GeneratorKnobs}  [knobs]
 * @param {MovementSpec}    [spec]
 * @returns {GenerationResult}
 * @throws {Error} if all retry attempts fail
 */
export function generateLevel(seed, knobs = new GeneratorKnobs(),
                               spec = new MovementSpec()) {
  const cfg = new PlayerConfig({
    height:          PLAYER_HEIGHT,
    maxJumpHeight:   spec.maxJumpHeight,
    maxJumpDistance: spec.maxJumpDistance,
    maxSafeDrop:     spec.maxSafeDrop,
  });
  const validator = new ReachabilityValidator(cfg);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const rng       = new SeededRng(seed + attempt);
    const footholds = _generateFootholds(rng, knobs, spec);
    if (!footholds) continue;

    const grid   = footholdsToGrid(footholds);
    const report = validator.validate(grid);
    if (report.reachable) {
      return new GenerationResult(grid, footholds, report, seed + attempt, attempt + 1);
    }
  }

  throw new Error(
    `Level generation failed after ${MAX_RETRIES} attempts (seed=${seed})`
  );
}
