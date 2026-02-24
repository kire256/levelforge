# LevelForge - AI Level Generator

## Project Structure
- `levelforge/` - Python backend (AI generation)
- `levelforge-api/` - FastAPI server (runs on port 8000)
- `levelforge-ui/` - React frontend (runs on port 4173 for production)

## How to Run

### Backend
```bash
cd ~/.openclaw/workspace/levelforge-api
source ../levelforge/venv/bin/activate
PYTHONPATH=.. python main.py
```

### Frontend
```bash
cd ~/.openclaw/workspace/levelforge-ui
npm run build && npm run preview -- --host
```

## Network
- Frontend: http://192.168.68.72:4173
- Backend: http://192.168.68.72:8000
- Ollama: 192.168.68.76:11434 (local fallback)

## Completed Features
- ✅ Generate platformer levels via AI (Ollama, Z-AI, Codex)
- ✅ Visual canvas preview with pan/zoom
- ✅ Fullscreen preview mode
- ✅ Entity rendering with emojis
- ✅ Export JSON
- ✅ Level refinement
- ✅ Project/level database save system
- ✅ Model selector dropdown (Ollama/Z-AI/Codex)
- ✅ Delete projects
- ✅ Build version in header
- ✅ **Progress bar for AI generation** (#22) - SSE streaming with step updates
- ✅ **Custom entity types** (#15) - Per-project entity definitions with metadata fields
- ✅ **Automatic Ollama fallback** - Falls back to local Ollama on rate limits

## Known Issues
- Z-AI not working (API key/account issue)

## Feature Roadmap
See GitHub issues #16-27 for remaining features. Prioritized:
1. Edit Mode (#17) - Move, Add, Remove Entities
2. Genre Presets for Entity Types (#16)
3. Custom Entity Icons (#18)
4. Playable Level Preview (#19)

## GitHub
- Issues: github.com/kire256/levelforge/issues
- Branch: feature/save-load-db

## Recent Session (2026-02-24)
- Added progress bar with SSE streaming
- Added custom entity types with metadata fields
- Added entity type edit/delete UI with emoji picker
- Added automatic Ollama fallback on rate limits
- Improved entity form layout
