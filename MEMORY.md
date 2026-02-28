# LevelForge - AI Level Generator

## Project Structure
- `levelforge/` - Python backend (AI generation)
- `levelforge-api/` - FastAPI server (runs on port 8000)
- `levelforge-ui/` - React frontend (runs on port 4173 for production)

## How to Run

### Backend (systemd service)
```bash
systemctl --user status levelforge-api.service
systemctl --user restart levelforge-api.service
journalctl --user -u levelforge-api.service -n 50
```

### Frontend (PM2)
```bash
pm2 status
pm2 restart levelforge-ui
pm2 logs levelforge-ui
```

### Manual Backend
```bash
cd ~/.openclaw/workspace/levelforge-api
source ../levelforge/venv/bin/activate
PYTHONPATH=.. python main.py
```

### Manual Frontend
```bash
cd ~/.openclaw/workspace/levelforge-ui
npm run build && npm run preview -- --host
```

## Network
- Frontend: http://192.168.68.72:4173
- Backend: http://192.168.68.72:8000
- Ollama: 192.168.68.76:11434 (local fallback)

## Testing with Chromium (Headless Server)

Since the server is headless (no X display), the OpenClaw browser tool doesn't work directly. 

### Option 1: Run Chromium with Remote Debugging (from desktop session)
```bash
chromium-browser --remote-debugging-port=9222 --new-window "http://192.168.68.72:4173" &
```

Then I can interact via CDP API:
```bash
# Open a new page
curl -X PUT "http://127.0.0.1:9222/json/new?http://192.168.68.72:4173"

# List open pages
curl -s http://127.0.0.1:9222/json

# Check Chrome version
curl -s http://127.0.0.1:9222/json/version
```

### Option 2: Install xvfb for headless browser (requires sudo)
```bash
sudo apt install xvfb
xvfb-run chromium-browser --remote-debugging-port=9222 &
```

### Option 3: Test from any machine on the network
Just open http://192.168.68.72:4173 in any browser.

## Completed Features

### Core Functionality
- ✅ Generate platformer levels via AI (Ollama, Z-AI, Codex, Gemini)
- ✅ Project/level database save system (SQLite)
- ✅ Custom entity types with metadata fields (#15)
- ✅ Progress bar for AI generation (#22) - SSE streaming
- ✅ Automatic Ollama fallback on rate limits
- ✅ Level persistence after generation
- ✅ AI prompts use project's custom entity types

### Enterprise UX (2026-02-24)
- ✅ Complete UI redesign (Unity/VS Code style)
- ✅ Top menu bar with dropdowns (File, Edit, View, Entities, Levels, AI, Tools, Help)
- ✅ Tab navigation (Dashboard, Entities, Levels, Library, AI Tools, Settings)
- ✅ Three-panel layout (Left sub-nav + Center data grid + Right inspector)
- ✅ Bottom console panel with tabs (Console, AI Output, Logs)
- ✅ Keyboard shortcuts (Ctrl+1-6, Ctrl+I, Ctrl+`, F11)
- ✅ Resizable panels with drag handles

### Level Editor (2026-02-27)
- ✅ Object hierarchy panel with tabs (Levels/Objects)
- ✅ Click to select objects on canvas
- ✅ Drag entities to reposition (live preview)
- ✅ Edit object properties in inspector (position, size, name)
- ✅ Changes persist to database
- ✅ Delete level from inspector
- ✅ Inline level name editing (click to edit, Enter to save)
- ✅ Undo/Redo support for level changes
- ✅ Tab disable/enable based on project selection
- ✅ Auto-switch to Levels tab when selecting project

### Canvas/Preview
- ✅ Light background for level preview (better readability)
- ✅ Draggable legend and info panels with minimize
- ✅ Pan canvas with mouse drag
- ✅ Zoom with mouse wheel
- ✅ Cursor changes on hover (pointer on objects)
- ✅ Selection highlight (purple ring)
- ✅ Hover highlight (lighter purple)
- ✅ Auto-fit bounds to show all entities

### Theme System
- ✅ Dark theme (default): Deep blue-gray (#0f0f1a)
- ✅ Light theme: Clean white (#f5f5f7)
- ✅ System theme: Follows OS preference
- ✅ 5 accent colors (Indigo, Purple, Green, Orange, Red)
- ✅ Theme persistence via localStorage
- ✅ CSS variables for all colors

### Inspector Panel
- ✅ Unified inspector for entities, levels, assets
- ✅ Entity edit form in inspector
- ✅ Level details view
- ✅ Library asset details
- ✅ Edit buttons in inspector header
- ✅ Object inspector with position/size editing
- ✅ Level actions (delete level button)

### Console Panel
- ✅ Three functional tabs (Console, AI Output, Logs)
- ✅ Auto-show on errors and AI progress
- ✅ Color-coded log types
- ✅ Real-time level generation progress

### Menu System
- ✅ Open Project modal with project list
- ✅ Open Recent submenu (4 most recent projects)
- ✅ Recent projects persistence (localStorage)
- ✅ Full menu hierarchy with keyboard shortcuts

### AI Model Support
- ✅ Google Gemini client support
- ✅ OpenAI client (Codex, GPT-4, GPT-3.5)
- ✅ Z-AI (GLM) support
- ✅ Ollama local LLM support
- ✅ Automatic fallback chain

## Known Issues
- Z-AI not working (API key/account issue)
- LLM sometimes generates duplicate entity arrays (auto-merged by parser)
- OpenClaw browser tool requires X display (doesn't work on headless server)

## Feature Roadmap
See GitHub issues #16-27 for remaining features. Prioritized:
1. Canvas Editor (#17) - Visual level editor with drag-drop ✅ DONE
2. Edit Mode (#17) - Move, Add, Remove Entities ✅ DONE
3. Genre Presets for Entity Types (#16)
4. Custom Entity Icons (#18)
5. Playable Level Preview (#19)
6. API Key Management UI (Gemini, OpenAI, Codex with OAuth)

## GitHub
- Issues: github.com/kire256/levelforge/issues
- Repo: https://github.com/kire256/levelforge.git
- Latest commit: Object selection, dragging, inspector editing

## Recent Session (2026-02-28)

### Tilemap System Design
- Created design doc: `docs/TILEMAP_DESIGN.md`
- Key decisions:
  - Integrated into Levels tab (not separate)
  - Two layers: Tilemap + Entities with visibility toggles
  - Single tilemap per level, fixed tile size per project
  - Colors for preview (textures later)
  - Tilemaps handle collision
  - AI generates for new levels only

### Phase 1 Implementation (Tilemap Infrastructure)
- Added `tile_size` column to projects table
- Created `tile_types` table with properties:
  - name, color, description, collision_type, friction, damage, category, metadata
- API endpoints:
  - `GET/POST /api/projects/:id/tile-types`
  - `GET/PUT/DELETE /api/tile-types/:id`
  - `PUT /api/projects/:id/tile-size`
- TileTypeManager component (create/edit tile types with modal form)
- Integrated into Settings > "Tile Types" section
- Tile size selector (16/24/32/48/64px)

### Bug Fixes & Features
- Fixed entity position reset bug (sync displayLevel with history)
- Added snap-to-grid toggle and grid options to Edit menu
- Grid size presets: 10/25/50/100px
- All grid settings persist in localStorage

## Recent Session (2026-02-27)

### Major Features Implemented
- Object hierarchy panel with Levels/Objects tabs
- Click to select objects (entities, platforms, spawn, goal)
- Drag entities on canvas to reposition
- Edit object properties in inspector
- Persist changes to database via PUT /api/levels/:id
- Delete level from inspector
- Inline level name editing
- Tab enable/disable based on project selection
- Auto-switch to Levels on project select

### Bug Fixes
- Fixed entities not visible on canvas (coordinate transform)
- Fixed undo/redo not reflecting in UI
- Fixed variable hoisting issues in LevelView (useCallback ordering)
- Fixed levelData used before definition

### Technical Improvements
- Auto-fit bounds for level preview
- Improved resize handles (8px width, better hover feedback)
- Custom entity types in AI prompts
- Better cursor feedback (pointer on hover, move on drag)
