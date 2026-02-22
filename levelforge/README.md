# LevelForge AI

AI-powered level design tool for game developers.

## Features

- Generate playable game levels from text prompts
- Support for platformer, puzzle, shooter, and RPG genres
- Export to Godot, Unity, and Unreal Engine
- Tileset analyzer - upload your art, auto-generate tilemap rules
- Player capabilities system - design levels around specific player abilities
- Integrated playtest simulation
- Metroidvania support with gating and multiple paths

## Tech Stack

- **Frontend:** React + Electron (or Tauri)
- **Backend:** Python (FastAPI)
- **AI:** OpenAI Codex, z.ai (GLM), Ollama
- **Storage:** SQLite + local files

## Getting Started

```bash
# Install dependencies
pip install -r requirements.txt

# Run development
python -m levelforge
```

## Documentation

- [Design Document](./docs/design.md)
- [Implementation Plan](./docs/implementation-plan.md)

## License

MIT
