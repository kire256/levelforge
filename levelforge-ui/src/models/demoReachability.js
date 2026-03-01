/**
 * Demo / test runner for ReachabilityValidator.
 *
 * Three test cases (mirrors the Python demo exactly):
 *   1. Reachable    — player walks and jumps over a hazard gap.
 *   2. Unreachable  — solid wall bisects the level; GOAL isolated.
 *   3. Platform chain — player must hop up three stepped platforms.
 *
 * Node:
 *   node demoReachability.js
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { PlayerConfig, ReachabilityReport, ReachabilityValidator } from './reachability.js';

// ---------------------------------------------------------------------------
// Shared player config
// ---------------------------------------------------------------------------

const CFG = new PlayerConfig({
  height:          2,
  maxJumpHeight:   4,
  maxJumpDistance: 5,
  maxSafeDrop:     6,
});

// ---------------------------------------------------------------------------
// Level builders
// ---------------------------------------------------------------------------

function boundary(g) {
  g.applyRect(0,  0, 32,  1, Cell.SOLID);   // ceiling
  g.applyRect(0, 31, 32,  1, Cell.SOLID);   // floor
  g.applyRect(0,  0,  1, 32, Cell.SOLID);   // left wall
  g.applyRect(31, 0,  1, 32, Cell.SOLID);   // right wall
}

function buildHazardGap() {
  const g = new SemanticGrid32();
  boundary(g);
  g.applyRect(14, 30, 4, 1, Cell.HAZARD);  // spike strip
  g.set(2,  30, Cell.START);
  g.set(28, 30, Cell.GOAL);
  return g;
}

function buildWalledOff() {
  const g = buildHazardGap();
  g.applyRect(15, 1, 1, 30, Cell.SOLID);   // sealing wall
  return g;
}

function buildPlatformChain() {
  /** Three stepped platforms — each exactly max_jump_height=4 tiles above the previous. */
  const g = new SemanticGrid32();
  boundary(g);
  g.applyRect(5,  27, 6, 1, Cell.SOLID);   // platform A, feet land at y=26
  g.applyRect(13, 23, 6, 1, Cell.SOLID);   // platform B, feet land at y=22
  g.applyRect(21, 19, 6, 1, Cell.SOLID);   // platform C, feet land at y=18
  g.set(2,  30, Cell.START);
  g.set(25, 18, Cell.GOAL);
  return g;
}

// ---------------------------------------------------------------------------
// ASCII rendering
// ---------------------------------------------------------------------------

const FLAG_CHARS = [
  [Cell.SOLID,  '#'],
  [Cell.HAZARD, '^'],
  [Cell.ONEWAY, '='],
  [Cell.LADDER, 'H'],
  [Cell.GOAL,   'G'],
  [Cell.START,  'S'],
];

function renderGrid(grid, valid = null) {
  const { WIDTH, HEIGHT } = SemanticGrid32;
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const f = grid.get(x, y);
      const entry = FLAG_CHARS.find(([flag]) => f & flag);
      if (entry) return entry[1];
      if (valid) return valid[y][x] ? '+' : '.';
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
// Test runner
// ---------------------------------------------------------------------------

function runCase(name, grid, expectReachable, extraChecks = []) {
  console.log('\n' + '='.repeat(40));
  console.log(`  ${name}`);
  console.log('='.repeat(40));

  const v     = new ReachabilityValidator(CFG);
  const stand = v.computeStandableMask(grid);
  const clear = v.computeClearanceMask(grid);
  const { WIDTH, HEIGHT } = SemanticGrid32;
  const valid = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => stand[y][x] && clear[y][x])
  );

  console.log(renderGrid(grid, valid));
  const report = v.validate(grid);
  console.log(`\n  ${report}`);

  assert(report.reachable === expectReachable,
    `[${name}] expected reachable=${expectReachable}, got ${report.reachable}`);

  if (expectReachable) {
    assert(report.pathLength >= 2,
      `[${name}] pathLength ${report.pathLength} < 2`);
    assert(report.minLandingWidth >= 1,
      `[${name}] minLandingWidth ${report.minLandingWidth} < 1`);
  } else {
    assert(report.reasons.length > 0,
      `[${name}] unreachable report should contain reasons`);
  }

  for (const [check, expected, label] of extraChecks) {
    assert(check(report), `[${name}] ${label} (got ${expected})`);
  }

  return report;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAll() {
  console.log('=== ReachabilityValidator Demo ===');
  console.log(`PlayerConfig: height=${CFG.height}, ` +
    `jumpHeight=${CFG.maxJumpHeight}, jumpDist=${CFG.maxJumpDistance}, ` +
    `drop=${CFG.maxSafeDrop}`);
  console.log('\nLegend:  # solid  ^ hazard  = oneway  S start  G goal');
  console.log('         + valid standing position  . open air');

  runCase(
    'Case 1 - Hazard gap (REACHABLE)',
    buildHazardGap(),
    true,
    [[r => r.jumpCount >= 1, '>=1', 'jumpCount >= 1']],
  );

  runCase(
    'Case 2 - Walled off (UNREACHABLE)',
    buildWalledOff(),
    false,
  );

  runCase(
    'Case 3 - Platform chain (REACHABLE)',
    buildPlatformChain(),
    true,
    [[r => r.jumpCount >= 3, '>=3', 'jumpCount >= 3']],
  );

  console.log(`\nAssertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All checks passed.');
}

if (typeof process !== 'undefined' && process.argv[1] &&
    (await import('url')).fileURLToPath(import.meta.url) === process.argv[1]) {
  runAll();
}
