# Tilemap System Design

## Quick Summary

**Goal:** Add grid-based tilemap system to LevelForge for collision/terrain design.

**Key Decisions:**
- ✅ Integrated into Levels tab (not a separate tab)
- ✅ Two layers: Tilemap + Entities (both with visibility toggles)
- ✅ Single tilemap layer per level (no multi-layer visuals yet)
- ✅ Fixed tile size per project
- ✅ Colors only for tile preview (textures later)
- ✅ Tilemaps handle collision (finer controls later)
- ✅ AI generates tilemaps for new levels only

---

## Overview

A grid-based tilemap system for LevelForge that allows users to create tile types, build layered tilemaps with manual drawing tools, and generate tilemaps via AI. Future enhancement: AI-powered image rendering for final exports.

---

## Core Concepts

### Tile Types (Project-Level)
- Defined once per project, reusable across all levels
- Similar to Entity Types in the current system

**Tile Type Properties:**
| Property | Type | Description |
|----------|------|-------------|
| id | int | Auto-generated unique ID |
| name | string | Display name (e.g., "Grass", "Stone", "Water") |
| color | hex | Color for preview rendering |
| texture_url | string? | Optional texture image URL |
| collision_type | enum | none, solid, passthrough, hazard, water |
| friction | float | 0.0 - 1.0 (affects movement) |
| damage | int | Damage per second (for hazards) |
| metadata | json | Custom key-value pairs |
| category | string | For grouping in palette (terrain, hazard, decoration) |

### Tilemap Layers (Level-Level)
- Each level can have multiple tilemap layers
- Layers are rendered in order (bottom to top)

**Layer Properties:**
| Property | Type | Description |
|----------|------|-------------|
| id | int | Unique layer ID |
| name | string | Display name |
| width | int | Grid width in tiles |
| height | int | Grid height in tiles |
| tile_size | int | Pixels per tile (e.g., 16, 32, 64) |
| data | 2D array | tile_id at each cell, or null for empty |
| visible | bool | Show/hide layer |
| locked | bool | Prevent editing |
| opacity | float | 0.0 - 1.0 |
| order | int | Render order (z-index) |

### Tilemap Data Structure
```
{
  "layers": [
    {
      "id": 1,
      "name": "Background",
      "width": 50,
      "height": 30,
      "tile_size": 32,
      "visible": true,
      "locked": false,
      "opacity": 1.0,
      "order": 0,
      "data": [
        [1, 1, 1, 1, ...],  // row 0
        [1, 2, 2, 1, ...],  // row 1 (2 = different tile)
        [null, null, 1, 1, ...],  // null = empty
        ...
      ]
    },
    {
      "id": 2,
      "name": "Collision",
      ...
      "order": 1
    }
  ]
}
```

---

## Database Schema (SQLite)

### New Tables

```sql
-- Project-level tile types
CREATE TABLE tile_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#808080',
    texture_url TEXT,
    collision_type TEXT DEFAULT 'none',
    friction REAL DEFAULT 1.0,
    damage INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    category TEXT DEFAULT 'terrain',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Layer-level tiles stored in level_data JSON (no new table needed)
-- Each level's level_data will include a tilemap object
```

### Updated level_data Structure
```json
{
  "platforms": [...],
  "entities": [...],
  "player_spawn": {...},
  "goal": {...},
  "tilemap": {
    "tile_size": 32,  // From project settings
    "width": 50,
    "height": 30,
    "data": [
      [1, 1, 1, 1, ...],  // row 0: tile IDs or null
      [1, 2, 2, 1, ...],  // row 1
      [null, null, 1, 1, ...],  // null = empty tile
      ...
    ]
  }
}
```

**Note:** Single tilemap layer per level for now. Future phases may add multiple tilemap layers for visual effects.

---

## UI/UX Design

### Integrated into Levels Tab

The tilemap editor is integrated into the existing Levels tab with a layer toggle system.

#### Updated Levels Tab Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🗺 Levels                                           [🚀 Generate]   │
├─────────────┬───────────────────────────────────┬───────────────────┤
│ Layer Panel │        Level Canvas                │  Tile Palette     │
│             │        (Entities + Tiles)          │  (when tile layer)│
│ LAYERS      │                                   │                   │
│ ─────────── │  ┌─────────────────────────────┐  │  Terrain          │
│ ☑ Entities  │  │                             │  │  [■] [■] [■]      │
│ ☑ Tilemap   │  │  Entities (🧑👾🪙) +       │  │                   │
│             │  │  Tile grid underneath       │  │  Hazards          │
│ TILEMAP     │  │                             │  │  [▲] [▲] [▲]      │
│ ─────────── │  │  Selected: Grass Tile       │  │                   │
│ Width: 50   │  │                             │  │  Empty            │
│ Height: 30  │  └─────────────────────────────┘  │  [·]              │
│             │                                   │                   │
├─────────────┴───────────────────────────────────┴───────────────────┤
│ Tools: [🖌 Pencil] [🧹 Eraser] [▢ Rect] [🪣 Fill] | [👁 Grid] [🧲 Snap] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Layer Visibility
- Each layer (Entities, Tilemap) has a visibility checkbox in the left panel
- When Tilemap layer is selected:
  - Tile palette appears on the right
  - Tilemap tools appear in toolbar
- When Entities layer is selected:
  - Entity inspector shows selected entity
  - Entity manipulation tools available

### Drawing Tools (Tilemap Layer)
1. **Pencil** - Paint individual tiles
2. **Eraser** - Remove tiles (set to null)
3. **Rectangle** - Draw filled rectangle of tiles
4. **Flood Fill** - Fill connected area with tile
5. **Pan** - Drag to pan canvas
6. **Zoom** - Zoom in/out

### Keyboard Shortcuts
- `B` - Pencil/Brush
- `E` - Eraser
- `R` - Rectangle
- `G` - Fill (bucket)
- `Space+Drag` - Pan
- `Scroll` - Zoom
- `V` - Toggle current layer visibility

---

## API Endpoints

### Tile Types CRUD
```
GET    /api/projects/:id/tile-types          # List all tile types
POST   /api/projects/:id/tile-types          # Create tile type
PUT    /api/tile-types/:id                   # Update tile type
DELETE /api/tile-types/:id                   # Delete tile type
```

### Tilemap Operations
```
PUT    /api/levels/:id/tilemap               # Update entire tilemap
PUT    /api/levels/:id/tilemap/layer         # Add/update layer
DELETE /api/levels/:id/tilemap/layer/:lid    # Delete layer
PUT    /api/levels/:id/tilemap/tile          # Update single tile (for real-time drawing)
```

---

## AI Generation Integration

### Option A: Separate Generation
```
POST /api/generate/tilemap
{
  "project_id": 10,
  "level_id": 42,
  "description": "A forest clearing with a river on the left",
  "layers": ["background", "collision"],
  "tile_types": [1, 2, 3, 4],  // Which tile types to use
  "width": 50,
  "height": 30
}
```

### Option B: Integrated with Level Generation
- Current level generation creates platforms/entities
- Add tilemap generation as part of the same process
- AI decides tile placement based on level description

**Recommendation:** Start with Option A (separate), later add integration.

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
- [ ] Add `tile_size` to projects table (default 32)
- [ ] Create `tile_types` table
- [ ] API endpoints for tile types CRUD
- [ ] TileTypeManager component (create/edit tile types)
- [ ] Add tile_types to project settings or Entities tab

### Phase 2: Tilemap Editor UI
- [ ] Update Levels tab to show layer panel (Entities / Tilemap)
- [ ] TilemapCanvas component (grid rendering)
- [ ] TilePalette component (select tile types)
- [ ] Drawing tools (pencil, eraser, rectangle, flood fill)
- [ ] Layer visibility toggles
- [ ] Toolbar integration

### Phase 3: Persistence & Sync
- [ ] Update level_data structure to include tilemap
- [ ] API endpoints for tilemap updates
- [ ] Real-time tile updates (PUT /api/levels/:id/tilemap/tile)
- [ ] Undo/redo for tile operations

### Phase 4: AI Generation
- [ ] Update AI prompt to include tile types
- [ ] Generate tilemap alongside entities
- [ ] Preview generated tilemap in canvas
- [ ] Tile placement logic based on level description

### Phase 5: Future - Visual Rendering (Deferred)
- [ ] AI image generation for tiles
- [ ] Per-layer rendering prompts
- [ ] Export final composed image
- [ ] Texture upload support

---

## Design Decisions (Confirmed)

### 1. Entity vs Tilemap Relationship
✅ **DECIDED:** Tilemaps and entities exist on separate layers within the same level.
- Each layer has a visibility toggle in the outline/hierarchy panel
- Entities snap to grid only when "Snap to Grid" option is enabled
- Both can be viewed/edited together or independently via layer visibility

### 2. Default Layers
✅ **DECIDED:** Two default layers per level:
- **Tilemap Layer** - Grid-based collision/terrain tiles
- **Entity Layer** - Free-form entities (player, enemies, items, etc.)
- Not focused on visual layers (background, foreground) at this stage
- Visual rendering via AI will come in a future phase

### 3. Tile Size
✅ **DECIDED:** Fixed tile size per project (e.g., 32x32 pixels for all layers)
- Stored in project settings
- Applies to all tilemap layers in the project

### 4. Texture Support
✅ **DECIDED:** Just colors for now
- Each tile type has a `color` property for preview rendering
- Texture/image support deferred to AI rendering phase

### 5. Collision
✅ **DECIDED:** Tilemaps handle collision
- Tile types have a `collision_type` property (none, solid, passthrough, hazard, etc.)
- Finer collision region controls per tile type will be added in future phase
- Tiles with collision will export as collision geometry for game engines

### 6. UI Location
✅ **DECIDED:** Integrated into Levels tab
- Tilemap editor is a view mode within the existing Levels tab
- Toggle between "Entities" and "Tilemap" views, or show both with layer visibility

### 7. AI Generation Scope
✅ **DECIDED:** Only for newly generated levels
- AI generates tilemap + entities together when creating a new level
- No retrofitting existing levels with tilemaps (user can manually add if needed)

---

## Technical Concerns

### Performance
- Large tilemaps (100x100) = 10,000 cells per layer
- Need efficient rendering (canvas-based, not DOM elements)
- Consider chunked rendering for very large maps

### Storage
- 50x30 layer = 1,500 cells
- Storing as 2D array in JSON is reasonable
- Could use RLE (run-length encoding) for sparse maps if needed

### Undo/Redo
- Store tile changes in history
- Consider tilemap snapshots vs. per-tile changes
- May need separate undo stack for tilemap vs. entities

---

## File Structure (Proposed)

```
levelforge-ui/src/components/
  TilemapCanvas.jsx      # Canvas rendering + mouse interaction for tiles
  TilePalette.jsx        # Tile type selection palette
  TileTypeManager.jsx    # Create/edit tile types (modal or panel)

levelforge-api/
  routes/tile_types.py   # Tile type CRUD endpoints
  # Tilemap updates handled in existing levels.py routes
```

---

## Next Steps

1. ✅ Design doc created and decisions confirmed
2. **Start Phase 1:**
   - Add `tile_size` column to projects table
   - Create `tile_types` table
   - API endpoints for tile types CRUD
   - TileTypeManager UI component
3. **Then Phase 2:** Tilemap editor UI in Levels tab
4. **Then Phase 3:** Persistence & sync
5. **Then Phase 4:** AI generation integration

Ready to proceed with implementation when approved.

---

*Last updated: 2026-02-28*
*Status: Design approved, ready for Phase 1 implementation*
