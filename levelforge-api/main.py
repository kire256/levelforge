"""
LevelForge FastAPI backend.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import logging

from levelforge.src.core.generation.generator import LevelGenerator, create_generator
from levelforge.src.ai.clients.llm_client import LLMFactory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LevelForge API",
    description="AI-powered level design tool API",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://192.168.68.72:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize generator
_generator: Optional[LevelGenerator] = None

def get_generator() -> LevelGenerator:
    """Get or create the level generator."""
    global _generator
    if _generator is None:
        try:
            _generator = create_generator(client_type="ollama", model="llama3.2:latest", base_url="http://192.168.68.76:11434")
            logger.info("Level generator initialized")
        except Exception as e:
            logger.error(f"Failed to initialize generator: {e}")
            raise HTTPException(status_code=500, detail="AI client not available")
    return _generator


# Request models
class GenerationRequest(BaseModel):
    genre: str = "platformer"
    difficulty: str = "medium"
    level_type: str = "linear"
    theme: str = "default"
    requirements: str = ""
    abilities: Optional[List[str]] = None


class RefinementRequest(BaseModel):
    level_data: dict
    modification: str


@app.get("/")
async def root():
    return {
        "name": "LevelForge API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Check API health and AI availability."""
    try:
        client = LLMFactory.get_best_available()
        return {
            "status": "healthy",
            "ai_available": client is not None,
            "client_type": type(client).__name__ if client else None
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@app.post("/api/generate")
async def generate_level(request: GenerationRequest):
    """Generate a new level."""
    try:
        generator = get_generator()
        
        logger.info(f"Generating {request.genre} level, difficulty: {request.difficulty}")
        
        # Generate based on genre
        if request.genre == "platformer":
            if request.level_type == "metroidvania":
                result = generator.generate_metroidvania(
                    difficulty=request.difficulty,
                    abilities=request.abilities or ["double_jump", "dash"],
                    theme=request.theme
                )
            else:
                result = generator.generate_platformer(
                    difficulty=request.difficulty,
                    requirements=request.requirements or "Create an engaging level",
                    theme=request.theme
                )
        elif request.genre == "puzzle":
            result = generator.generate_puzzle(
                difficulty=request.difficulty,
                requirements=request.requirements
            )
        elif request.genre == "shooter":
            result = generator.generate_shooter(
                difficulty=request.difficulty,
                requirements=request.requirements
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported genre: {request.genre}")
        
        if result.success:
            return {
                "success": True,
                "level": result.level.model_dump()
            }
        else:
            raise HTTPException(status_code=500, detail=result.error or "Generation failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine")
async def refine_level(request: RefinementRequest):
    """Refine an existing level."""
    try:
        generator = get_generator()
        
        result = generator.refine_level(
            original_level=request.level_data,
            modification=request.modification
        )
        
        if result.success:
            return {
                "success": True,
                "level": result.level.model_dump()
            }
        else:
            raise HTTPException(status_code=500, detail=result.error or "Refinement failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Refinement error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/client-status")
async def client_status():
    """Get current AI client status."""
    try:
        client = LLMFactory.get_best_available()
        return {
            "available": client is not None,
            "client": type(client).__name__ if client else None
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }


# Project endpoints
@app.post("/api/projects")
async def create_project(name: str, description: str = None):
    """Create a new project."""
    from database import create_project
    project_id = create_project(name, description)
    return {"id": project_id, "name": name}


@app.get("/api/projects")
async def get_projects():
    """Get all projects."""
    from database import get_projects
    projects = get_projects()
    return [{"id": p[0], "name": p[1], "description": p[2], "created_at": p[3], "updated_at": p[4]} for p in projects]


@app.get("/api/projects/{project_id}")
async def get_project(project_id: int):
    """Get a single project."""
    from database import get_project
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    """Delete a project."""
    from database import delete_project
    success = delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}


# Level endpoints
@app.post("/api/projects/{project_id}/levels")
async def create_level(project_id: int, name: str, genre: str, difficulty: str, 
                       level_type: str, theme: str = None, level_data: str = None):
    """Create a new level in a project."""
    from database import create_level, get_project
    
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    level_id = create_level(project_id, name, genre, difficulty, level_type, theme, level_data or "{}")
    return {"id": level_id, "name": name}


@app.get("/api/projects/{project_id}/levels")
async def get_levels(project_id: int):
    """Get all levels in a project."""
    from database import get_levels
    levels = get_levels(project_id)
    return [{
        "id": l[0], "name": l[1], "genre": l[2], "difficulty": l[3],
        "level_type": l[4], "theme": l[5], "version": l[6], "created_at": l[7], "updated_at": l[8]
    } for l in levels]


@app.get("/api/levels/{level_id}")
async def get_level(level_id: int):
    """Get a single level with full data."""
    from database import get_level
    level = get_level(level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")
    return level


@app.put("/api/levels/{level_id}")
async def update_level(level_id: int, level_data: str):
    """Update a level's data."""
    from database import update_level
    success = update_level(level_id, level_data)
    if not success:
        raise HTTPException(status_code=404, detail="Level not found")
    return {"success": True}


@app.delete("/api/levels/{level_id}")
async def delete_level(level_id: int):
    """Delete a level."""
    from database import delete_level
    success = delete_level(level_id)
    if not success:
        raise HTTPException(status_code=404, detail="Level not found")
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
