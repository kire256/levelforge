# LevelForge — Project & Codebase Overview

**LevelForge** is an AI-assisted 2D platformer level editor. It uses an LLM to interpret natural language level descriptions into structured generation parameters, then uses a deterministic procedural algorithm to generate a 32×32 tile grid. The editor lets users visually paint tiles, place entities, and refine regions of the grid.

---

## Architecture: Three Components

### `levelforge/` — Python AI & generation library
- `src/ai/clients/llm_client.py` — Multi-provider LLM client: OpenAI, Anthropic, Gemini, Grok/xAI, DeepSeek, Mistral, Z-AI, Ollama. Ollama default `num_predict=2048`.
- `src/ai/prompts/templates.py` — Prompt builders including `get_level_plan_prompt()` and `get_refine_request_prompt()`.
- `src/ai/parsers/response_parser.py` — Parses LLM JSON; auto-merges duplicate entity arrays.
- `src/core/grid/level_generator.py` — Foothold-based procedural generation. Key constants: `MAX_RETRIES=100`, `MAX_STEP_TRIES=200`, `GOAL_X_MIN=26`, `W=H=32`. Key types: `GeneratorKnobs`, `MovementSpec`, `Foothold`, `GenerationResult`. Key functions: `generate_level(seed, knobs, spec)`, `footholds_to_grid(footholds, allow_ladders)`.
- `src/core/grid/semantic_to_tilemap.py` — `SemanticToTilemap` + `TileIds`; 4-neighbor bitmask autotile for SOLID cells.
- `src/core/grid/reachability.py` — BFS platformer reachability validator.
- `src/core/grid/refine_region.py` — Region-limited in-place level refinement: `refine_region(grid, rect, request, seed)`.
- `src/core/grid/__init__.py` — Exports `MovementSpec`, `GeneratorKnobs`, `generate_level`.

### `levelforge-api/` — FastAPI backend, port 8000, SQLite DB `levelforge.db`
- `main.py` (~900 lines) — All API endpoints:
  - `POST /api/generate/stream` (SSE) — Procedural generation via `_run_procedural_generation()`
  - `POST /api/interpret-level-plan` — NL description → `LevelPlanRequest` JSON via LLM
  - `GET/POST /api/settings/keys` — API key management
  - `GET/PUT /api/levels/{id}` — Level CRUD
- `database.py` — DB layer; `app_settings` table stores keys as `api_key_{provider}` rows; Ollama URL configurable.
- Provider fallback order: DB → env var → Ollama.
- `_complete_json()` helper repairs truncated LLM JSON.

### `levelforge-ui/` — React + Vite frontend, port 4173 (prod) / 5173 (dev)
- `src/App.jsx` — Root component; manages `currentProject`, `currentLevel`, `levels`, `selectedItem`, settings panel, undo/redo.
  - `handleGenerateLevel(settings)` — passes `LevelPlanRequest` fields to streaming endpoint.
  - `handleInterpretDescription(description)` → `POST /api/interpret-level-plan` → returns knob values.
  - `handleTilemapChange(tilemapData, ladderData)` — saves both tilemap layers.
- `src/components/Layout.jsx` (~800 lines) — Main shell: sidebar nav, resizable inspector panel (250–500px).
- `src/components/Levels.jsx` — Main level editor. Three stacked canvas layers (all `transparent={true}`):
  1. `.tilemap-layer` z-index:1 — `TilemapCanvas` for solid/oneway/hazard tiles
  2. `.ladders-layer` z-index:2 — `TilemapCanvas` for ladder tiles only
  3. `.entities-layer` z-index:3 — `LevelView` for entity/object placement
  - State: `tilemapData`, `ladderData`, `activeLayer` (`LAYERS.TILEMAP | LAYERS.LADDERS | LAYERS.ENTITIES`), `layerVisibility`.
  - Level load: splits `semantic_grid` into tilemap (LADDER→0) and ladder layer (LADDER cells → `ladderTileId`). Also loads `levelData.ladder_tilemap`.
  - Tile toolbar: shows for TILEMAP and LADDERS layers; LADDERS filtered to `collision_type === 'ladder'` tiles.
  - Debounced save: `onTilemapChange(tilemapData, ladderData)` fires 500ms after edit.
- `src/components/TilemapCanvas.jsx` — Canvas tile painter. Props: `tileData`, `tileTypes`, `selectedTileId`, `tool` (pencil/eraser/rect/fill/pan), `transparent` (bool), `interactive` (bool), `onTileChange`. Shared pan/zoom state passed as props. When `transparent={true}`: clears canvas with `clearRect` instead of filling `#1a1a2e`; adds `.transparent` CSS class to container div.
- `src/components/TileTypeManager.jsx` — Manages tile types. `COLLISION_TYPES`: `solid`, `passthrough` (one-way), `hazard`, `ladder`, `empty`.
- `src/components/LevelView.jsx` — Entity/object placement overlay.
- `src/models/semanticGrid.js` — `SemanticGrid32` (32×32 bitflag grid). `Cell` flags: `SOLID=0x01, ONEWAY=0x02, HAZARD=0x04, LADDER=0x08, GOAL=0x10, START=0x20`.
- `src/models/semanticToTilemap.js` — JS port of the Python autotile mapper.
- `src/hooks/useUndoRedo.js` — Undo/redo history hook.

---

## Key Data Structures

### `LevelPlanRequest` (Python/API)
```python
seed: Optional[int]          # None = random
difficulty: float            # 0.0–1.0
verticality: float           # 0.0–1.0
hazard_density: float        # 0.0–1.0
target_foothold_count: int   # 4–16
allow_ladders: bool
style_tags: List[str]
```

### `GeneratorKnobs` (Python)
```python
target_foothold_count: int
min_foothold_width: int      # = 2 + round((1-difficulty)*2)
max_foothold_width: int      # = 3 + round((1-difficulty)*2)
verticality: float
difficulty: float
allow_ladders: bool
```

### `level_data` JSON (stored in SQLite)
```json
{
  "version": "2.0",
  "kind": "procedural",
  "level_plan": { "...LevelPlanRequest fields..." },
  "semantic_grid": { "width": 32, "height": 32, "cells": "<base64>" },
  "footholds": [{ "x": "int", "y": "int", "width": "int" }],
  "seed_used": "int",
  "tilemap": { "width": 32, "height": 32, "data": [["tileId|null", "..."]] },
  "ladder_tilemap": { "width": 32, "height": 32, "data": [["tileId|null", "..."]] },
  "entities": [],
  "platforms": [],
  "player_spawn": { "x": "float", "y": "float" },
  "goal": { "x": "float", "y": "float" }
}
```

---

## Canvas Layering

`.layered-canvas` (Levels.css) has `background: #1a1a2e` as the base color. All three `.canvas-layer` children use `position: absolute; inset: 0`. Their container divs must have `background: transparent` (via the `transparent` prop on `TilemapCanvas`) so lower layers show through. The `TilemapCanvas` renders `clearRect` instead of a fill when `transparent={true}`, and adds `.transparent` to the container div class which sets `background: transparent` in `TilemapCanvas.css`.

---

## Dev Commands
```
npm run dev   # root — starts API + UI concurrently
npm run api   # backend only (port 8000)
npm run ui    # frontend only (port 5173 dev / 4173 prod)
```

## Network
- Frontend: `http://192.168.68.72:4173`
- Backend: `http://192.168.68.72:8000`
- Ollama (local LLM fallback): `192.168.68.76:11434`
