"""
LevelForge FastAPI backend.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import logging
import asyncio
import sse_starlette.sse as sse

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
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:4173", "http://localhost:3000", "http://192.168.68.72:5173", "http://192.168.68.72:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize generator
_generator: Optional[LevelGenerator] = None
_current_model: Optional[str] = "llama3.2:latest"

def get_generator() -> LevelGenerator:
    """Get or create the level generator."""
    global _generator, _current_model
    if _generator is None:
        try:
            _current_model = _current_model or "llama3.2:latest"
            _generator = create_generator(client_type="ollama", model=_current_model, base_url="http://192.168.68.76:11434")
            logger.info(f"Level generator initialized with model {_current_model}")
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
    model: Optional[str] = None  # Optional model override
    project_id: Optional[int] = None  # For custom entity types


class RefinementRequest(BaseModel):
    level_data: dict
    modification: str
    model: Optional[str] = None


class ModelRequest(BaseModel):
    model: str


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
            "client_type": type(client).__name__ if client else None,
            "current_model": _current_model
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@app.get("/api/models")
async def get_models():
    """Get available AI models from all providers."""
    import requests
    
    result = {
        "providers": {},
        "current": _current_model,
        "current_provider": _current_provider
    }
    
    # Get Ollama models
    try:
        resp = requests.get("http://192.168.68.76:11434/api/tags", timeout=5)
        models = resp.json().get("models", [])
        result["providers"]["ollama"] = [{"name": f"ollama:{m['name']}", "display": m["name"], "size": m.get("size", 0)} for m in models]
    except:
        result["providers"]["ollama"] = []
    
    # Check z-ai availability
    import os
    zai_key = os.environ.get("ZAI_API_KEY")
    if zai_key:
        result["providers"]["z-ai"] = [
            {"name": "z-ai:glm-5", "display": "GLM-5"},
            {"name": "z-ai:glm-4.7", "display": "GLM-4.7"},
            {"name": "z-ai:glm-4.6", "display": "GLM-4.6"},
            {"name": "z-ai:glm-4.5", "display": "GLM-4.5"}
        ]
    else:
        result["providers"]["z-ai"] = []
    
    # Check OpenAI/Codex availability
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        result["providers"]["codex"] = [
            {"name": "codex:gpt-4o", "display": "GPT-4o"},
            {"name": "codex:gpt-4o-mini", "display": "GPT-4o Mini"},
            {"name": "codex:gpt-4-turbo", "display": "GPT-4 Turbo"}
        ]
    else:
        result["providers"]["codex"] = []
    
    return result


@app.post("/api/models")
async def set_model(request: ModelRequest):
    """Set the active AI model."""
    try:
        recreate_generator(request.model)
        return {"success": True, "model": request.model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Current provider tracking
_current_provider: str = "ollama"


def recreate_generator(model: str) -> LevelGenerator:
    """Recreate the generator with a new model/provider."""
    global _generator, _current_model, _current_provider
    
    # Parse model string (format: "provider:model")
    if ":" in model:
        provider, model_name = model.split(":", 1)
        _current_provider = provider
        _current_model = model_name
    else:
        # Default to ollama if just model name
        provider = "ollama"
        model_name = model
        _current_provider = provider
        _current_model = model_name
    
    try:
        if provider == "ollama":
            _generator = create_generator(client_type="ollama", model=model_name, base_url="http://192.168.68.76:11434")
        elif provider == "z-ai":
            # Use the model name directly for Z-AI
            _generator = create_generator(client_type="z-ai", model=model_name)
        elif provider == "codex":
            _generator = create_generator(client_type="codex", model=model_name)
        else:
            _generator = create_generator(client_type="ollama", model=model_name, base_url="http://192.168.68.76:11434")
        
        logger.info(f"Level generator recreated with {provider}:{model_name}")
    except Exception as e:
        logger.error(f"Failed to recreate generator: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to switch to model {model}")
    return _generator


@app.post("/api/generate")
async def generate_level(request: GenerationRequest):
    """Generate a new level."""
    try:
        # Switch model if requested
        if request.model and request.model != _current_model:
            generator = recreate_generator(request.model)
        else:
            generator = get_generator()
        
        # Fetch custom entity types if project_id provided
        custom_entities_info = ""
        if request.project_id:
            import database as db
            entity_types = db.get_entity_types(request.project_id)
            if entity_types:
                custom_entities_info = "\n\nCustom entity types for this project:\n"
                for et in entity_types:
                    rules = f" - Placement: {et['placement_rules']}" if et.get('placement_rules') else ""
                    behavior = f" - Behavior: {et['behavior']}" if et.get('behavior') else ""
                    
                    # Parse and include metadata fields
                    metadata_info = ""
                    try:
                        fields = json.loads(et.get('metadata_fields', '[]'))
                        if fields:
                            metadata_info = " - Metadata fields:"
                            for field in fields:
                                metadata_info += f"\n    * {field.get('name', 'unknown')} ({field.get('type', 'text')}): {field.get('description', '')} [default: {field.get('default', '')}]"
                    except:
                        pass
                    
                    custom_entities_info += f"- {et['emoji']} {et['name']} ({et['collision_type']}): {et.get('description', '')}{rules}{behavior}{metadata_info}\n"
        
        logger.info(f"Generating {request.genre} level, difficulty: {request.difficulty}")
        
        # Add custom entities to requirements
        full_requirements = request.requirements or "Create an engaging level"
        if custom_entities_info:
            full_requirements += custom_entities_info
        
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
                    requirements=full_requirements,
                    theme=request.theme
                )
        elif request.genre == "puzzle":
            result = generator.generate_puzzle(
                difficulty=request.difficulty,
                requirements=full_requirements
            )
        elif request.genre == "shooter":
            result = generator.generate_shooter(
                difficulty=request.difficulty,
                requirements=full_requirements
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
        error_str = str(e)
        # Translate common Chinese error messages
        if "令牌已过期" in error_str or "401" in error_str:
            error_detail = f"API authentication failed. Please check your {_current_provider} API key."
        elif "rate limit" in error_str.lower():
            error_detail = f"Rate limit exceeded. Please wait and try again."
        else:
            error_detail = f"Generation failed using {_current_provider}:{_current_model} - {error_str}"
        raise HTTPException(status_code=500, detail=error_detail)


def is_rate_limit_error(error_str: str) -> bool:
    """Check if an error is a rate limit or quota error."""
    error_lower = error_str.lower()
    return any(x in error_lower for x in [
        "rate limit", "quota", "429", "too many requests", 
        "limit exceeded", "requests per", "usage limit"
    ])


def generate_with_fallback(generator, genre, level_type, difficulty, full_requirements, theme, abilities, custom_entities=None):
    """Try generation with current model, fall back to Ollama on rate limits."""
    global _generator, _current_model, _current_provider
    
    try:
        # Try primary model
        if genre == "platformer":
            if level_type == "metroidvania":
                return generator.generate_metroidvania(
                    difficulty=difficulty,
                    abilities=abilities or ["double_jump", "dash"],
                    theme=theme
                )
            else:
                return generator.generate_platformer(
                    difficulty=difficulty,
                    requirements=full_requirements,
                    theme=theme,
                    custom_entities=custom_entities
                )
        elif genre == "puzzle":
            return generator.generate_puzzle(
                difficulty=difficulty,
                requirements=full_requirements
            )
        elif genre == "shooter":
            return generator.generate_shooter(
                difficulty=difficulty,
                requirements=full_requirements
            )
    except Exception as e:
        error_str = str(e)
        # If rate limit, try fallback to Ollama
        if is_rate_limit_error(error_str) and _current_provider != "ollama":
            logger.warning(f"Rate limit hit, falling back to Ollama: {error_str}")
            try:
                fallback_generator = create_generator(
                    client_type="ollama", 
                    model="llama3.2:latest", 
                    base_url="http://192.168.68.76:11434"
                )
                if genre == "platformer":
                    if level_type == "metroidvania":
                        return fallback_generator.generate_metroidvania(
                            difficulty=difficulty,
                            abilities=abilities or ["double_jump", "dash"],
                            theme=theme
                        )
                    else:
                        return fallback_generator.generate_platformer(
                            difficulty=difficulty,
                            requirements=full_requirements,
                            theme=theme,
                            custom_entities=custom_entities
                        )
                elif genre == "puzzle":
                    return fallback_generator.generate_puzzle(
                        difficulty=difficulty,
                        requirements=full_requirements
                    )
                elif genre == "shooter":
                    return fallback_generator.generate_shooter(
                        difficulty=difficulty,
                        requirements=full_requirements
                    )
            except Exception as fallback_error:
                logger.error(f"Fallback also failed: {fallback_error}")
                raise fallback_error
        else:
            raise e


async def generate_level_events(request: GenerationRequest):
    """Generate a level with SSE progress events."""
    try:
        # Switch model if requested
        if request.model and request.model != _current_model:
            generator = recreate_generator(request.model)
        else:
            generator = get_generator()
        
        # Fetch custom entity types if project_id provided
        custom_entities = None
        custom_entities_info = ""
        if request.project_id:
            import database as db
            entity_types = db.get_entity_types(request.project_id)
            if entity_types:
                custom_entities = entity_types
                custom_entities_info = "\n\nUsing custom entity types from this project."
        
        # Send "preparing" step
        yield f"data: {json.dumps({'event': 'progress', 'step': 'preparing', 'message': 'Preparing prompt...', 'progress': 10})}\n\n"
        await asyncio.sleep(0.1)
        
        # Add custom entities to requirements
        full_requirements = request.requirements or "Create an engaging level"
        
        # Check for supported genre
        if request.genre not in ["platformer", "puzzle", "shooter"]:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Unsupported genre: {request.genre}'})}\n\n"
            return
        
        # Send "generating" step
        yield f"data: {json.dumps({'event': 'progress', 'step': 'generating', 'message': f'AI is generating level ({_current_provider}:{_current_model})...', 'progress': 40})}\n\n"
        await asyncio.sleep(0.1)
        
        # Generate with automatic fallback to Ollama
        try:
            result = generate_with_fallback(
                generator=generator,
                genre=request.genre,
                level_type=request.level_type,
                difficulty=request.difficulty,
                full_requirements=full_requirements,
                theme=request.theme,
                abilities=request.abilities,
                custom_entities=custom_entities
            )
        except Exception as gen_error:
            if is_rate_limit_error(str(gen_error)):
                yield f"data: {json.dumps({'event': 'progress', 'step': 'fallback', 'message': 'Rate limit hit, falling back to Ollama...', 'progress': 45})}\n\n"
                await asyncio.sleep(0.1)
                # Retry the whole generation with Ollama
                generator = create_generator(client_type="ollama", model="llama3.2:latest", base_url="http://192.168.68.76:11434")
                result = generate_with_fallback(
                    generator=generator,
                    genre=request.genre,
                    level_type=request.level_type,
                    difficulty=request.difficulty,
                    full_requirements=full_requirements,
                    theme=request.theme,
                    abilities=request.abilities,
                    custom_entities=custom_entities
                )
            else:
                raise gen_error
        
        # Send "parsing" step  
        yield f"data: {json.dumps({'event': 'progress', 'step': 'parsing', 'message': 'Parsing AI response...', 'progress': 70})}\n\n"
        await asyncio.sleep(0.1)
        
        # Send "validating" step
        yield f"data: {json.dumps({'event': 'progress', 'step': 'validating', 'message': 'Validating level data...', 'progress': 85})}\n\n"
        await asyncio.sleep(0.1)
        
        if result.success:
            level_response = result.level.model_dump()
            
            # Save the level to the database if project_id is provided
            if request.project_id:
                try:
                    import database as db
                    level_id = db.create_level(
                        project_id=request.project_id,
                        name=f"{request.theme.title()} {request.genre.capitalize()} - {request.difficulty.title()}",
                        genre=request.genre,
                        difficulty=request.difficulty,
                        level_type=request.level_type,
                        theme=request.theme,
                        level_data=json.dumps(result.level.model_dump())
                    )
                    logger.info(f"Level saved to database with ID: {level_id}")
                    
                    # Fetch the complete level from DB to return
                    levels = db.get_levels(request.project_id)
                    saved_level = next((l for l in levels if l[0] == level_id), None)
                    
                    if saved_level:
                        level_response = {
                            "id": saved_level[0],
                            "name": saved_level[1],
                            "genre": saved_level[2],
                            "difficulty": saved_level[3],
                            "level_type": saved_level[4],
                            "theme": saved_level[5],
                            "level_data": saved_level[6],
                            "version": saved_level[7],
                            "created_at": saved_level[8],
                            "updated_at": saved_level[9]
                        }
                    else:
                        level_response["id"] = level_id
                        
                except Exception as save_error:
                    logger.error(f"Failed to save level: {save_error}")
                    # Still return success, just won't have DB ID
            
            yield f"data: {json.dumps({'event': 'progress', 'step': 'complete', 'message': 'Level generated successfully!', 'progress': 100})}\n\n"
            await asyncio.sleep(0.1)
            
            yield f"data: {json.dumps({'event': 'result', 'success': True, 'level': level_response})}\n\n"
        else:
            yield f"data: {json.dumps({'event': 'error', 'message': result.error or 'Generation failed'})}\n\n"
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generation error: {e}")
        error_str = str(e)
        if "令牌已过期" in error_str or "401" in error_str:
            error_detail = f"API authentication failed. Please check your {_current_provider} API key."
        elif "rate limit" in error_str.lower():
            error_detail = f"Rate limit exceeded. Please wait and try again."
        else:
            error_detail = f"Generation failed using {_current_provider}:{_current_model} - {error_str}"
        
        yield f"data: {json.dumps({'event': 'error', 'message': error_detail})}\n\n"


@app.post("/api/generate/stream")
async def generate_level_stream(request: GenerationRequest):
    """Generate a new level with streaming progress events."""
    return StreamingResponse(
        generate_level_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


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
        error_str = str(e)
        if "令牌已过期" in error_str or "401" in error_str:
            error_detail = f"API authentication failed. Please check your {_current_provider} API key."
        elif "rate limit" in error_str.lower():
            error_detail = f"Rate limit exceeded. Please wait and try again."
        else:
            error_detail = f"Refinement failed using {_current_provider}:{_current_model} - {error_str}"
        raise HTTPException(status_code=500, detail=error_detail)


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
        "level_type": l[4], "theme": l[5], "level_data": l[6], "version": l[7], "created_at": l[8], "updated_at": l[9]
    } for l in levels]


@app.get("/api/levels/{level_id}")
async def get_level_by_id(level_id: int):
    """Get a single level with full data."""
    from database import get_level
    level = get_level(level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")
    return level


class RenameLevelRequest(BaseModel):
    name: str


@app.post("/api/levels/{level_id}/rename")
async def rename_level(level_id: int, request: RenameLevelRequest):
    """Rename a level."""
    from database import rename_level, get_level

    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    success = rename_level(level_id, request.name.strip())
    if not success:
        raise HTTPException(status_code=404, detail="Level not found")

    level = get_level(level_id)
    return {"success": True, "level": level}


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


# Entity Type endpoints
class CreateEntityTypeRequest(BaseModel):
    name: str
    emoji: str = '📦'
    color: str = '#6366f1'
    description: str = None
    placement_rules: str = None
    behavior: str = None
    collision_type: str = 'neutral'
    metadata_fields: str = '[]'  # JSON array of field definitions


class UpdateEntityTypeRequest(BaseModel):
    name: str = None
    emoji: str = None
    color: str = None
    description: str = None
    placement_rules: str = None
    behavior: str = None
    collision_type: str = None
    metadata_fields: str = None


@app.post("/api/projects/{project_id}/entity-types")
async def create_entity_type(project_id: int, request: CreateEntityTypeRequest):
    """Create a new entity type for a project."""
    import database as db
    
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    entity_type_id = db.create_entity_type(
        project_id=project_id,
        name=request.name,
        emoji=request.emoji,
        color=request.color,
        description=request.description,
        placement_rules=request.placement_rules,
        behavior=request.behavior,
        collision_type=request.collision_type,
        metadata_fields=request.metadata_fields
    )
    return {"id": entity_type_id, "name": request.name}


@app.get("/api/projects/{project_id}/entity-types")
async def get_entity_types(project_id: int):
    """Get all entity types for a project."""
    import database as db
    return db.get_entity_types(project_id)


@app.get("/api/entity-types/{entity_type_id}")
async def get_entity_type(entity_type_id: int):
    """Get a single entity type."""
    import database as db
    entity_type = db.get_entity_type(entity_type_id)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return entity_type


@app.put("/api/entity-types/{entity_type_id}")
async def update_entity_type(entity_type_id: int, request: UpdateEntityTypeRequest):
    """Update an entity type."""
    import database as db
    success = db.update_entity_type(
        entity_type_id,
        name=request.name,
        emoji=request.emoji,
        color=request.color,
        description=request.description,
        placement_rules=request.placement_rules,
        behavior=request.behavior,
        collision_type=request.collision_type,
        metadata_fields=request.metadata_fields
    )
    if not success:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return {"success": True}


@app.delete("/api/entity-types/{entity_type_id}")
async def delete_entity_type(entity_type_id: int):
    """Delete an entity type."""
    import database as db
    success = db.delete_entity_type(entity_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
