# LevelForge - AI Level Generator

## Project Structure
- `levelforge/` - Python backend (AI generation)
- `levelforge-api/` - FastAPI server (runs on port 8000)
- `levelforge-ui/` - React frontend (runs on port 5173)

## How to Run

### Backend (terminal 1)
```bash
cd ~/.openclaw/workspace/levelforge-api
source ../levelforge/venv/bin/activate
PYTHONPATH=.. python main.py
```

### Frontend (terminal 2)
```bash
cd ~/.openclaw/workspace/levelforge-ui
npm run dev -- --host
```

## Network Setup
- Frontend accessible at: `http://192.168.68.72:5173`
- Backend API at: `http://192.168.68.72:8000`
- Ollama running on: `192.168.68.76:11434` (local PC, not cloud!)
- Model: `llama3.2:latest` (running locally)

## Fixed Issues
- Added missing `vite.config.js` for React JSX transform
- Fixed `src/__init__.py` imports (files were in `core/schemas/`)
- Added `validate_level_data` method to SchemaValidator
- Updated default prompt to require coins/enemies
- Added CORS for remote access
- Configured to use local Ollama instead of cloud

## Current Features
- Generate platformer levels via AI (uses local Ollama with llama3.2)
- Visual canvas preview with pan/zoom
- Fullscreen preview mode
- Entity rendering with emojis (🧑🚩🪙🔑👾🔥⭐)
- Export JSON
- Level refinement (modify existing levels)

## Remote Access
- Web UI accessible from other machines on network
- Backend CORS configured for 192.168.68.72:5173

## Next Steps (Suggested)
1. Additional level types (puzzle, shooter, metroidvania in UI)
2. Save/load to database
3. Player preview (animate character jumping)
4. Godot/Unity exporters
5. Environment variables for IP configuration

## PR Workflow
- Always have Copilot review PRs before merging

## Technical Notes
- Frontend calls `http://192.168.68.72:8000/api/generate`
- Backend uses Ollama client
- Level schema: platforms[], entities[], metadata{}
