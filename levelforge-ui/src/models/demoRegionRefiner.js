/**
 * Demo / test runner for regionRefiner.js.
 *
 * Four test cases (mirrors demo_refine_region.py exactly):
 *   1. Basic refinement           -- same knobs, new seed inside rect
 *   2. Harder difficulty          -- difficultyDelta=+0.5, verticalityDelta=+0.4
 *   3. Secret platform            -- addSecret=true
 *   4. Smooth silhouette          -- smoothSilhouette=true
 *
 * Node:
 *   node demoRegionRefiner.js
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { MovementSpec, GeneratorKnobs, generateLevel } from './levelGenerator.js';
import { RefineRect, RefineRequest, RefineReport, refineRegion } from './regionRefiner.js';

// ---------------------------------------------------------------------------
// ASCII renderer
// ---------------------------------------------------------------------------

const FLAG_CHARS = [
  [Cell.SOLID,  '#'],
  [Cell.HAZARD, '^'],
  [Cell.ONEWAY, '='],
  [Cell.GOAL,   'G'],
  [Cell.START,  'S'],
];

function render(grid, rect = null) {
  const { WIDTH, HEIGHT } = SemanticGrid32;
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const f     = grid.get(x, y);
      const entry = FLAG_CHARS.find(([flag]) => f & flag);
      if (entry) return entry[1];
      if (rect && rect.onBoundary(x, y)) return ':';
      return '.';
    }).join('')
  ).join('\n');
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else       { failed++; console.error(`  FAIL  ${msg}`); }
}

// ---------------------------------------------------------------------------
// Outside-rect preservation check
// ---------------------------------------------------------------------------

function checkOutsidePreserved(orig, refined, rect, label) {
  const { WIDTH, HEIGHT } = SemanticGrid32;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!rect.contains(x, y)) {
        assert(
          orig.get(x, y) === refined.get(x, y),
          `[${label}] (${x},${y}) changed outside rect: ` +
          `${orig.get(x, y)} -> ${refined.get(x, y)}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAll() {
  const spec  = new MovementSpec({ maxJumpHeight: 4, maxJumpDistance: 5, maxSafeDrop: 6 });
  const knobs = new GeneratorKnobs({
    targetFootholdCount: 8,
    minFootholdWidth: 3, maxFootholdWidth: 6,
    verticality: 0.3, difficulty: 0.2,
  });

  console.log('Generating base level (seed=42)...');
  const base = generateLevel(42, knobs, spec);
  console.log(render(base.grid));
  console.log(`  attempts=${base.attempts}  seedUsed=${base.seedUsed}`);
  console.log(`  ${base.report}`);

  // Rect covering the middle section where footholds pass through.
  // x=7 aligns with the leftmost foothold that crosses that column in both
  // the Python and JS levels (different PRNGs produce different layouts).
  const rect = new RefineRect(7, 4, 16, 24);

  // ── Case 1: Basic refinement ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('  Case 1 - Basic refinement');
  console.log('='.repeat(40));

  const { newGrid: new1, report: rep1 } = refineRegion(
    base.grid, rect, new RefineRequest(), 100, knobs, spec
  );
  console.log(render(new1, rect));
  console.log(`\n  ${rep1}`);

  assert(rep1.success,
    'Case 1: refinement succeeded');
  assert(rep1.reachability && rep1.reachability.reachable,
    'Case 1: refined level reachable');
  assert(rep1.seamEntry !== null,
    'Case 1: entry seam detected');
  assert(rep1.seamExit  !== null,
    'Case 1: exit seam detected');
  assert(rep1.innerFootholds >= 2,
    `Case 1: ${rep1.innerFootholds} inner footholds >= 2`);
  checkOutsidePreserved(base.grid, new1, rect, 'Case 1');

  // Entry seam must remain standable
  if (rep1.seamEntry) {
    const [sx, sy] = rep1.seamEntry;
    if (sy + 1 < 32)
      assert(!!(new1.get(sx, sy + 1) & Cell.SOLID),
        `Case 1: entry seam floor (${sx},${sy+1}) is SOLID`);
    assert(!(new1.get(sx, sy) & Cell.SOLID),
      `Case 1: entry seam feet (${sx},${sy}) is clear`);
  }

  // ── Case 2: Higher difficulty and verticality ─────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('  Case 2 - Difficulty+0.5, Verticality+0.4');
  console.log('='.repeat(40));

  const { newGrid: new2, report: rep2 } = refineRegion(
    base.grid, rect,
    new RefineRequest({ difficultyDelta: 0.5, verticalityDelta: 0.4 }),
    200, knobs, spec
  );
  console.log(render(new2, rect));
  console.log(`\n  ${rep2}`);

  assert(rep2.success,
    'Case 2: hard refinement succeeded');
  assert(rep2.reachability?.reachable,
    'Case 2: hard refined level reachable');
  checkOutsidePreserved(base.grid, new2, rect, 'Case 2');

  // ── Case 3: Secret platform ───────────────────────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('  Case 3 - Secret platform');
  console.log('='.repeat(40));

  const { newGrid: new3, report: rep3 } = refineRegion(
    base.grid, rect,
    new RefineRequest({ addSecret: true }),
    300, knobs, spec
  );
  console.log(render(new3, rect));
  console.log(`\n  ${rep3}`);

  assert(rep3.success,
    'Case 3: secret refinement succeeded');
  assert(rep3.reachability?.reachable,
    'Case 3: secret level reachable');
  checkOutsidePreserved(base.grid, new3, rect, 'Case 3');

  const solidInside = (() => {
    let n = 0;
    for (let y = rect.y; y <= rect.bottom; y++)
      for (let x = rect.x; x <= rect.right; x++)
        if (new3.get(x, y) & Cell.SOLID) n++;
    return n;
  })();
  assert(solidInside > 0,
    `Case 3: ${solidInside} SOLID tiles inside rect`);

  // ── Case 4: Smooth silhouette ─────────────────────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('  Case 4 - Smooth silhouette');
  console.log('='.repeat(40));

  const { newGrid: new4, report: rep4 } = refineRegion(
    base.grid, rect,
    new RefineRequest({ smoothSilhouette: true }),
    400, knobs, spec
  );
  console.log(render(new4, rect));
  console.log(`\n  ${rep4}`);

  assert(rep4.success,
    'Case 4: smooth refinement succeeded');
  assert(rep4.reachability?.reachable,
    'Case 4: smooth level reachable');

  // No isolated spikes at top row of rect
  const topY = rect.y;
  for (let x = rect.x; x <= rect.right; x++) {
    if (new4.get(x, topY) & Cell.SOLID) {
      const leftSolid  = x > rect.x     && !!(new4.get(x - 1, topY) & Cell.SOLID);
      const rightSolid = x < rect.right && !!(new4.get(x + 1, topY) & Cell.SOLID);
      assert(leftSolid || rightSolid,
        `Case 4: isolated SOLID spike at (${x},${topY})`);
    }
  }

  // ── Determinism check ─────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('  Determinism check');
  console.log('='.repeat(40));

  const { newGrid: det1 } = refineRegion(
    base.grid, rect, new RefineRequest(), 42, knobs, spec
  );
  const { newGrid: det2 } = refineRegion(
    base.grid, rect, new RefineRequest(), 42, knobs, spec
  );
  assert(det1.equals(det2),
    'Determinism: same seed produces same refined grid');
  console.log('  Same seed -> same refined grid: OK');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nAssertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All checks passed.');
}

if (typeof process !== 'undefined' && process.argv[1] &&
    (await import('url')).fileURLToPath(import.meta.url) === process.argv[1]) {
  runAll();
}
