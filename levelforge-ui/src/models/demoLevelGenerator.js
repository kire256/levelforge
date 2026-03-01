/**
 * Demo / test runner for levelGenerator.js.
 *
 * Generates three levels with different knobs, prints ASCII output,
 * foothold tables, validation reports, and runs invariant checks.
 *
 * Node:
 *   node demoLevelGenerator.js
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { MovementSpec, GeneratorKnobs, generateLevel } from './levelGenerator.js';

// ---------------------------------------------------------------------------
// ASCII rendering
// ---------------------------------------------------------------------------

const FLAG_CHARS = [
  [Cell.SOLID,  '#'],
  [Cell.HAZARD, '^'],
  [Cell.ONEWAY, '='],
  [Cell.GOAL,   'G'],
  [Cell.START,  'S'],
];

function render(grid) {
  const { WIDTH, HEIGHT } = SemanticGrid32;
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const f = grid.get(x, y);
      return (FLAG_CHARS.find(([flag]) => f & flag) ?? [0, '.'])[1];
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
// Single case runner
// ---------------------------------------------------------------------------

function runCase(label, seed, knobs, spec) {
  console.log('\n' + '='.repeat(40));
  console.log(`  ${label}  (seed=${seed})`);
  console.log('='.repeat(40));

  const result = generateLevel(seed, knobs, spec);
  const fhs    = result.footholds;

  console.log(render(result.grid));

  console.log(`\n  Footholds (${fhs.length}):`);
  fhs.forEach((fh, i) => {
    const tag = i === 0 ? ' <-- START' : i === fhs.length - 1 ? ' <-- GOAL' : '';
    console.log(`    [${i}] x=${String(fh.x).padStart(2)}..${String(fh.right).padStart(2)}` +
                `  y=${String(fh.y).padStart(2)}  w=${fh.width}${tag}`);
  });

  console.log(`\n  ${result.report}`);
  console.log(`  attempts=${result.attempts}  seedUsed=${result.seedUsed}`);

  // Invariant checks
  assert(result.report.reachable,
    `[${label}] level must be reachable`);
  assert(fhs.length === knobs.targetFootholdCount,
    `[${label}] foothold count ${fhs.length} != ${knobs.targetFootholdCount}`);
  assert(fhs[0].x >= 2 && fhs[0].x <= 5,
    `[${label}] first foothold x=${fhs[0].x} not in [2,5]`);
  assert(fhs[fhs.length - 1].x >= 26,
    `[${label}] last foothold x=${fhs[fhs.length - 1].x} < 26`);
  assert(result.report.pathLength >= 2,
    `[${label}] pathLength ${result.report.pathLength} too short`);

  for (let i = 0; i < fhs.length; i++) {
    const fh = fhs[i];
    assert(fh.x >= 0 && fh.right <= 30,
      `[${label}] foothold ${i} x-range ${fh.x}..${fh.right} out of bounds`);
    assert(fh.y >= 2 && fh.y <= 29,
      `[${label}] foothold ${i} y=${fh.y} not in [2,29]`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAll() {
  const spec = new MovementSpec({ maxJumpHeight: 4, maxJumpDistance: 5, maxSafeDrop: 6 });

  runCase(
    'Easy flat',
    42,
    new GeneratorKnobs({ targetFootholdCount: 8, minFootholdWidth: 3, maxFootholdWidth: 6,
                          verticality: 0.2, difficulty: 0.1 }),
    spec,
  );

  runCase(
    'Medium',
    100,
    new GeneratorKnobs({ targetFootholdCount: 9, minFootholdWidth: 2, maxFootholdWidth: 5,
                          verticality: 0.5, difficulty: 0.4 }),
    spec,
  );

  runCase(
    'Hard vertical',
    777,
    new GeneratorKnobs({ targetFootholdCount: 10, minFootholdWidth: 2, maxFootholdWidth: 4,
                          verticality: 0.9, difficulty: 0.7 }),
    spec,
  );

  // Determinism check: same seed + knobs -> same grid
  const r1 = generateLevel(42, new GeneratorKnobs(), spec);
  const r2 = generateLevel(42, new GeneratorKnobs(), spec);
  assert(r1.grid.equals(r2.grid),   'determinism: same seed -> same grid');
  assert(r1.seedUsed === r2.seedUsed, 'determinism: same seedUsed');

  console.log(`\nAssertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All checks passed.');
}

if (typeof process !== 'undefined' && process.argv[1] &&
    (await import('url')).fileURLToPath(import.meta.url) === process.argv[1]) {
  runAll();
}
