"""
LevelForge prompt templates for level generation.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class GenerationPrompt:
    """A prompt template for level generation."""
    system: str
    user: str
    
    def format(self, **kwargs) -> tuple[str, str]:
        """Format the prompt with given parameters."""
        return self.format_system(**kwargs), self.format_user(**kwargs)
    
    def format_system(self, **kwargs) -> str:
        return self.system.format(**kwargs)
    
    def format_user(self, **kwargs) -> str:
        return self.user.format(**kwargs)


def build_entity_types_section(custom_entities: List[Dict[str, Any]] = None) -> str:
    """Build the entity types section for prompts, using custom entities if available."""
    if custom_entities and len(custom_entities) > 0:
        # Use custom entity types from the project
        entity_list = []
        for et in custom_entities:
            entity_desc = f"- {et['name']}: {et.get('description', 'No description')}"
            if et.get('placement_rules'):
                entity_desc += f" Placement: {et['placement_rules']}"
            if et.get('behavior'):
                entity_desc += f" Behavior: {et['behavior']}"
            entity_list.append(entity_desc)
        
        return f"""Use ONLY these entity types defined for this project:
{chr(10).join(entity_list)}

Each entity must have: type (entity name), x, y coordinates.
You can also include optional properties: name, behavior, metadata"""
    else:
        # Fallback to generic types
        return """Entity types: player_spawn, goal, coin, key, enemy_basic, enemy_flying, enemy_patrol, spike, lava, powerup

Each entity must have: type, x, y coordinates."""


def get_platformer_prompt(
    difficulty: str = "medium",
    requirements: str = "5-7 platforms, 3-5 enemies, 5-8 coins",
    theme: str = "default",
    custom_entities: List[Dict[str, Any]] = None
) -> tuple[str, str]:
    """Get the system and user prompts for platformer generation."""
    
    entity_types_section = build_entity_types_section(custom_entities)
    
    system_prompt = f"""You are a professional game level designer. Your task is to create game levels in JSON format.

CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown, no text outside the JSON.

Level schema:
{{
  "version": "1.0",
  "genre": "platformer",
  "type": "linear",
  "theme": "theme name",
  "difficulty": "easy|medium|hard|expert",
  "platforms": [{{"x": 0, "y": 480, "width": 500, "height": 30}}, ...],
  "entities": [
    {{"type": "player_spawn", "x": 50, "y": 450}},
    {{"type": "goal", "x": 450, "y": 80}},
    {{"type": "enemy", "x": 200, "y": 380, "patrol_range": [150, 250]}},
    {{"type": "coin", "x": 100, "y": 350}}
  ],
  "metadata": {{"estimated_duration_seconds": 120, "difficulty_score": 5.5}}
}}

{entity_types_section}

Platform requirements:
- Include a ground platform at y >= 450
- Platforms should be reachable with standard jumping
- Mix of easy (bottom) to hard (top) sections
- Use reasonable jump distances (100-200px for medium difficulty)

REQUIRED: Include at least one player_spawn, one goal, and distribute entities throughout the level."""

    user_prompt = f"""Create a {difficulty} difficulty platformer level with the following requirements:

{requirements}

Theme: {theme}

Generate ONLY valid JSON, no other text."""
    
    return system_prompt, user_prompt


# Keep old templates for backward compatibility
PLATFORMER_LINEAR = GenerationPrompt(
    system="""You are a professional game level designer. Your task is to create game levels in JSON format.

CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown, no text outside the JSON.

Level schema:
{
  "version": "1.0",
  "genre": "platformer",
  "type": "linear",
  "theme": "theme name",
  "difficulty": "easy|medium|hard|expert",
  "platforms": [{"x": 0, "y": 480, "width": 500, "height": 30}, ...],
  "entities": [
    {"type": "player_spawn", "x": 50, "y": 450},
    {"type": "goal", "x": 450, "y": 80},
    {"type": "enemy_basic", "x": 200, "y": 380, "patrol_range": [150, 250]},
    {"type": "coin", "x": 100, "y": 350}
  ],
  "metadata": {"estimated_duration_seconds": 120, "difficulty_score": 5.5}
}

Entity types: player_spawn, goal, coin, key, enemy_basic, enemy_flying, enemy_patrol, spike, lava, powerup

Platform requirements:
- Include a ground platform at y >= 450
- Platforms should be reachable with standard jumping
- Mix of easy (bottom) to hard (top) sections
- Use reasonable jump distances (100-200px for medium difficulty)

REQUIRED: Include at least 5-8 coins distributed throughout the level. Also include a player_spawn, a goal, and 2-4 enemies.""",
    
    user="""Create a {difficulty} difficulty platformer level with the following requirements:

{requirements}

Theme: {theme}

Generate ONLY valid JSON, no other text."""
)


PLATFORMER_METROIDVANIA = GenerationPrompt(
    system="""You are a professional game level designer specializing in metroidvania games. Your task is to create complex game levels with gating and progression.

CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown, no text outside the JSON.

Metroidvania level schema:
{
  "version": "2.5",
  "genre": "platformer",
  "type": "metroidvania",
  "theme": "theme name",
  "difficulty": "easy|medium|hard|expert",
  "abilities": ["double_jump", "dash", "wall_jump", "grapple"],
  "platforms": [...],
  "entities": [
    {"type": "player_spawn", "x": 50, "y": 450},
    {"type": "ability_pickup", "x": 150, "y": 300, "property": "double_jump"},
    {"type": "key", "x": 300, "y": 200, "item_id": "key_red"},
    {"type": "door", "x": 400, "y": 150, "requires_item": "key_red"},
    {"type": "goal", "x": 450, "y": 80}
  ],
  "goals": [
    {"id": "goal_1", "type": "collectible", "item_id": "key_red"}
  ],
  "gates": [
    {"id": "gate_1", "type": "soft|hard", "requires_ability": "double_jump"|"requires_item": "key_red", "position": {"x": 300, "y": 200}}
  ],
  "metadata": {"estimated_duration_seconds": 300, "difficulty_score": 6.5}
}

Key principles:
- Player starts with basic abilities (jump)
- New abilities unlock access to new areas
- Gates require specific abilities or items
- Create a sense of progression and exploration
- Include backtracking opportunities""",
    
    user="""Create a {difficulty} difficulty metroidvania level with:

- Available abilities: {abilities}
- Required gates: {gates}
- Number of collectible keys: {key_count}
- Theme: {theme}

Generate ONLY valid JSON, no other text."""
)


PUZZLE = GenerationPrompt(
    system="""You are a puzzle game level designer. Your task is to create puzzle levels with logical solutions.

CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown.

Puzzle level schema:
{
  "version": "1.0",
  "genre": "puzzle",
  "type": "linear",
  "difficulty": "easy|medium|hard|expert",
  "platforms": [...],
  "entities": [
    {"type": "player_spawn", "x": 50, "y": 450},
    {"type": "switch", "x": 200, "y": 400, "property": "trigger_id": "switch_1"},
    {"type": "door", "x": 300, "y": 350, "property": "requires": "switch_1"},
    {"type": "goal", "x": 400, "y": 300}
  ],
  "metadata": {"estimated_duration_seconds": 60, "difficulty_score": 4.0}
}

Puzzle element types:
- switch: triggers something when stepped on
- door: blocks path until triggered
- pressure_plate: requires weight to activate
- key: collectible to unlock doors
- button: manually activated switch""",
    
    user="""Create a {difficulty} puzzle level with {puzzle_type} puzzle mechanics.

Requirements: {requirements}

Generate ONLY valid JSON."""
)


SHOOTER = GenerationPrompt(
    system="""You are a shooter game level designer. Your task is to create engaging combat arenas.

CRITICAL: You MUST output ONLY valid JSON.

Shooter level schema:
{
  "version": "1.0",
  "genre": "shooter",
  "type": "linear|arena",
  "difficulty": "easy|medium|hard|expert",
  "platforms": [...],
  "entities": [
    {"type": "player_spawn", "x": 50, "y": 450},
    {"type": "enemy_basic", "x": 200, "y": 380, "patrol_range": [150, 250], "behavior": "patrol|stationary|chase"},
    {"type": "enemy_flying", "x": 300, "y": 200, "behavior": "hover"},
    {"type": "cover", "x": 150, "y": 400},
    {"type": "ammo", "x": 250, "y": 350},
    {"type": "goal", "x": 450, "y": 80}
  ],
  "metadata": {"estimated_duration_seconds": 180, "difficulty_score": 5.0}
}

Combat considerations:
- Provide cover positions for the player
- Place enemies in interesting formations
- Include ammo/health pickups
- Create flow from combat encounter to encounter""",
    
    user="""Create a {difficulty} {subgenre} shooter level.

Requirements: {requirements}

Generate ONLY valid JSON."""
)


# Refinement prompts
REFINE_MAKE_HARDER = GenerationPrompt(
    system="You are a game level designer. Modify the given level to increase difficulty.",
    
    user="""Make this level HARDER by:
{modifications}

Original level:
{original_level}

Output the modified level as JSON only."""
)


REFINE_ADD_PLATFORMS = GenerationPrompt(
    system="You are a game level designer. Add elements to an existing level.",
    
    user="""Add the following to this level:
{additions}

Original level:
{original_level}

Output the modified level as JSON only."""
)


# Player capabilities prompt
PLAYER_CAPABILITIES = GenerationPrompt(
    system="You are a game designer specializing in player character mechanics.",
    
    user="""Create a PlayerCapabilities JSON for a {preset_style} game.

The configuration should include:
- Physics parameters (gravity, jump height, speed)
- Abilities (double_jump, dash, wall_jump, grapple, etc.)
- Combat parameters if applicable

Output JSON only."""
)


def get_metroidvania_prompt(
    difficulty: str = "medium",
    abilities: list = None,
    gates: str = "2 ability gates",
    key_count: int = 2,
    theme: str = "default"
) -> GenerationPrompt:
    """Get the appropriate prompt for metroidvania generation."""
    return PLATFORMER_METROIDVANIA


def get_refine_prompt(
    modification_type: str,
    original_level: str,
    modifications: str
) -> GenerationPrompt:
    """Get a refinement prompt."""
    if modification_type == "harder":
        return REFINE_MAKE_HARDER
    return REFINE_ADD_PLATFORMS
