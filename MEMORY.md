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

## Completed Features

### Core Functionality
- ✅ Generate platformer levels via AI (Ollama, Z-AI, Codex, Gemini)
- ✅ Project/level database save system (SQLite)
- ✅ Custom entity types with metadata fields (#15)
- ✅ Progress bar for AI generation (#22) - SSE streaming
- ✅ Automatic Ollama fallback on rate limits
- ✅ Level persistence after generation

### Enterprise UX (2026-02-24)
- ✅ Complete UI redesign (Unity/VS Code style)
- ✅ Top menu bar with dropdowns (File, Edit, View, Entities, Levels, AI, Tools, Help)
- ✅ Tab navigation (Dashboard, Entities, Levels, Library, AI Tools, Settings)
- ✅ Three-panel layout (Left sub-nav + Center data grid + Right inspector)
- ✅ Bottom console panel with tabs (Console, AI Output, Logs)
- ✅ Keyboard shortcuts (Ctrl+1-6, Ctrl+I, Ctrl+`, F11)
- ✅ Resizable panels with drag handles

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
- Level preview/edit not yet implemented

## Feature Roadmap
See GitHub issues #16-27 for remaining features. Prioritized:
1. Canvas Editor (#17) - Visual level editor with drag-drop
2. Edit Mode (#17) - Move, Add, Remove Entities
3. Genre Presets for Entity Types (#16)
4. Custom Entity Icons (#18)
5. Playable Level Preview (#19)
6. API Key Management UI (Gemini, OpenAI, Codex with OAuth)

## GitHub
- Issues: github.com/kire256/levelforge/issues
- Branch: feature/save-load-db
- Latest commit: Enterprise UX redesign with theme system

## Recent Session (2026-02-24)

### Major Features Implemented
- Enterprise UX redesign matching Unity/VS Code
- Full theme system with light/dark modes
- Unified inspector panel for all item types
- Console panel with functional tabs
- Level generation with SSE streaming
- Open Project and Open Recent menus
- Gemini AI client support

### Bug Fixes
- Fixed SSE event format (data: prefix + \n\n suffix)
- Fixed duplicate entity arrays in LLM responses
- Fixed level generation not saving to database
- Fixed inspector disappearing on wide windows
- Fixed theme colors not applying to all components

### Technical Improvements
- CSS variables for all colors (easy theming)
- Better error logging with response preview
- Auto-show console on errors
- Recent projects persistence
- Level names generated from theme/genre/difficulty

### Services Setup
- PM2 for frontend (auto-restart)
- systemd user service for backend (auto-restart)
- Both services persist across reboots

### Pull Request
- Branch: feature/save-load-db
- Commit: feat: Enterprise UX redesign with theme system and level generation fixes
- Ready for code review and merge
