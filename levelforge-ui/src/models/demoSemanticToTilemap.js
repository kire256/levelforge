/**
 * Demo / test runner for SemanticToTilemap.
 *
 * Node (ES module):
 *   node demoSemanticToTilemap.js
 */

import { Cell, SemanticGrid32 } from './semanticGrid.js';
import { TileIds, SemanticToTilemap, NEIGHBOR } from './semanticToTilemap.js';

// ---------------------------------------------------------------------------
// Tile ID config (same values as the Python demo for easy cross-checking)
// ---------------------------------------------------------------------------

const SOLID_VARIANTS = Object.fromEntries(
  Array.from({ length: 16 }, (_, mask) => [mask, 10 + mask])
);

const DEMO_TILE_IDS = new TileIds({
  solidBase:     10,
  solidVariants: SOLID_VARIANTS,
  oneway:        30,
  hazard:        31,
  ladder:        32,
  startMarker:   40,
  goalMarker:    41,
  empty:         0,
});

const DISPLAY = {
  0:  '.',
  ...Object.fromEntries(Object.values(SOLID_VARIANTS).map(v => [v, '#'])),
  30: '=',
  31: '^',
  32: 'H',
  40: 'S',
  41: 'G',
};

// ---------------------------------------------------------------------------
// Shared level layout
// ---------------------------------------------------------------------------

function buildLevel() {
  const g = new SemanticGrid32();
  g.applyRect(0,  0, 32,  1, Cell.SOLID);   // ceiling
  g.applyRect(0, 31, 32,  1, Cell.SOLID);   // floor
  g.applyRect(0,  0,  1, 32, Cell.SOLID);   // left wall
  g.applyRect(31, 0,  1, 32, Cell.SOLID);   // right wall
  g.applyRect(5,  24, 8,  1, Cell.ONEWAY);
  g.applyRect(18, 18, 8,  1, Cell.ONEWAY);
  g.applyRect(14, 30, 4,  1, Cell.HAZARD);
  g.applyRect(10, 24, 1,  7, Cell.LADDER);
  g.set(2,  30, Cell.START);
  g.set(29, 30, Cell.GOAL);
  return g;
}

// ---------------------------------------------------------------------------
// ASCII render helpers
// ---------------------------------------------------------------------------

function renderSemantic(grid) {
  const flagChars = [
    [Cell.SOLID,  '#'],
    [Cell.HAZARD, '^'],
    [Cell.ONEWAY, '='],
    [Cell.LADDER, 'H'],
    [Cell.GOAL,   'G'],
    [Cell.START,  'S'],
  ];
  const { WIDTH, HEIGHT } = SemanticGrid32;
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const f = grid.get(x, y);
      return (flagChars.find(([flag]) => f & flag) ?? [0, '.'])[1];
    }).join('')
  ).join('\n');
}

function renderTilemap(tiles, display) {
  return tiles.map(row =>
    row.map(id => display[id] ?? '?').join('')
  ).join('\n');
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; }
  else           { failed++; console.error(`  FAIL  ${msg}`); }
}

// ---------------------------------------------------------------------------
// Demo 1 — flat solid (no autotile)
// ---------------------------------------------------------------------------

function demoFlat() {
  console.log('─'.repeat(34));
  console.log('Demo 1 — flat solid (no autotile)');
  console.log('─'.repeat(34));

  const ids = new TileIds({ solidBase: 1, oneway: 30, hazard: 31,
                             ladder: 32, startMarker: 40, goalMarker: 41, empty: 0 });
  const display = { 0: '.', 1: '#', 30: '=', 31: '^', 32: 'H', 40: 'S', 41: 'G' };

  const grid   = buildLevel();
  const mapper = new SemanticToTilemap(ids);
  const tiles  = mapper.convert(grid);

  console.log('\nSemantic grid:');
  console.log(renderSemantic(grid));
  console.log('\nTile grid:');
  console.log(renderTilemap(tiles, display));

  assert(tiles[31][0]  === 1,  'wall+floor corner → solidBase');
  assert(tiles[30][2]  === 40, 'START → startMarker');
  assert(tiles[30][29] === 41, 'GOAL  → goalMarker');
  assert(tiles[30][14] === 31, 'hazard → hazard tile');
  assert(tiles[24][5]  === 30, 'oneway → oneway tile');
  assert(tiles[24][10] === 32, 'ladder → ladder tile');
  assert(tiles[15][15] === 0,  'empty interior → 0');
}

// ---------------------------------------------------------------------------
// Demo 2 — 4-neighbor autotile
// ---------------------------------------------------------------------------

function demoAutotile() {
  console.log('\n' + '─'.repeat(34));
  console.log('Demo 2 — autotile (solidVariants)');
  console.log('─'.repeat(34));

  const grid   = buildLevel();
  const mapper = new SemanticToTilemap(DEMO_TILE_IDS);
  const tiles  = mapper.convert(grid);

  console.log('\nTile grid:');
  console.log(renderTilemap(tiles, DISPLAY));

  console.log('\nAutotile bitmask samples:');
  console.log(`  ${'cell'.padStart(8)}  ${'mask'.padStart(10)}  ${'tile_id'.padStart(8)}  desc`);
  console.log(`  ${'────'.padStart(8)}  ${'──────────'.padStart(10)}  ${'───────'.padStart(8)}  ────`);

  const samples = [
    [0,  0,  'top-left corner (wall∩ceiling)'],
    [1,  0,  'ceiling interior'],
    [0,  1,  'left wall interior'],
    [0,  31, 'bottom-left corner (wall∩floor)'],
    [5,  31, 'floor top (E+S+W solid)'],
    [15, 31, 'floor top (E+S+W solid)'],
  ];
  for (const [x, y, desc] of samples) {
    const mask = mapper.neighborMask(grid, x, y);
    const tile = tiles[y][x];
    const flags =
      (mask & NEIGHBOR.N ? 'N' : '_') +
      (mask & NEIGHBOR.E ? 'E' : '_') +
      (mask & NEIGHBOR.S ? 'S' : '_') +
      (mask & NEIGHBOR.W ? 'W' : '_');
    console.log(`  (${String(x).padStart(2)},${String(y).padStart(2)})      ${flags}=${String(mask).padStart(2)}   tile=${String(tile).padStart(3)}   ${desc}`);
  }

  // All solid cells must land in the variant range 10–25
  const { WIDTH, HEIGHT } = SemanticGrid32;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (grid.get(x, y) & Cell.SOLID) {
        assert(tiles[y][x] >= 10 && tiles[y][x] <= 25,
          `(${x},${y}) solid tile ${tiles[y][x]} not in range 10–25`);
      }
    }
  }

  // Floor cell (5,31): N=empty, E=solid, S=OOB, W=solid → mask=E|S|W=14 → tile=24
  const mask531 = mapper.neighborMask(grid, 5, 31);
  assert(mask531 === (NEIGHBOR.E | NEIGHBOR.S | NEIGHBOR.W),
    `floor (5,31) mask = ${mask531} (expected _ESW = 14)`);
  assert(tiles[31][5] === 24, 'floor (5,31) → tile 24');

  // Top-left corner (0,0): all neighbors OOB → mask=15 → tile=25
  const mask00 = mapper.neighborMask(grid, 0, 0);
  assert(mask00 === 15, `corner (0,0) mask = ${mask00} (expected 15)`);
  assert(tiles[0][0] === 25, 'top-left corner → tile 25 (interior)');

  assert(tiles[15][15] === 0,  'empty interior (15,15) -> 0');
  assert(tiles[30][2]  === 40, 'START → startMarker');
  assert(tiles[30][29] === 41, 'GOAL  → goalMarker');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAll() {
  console.log('=== SemanticToTilemap Demo ===\n');
  demoFlat();
  demoAutotile();
  console.log(`\nAssertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All checks passed.');
}

if (typeof process !== 'undefined' && process.argv[1] &&
    (await import('url')).fileURLToPath(import.meta.url) === process.argv[1]) {
  runAll();
}
