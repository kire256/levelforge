/**
 * llmPrompts.ts
 *
 * LLM prompt templates for AI-driven level design.
 *
 * Each builder returns a { system, user } pair ready for any chat-completion
 * API (OpenAI, Anthropic, etc.).  The system prompt embeds the full JSON
 * Schema so the model is constrained to output ONLY valid JSON — no prose,
 * no markdown fences, no explanation.
 *
 * Exports:
 *   buildLevelPlanPrompt(userRequest)          → { system, user }
 *   buildRefineRequestPrompt(userRequest, rect) → { system, user }
 *   EXAMPLE_LEVEL_PLAN                          (sample LevelPlan JSON)
 *   EXAMPLE_REFINE_REQUEST                      (sample RefineRequest JSON)
 */

import type { LevelPlan, RefineRequest, RefineRect } from './levelSchemas';
import { LEVEL_PLAN_SCHEMA, REFINE_REQUEST_SCHEMA } from './levelSchemas';

// ---------------------------------------------------------------------------
// Shared header injected into every system prompt
// ---------------------------------------------------------------------------

const STRICT_JSON_RULE = `\
You are a level-design assistant for a 2-D tile-based platformer.

STRICT OUTPUT RULES — read carefully:
1. Your response MUST be a single, valid JSON object. Nothing else.
2. Do NOT wrap the JSON in markdown code fences (\`\`\`json … \`\`\`).
3. Do NOT include any text, explanation, or comments before or after the JSON.
4. Every field listed in the schema's "required" array MUST be present.
5. No additional properties are allowed (\`additionalProperties: false\`).
6. All numeric fields must respect their \`minimum\`/\`maximum\` bounds exactly.
7. If the user's request is ambiguous, choose the most reasonable default.`;

// ---------------------------------------------------------------------------
// LevelPlan prompt
// ---------------------------------------------------------------------------

const LEVEL_PLAN_SYSTEM = `\
${STRICT_JSON_RULE}

OUTPUT SCHEMA (JSON Schema draft-2020-12):
${JSON.stringify(LEVEL_PLAN_SCHEMA, null, 2)}

FIELD GUIDANCE:
• seed           — pick any non-negative integer; vary it to introduce novelty.
• difficulty     — 0.0 = very forgiving gaps, 1.0 = expert-level precision jumps.
• verticality    — 0.0 = all platforms near the same height, 1.0 = steep tower.
• hazardDensity  — 0.0 = no spikes/lava, 1.0 = maximum hazard coverage.
• targetFootholdCount — 4 is a short level, 16 is a very long level.
• allowLadders   — true allows vertical shortcuts between platforms.
• styleTags      — lowercase thematic keywords for the visual theme (future use).
                   Examples: "cave", "lava", "jungle", "ruins", "ice", "sky".`;

/**
 * Build a { system, user } prompt pair that makes the LLM output a LevelPlan.
 *
 * @param userRequest  Natural-language description of the desired level.
 *
 * @example
 * const { system, user } = buildLevelPlanPrompt(
 *   'A short cave level with lava pits, medium difficulty, lots of vertical jumps.'
 * );
 */
export function buildLevelPlanPrompt(userRequest: string): { system: string; user: string } {
  return {
    system: LEVEL_PLAN_SYSTEM,
    user:   userRequest.trim(),
  };
}

// ---------------------------------------------------------------------------
// RefineRequest prompt
// ---------------------------------------------------------------------------

const REFINE_REQUEST_SYSTEM = `\
${STRICT_JSON_RULE}

OUTPUT SCHEMA (JSON Schema draft-2020-12):
${JSON.stringify(REFINE_REQUEST_SCHEMA, null, 2)}

FIELD GUIDANCE:
• rect             — the grid rectangle to regenerate (x/y/w/h in cell units).
                     The 32×32 grid has columns 0–31 and rows 0–31 (y=0 = top).
                     If the user mentions a region vaguely (e.g. "the middle"),
                     use reasonable defaults such as {"x":8,"y":4,"w":16,"h":20}.
• difficultyDelta  — positive = harder, negative = easier; 0 = unchanged.
                     Keep the sum within [0,1] relative to base difficulty.
• verticalityDelta — positive = more vertical variation; 0 = unchanged.
• addSecret        — true adds a hidden off-path platform (reachable by a
                     non-obvious jump not required to reach the GOAL).
• smoothSilhouette — true removes jagged single-cell SOLID protrusions along
                     the top border of the rect (cosmetic only).
• keepMainPathStable — true preserves the existing entry/exit seam tiles so
                     the critical path through the rect stays connected.
                     Use true when the user does NOT ask to reroute the path.`;

/**
 * Build a { system, user } prompt pair that makes the LLM output a RefineRequest.
 *
 * @param userRequest  Natural-language description of the desired change.
 * @param rect         Optional pre-selected rect to inject into the user prompt
 *                     so the model knows what region is being discussed.
 *
 * @example
 * const { system, user } = buildRefineRequestPrompt(
 *   'Make this section a bit harder and add a secret above the main route.',
 *   { x: 7, y: 4, w: 16, h: 24 },
 * );
 */
export function buildRefineRequestPrompt(
  userRequest: string,
  rect?: RefineRect,
): { system: string; user: string } {
  const rectHint = rect
    ? `\nThe region to modify is already selected: x=${rect.x}, y=${rect.y}, w=${rect.w}, h=${rect.h}.`
    : '';
  return {
    system: REFINE_REQUEST_SYSTEM,
    user:   `${userRequest.trim()}${rectHint}`,
  };
}

// ---------------------------------------------------------------------------
// Canonical examples (used in tests and documentation)
// ---------------------------------------------------------------------------

/**
 * Example LevelPlan JSON.
 * Describes: "A short cave level with lava pits, medium difficulty."
 */
export const EXAMPLE_LEVEL_PLAN: LevelPlan = {
  seed:                42,
  difficulty:          0.45,
  verticality:         0.35,
  hazardDensity:       0.15,
  targetFootholdCount: 8,
  allowLadders:        false,
  styleTags:           ['cave', 'lava'],
};

/**
 * Example RefineRequest JSON.
 * Prompt: "Make it a bit harder and add a secret above the main route."
 *
 * Interpretation:
 *   - difficultyDelta +0.25  → noticeably harder jumps, but not brutal
 *   - verticalityDelta  0.0  → no layout change (user didn't ask)
 *   - addSecret        true  → hidden off-path platform above the route
 *   - smoothSilhouette false → user said nothing about appearance
 *   - keepMainPathStable true → user wants the same general route, just harder
 */
export const EXAMPLE_REFINE_REQUEST: RefineRequest = {
  rect: { x: 7, y: 4, w: 16, h: 24 },
  difficultyDelta:    0.25,
  verticalityDelta:   0.0,
  addSecret:          true,
  smoothSilhouette:   false,
  keepMainPathStable: true,
};

// ---------------------------------------------------------------------------
// Convenience: pretty-print examples as JSON strings
// ---------------------------------------------------------------------------

export const EXAMPLE_LEVEL_PLAN_JSON    = JSON.stringify(EXAMPLE_LEVEL_PLAN,         null, 2);
export const EXAMPLE_REFINE_REQUEST_JSON = JSON.stringify(EXAMPLE_REFINE_REQUEST,    null, 2);
