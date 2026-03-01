/**
 * Demo / unit-test runner for SemanticGrid32.
 *
 * Run with Node.js (ES module mode):
 *   node --input-type=module < demoSemanticGrid.js
 *
 * Or import and call runAll() from any JS environment that supports ES modules.
 * Uses only built-in globals (btoa/atob available in Node 16+ and all browsers).
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL  ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

function testBasicSetGet() {
  console.log('\n[testBasicSetGet]');
  const g = new SemanticGrid32();
  g.set(0, 0, Cell.SOLID);
  assert(g.get(0, 0) === Cell.SOLID, 'get returns SOLID after set');
  assert(g.get(1, 0) === Cell.EMPTY, 'adjacent cell is still EMPTY');
}

function testAddRemoveFlags() {
  console.log('\n[testAddRemoveFlags]');
  const g = new SemanticGrid32();
  g.set(5, 5, Cell.SOLID);
  g.addFlags(5, 5, Cell.HAZARD);
  assert(g.get(5, 5) === (Cell.SOLID | Cell.HAZARD), 'addFlags ORs correctly');
  g.removeFlags(5, 5, Cell.SOLID);
  assert(g.get(5, 5) === Cell.HAZARD, 'removeFlags clears only the specified flag');
}

function testFillAndClear() {
  console.log('\n[testFillAndClear]');
  const g = new SemanticGrid32();
  g.fill(Cell.SOLID);
  assert(g.get(15, 15) === Cell.SOLID, 'fill sets every cell');
  g.clear();
  assert(g.get(15, 15) === Cell.EMPTY, 'clear zeros every cell');
}

function testCopy() {
  console.log('\n[testCopy]');
  const g = new SemanticGrid32();
  g.set(3, 3, Cell.LADDER);
  const h = g.copy();
  assert(g.equals(h), 'copy is equal to original');
  h.set(3, 3, Cell.GOAL);
  assert(g.get(3, 3) === Cell.LADDER, 'original not mutated by copy modification');
}

function testApplyRectModes() {
  console.log('\n[testApplyRectModes]');
  const g = new SemanticGrid32();

  // overwrite
  g.applyRect(0, 31, 32, 1, Cell.SOLID);
  assert(g.get(0,  31) === Cell.SOLID, 'applyRect overwrite: leftmost cell');
  assert(g.get(31, 31) === Cell.SOLID, 'applyRect overwrite: rightmost cell');
  assert(g.get(0,  30) === Cell.EMPTY, 'applyRect overwrite: row above untouched');

  // add
  g.applyRect(0, 31, 4, 1, Cell.HAZARD, 'add');
  assert(g.get(0, 31) === (Cell.SOLID | Cell.HAZARD), 'applyRect add: merges HAZARD into SOLID');
  assert(g.get(4, 31) === Cell.SOLID,                 'applyRect add: cell outside rect unchanged');

  // remove
  g.applyRect(0, 31, 4, 1, Cell.HAZARD, 'remove');
  assert(g.get(0, 31) === Cell.SOLID, 'applyRect remove: strips HAZARD');

  // out-of-bounds clipping (should not throw)
  g.applyRect(30, 30, 10, 10, Cell.GOAL);
  assert(g.get(31, 31) === Cell.GOAL, 'applyRect clips to boundary: corner cell set');
}

function testBoundsError() {
  console.log('\n[testBoundsError]');
  const g = new SemanticGrid32();

  try {
    g.get(32, 0);
    assert(false, 'get(32,0) should throw RangeError');
  } catch (e) {
    assert(e instanceof RangeError, 'get(32,0) throws RangeError as expected');
  }

  try {
    g.set(-1, 0, Cell.SOLID);
    assert(false, 'set(-1,0) should throw RangeError');
  } catch (e) {
    assert(e instanceof RangeError, 'set(-1,0) throws RangeError as expected');
  }
}

function testSerializationRoundtrip() {
  console.log('\n[testSerializationRoundtrip]');
  const g = new SemanticGrid32();

  // Build a representative level layout
  g.applyRect(0, 31, 32, 1, Cell.SOLID);           // solid floor
  g.set(1,  30, Cell.START);                        // player spawn
  g.set(30, 30, Cell.GOAL);                         // level exit
  g.applyRect(10, 25, 5, 1, Cell.ONEWAY);          // one-way platform
  g.set(15, 20, Cell.LADDER);                       // climbable tile
  g.set(20, 29, Cell.HAZARD);                       // spike

  const data = g.toJSON();
  assert(data.width  === 32,           'toJSON has width=32');
  assert(data.height === 32,           'toJSON has height=32');
  assert(typeof data.cells === 'string', 'toJSON has cells string');

  const jsonStr = JSON.stringify(data);
  const loaded  = SemanticGrid32.fromJSON(JSON.parse(jsonStr));

  assert(g.equals(loaded),                                'roundtrip: grid equality');
  assert(loaded.get(0,  31) === Cell.SOLID,               'roundtrip: floor solid');
  assert(loaded.get(1,  30) === Cell.START,               'roundtrip: START preserved');
  assert(loaded.get(30, 30) === Cell.GOAL,                'roundtrip: GOAL preserved');
  assert(loaded.get(10, 25) === Cell.ONEWAY,              'roundtrip: ONEWAY platform');
  assert(loaded.get(15, 20) === Cell.LADDER,              'roundtrip: LADDER');
  assert(loaded.get(20, 29) === Cell.HAZARD,              'roundtrip: HAZARD');
  assert(loaded.get(15, 15) === Cell.EMPTY,               'roundtrip: empty interior cell');

  console.log(`  JSON payload size: ${jsonStr.length} bytes`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAll() {
  console.log('=== SemanticGrid32 Demo ===');
  testBasicSetGet();
  testAddRemoveFlags();
  testFillAndClear();
  testCopy();
  testApplyRectModes();
  testBoundsError();
  testSerializationRoundtrip();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All tests passed.');
}

// Auto-run when executed directly (Node detects this via import.meta.url)
if (typeof process !== 'undefined' && process.argv[1] &&
    (await import('url')).fileURLToPath(import.meta.url) === process.argv[1]) {
  runAll();
}
