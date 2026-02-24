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
ZAI_API_KEY=your_key PYTHONPATH=.. python main.py
```

### Frontend
```bash
cd ~/.openclaw/workspace/levelforge-ui
npm run build && npm run preview -- --host
```

## Network
- Frontend: http://192.168.68.72:4173
- Backend: http://192.168.68.72:8000
- Ollama: 192.168.68.76:11434

## Current Features
- Generate platformer levels via AI (Ollama, Z-AI, Codex)
- Visual canvas preview with pan/zoom
- Fullscreen preview mode
- Entity rendering with emojis
- Export JSON
- Level refinement
- Project/level database save system
- Model selector dropdown
- Delete projects
- Build version in header

## Known Issues
- Z-AI not working (API key/account issue)

## Feature Roadmap
See GitHub issues #13-27 for full list. Prioritized:
1. Progress Bar (next)
2. Edit Mode
3. Custom Entity Types

## GitHub
- Issues: github.com/kire256/levelforge/issues
