"""
LevelForge FastAPI backend.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import json
import logging
import asyncio
import random
import sse_starlette.sse as sse

from levelforge.src.core.generation.generator import LevelGenerator, create_generator
from levelforge.src.ai.clients.llm_client import LLMFactory
from levelforge.src.core.grid import MovementSpec, GeneratorKnobs, generate_level

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
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:4173", "http://localhost:3000", "http://192.168.68.72:5173", "http://192.168.68.72:4173", "http://192.168.68.76:5173", "http://192.168.68.76:4173"],
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
            _generator = create_generator(client_type="ollama", model=_current_model, base_url=_get_ollama_url())
            logger.info(f"Level generator initialized with model {_current_model}")
        except Exception as e:
            logger.error(f"Failed to initialize generator: {e}")
            raise HTTPException(status_code=500, detail="AI client not available")
    return _generator


# Request models

class LevelPlanRequest(BaseModel):
    """Structured knobs for the procedural level generator."""
    seed: Optional[int] = None              # None = random each time
    level_width: int = 32
    level_height: int = 32
    difficulty: float = 0.5                 # 0.0–1.0
    verticality: float = 0.3                # 0.0–1.0
    hazard_density: float = 0.1             # 0.0–1.0
    target_foothold_count: int = 8          # 4–16
    allow_ladders: bool = False
    style_tags: List[str] = []
    entity_requirements: List[dict] = []
    level_name: Optional[str] = None
    model: Optional[str] = None
    project_id: Optional[int] = None


class InterpretRequest(BaseModel):
    """Natural-language description to parse into a LevelPlanRequest."""
    description: str
    model: Optional[str] = None


class RefinementRequest(BaseModel):
    level_data: dict
    modification: str
    model: Optional[str] = None


class ModelRequest(BaseModel):
    model: str


class ApiKeysRequest(BaseModel):
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    gemini: Optional[str] = None
    grok: Optional[str] = None
    deepseek: Optional[str] = None
    mistral: Optional[str] = None
    zai: Optional[str] = None
    ollama_url: Optional[str] = None


def _get_ollama_url() -> str:
    """Return the configured Ollama URL from DB, with fallback."""
    import database as db
    return db.get_app_setting("ollama_url") or "http://192.168.68.76:11434"


def _get_stored_key(provider: str, env_var: Optional[str]) -> Optional[str]:
    """Return API key from DB if set, otherwise fall back to env var."""
    import database as db
    import os
    key = db.get_app_setting(f"api_key_{provider}")
    if key:
        return key
    return os.environ.get(env_var) if env_var else None


def _mask_key(key: Optional[str]) -> Optional[str]:
    """Return a masked version of an API key for display."""
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return key[:4] + "****" + key[-4:]


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

    # Ollama (local — no key needed)
    import database as db
    ollama_url = db.get_app_setting("ollama_url") or "http://192.168.68.76:11434"
    try:
        resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        models = resp.json().get("models", [])
        result["providers"]["ollama"] = [
            {"name": f"ollama:{m['name']}", "display": m["name"], "size": m.get("size", 0)}
            for m in models
        ]
    except:
        result["providers"]["ollama"] = []

    # OpenAI
    openai_key = _get_stored_key("openai", "OPENAI_API_KEY")
    if openai_key:
        result["providers"]["openai"] = [
            {"name": "openai:gpt-4o", "display": "GPT-4o"},
            {"name": "openai:gpt-4o-mini", "display": "GPT-4o Mini"},
            {"name": "openai:gpt-4-turbo", "display": "GPT-4 Turbo"},
            {"name": "openai:o3-mini", "display": "o3 Mini"},
        ]
    else:
        result["providers"]["openai"] = []

    # Anthropic
    anthropic_key = _get_stored_key("anthropic", "ANTHROPIC_API_KEY")
    if anthropic_key:
        result["providers"]["anthropic"] = [
            {"name": "anthropic:claude-opus-4-6", "display": "Claude Opus 4.6"},
            {"name": "anthropic:claude-sonnet-4-6", "display": "Claude Sonnet 4.6"},
            {"name": "anthropic:claude-haiku-4-5-20251001", "display": "Claude Haiku 4.5"},
            {"name": "anthropic:claude-3-5-sonnet-20241022", "display": "Claude 3.5 Sonnet"},
        ]
    else:
        result["providers"]["anthropic"] = []

    # Google Gemini
    gemini_key = _get_stored_key("gemini", "GOOGLE_API_KEY") or _get_stored_key("gemini", "GEMINI_API_KEY")
    if gemini_key:
        result["providers"]["gemini"] = [
            {"name": "gemini:gemini-2.0-flash", "display": "Gemini 2.0 Flash"},
            {"name": "gemini:gemini-1.5-pro", "display": "Gemini 1.5 Pro"},
            {"name": "gemini:gemini-1.5-flash", "display": "Gemini 1.5 Flash"},
        ]
    else:
        result["providers"]["gemini"] = []

    # xAI Grok
    grok_key = _get_stored_key("grok", "XAI_API_KEY")
    if grok_key:
        result["providers"]["grok"] = [
            {"name": "grok:grok-2-latest", "display": "Grok 2"},
            {"name": "grok:grok-2-mini", "display": "Grok 2 Mini"},
        ]
    else:
        result["providers"]["grok"] = []

    # DeepSeek
    deepseek_key = _get_stored_key("deepseek", "DEEPSEEK_API_KEY")
    if deepseek_key:
        result["providers"]["deepseek"] = [
            {"name": "deepseek:deepseek-chat", "display": "DeepSeek Chat"},
            {"name": "deepseek:deepseek-reasoner", "display": "DeepSeek Reasoner"},
        ]
    else:
        result["providers"]["deepseek"] = []

    # Mistral
    mistral_key = _get_stored_key("mistral", "MISTRAL_API_KEY")
    if mistral_key:
        result["providers"]["mistral"] = [
            {"name": "mistral:mistral-large-latest", "display": "Mistral Large"},
            {"name": "mistral:mistral-small-latest", "display": "Mistral Small"},
        ]
    else:
        result["providers"]["mistral"] = []

    # Z-AI (GLM)
    zai_key = _get_stored_key("zai", "ZAI_API_KEY")
    if zai_key:
        result["providers"]["z-ai"] = [
            {"name": "z-ai:glm-4-plus", "display": "GLM-4 Plus"},
            {"name": "z-ai:glm-4-flash", "display": "GLM-4 Flash"},
        ]
    else:
        result["providers"]["z-ai"] = []

    return result


@app.get("/api/settings/keys")
async def get_api_keys():
    """Get configured API key status (masked values) for all providers."""
    import database as db

    providers = [
        ("openai", "OPENAI_API_KEY"),
        ("anthropic", "ANTHROPIC_API_KEY"),
        ("gemini", "GOOGLE_API_KEY"),
        ("grok", "XAI_API_KEY"),
        ("deepseek", "DEEPSEEK_API_KEY"),
        ("mistral", "MISTRAL_API_KEY"),
        ("zai", "ZAI_API_KEY"),
    ]
    import os as _os
    result = {}
    for provider, env_var in providers:
        db_key = db.get_app_setting(f"api_key_{provider}")
        env_key = _os.environ.get(env_var)
        active_key = db_key or env_key
        result[provider] = {
            "configured": bool(active_key),
            "masked_key": _mask_key(active_key),
            "source": "db" if db_key else ("env" if env_key else None),
        }
    result["ollama_url"] = {
        "configured": True,
        "value": db.get_app_setting("ollama_url") or "http://192.168.68.76:11434",
    }
    return result


@app.post("/api/settings/keys")
async def save_api_keys(request: ApiKeysRequest):
    """Save API keys and Ollama URL to the database."""
    import database as db

    saved = []
    cleared = []

    key_map = {
        "openai": request.openai,
        "anthropic": request.anthropic,
        "gemini": request.gemini,
        "grok": request.grok,
        "deepseek": request.deepseek,
        "mistral": request.mistral,
        "zai": request.zai,
    }

    for provider, value in key_map.items():
        if value is None:
            continue  # Not included in request — leave unchanged
        if value.strip() == "":
            db.delete_app_setting(f"api_key_{provider}")
            cleared.append(provider)
        else:
            db.set_app_setting(f"api_key_{provider}", value.strip())
            saved.append(provider)

    if request.ollama_url is not None:
        url = request.ollama_url.strip()
        if url:
            db.set_app_setting("ollama_url", url)
        else:
            db.delete_app_setting("ollama_url")

    return {"success": True, "saved": saved, "cleared": cleared}


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
    else:
        provider = "ollama"
        model_name = model

    _current_provider = provider
    _current_model = model_name

    import database as db

    try:
        if provider == "ollama":
            ollama_url = db.get_app_setting("ollama_url") or "http://192.168.68.76:11434"
            _generator = create_generator(client_type="ollama", model=model_name, base_url=ollama_url)
        elif provider in ("openai", "codex"):
            api_key = _get_stored_key("openai", "OPENAI_API_KEY")
            _generator = create_generator(client_type="openai", model=model_name, api_key=api_key)
        elif provider == "anthropic":
            api_key = _get_stored_key("anthropic", "ANTHROPIC_API_KEY")
            _generator = create_generator(client_type="anthropic", model=model_name, api_key=api_key)
        elif provider == "gemini":
            api_key = _get_stored_key("gemini", "GOOGLE_API_KEY") or _get_stored_key("gemini", "GEMINI_API_KEY")
            _generator = create_generator(client_type="gemini", model=model_name, api_key=api_key)
        elif provider == "grok":
            api_key = _get_stored_key("grok", "XAI_API_KEY")
            _generator = create_generator(client_type="grok", model=model_name, api_key=api_key)
        elif provider == "deepseek":
            api_key = _get_stored_key("deepseek", "DEEPSEEK_API_KEY")
            _generator = create_generator(client_type="deepseek", model=model_name, api_key=api_key)
        elif provider == "mistral":
            api_key = _get_stored_key("mistral", "MISTRAL_API_KEY")
            _generator = create_generator(client_type="mistral", model=model_name, api_key=api_key)
        elif provider == "z-ai":
            api_key = _get_stored_key("zai", "ZAI_API_KEY")
            _generator = create_generator(client_type="z-ai", model=model_name, api_key=api_key)
        else:
            ollama_url = db.get_app_setting("ollama_url") or "http://192.168.68.76:11434"
            _generator = create_generator(client_type="ollama", model=model_name, base_url=ollama_url)

        logger.info(f"Level generator recreated with {provider}:{model_name}")
    except Exception as e:
        logger.error(f"Failed to recreate generator: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to switch to model {model}")
    return _generator


def _complete_json(raw: str) -> str:
    """Close any unclosed JSON brackets/braces in a truncated LLM response."""
    stack = []
    in_string = False
    escape = False
    for ch in raw:
        if escape:
            escape = False
        elif ch == '\\' and in_string:
            escape = True
        elif ch == '"':
            in_string = not in_string
        elif not in_string:
            if ch in ('{', '['):
                stack.append('}' if ch == '{' else ']')
            elif ch in ('}', ']') and stack:
                stack.pop()
    return raw + ''.join(reversed(stack))


@app.post("/api/interpret-level-plan")
async def interpret_level_plan(request: InterpretRequest):
    """Use the active LLM to parse a natural-language description into LevelPlan knobs."""
    from levelforge.src.ai.prompts.templates import get_level_plan_prompt

    if request.model and request.model != _current_model:
        recreate_generator(request.model)

    generator = get_generator()
    system, user = get_level_plan_prompt(request.description)

    try:
        raw = generator.client.generate_with_system(system, user, model=generator.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    # Strip any accidental markdown fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rstrip("`").strip()

    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        # Truncated response — try closing any unclosed brackets/braces
        try:
            plan = json.loads(_complete_json(raw))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=422, detail=f"LLM did not return valid JSON: {e}\nRaw: {raw[:200]}")

    # Clamp and validate numeric fields
    plan["level_width"] = max(8, min(256, int(plan.get("level_width", 32))))
    plan["level_height"] = max(8, min(256, int(plan.get("level_height", 32))))
    plan["difficulty"]    = max(0.0, min(1.0, float(plan.get("difficulty",    0.5))))
    plan["verticality"]   = max(0.0, min(1.0, float(plan.get("verticality",   0.3))))
    plan["hazard_density"] = max(0.0, min(1.0, float(plan.get("hazard_density", 0.1))))
    plan["target_foothold_count"] = max(4, min(16, int(plan.get("target_foothold_count", 8))))
    plan["allow_ladders"] = bool(plan.get("allow_ladders", False))
    plan["style_tags"]    = [str(t).lower() for t in plan.get("style_tags", [])][:8]
    if "seed" not in plan or plan["seed"] is None:
        plan["seed"] = random.randint(0, 2**31)
    else:
        plan["seed"] = max(0, int(plan["seed"]))

    return plan


def _get_project_tile_size(project_id: Optional[int]) -> int:
    """Best-effort project tile size lookup; falls back to 32."""
    if project_id is None:
        return 32
    try:
        import database as db
        project = db.get_project(project_id)
        if project and isinstance(project, dict):
            return int(project.get("tile_size") or 32)
    except Exception:
        pass
    return 32


def _tile_center_to_world(tile_x: int, tile_y: int, tile_size: int) -> tuple[int, int]:
    """Convert tile-grid coordinates to world-space pixel center coordinates."""
    x = int(round((tile_x + 0.5) * tile_size))
    y = int(round((tile_y + 0.5) * tile_size))
    return x, y


def _run_procedural_generation(request: LevelPlanRequest) -> dict:
    """Build knobs, run the procedural generator, and return serialised level_data."""
    seed = request.seed if request.seed is not None else random.randint(0, 2**31)

    # Harder difficulty → narrower footholds (less room for error)
    inv = 1.0 - request.difficulty
    knobs = GeneratorKnobs(
        target_foothold_count=request.target_foothold_count,
        min_foothold_width=max(2, 2 + round(inv * 2)),   # 2–4
        max_foothold_width=max(3, 3 + round(inv * 2)),   # 3–5 (reduced to avoid clearance conflicts)
        verticality=request.verticality,
        difficulty=request.difficulty,
        allow_ladders=request.allow_ladders,
    )
    # More footholds need a larger horizontal jump budget so the last step
    # can always reach GOAL_X_MIN even when early steps consumed more x-space.
    jump_dist = 6 if request.target_foothold_count >= 10 else 5
    spec = MovementSpec(max_jump_height=4, max_jump_distance=jump_dist, max_safe_drop=6)

    result = generate_level(seed, knobs, spec)

    rng = random.Random(seed)
    tile_size = _get_project_tile_size(request.project_id)

    entities = _place_entities(
        footholds=result.footholds,
        entity_requirements=request.entity_requirements,
        project_id=request.project_id,
        rng=rng,
        tile_size=tile_size,
    )

    spawn_x, spawn_y = _tile_center_to_world(
        result.footholds[0].x + result.footholds[0].width // 2,
        result.footholds[0].y,
        tile_size,
    )
    goal_x, goal_y = _tile_center_to_world(
        result.footholds[-1].x + result.footholds[-1].width // 2,
        result.footholds[-1].y,
        tile_size,
    )

    plan_dict = {
        "seed": seed,
        "level_width": max(8, min(256, int(request.level_width))),
        "level_height": max(8, min(256, int(request.level_height))),
        "difficulty": request.difficulty,
        "verticality": request.verticality,
        "hazard_density": request.hazard_density,
        "target_foothold_count": request.target_foothold_count,
        "allow_ladders": request.allow_ladders,
        "style_tags": request.style_tags,
    }

    return {
        "version": "2.0",
        "kind": "procedural",
        "level_plan": plan_dict,
        "canvas_width": max(8, min(256, int(request.level_width))),
        "canvas_height": max(8, min(256, int(request.level_height))),
        "semantic_grid": result.grid.toJSON(),
        "footholds": [{"x": fh.x, "y": fh.y, "width": fh.width} for fh in result.footholds],
        "entities": entities,
        "platforms": [],
        "player_spawn": {"x": spawn_x, "y": spawn_y},
        "goal": {"x": goal_x, "y": goal_y},
        "seed_used": result.seed_used,
        "attempts": result.attempts,
    }


def _select_footholds_for_placement(footholds: list, hint: str) -> list:
    """Return a foothold subset guided by natural-language placement hints."""
    if not footholds:
        return []

    text = (hint or "").lower()
    n = len(footholds)

    if any(w in text for w in ["start", "beginning", "first", "early"]):
        return footholds[:max(1, n // 3)]

    if any(w in text for w in ["end", "goal", "finish", "last", "late"]):
        return footholds[max(0, (2 * n) // 3):]

    if "middle" in text or "center" in text:
        middle = footholds[n // 4:(3 * n) // 4]
        return middle or footholds

    if any(w in text for w in ["wide", "large", "big"]):
        wide = [fh for fh in footholds if fh.width >= 3]
        return wide or footholds

    if any(w in text for w in ["sparse", "sparsely", "rarely"]):
        sparse = [fh for i, fh in enumerate(footholds) if i % 2 == 0]
        return sparse or footholds

    return footholds


def _place_entities(
    footholds: list,
    entity_requirements: list,
    project_id: Optional[int],
    rng: random.Random,
    tile_size: int = 32,
) -> list:
    """Generate concrete entities from requirements + entity type placement/behavior rules."""
    if not footholds or not entity_requirements:
        return []

    entity_type_by_id = {}
    if project_id is not None:
        try:
            import database as db
            db_entity_types = db.get_entity_types(project_id)
            entity_type_by_id = {et.get("id"): et for et in db_entity_types}
        except Exception as e:
            logger.warning(f"Failed to load entity types for project {project_id}: {e}")

    entities = []
    # Track occupied tile positions across all entity types to prevent overlaps.
    occupied_tiles: set[tuple[int, int]] = set()

    def _pick_tile(foothold) -> tuple[int, int]:
        """Return an unoccupied tile on foothold; falls back to any tile if all occupied."""
        # Try random positions first (fast path for sparse footholds)
        for _ in range(20):
            tx = foothold.x + rng.randint(0, max(0, foothold.width - 1))
            ty = foothold.y
            if (tx, ty) not in occupied_tiles:
                return tx, ty
        # Linear scan to find any free tile
        for tx in range(foothold.x, foothold.x + max(1, foothold.width)):
            if (tx, foothold.y) not in occupied_tiles:
                return tx, foothold.y
        # Last resort: return a random position (foothold truly full)
        return foothold.x + rng.randint(0, max(0, foothold.width - 1)), foothold.y

    for req in entity_requirements:
        if not isinstance(req, dict):
            continue

        try:
            count = max(1, int(req.get("count", 1)))
        except (TypeError, ValueError):
            count = 1

        entity_id = req.get("entityId")
        req_name = (req.get("entityName") or "entity").strip() or "entity"
        req_placement = req.get("placement") or ""

        et = entity_type_by_id.get(entity_id, {}) if entity_id is not None else {}
        entity_name = (et.get("name") or req_name).strip() or req_name
        behavior = et.get("behavior") or ""
        placement_rules = et.get("placement_rules") or ""

        combined_hint = f"{req_placement} {placement_rules}".strip()
        pool = _select_footholds_for_placement(footholds, combined_hint)
        if not pool:
            pool = footholds

        if any(w in combined_hint.lower() for w in ["cluster", "grouped", "together"]):
            anchor = rng.choice(pool)
            cluster_pool = [
                fh for fh in pool
                if abs(fh.x - anchor.x) <= 4 and abs(fh.y - anchor.y) <= 3
            ]
            if cluster_pool:
                pool = cluster_pool

        for i in range(count):
            # Start at the preferred foothold and cycle through the pool until we
            # find a foothold that has at least one free tile slot.
            tile_x, tile_y = None, None
            for attempt in range(len(pool)):
                foothold = pool[(i + attempt) % len(pool)]
                tx, ty = _pick_tile(foothold)
                if (tx, ty) not in occupied_tiles:
                    tile_x, tile_y = tx, ty
                    break
            # If every foothold in the pool is full, use the preferred one anyway.
            if tile_x is None:
                foothold = pool[i % len(pool)]
                tile_x, tile_y = _pick_tile(foothold)

            occupied_tiles.add((tile_x, tile_y))
            x, y = _tile_center_to_world(tile_x, tile_y, tile_size)

            entities.append({
                "type": entity_name,
                "name": f"{entity_name} {len([e for e in entities if e.get('type') == entity_name]) + 1}",
                "x": x,
                "y": y,
                "behavior": behavior,
                "placement_hint": req_placement,
            })

    return entities


async def generate_level_events(request: LevelPlanRequest):
    """Generate a level with SSE progress events (procedural generator)."""
    try:
        yield f"data: {json.dumps({'event': 'progress', 'step': 'preparing', 'message': 'Building generation knobs...', 'progress': 20})}\n\n"
        await asyncio.sleep(0.05)

        yield f"data: {json.dumps({'event': 'progress', 'step': 'generating', 'message': 'Running procedural generator...', 'progress': 50})}\n\n"
        await asyncio.sleep(0.05)

        level_data = _run_procedural_generation(request)

        yield f"data: {json.dumps({'event': 'progress', 'step': 'saving', 'message': 'Saving level...', 'progress': 85})}\n\n"
        await asyncio.sleep(0.05)

        level_response = {"level_data": json.dumps(level_data)}

        if request.project_id:
            try:
                import database as db
                tags_str  = ", ".join(request.style_tags) if request.style_tags else "generated"
                level_name = request.level_name or f"Procedural Level ({tags_str}, d={request.difficulty:.2f})"
                level_id = db.create_level(
                    project_id=request.project_id,
                    name=level_name,
                    genre="platformer",
                    difficulty=str(round(request.difficulty, 2)),
                    level_type="grid",
                    theme=tags_str,
                    level_data=json.dumps(level_data),
                )
                logger.info(f"Procedural level saved with ID: {level_id}")

                levels = db.get_levels(request.project_id)
                saved = next((l for l in levels if l[0] == level_id), None)
                if saved:
                    level_response = {
                        "id": saved[0], "name": saved[1], "genre": saved[2],
                        "difficulty": saved[3], "level_type": saved[4], "theme": saved[5],
                        "level_data": saved[6], "version": saved[7],
                        "created_at": saved[8], "updated_at": saved[9],
                    }
                else:
                    level_response["id"] = level_id
            except Exception as save_err:
                logger.error(f"Failed to save level: {save_err}")

        yield f"data: {json.dumps({'event': 'progress', 'step': 'complete', 'message': 'Level generated successfully!', 'progress': 100})}\n\n"
        await asyncio.sleep(0.05)
        yield f"data: {json.dumps({'event': 'result', 'success': True, 'level': level_response})}\n\n"

    except Exception as e:
        logger.error(f"Generation error: {e}")
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"


@app.post("/api/generate/stream")
async def generate_level_stream(request: LevelPlanRequest):
    """Generate a new procedural level with streaming progress events."""
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
    description: Optional[str] = None
    placement_rules: Optional[str] = None
    behavior: Optional[str] = None
    collision_type: str = 'neutral'
    metadata_fields: str = '[]'  # JSON array of field definitions


class UpdateEntityTypeRequest(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    placement_rules: Optional[str] = None
    behavior: Optional[str] = None
    collision_type: Optional[str] = None
    metadata_fields: Optional[str] = None


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


# Tile Type endpoints
class CreateTileTypeRequest(BaseModel):
    name: str
    color: str = '#808080'
    description: Optional[str] = None
    collision_type: str = 'solid'
    friction: float = 1.0
    damage: int = 0
    category: str = 'terrain'
    metadata: str = '{}'


class UpdateTileTypeRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    collision_type: Optional[str] = None
    friction: Optional[float] = None
    damage: Optional[int] = None
    category: Optional[str] = None
    metadata: Optional[str] = None


class UpdateTileSizeRequest(BaseModel):
    tile_size: int


@app.post("/api/projects/{project_id}/tile-types")
async def create_tile_type(project_id: int, request: CreateTileTypeRequest):
    """Create a new tile type for a project."""
    import database as db
    
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tile_type_id = db.create_tile_type(
        project_id=project_id,
        name=request.name,
        color=request.color,
        description=request.description,
        collision_type=request.collision_type,
        friction=request.friction,
        damage=request.damage,
        category=request.category,
        metadata=request.metadata
    )
    return {"id": tile_type_id, "name": request.name}


@app.get("/api/projects/{project_id}/tile-types")
async def get_tile_types(project_id: int):
    """Get all tile types for a project."""
    import database as db
    return db.get_tile_types(project_id)


@app.get("/api/tile-types/{tile_type_id}")
async def get_tile_type(tile_type_id: int):
    """Get a single tile type."""
    import database as db
    tile_type = db.get_tile_type(tile_type_id)
    if not tile_type:
        raise HTTPException(status_code=404, detail="Tile type not found")
    return tile_type


@app.put("/api/tile-types/{tile_type_id}")
async def update_tile_type(tile_type_id: int, request: UpdateTileTypeRequest):
    """Update a tile type."""
    import database as db
    success = db.update_tile_type(
        tile_type_id,
        name=request.name,
        color=request.color,
        description=request.description,
        collision_type=request.collision_type,
        friction=request.friction,
        damage=request.damage,
        category=request.category,
        metadata=request.metadata
    )
    if not success:
        raise HTTPException(status_code=404, detail="Tile type not found")
    return {"success": True}


@app.delete("/api/tile-types/{tile_type_id}")
async def delete_tile_type(tile_type_id: int):
    """Delete a tile type."""
    import database as db
    success = db.delete_tile_type(tile_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tile type not found")
    return {"success": True}


@app.put("/api/projects/{project_id}/tile-size")
async def update_project_tile_size(project_id: int, request: UpdateTileSizeRequest):
    """Update a project's tile size."""
    import database as db
    if request.tile_size < 8 or request.tile_size > 128:
        raise HTTPException(status_code=400, detail="Tile size must be between 8 and 128")
    success = db.update_project_tile_size(project_id, request.tile_size)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True, "tile_size": request.tile_size}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
