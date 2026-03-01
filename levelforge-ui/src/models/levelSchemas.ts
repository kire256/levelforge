/**
 * levelSchemas.ts
 *
 * TypeScript types and JSON Schema (draft-2020-12) objects for the two
 * primary AI-facing data structures:
 *
 *   LevelPlan     — initial procedural-generation knobs
 *   RefineRequest — region-limited in-place refinement request
 *
 * Usage:
 *   import type { LevelPlan, RefineRequest } from './levelSchemas';
 *   import { LEVEL_PLAN_SCHEMA, REFINE_REQUEST_SCHEMA } from './levelSchemas';
 */

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

/**
 * Initial knobs passed to the procedural level generator.
 * Every field maps 1-to-1 to a GeneratorKnobs / MovementSpec parameter.
 */
export interface LevelPlan {
  /** PRNG seed for deterministic generation. Integer ≥ 0. */
  seed: number;

  /**
   * Overall difficulty. Controls jump gap width and hazard placement.
   * Range: 0.0 (easiest) – 1.0 (hardest).
   */
  difficulty: number;

  /**
   * Vertical spread preference.
   * Range: 0.0 (all footholds near the same row) – 1.0 (tower layout).
   */
  verticality: number;

  /**
   * Fraction of open cells that become hazard tiles (spikes / lava pits).
   * Range: 0.0 – 1.0.
   */
  hazardDensity: number;

  /**
   * Number of foothold platforms to generate.
   * Integer in [4, 16]. First = START, last = GOAL.
   */
  targetFootholdCount: number;

  /** Whether LADDER tiles may appear in this level. */
  allowLadders: boolean;

  /**
   * Thematic tags for tileset / decoration selection (future use).
   * Each tag: lowercase letters, digits, hyphens, or underscores.
   * Examples: ["cave", "lava"], ["jungle", "ruins", "overgrown"].
   */
  styleTags: string[];
}

/** Axis-aligned rectangle within the 32×32 semantic grid. */
export interface RefineRect {
  /** Left column, inclusive. Integer 0–31. */
  x: number;
  /** Top row, inclusive. Integer 0–31. */
  y: number;
  /** Width in columns. Integer 1–32. */
  w: number;
  /** Height in rows. Integer 1–32. */
  h: number;
}

/**
 * Parameters for region-limited in-place level refinement.
 * The refiner clears the rect, regenerates footholds that bridge the
 * entry/exit seams, then validates full-level reachability.
 */
export interface RefineRequest {
  /** The rectangular region to regenerate (32×32 grid coordinates). */
  rect: RefineRect;

  /**
   * Signed difficulty adjustment on top of the base level's knobs.
   * The sum (base.difficulty + difficultyDelta) is clamped to [0, 1].
   * Range: −1.0 – +1.0. Use 0 for no change.
   */
  difficultyDelta: number;

  /**
   * Signed verticality adjustment. Same clamping rules as difficultyDelta.
   * Range: −1.0 – +1.0. Use 0 for no change.
   */
  verticalityDelta: number;

  /**
   * If true, place an extra hidden platform reachable only via a
   * non-obvious jump — not on the critical START→GOAL path.
   */
  addSecret: boolean;

  /**
   * If true, remove isolated single-tile SOLID protrusions at the top
   * edge of the rect after generation (cosmetic silhouette smoothing).
   */
  smoothSilhouette: boolean;

  /**
   * If true, the BFS-validated traversal path through the rect is
   * preserved: the refiner locks entry and exit seam tiles and only
   * regenerates the footholds that bridge them.
   * Setting false allows the refiner to find entirely new seam positions.
   */
  keepMainPathStable: boolean;
}

// ---------------------------------------------------------------------------
// JSON Schema (draft-2020-12)
// ---------------------------------------------------------------------------

/** Inline rect schema (no top-level $schema/$id — used as a sub-schema). */
const _RECT_PROPS = {
  type: 'object' as const,
  required: ['x', 'y', 'w', 'h'],
  additionalProperties: false,
  description: 'Axis-aligned rectangle within the 32×32 grid.',
  properties: {
    x: { type: 'integer' as const, minimum: 0,  maximum: 31, description: 'Left column (inclusive).'  },
    y: { type: 'integer' as const, minimum: 0,  maximum: 31, description: 'Top row (inclusive).'      },
    w: { type: 'integer' as const, minimum: 1,  maximum: 32, description: 'Width in columns.'         },
    h: { type: 'integer' as const, minimum: 1,  maximum: 32, description: 'Height in rows.'           },
  },
};

export const LEVEL_PLAN_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id:     'https://levelforge/schemas/level-plan.json',
  title:   'LevelPlan',
  description: 'Initial knobs for procedural level generation.',
  type: 'object' as const,
  required: [
    'seed', 'difficulty', 'verticality', 'hazardDensity',
    'targetFootholdCount', 'allowLadders', 'styleTags',
  ],
  additionalProperties: false,
  properties: {
    seed: {
      type: 'integer' as const,
      minimum: 0,
      description: 'PRNG seed. Integer ≥ 0.',
    },
    difficulty: {
      type: 'number' as const,
      minimum: 0.0,
      maximum: 1.0,
      description: 'Overall difficulty. 0 = easiest, 1 = hardest.',
    },
    verticality: {
      type: 'number' as const,
      minimum: 0.0,
      maximum: 1.0,
      description: 'Vertical spread. 0 = flat layout, 1 = tower.',
    },
    hazardDensity: {
      type: 'number' as const,
      minimum: 0.0,
      maximum: 1.0,
      description: 'Fraction of open cells converted to hazard tiles.',
    },
    targetFootholdCount: {
      type: 'integer' as const,
      minimum: 4,
      maximum: 16,
      description: 'Number of foothold platforms to place (includes START and GOAL).',
    },
    allowLadders: {
      type: 'boolean' as const,
      description: 'Whether LADDER tiles may appear.',
    },
    styleTags: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        minLength: 1,
        maxLength: 24,
        pattern: '^[a-z][a-z0-9_-]*$',
      },
      maxItems: 8,
      uniqueItems: true,
      description: 'Thematic tags for tileset/decoration (future use). E.g. ["cave","lava"].',
    },
  },
} as const;

export const REFINE_REQUEST_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id:     'https://levelforge/schemas/refine-request.json',
  title:   'RefineRequest',
  description: 'Parameters for region-limited in-place level refinement.',
  type: 'object' as const,
  required: [
    'rect', 'difficultyDelta', 'verticalityDelta',
    'addSecret', 'smoothSilhouette', 'keepMainPathStable',
  ],
  additionalProperties: false,
  properties: {
    rect: _RECT_PROPS,
    difficultyDelta: {
      type: 'number' as const,
      minimum: -1.0,
      maximum:  1.0,
      description: 'Signed difficulty adjustment. 0 = no change.',
    },
    verticalityDelta: {
      type: 'number' as const,
      minimum: -1.0,
      maximum:  1.0,
      description: 'Signed verticality adjustment. 0 = no change.',
    },
    addSecret: {
      type: 'boolean' as const,
      description: 'Add a hidden off-critical-path secret platform.',
    },
    smoothSilhouette: {
      type: 'boolean' as const,
      description: 'Remove isolated SOLID spikes at the top edge of the rect.',
    },
    keepMainPathStable: {
      type: 'boolean' as const,
      description: 'Lock seam tiles; only regenerate bridging footholds.',
    },
  },
} as const;
